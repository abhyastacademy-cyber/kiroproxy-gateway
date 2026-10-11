import { configManager } from '../config/index.js';
import type { ChatMessage } from './gemini_provider.js';

// Top free models catalog for Kilo, OpenRouter, Cline, OrcaRouter, and Gemini otomode rotation
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
  'gemini-3-flash-preview',
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
      candidateApiKeys = config.kiloApiKeys || [];
      if (config.kiloApiKey && !candidateApiKeys.includes(config.kiloApiKey)) {
        candidateApiKeys.push(config.kiloApiKey);
      }
      if (candidateApiKeys.length === 0) candidateApiKeys.push(''); // Zero-key gateway mode
      break;
    }
    case 'openrouter': {
      candidateModels = OPENROUTER_FREE_MODELS;
      candidateBaseUrls = ['https://openrouter.ai/api/v1'];
      candidateApiKeys = config.openrouterApiKeys || [];
      if (config.openrouterApiKey && !candidateApiKeys.includes(config.openrouterApiKey)) {
        candidateApiKeys.push(config.openrouterApiKey);
      }
      if (candidateApiKeys.length === 0) candidateApiKeys.push('');
      break;
    }
    case 'cline': {
      candidateModels = CLINE_FREE_MODELS;
      candidateBaseUrls = ['https://api.cline.bot/v1', 'https://openrouter.ai/api/v1'];
      candidateApiKeys = config.clineApiKeys || [];
      if (config.clineApiKey && !candidateApiKeys.includes(config.clineApiKey)) {
        candidateApiKeys.push(config.clineApiKey);
      }
      if (candidateApiKeys.length === 0) candidateApiKeys.push('');
      break;
    }
    case 'orcarouter': {
      candidateModels = ORCAROUTER_FREE_MODELS;
      candidateBaseUrls = ['https://api.orcarouter.com/v1', 'https://openrouter.ai/api/v1'];
      candidateApiKeys = config.orcarouterApiKeys || [];
      if (config.orcarouterApiKey && !candidateApiKeys.includes(config.orcarouterApiKey)) {
        candidateApiKeys.push(config.orcarouterApiKey);
      }
      if (candidateApiKeys.length === 0) candidateApiKeys.push('');
      break;
    }
    case 'gemini': {
      candidateModels = GEMINI_ROTATION_MODELS;
      candidateBaseUrls = [];
      candidateApiKeys = config.geminiApiKeys || [];
      if (config.geminiApiKey && !candidateApiKeys.includes(config.geminiApiKey)) {
        candidateApiKeys.push(config.geminiApiKey);
      }
      if (process.env.GEMINI_API_KEY && !candidateApiKeys.includes(process.env.GEMINI_API_KEY)) {
        candidateApiKeys.push(process.env.GEMINI_API_KEY);
      }
      break;
    }
  }

  // If gemini otomode, rotate across Gemini models and keys using direct Gemini provider
  if (otomode === 'gemini') {
    const { geminiProvider } = await import('./gemini_provider.js');
    let lastGeminiErr: Error | null = null;

    const keysToTry = candidateApiKeys.length > 0 ? candidateApiKeys : [''];
    for (const m of candidateModels) {
      for (const k of keysToTry) {
        try {
          const text = await geminiProvider.streamGenerate(
            options.messages,
            options.systemPrompt,
            m,
            onChunk,
            k || undefined
          );
          return { text, modelUsed: m, providerUsed: 'gemini-otomode' };
        } catch (err: any) {
          lastGeminiErr = err;
          console.warn(`[gemini-otomode] Model ${m} failed (${err.message}). Trying next candidate...`);
        }
      }
    }
    throw lastGeminiErr || new Error('All models in gemini-otomode rotation failed.');
  }

  // For HTTP/SSE providers (kilo, openrouter, cline, orcarouter):
  let lastError: Error | null = null;
  const hasRealKey = candidateApiKeys.some((k) => k && k.trim().length > 0);
  const modelsToTry = hasRealKey ? candidateModels : candidateModels.slice(0, 1);
  const timeoutMs = hasRealKey ? 10000 : 1500;

  for (const baseUrl of candidateBaseUrls) {
    let baseUrlFailed = false;

    for (const apiKey of candidateApiKeys) {
      if (baseUrlFailed) break;

      for (const model of modelsToTry) {
        if (baseUrlFailed) break;

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
          const timeout = setTimeout(() => controller.abort(), timeoutMs);

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
              baseUrlFailed = true;
              const errBody = await resp.text().catch(() => '');
              throw new Error(`HTTP ${resp.status}: ${errBody.substring(0, 100)}`);
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
          if (
            !hasRealKey ||
            err.message.includes('AUTH_FAILED') ||
            err.name === 'AbortError' ||
            err.message.includes('fetch failed')
          ) {
            baseUrlFailed = true;
            break;
          }
        }
      }
    }
  }

  throw lastError || new Error(`All candidate models for ${otomode}-otomode failed.`);
}
