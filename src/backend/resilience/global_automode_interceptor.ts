import { RICH_MODEL_CATALOG, type ModelCatalogEntry } from '../config/catalog.js';
import {
  KILO_FREE_MODELS,
  OPENROUTER_FREE_MODELS,
  CLINE_FREE_MODELS,
  ORCAROUTER_FREE_MODELS,
  GEMINI_ROTATION_MODELS,
} from '../providers/otomode.js';

const originalFetch = globalThis.fetch;

export const PROVIDER_FREE_MODELS: Record<string, string[]> = {
  'api.kilo.ai': [...KILO_FREE_MODELS],
  'api.cline.bot': [...CLINE_FREE_MODELS],
  'openrouter.ai': [...OPENROUTER_FREE_MODELS],
  'api.orcarouter.ai': [...ORCAROUTER_FREE_MODELS],
  'generativelanguage.googleapis.com': [...GEMINI_ROTATION_MODELS],
  'api.groq.com': ['openai/gpt-oss-120b', 'openai/gpt-oss-20b', 'qwen/qwen3.8-27b'],
  'devgateway.space-z.ai': ['glm-5.3-flash', 'glm-5.3', 'glm-5.2'],
  'corset-decipher-vocation.ngrok-free.dev': ['gemini-2.5-flash'],
};

export const PROVIDER_PRIORITY_ORDER: string[] = [
  'api.groq.com',
  'devgateway.space-z.ai',
  'api.kilo.ai',
  'api.cline.bot',
  'openrouter.ai',
  'api.orcarouter.ai',
  'generativelanguage.googleapis.com',
  'corset-decipher-vocation.ngrok-free.dev',
];

/**
 * Dynamically synchronize PROVIDER_FREE_MODELS from auto-populated model catalog
 */
export function syncFromCatalog(models: ModelCatalogEntry[]): void {
  if (!Array.isArray(models)) return;
  const nonChatPattern = /(?:lyria|content-safety|embedding|imagen|veo|aqa|tts|whisper|moderation)/i;

  const domainMap: Record<string, string> = {
    kilo: 'api.kilo.ai',
    cline: 'api.cline.bot',
    openrouter: 'openrouter.ai',
    orcarouter: 'api.orcarouter.ai',
    orca: 'api.orcarouter.ai',
    gemini: 'generativelanguage.googleapis.com',
  };

  for (const m of models) {
    if (!m || m.modelId === 'global-automode' || m.modelId.endsWith('-otomode')) continue;
    if (m.rateMultiplier !== 0 && (m as any).category !== 'free') continue;
    const slug = m.upstreamSlug || m.modelId;
    if (!slug || slug === 'kilo-auto/small' || nonChatPattern.test(slug)) continue;

    let domain: string | null = null;
    if ((m as any).provider === 'custom' && (m as any)._customProvider && (m as any)._customProvider.baseUrl) {
      domain = extractDomain((m as any)._customProvider.baseUrl);
    } else if (domainMap[(m as any).provider]) {
      domain = domainMap[(m as any).provider];
    }

    if (domain) {
      if (!PROVIDER_FREE_MODELS[domain]) {
        PROVIDER_FREE_MODELS[domain] = [];
      }
      if (!PROVIDER_FREE_MODELS[domain].includes(slug)) {
        PROVIDER_FREE_MODELS[domain].push(slug);
      }
      if (!PROVIDER_PRIORITY_ORDER.includes(domain)) {
        PROVIDER_PRIORITY_ORDER.push(domain);
      }
    }
  }
}

/**
 * Extract domain hostname from URL string
 */
export function extractDomain(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname;
  } catch (e: any) {
    return '';
  }
}

/**
 * Custom fetch implementation with multi-provider failover
 */
export async function customFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const url = typeof input === 'string' ? input : (input as Request).url || input.toString();

  // Single-URL passthrough (optimization)
  if (!url || !url.includes(',')) {
    return originalFetch(input, init);
  }

  // Multi-provider detected — sort by priority order
  const rawUrls = url.split(',').map((u) => u.trim());
  const providerUrls = rawUrls.sort((a, b) => {
    const domA = extractDomain(a);
    const domB = extractDomain(b);
    const idxA = PROVIDER_PRIORITY_ORDER.indexOf(domA);
    const idxB = PROVIDER_PRIORITY_ORDER.indexOf(domB);
    const rankA = idxA === -1 ? 999 : idxA;
    const rankB = idxB === -1 ? 999 : idxB;
    return rankA - rankB;
  });

  let lastError: any = null;
  let lastResponse: Response | null = null;

  for (let i = 0; i < providerUrls.length; i++) {
    const providerUrl = providerUrls[i];
    const domain = extractDomain(providerUrl);
    const models = PROVIDER_FREE_MODELS[domain] || [];

    if (models.length === 0) {
      try {
        const response = await originalFetch(providerUrl, init);
        if (response.status >= 200 && response.status < 400) {
          return response;
        }
        lastResponse = response;
      } catch (err: any) {
        lastError = err;
      }
      continue;
    }

    for (let j = 0; j < models.length; j++) {
      const model = models[j];

      try {
        let mutatedBody = init.body;
        if (init.body && typeof init.body === 'string') {
          try {
            const bodyObj = JSON.parse(init.body);
            bodyObj.model = model;
            mutatedBody = JSON.stringify(bodyObj);
          } catch (parseErr) {
            // Keep original body if JSON parse fails
          }
        }

        const mutatedInit = { ...init, body: mutatedBody };
        const response = await originalFetch(providerUrl, mutatedInit);

        if (response.status >= 200 && response.status < 400) {
          return response;
        }

        lastResponse = response;
        if (
          response.status === 429 ||
          response.status === 401 ||
          response.status === 402 ||
          response.status === 403 ||
          response.status === 404 ||
          response.status === 422 ||
          response.status >= 500
        ) {
          continue;
        }
      } catch (fetchErr: any) {
        lastError = fetchErr;
        continue;
      }
    }
  }

  if (lastResponse) return lastResponse;
  if (lastError) throw lastError;

  throw new Error('GlobalAutomode: All providers and models exhausted');
}

/**
 * Install the global fetch interceptor
 */
export function installGlobalAutomodeInterceptor(): void {
  globalThis.fetch = customFetch as any;
  syncFromCatalog(RICH_MODEL_CATALOG);
  console.log('[GlobalAutomode] Interceptor installed with multi-provider failover support');
}

/**
 * Restore original fetch
 */
export function uninstallGlobalAutomodeInterceptor(): void {
  globalThis.fetch = originalFetch;
  console.log('[GlobalAutomode] Original fetch restored');
}
