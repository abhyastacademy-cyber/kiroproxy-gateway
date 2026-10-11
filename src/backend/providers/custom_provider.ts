import type { CustomProvider } from '../config/index.js';
import type { ChatMessage } from './gemini_provider.js';

export class CustomProviderService {
  /**
   * Executes a streaming request with automatic failover across multiple baseUrls and apiKeys.
   */
  public async executeWithFailover(
    provider: CustomProvider,
    messages: ChatMessage[],
    requestedModel: string,
    onChunk: (chunk: string) => void
  ): Promise<string> {
    const urls = provider.baseUrls.filter(Boolean);
    const keys = provider.apiKeys.length > 0 ? provider.apiKeys : [''];

    if (urls.length === 0) {
      throw new Error(`Provider ${provider.name} has no valid baseUrls configured.`);
    }

    let rawModel = provider.modelMapping?.[requestedModel] || provider.activeModel || requestedModel;
    if (rawModel.startsWith('ngrok-gemini-') || rawModel.startsWith('canvas-') || rawModel.startsWith('ngrok-')) {
      rawModel = rawModel.includes('pro') ? 'gemini-2.5-pro' : 'gemini-3.8-flash';
    } else if (rawModel === 'gemini-2.5-flash') {
      rawModel = 'gemini-3.8-flash';
    }
    const targetModel = rawModel;
    let lastError: Error | null = null;

    // Iterate through base URLs in failover order
    for (let uIdx = 0; uIdx < urls.length; uIdx++) {
      const baseUrl = urls[uIdx].replace(/\/+$/, '');
      const apiKey = keys[uIdx % keys.length] || '';

      try {
        const fullResponse = await this.streamFromEndpoint(
          baseUrl,
          apiKey,
          messages,
          targetModel,
          onChunk
        );
        return fullResponse;
      } catch (err: any) {
        lastError = err;
        console.warn(`[CustomProvider] Failover on ${provider.name}: URL ${baseUrl} failed (${err.message}). Trying next...`);
      }
    }

    throw lastError || new Error(`All endpoints for provider ${provider.name} failed.`);
  }

  private async streamFromEndpoint(
    baseUrl: string,
    apiKey: string,
    messages: ChatMessage[],
    model: string,
    onChunk: (chunk: string) => void
  ): Promise<string> {
    // Normalise endpoint (support both base url like https://openrouter.ai/api/v1 or generativelanguage)
    let endpoint = baseUrl;
    if (endpoint.includes('generativelanguage.googleapis.com')) {
      endpoint = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
      if (apiKey) {
        endpoint += `?key=${encodeURIComponent(apiKey)}`;
      }
    } else if (!endpoint.endsWith('/chat/completions')) {
      if (endpoint.endsWith('/v1') || endpoint.endsWith('/v1beta/openai')) {
        endpoint += '/chat/completions';
      } else {
        endpoint += '/v1/chat/completions';
      }
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'text/event-stream, application/json',
    };
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    const body = JSON.stringify({
      model,
      messages,
      stream: true,
      max_tokens: 4096,
      temperature: 0.7,
    });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45000);

    try {
      const resp = await fetch(endpoint, {
        method: 'POST',
        headers,
        body,
        signal: controller.signal,
      });

      if (!resp.ok) {
        const errText = await resp.text().catch(() => '');
        throw new Error(`HTTP ${resp.status}: ${errText.substring(0, 300)}`);
      }

      if (!resp.body) {
        throw new Error('Response body is null');
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let fullText = '';
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith(':')) continue;
          if (trimmed === 'data: [DONE]') continue;

          if (trimmed.startsWith('data: ')) {
            const jsonStr = trimmed.slice(6);
            try {
              const parsed = JSON.parse(jsonStr);
              const delta = parsed.choices?.[0]?.delta?.content || parsed.choices?.[0]?.text || '';
              if (delta) {
                fullText += delta;
                onChunk(delta);
              }
            } catch {
              // Ignore partial JSON chunks
            }
          }
        }
      }

      // If no chunks were streamed (e.g. non-streaming response)
      if (!fullText && buffer.trim()) {
        try {
          const parsed = JSON.parse(buffer.trim());
          const content = parsed.choices?.[0]?.message?.content || parsed.choices?.[0]?.text || '';
          if (content) {
            fullText = content;
            onChunk(content);
          }
        } catch {
          // Ignore
        }
      }

      return fullText;
    } finally {
      clearTimeout(timeout);
    }
  }
}

export const customProviderService = new CustomProviderService();
