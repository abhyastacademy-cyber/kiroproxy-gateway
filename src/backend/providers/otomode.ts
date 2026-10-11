import { configManager } from '../config/index.js';
import type { ChatMessage } from './gemini_provider.js';

// Top free models catalog for Kilo, OpenRouter, and OrcaRouter otomode rotation
export const KILO_FREE_MODELS = [
  'meta-llama/llama-3.3-70b-instruct:free',
  'deepseek/deepseek-chat:free',
  'qwen/qwen-2.5-72b-instruct:free',
  'google/gemini-2.0-flash-exp:free',
  'mistralai/mistral-small-24b-instruct-2501:free',
  'meta-llama/llama-3.1-8b-instruct:free',
  'qwen/qwen-2.5-coder-32b-instruct:free',
  'nousresearch/hermes-3-llama-3.1-405b:free',
  'microsoft/phi-3-medium-128k-instruct:free',
  'cognitivecomputations/dolphin3.0-r1-mistral-24b:free',
];

export const OPENROUTER_FREE_MODELS = [
  'meta-llama/llama-3.3-70b-instruct:free',
  'deepseek/deepseek-chat:free',
  'google/gemini-2.0-flash-exp:free',
  'qwen/qwen-2.5-72b-instruct:free',
  'mistralai/mistral-small-24b-instruct-2501:free',
  'meta-llama/llama-3.1-8b-instruct:free',
  'openrouter/auto',
];

export const GEMINI_ROTATION_MODELS = [
  'gemini-3.8-flash',
  'gemini-2.5-pro',
  'gemini-2.0-flash-exp',
  'gemini-1.5-flash',
  'gemini-1.5-pro',
];

export const ORCAROUTER_FREE_MODELS = [
  'meta-llama/llama-3.3-70b-instruct:free',
  'deepseek/deepseek-chat:free',
  'qwen/qwen-2.5-72b-instruct:free',
];

export const CLINE_FREE_MODELS = [
  'meta-llama/llama-3.3-70b-instruct:free',
  'deepseek/deepseek-chat:free',
  'qwen/qwen-2.5-72b-instruct:free',
];

export type OtomodeType = 'kilo' | 'openrouter' | 'cline' | 'orcarouter' | 'gemini';

export interface OtomodeRunOptions {
  messages: ChatMessage[];
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
}

/**
 * Executes intra-provider model & key rotation for a given provider otomode.
 */
