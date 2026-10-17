import type { CustomProvider } from '../config/index.js';
import type { ChatMessage } from './gemini_provider.js';

export class CustomProviderService {
  /**
   * Executes a streaming request with automatic failover across multiple baseUrls and multi-key rotation.
   */
  public async executeWithFailover(
    provider: CustomProvider,
    messages: ChatMessage[],
    requestedModel: string,
    onChunk: (chunk: string) => void
  ): Promise<string> {
    const urls = (Array.isArray(provider.baseUrls) && provider.baseUrls.length > 0 ? provider.baseUrls : [provider.baseUrl || ''])
      .map((u) => u.trim())
      .filter(Boolean);

    const keys = (Array.isArray(provider.apiKeys) && provider.apiKeys.length > 0 ? provider.apiKeys : [provider.apiKey || ''])
      .map((k) => k.trim());

    if (keys.length === 0) {
      keys.push('');
    }

    // Auto-Authenticated Backend AI Access (AI Studio / Cloud Platform)
    if (provider.id === 'backend-ai' || provider.baseUrl?.startsWith('internal://') || (Array.isArray(provider.baseUrls) && provider.baseUrls.some(u => u.startsWith('internal://')))) {
      const { geminiProvider } = await import('./gemini_provider.js');
      const targetGeminiModel = provider.modelMapping?.[requestedModel] ||
        provider.modelMapping?.[requestedModel.replace(/^backend-ai\//, '')] ||
        provider.defaultModel ||
        'gemini-flash-latest';

      try {
        return await geminiProvider.streamGenerate(
          messages,
          undefined,
          targetGeminiModel,
          onChunk
        );
      } catch (gemErr: any) {
        console.warn(`[CustomProvider:BackendAI] Gemini server key failed (${gemErr.message}). Cascading to secondary auto-auth zero-cost fallback...`);
        const { runProviderOtomode } = await import('./otomode.js');
        const otoRes = await runProviderOtomode('kilo', { messages, targetModel: 'kilo-auto/free' }, onChunk);
        return otoRes.text;
      }
    }

    if (urls.length === 0) {
      throw new Error(`Provider ${provider.name} has no valid baseUrls configured.`);
    }

    const modelWithoutPrefix = requestedModel.includes('/') ? requestedModel.split('/')[1] : requestedModel;
    const isMatchingProvider = requestedModel.toLowerCase().startsWith(provider.id.toLowerCase() + '/') ||
      requestedModel.toLowerCase().startsWith(provider.name.toLowerCase().replace(/\s+/g, '-') + '/');

    let rawModel = provider.modelMapping?.[requestedModel] ||
      provider.modelMapping?.[modelWithoutPrefix] ||
      (isMatchingProvider ? modelWithoutPrefix : (provider.activeModel || requestedModel));

    if (rawModel.startsWith('ngrok-gemini-') || rawModel.startsWith('canvas-') || rawModel.startsWith('ngrok-')) {
      rawModel = rawModel.includes('pro') ? 'gemini-2.5-pro' : 'gemini-2.5-flash';
    }
    const targetModel = rawModel;
    let lastError: Error | null = null;

    // Outer loop: Iterate through base URLs in failover priority order
    for (let uIdx = 0; uIdx < urls.length; uIdx++) {
      const baseUrl = urls[uIdx].replace(/\/+$/, '');

      // Inner loop: Try all API keys for this base URL before failing over to next base URL
      for (let kIdx = 0; kIdx < keys.length; kIdx++) {
        const apiKey = keys[kIdx];

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
          const errMsg = err?.message || String(err);
          console.warn(
            `[CustomProvider] ${provider.name} failover: URL #${uIdx + 1} (${baseUrl}) with Key #${kIdx + 1} failed (${errMsg.substring(0, 150)}). Trying next candidate...`
          );
        }
      }
    }

    throw lastError || new Error(`All endpoints and API keys for provider ${provider.name} failed.`);
  }

  private async streamFromEndpoint(
    baseUrl: string,
    apiKey: string,
    messages: ChatMessage[],
    model: string,
    onChunk: (chunk: string) => void
  ): Promise<string> {
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
      'HTTP-Referer': 'https://kiroproxy.ai.studio',
      'X-Title': 'KiroProxy Cloud Gateway v2.8.0',
    };
    const isPlaceholder = !apiKey || apiKey === 'auto-authenticated' || apiKey.startsWith('MY_') || apiKey.includes('YOUR_');
    if (apiKey && !isPlaceholder) {
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
    const timeout = setTimeout(() => controller.abort(), 20000);

    try {
      const resp = await fetch(endpoint, {
        method: 'POST',
        headers,
        body,
        signal: controller.signal,
      });

      if (!resp.ok) {
        const errText = await resp.text().catch(() => '');
        throw new Error(`HTTP ${resp.status}: ${errText.substring(0, 200)}`);
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

      // If non-streaming response was returned
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