export async function runProviderOtomode(
  otomode: OtomodeType,
  options: OtomodeRunOptions,
  onChunk: (chunk: string) => void
): Promise<{ text: string; modelUsed: string; providerUsed: string }> {
  const config = configManager.getConfig();

  let candidateModels: string[] = [];
  let candidateBaseUrls: string[] = [];
  let candidateApiKeys: string[] = [];

  switch (otomode) {
    case 'kilo': {
      candidateModels = KILO_FREE_MODELS;
      candidateBaseUrls = [
        'https://api.kilo.ai/v1',
        'https://openrouter.ai/api/v1',
      ];
      candidateApiKeys = (config as any).kiloApiKeys || [];
      if ((config as any).kiloApiKey) candidateApiKeys.push((config as any).kiloApiKey);
      if (candidateApiKeys.length === 0) candidateApiKeys.push(''); // Zero-key gateway mode
      break;
    }
    case 'openrouter': {
      candidateModels = OPENROUTER_FREE_MODELS;
      candidateBaseUrls = ['https://openrouter.ai/api/v1'];
      candidateApiKeys = (config as any).openrouterApiKeys || [];
      if ((config as any).providers?.openrouter?.apiKey) {
        candidateApiKeys.push((config as any).providers.openrouter.apiKey);
      }
      if (candidateApiKeys.length === 0) candidateApiKeys.push('');
      break;
    }
    case 'cline': {
      candidateModels = CLINE_FREE_MODELS;
      candidateBaseUrls = ['https://api.cline.bot/v1', 'https://openrouter.ai/api/v1'];
      candidateApiKeys = (config as any).clineApiKeys || [];
      if ((config as any).clineApiKey) candidateApiKeys.push((config as any).clineApiKey);
      if (candidateApiKeys.length === 0) candidateApiKeys.push('');
      break;
    }
    case 'orcarouter': {
      candidateModels = ORCAROUTER_FREE_MODELS;
      candidateBaseUrls = ['https://api.orcarouter.com/v1', 'https://openrouter.ai/api/v1'];
      candidateApiKeys = (config as any).orcarouterApiKeys || [];
      if (candidateApiKeys.length === 0) candidateApiKeys.push('');
      break;
    }
    case 'gemini': {
      candidateModels = GEMINI_ROTATION_MODELS;
      candidateBaseUrls = [];
      candidateApiKeys = (config as any).geminiApiKeys || [];
      if (config.geminiApiKey) candidateApiKeys.push(config.geminiApiKey);
      break;
    }
  }

  // If gemini otomode, rotate across Gemini models using direct Gemini provider
  if (otomode === 'gemini') {
    const { geminiProvider } = await import('./gemini_provider.js');
    let lastGeminiErr: Error | null = null;
    for (const m of candidateModels) {
      try {
        const text = await geminiProvider.streamGenerate(
          options.messages,
          options.systemPrompt,
          m,
          onChunk
        );
        return { text, modelUsed: m, providerUsed: 'gemini-otomode' };
      } catch (err: any) {
        lastGeminiErr = err;
        console.warn(`[gemini-otomode] Model ${m} failed (${err.message}). Trying next candidate...`);
      }
    }
    throw lastGeminiErr || new Error('All models in gemini-otomode rotation failed.');
  }

  // For HTTP/SSE providers (kilo, openrouter, cline, orcarouter):
  // Rotate through models and keys
  let lastError: Error | null = null;

  for (const model of candidateModels) {
    for (const baseUrl of candidateBaseUrls) {
      for (const apiKey of candidateApiKeys) {
        try {
          const endpoint = baseUrl.endsWith('/chat/completions')
            ? baseUrl
            : `${baseUrl.replace(/\/+$/, '')}/chat/completions`;

          const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'Accept': 'text/event-stream, application/json',
            'HTTP-Referer': 'https://kiroproxy.ai.studio',
            'X-Title': 'KiroProxy Cloud Gateway v2.8.0',
          };
          if (apiKey) {
            headers['Authorization'] = `Bearer ${apiKey}`;
          }

          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 20000);

          try {
            const resp = await fetch(endpoint, {
              method: 'POST',
              headers,
              body: JSON.stringify({
                model,
                messages: options.messages,
                stream: true,
                max_tokens: options.maxTokens || 4096,
                temperature: options.temperature || 0.7,
              }),
              signal: controller.signal,
            });

            if (!resp.ok) {
              const errBody = await resp.text().catch(() => '');
              throw new Error(`HTTP ${resp.status}: ${errBody.substring(0, 200)}`);
            }

            if (!resp.body) throw new Error('No response body');

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
                if (!trimmed || trimmed.startsWith(':') || trimmed === 'data: [DONE]') continue;
                if (trimmed.startsWith('data: ')) {
                  try {
                    const parsed = JSON.parse(trimmed.slice(6));
                    const delta = parsed.choices?.[0]?.delta?.content || parsed.choices?.[0]?.text || '';
                    if (delta) {
                      fullText += delta;
                      onChunk(delta);
                    }
                  } catch {}
                }
              }
            }

            if (fullText.trim().length > 0) {
              return {
                text: fullText,
                modelUsed: model,
                providerUsed: `${otomode}-otomode`,
              };
            }
          } finally {
            clearTimeout(timeout);
          }
        } catch (err: any) {
          lastError = err;
          // Rotate silently to next free model
        }
      }
    }
  }

  throw lastError || new Error(`All candidate models for ${otomode}-otomode failed.`);
}
