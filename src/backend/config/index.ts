import fs from 'node:fs';
import path from 'node:path';

export interface CustomProvider {
  id: string;
  name: string;
  baseUrls: string[];
  baseUrl?: string;
  apiKeys: string[];
  apiKey?: string;
  modelMapping?: Record<string, string>;
  activeModel?: string;
  defaultModel?: string;
  priority?: string;
  autoPopulate?: boolean;
  freeOnly?: boolean;
  enabled: boolean;
  notes?: string;
}

export interface KiroGatewayConfig {
  host: string;
  port: number;
  publicDomainUrl: string;
  detectedPublicUrl?: string;
  adminToken: string;
  providerPriorityOrder: string[];
  customProviders: CustomProvider[];
  activeDefaultModel: string;
  model?: string;
  provider?: string;
  mode?: string;
  temperature: number;
  maxTokens: number;
  timeoutMs?: number;
  rateMultiplier?: number;
  enableNgrokTunnel: boolean;
  ngrokAuthToken: string;
  geminiApiKey: string;
  geminiApiKeys?: string[];
  kiloApiKey?: string;
  kiloApiKeys?: string[];
  clineApiKey?: string;
  clineApiKeys?: string[];
  openrouterApiKey?: string;
  openrouterApiKeys?: string[];
  orcarouterApiKey?: string;
  orcarouterApiKeys?: string[];
  globalAutoMode: boolean;
  otoMode: boolean;
  maxAutoSteps: number;
  autoApproveTools: boolean;
  providers?: Record<string, { enabled?: boolean; apiKey?: string; authtoken?: string }>;
  headlessGeminiWorker?: { enabled?: boolean; autoStart?: boolean; chromeExecutablePath?: string };
}

function normalizeCustomProvider(p: any, idx: number): CustomProvider {
  const name = p.name || `Provider ${idx + 1}`;
  const id = p.id || name.toLowerCase().replace(/[^a-z0-9]/g, '-');
  const baseUrls: string[] = Array.isArray(p.baseUrls) && p.baseUrls.length > 0
    ? p.baseUrls
    : (p.baseUrl ? [p.baseUrl] : []);

  const apiKeys: string[] = Array.isArray(p.apiKeys) && p.apiKeys.length > 0
    ? p.apiKeys
    : (p.apiKey ? [p.apiKey] : []);

  const activeModel = p.activeModel || p.defaultModel || 'gemini-2.5-flash';

  return {
    id,
    name,
    baseUrl: p.baseUrl || baseUrls[0] || '',
    baseUrls: baseUrls.map((u: string) =>
      u.replace(/\/+$/, '') === 'https://generativelanguage.googleapis.com'
        ? 'https://generativelanguage.googleapis.com/v1beta/openai'
        : u
    ),
    apiKey: p.apiKey || apiKeys[0] || '',
    apiKeys,
    defaultModel: activeModel,
    activeModel,
    priority: p.priority || 'high',
    autoPopulate: p.autoPopulate ?? true,
    freeOnly: p.freeOnly ?? false,
    enabled: p.enabled !== false,
    notes: p.notes || (p.priority ? `Priority: ${p.priority}` : ''),
    modelMapping: p.modelMapping,
  };
}

const CANONICAL_CLOUD_GATEWAY_URL = 'https://kiroproxy-746899042471.asia-southeast1.run.app';

export const PRELOADED_CUSTOM_PROVIDERS: CustomProvider[] = [
  {
    id: 'groq',
    name: 'Groq Cloud',
    baseUrl: 'https://api.groq.com/openai/v1',
    baseUrls: ['https://api.groq.com/openai/v1'],
    apiKey: '',
    apiKeys: [],
    defaultModel: 'llama-3.3-70b-versatile',
    activeModel: 'llama-3.3-70b-versatile',
    priority: 'high',
    autoPopulate: true,
    freeOnly: true,
    enabled: true,
    notes: 'Ultra-fast LPU (300-800 tok/s), 14.4k req/day (8B), 1k req/day (70B), 100% free without credit card',
    modelMapping: {
      'auto': 'llama-3.3-70b-versatile',
      'llama-3.3-70b': 'llama-3.3-70b-versatile',
      'llama-3.1-8b': 'llama-3.1-8b-instant',
      'gemma2-9b': 'gemma2-9b-it',
    },
  },
  {
    id: 'cerebras',
    name: 'Cerebras Cloud',
    baseUrl: 'https://api.cerebras.ai/v1',
    baseUrls: ['https://api.cerebras.ai/v1'],
    apiKey: '',
    apiKeys: [],
    defaultModel: 'llama-3.3-70b',
    activeModel: 'llama-3.3-70b',
    priority: 'high',
    autoPopulate: true,
    freeOnly: true,
    enabled: true,
    notes: 'Wafer-scale engine (~1,500 tok/s), 1,000,000 free tokens/day daily reset',
    modelMapping: {
      'auto': 'llama-3.3-70b',
      'llama-3.3-70b': 'llama-3.3-70b',
      'llama-3.1-8b': 'llama3.1-8b',
      'deepseek-r1': 'deepseek-r1-distill-llama-70b',
    },
  },
  {
    id: 'mistral',
    name: 'Mistral AI',
    baseUrl: 'https://api.mistral.ai/v1',
    baseUrls: ['https://api.mistral.ai/v1'],
    apiKey: '',
    apiKeys: [],
    defaultModel: 'codestral-latest',
    activeModel: 'codestral-latest',
    priority: 'high',
    autoPopulate: true,
    freeOnly: true,
    enabled: true,
    notes: 'Premier 22B coding model Codestral, free experimentation tier, 60 RPM',
    modelMapping: {
      'auto': 'codestral-latest',
      'codestral': 'codestral-latest',
      'mistral-small': 'mistral-small-latest',
      'mistral-nemo': 'open-mistral-nemo',
    },
  },
  {
    id: 'github-models',
    name: 'GitHub Models',
    baseUrl: 'https://models.inference.ai.azure.com',
    baseUrls: ['https://models.inference.ai.azure.com'],
    apiKey: '',
    apiKeys: [],
    defaultModel: 'gpt-4o-mini',
    activeModel: 'gpt-4o-mini',
    priority: 'high',
    autoPopulate: true,
    freeOnly: true,
    enabled: true,
    notes: 'Free with any standard GitHub PAT (ghp_...), 50-150 requests/day for GPT-4o, Phi-4, Claude & Mistral',
    modelMapping: {
      'auto': 'gpt-4o-mini',
      'gpt-4o': 'gpt-4o',
      'gpt-4o-mini': 'gpt-4o-mini',
      'phi-4': 'Phi-4',
      'deepseek-r1': 'DeepSeek-R1',
    },
  },
  {
    id: 'sambanova',
    name: 'SambaNova Cloud',
    baseUrl: 'https://api.sambanova.ai/v1',
    baseUrls: ['https://api.sambanova.ai/v1'],
    apiKey: '',
    apiKeys: [],
    defaultModel: 'Meta-Llama-3.3-70B-Instruct',
    activeModel: 'Meta-Llama-3.3-70B-Instruct',
    priority: 'medium',
    autoPopulate: true,
    freeOnly: true,
    enabled: true,
    notes: 'Custom RDU hardware, 200k tokens/day free developer tier for Llama 3.3 70B & DeepSeek R1',
    modelMapping: {
      'auto': 'Meta-Llama-3.3-70B-Instruct',
      'llama-3.3-70b': 'Meta-Llama-3.3-70B-Instruct',
      'deepseek-r1': 'DeepSeek-R1',
    },
  },
  {
    id: 'together-ai',
    name: 'Together AI Free',
    baseUrl: 'https://api.together.ai/v1',
    baseUrls: ['https://api.together.ai/v1'],
    apiKey: '',
    apiKeys: [],
    defaultModel: 'meta-llama/Llama-3.3-70B-Instruct-Turbo-Free',
    activeModel: 'meta-llama/Llama-3.3-70B-Instruct-Turbo-Free',
    priority: 'medium',
    autoPopulate: true,
    freeOnly: true,
    enabled: true,
    notes: 'Dedicated zero-cost endpoints with 60 RPM on Llama 3.3 70B Turbo & DeepSeek R1 Distill',
    modelMapping: {
      'auto': 'meta-llama/Llama-3.3-70B-Instruct-Turbo-Free',
      'llama-3.3-70b': 'meta-llama/Llama-3.3-70B-Instruct-Turbo-Free',
      'deepseek-r1': 'deepseek-ai/DeepSeek-R1-Distill-Llama-70B-Free',
    },
  },
  {
    id: 'siliconflow',
    name: 'SiliconFlow Free',
    baseUrl: 'https://api.siliconflow.cn/v1',
    baseUrls: ['https://api.siliconflow.cn/v1'],
    apiKey: '',
    apiKeys: [],
    defaultModel: 'Qwen/Qwen2.5-7B-Instruct',
    activeModel: 'Qwen/Qwen2.5-7B-Instruct',
    priority: 'medium',
    autoPopulate: true,
    freeOnly: true,
    enabled: true,
    notes: 'Permanently free open-source catalog for Qwen 2.5, DeepSeek V2.5, and GLM-4',
    modelMapping: {
      'auto': 'Qwen/Qwen2.5-7B-Instruct',
      'qwen-7b': 'Qwen/Qwen2.5-7B-Instruct',
      'deepseek-v2.5': 'deepseek-ai/DeepSeek-V2.5',
    },
  },
  {
    id: 'pollinations',
    name: 'Pollinations AI',
    baseUrl: 'https://text.pollinations.ai/openai',
    baseUrls: ['https://text.pollinations.ai/openai'],
    apiKey: '',
    apiKeys: [],
    defaultModel: 'mistral',
    activeModel: 'mistral',
    priority: 'medium',
    autoPopulate: true,
    freeOnly: true,
    enabled: true,
    notes: 'Zero-authentication instant free tier without API keys or credit card',
    modelMapping: {
      'auto': 'mistral',
      'mistral': 'mistral',
      'llama': 'llama',
      'qwen': 'qwen',
    },
  },
];

const DEFAULT_CONFIG: KiroGatewayConfig = {
  host: process.env.HOST || '0.0.0.0',
  port: process.env.PORT ? parseInt(process.env.PORT, 10) : 3000,
  publicDomainUrl: process.env.PUBLIC_DOMAIN_URL || process.env.APP_URL || process.env.SERVICE_URL || CANONICAL_CLOUD_GATEWAY_URL,
  adminToken: process.env.PROXY_ADMIN_TOKEN || '',
  providerPriorityOrder: (process.env.PROVIDER_PRIORITY_ORDER || 'kilo,cline,openrouter,orcarouter,gemini,custom,canvas')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  customProviders: PRELOADED_CUSTOM_PROVIDERS,
  activeDefaultModel: 'gemini-2.5-flash',
  temperature: 0.7,
  maxTokens: 4096,
  enableNgrokTunnel: false, // Cloud Run provides native public HTTPS; ngrok is not needed in cloud
  ngrokAuthToken: process.env.NGROK_AUTHTOKEN || '',
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  geminiApiKeys: [],
  kiloApiKey: process.env.KILO_API_KEY || '',
  kiloApiKeys: [],
  clineApiKey: process.env.CLINE_API_KEY || '',
  clineApiKeys: [],
  openrouterApiKey: process.env.OPENROUTER_API_KEY || '',
  openrouterApiKeys: [],
  orcarouterApiKey: process.env.ORCAROUTER_API_KEY || '',
  orcarouterApiKeys: [],
  globalAutoMode: true,
  otoMode: true,
  maxAutoSteps: 25,
  autoApproveTools: true,
};

// Paths for persistence
const LOCAL_CONFIG_PATH = path.resolve(process.cwd(), 'config', 'kiro_ai_config.local.json');
const PRIMARY_CONFIG_PATH = path.resolve(process.cwd(), 'config', 'kiro_ai_config.json');
const FALLBACK_CONFIG_PATH = path.resolve('/tmp', 'kiro_ai_config.json');

class ConfigManager {
  private config: KiroGatewayConfig;
  private activeConfigPath: string = PRIMARY_CONFIG_PATH;

  constructor() {
    this.config = { ...DEFAULT_CONFIG };
    this.loadInitialConfig();
  }

  public loadInitialConfig() {
    // 1. Try to load from candidate paths (local override > project config > /tmp fallback)
    const candidatePaths = [LOCAL_CONFIG_PATH, PRIMARY_CONFIG_PATH, FALLBACK_CONFIG_PATH];
    let fileConfig: any = {};

    for (const p of candidatePaths) {
      if (fs.existsSync(p)) {
        try {
          const raw = fs.readFileSync(p, 'utf8');
          fileConfig = JSON.parse(raw);
          this.activeConfigPath = p;
          break;
        } catch (e) {
          console.warn(`[Config] Failed to parse config file at ${p}:`, e);
        }
      }
    }

    // 2. Parse stateless container environment variable overrides
    let envCustomProviders: CustomProvider[] = [];
    if (process.env.CUSTOM_PROVIDERS_JSON) {
      try {
        const parsed = JSON.parse(process.env.CUSTOM_PROVIDERS_JSON);
        if (Array.isArray(parsed)) {
          envCustomProviders = parsed;
        }
      } catch (e) {
        console.warn('[Config] Failed to parse CUSTOM_PROVIDERS_JSON:', e);
      }
    }

    let envPriorityOrder: string[] | null = null;
    if (process.env.PROVIDER_PRIORITY_ORDER) {
      envPriorityOrder = process.env.PROVIDER_PRIORITY_ORDER.split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    }

    const rawCustomProviders = envCustomProviders.length > 0
      ? envCustomProviders
      : (fileConfig.customProviders || []);

    const userCustomProviders = rawCustomProviders.map((p: any, idx: number) =>
      normalizeCustomProvider(p, idx)
    );

    const userProviderMap = new Map<string, CustomProvider>();
    for (const cp of userCustomProviders) {
      userProviderMap.set(cp.id, cp);
    }

    // Merge: preserve all user-configured providers, and add any missing pre-loaded providers
    const sanitizedCustomProviders: CustomProvider[] = [...userCustomProviders];
    for (const pre of PRELOADED_CUSTOM_PROVIDERS) {
      if (!userProviderMap.has(pre.id)) {
        sanitizedCustomProviders.push(pre);
      }
    }

    // Merge: fileConfig takes precedence over default, and explicit non-empty env vars take precedence
    this.config = {
      ...this.config,
      ...fileConfig,
      model: fileConfig.model || fileConfig.activeDefaultModel || this.config.activeDefaultModel,
      activeDefaultModel: (fileConfig.activeDefaultModel || (fileConfig.model && fileConfig.model !== 'global-automode' ? fileConfig.model : null) || this.config.activeDefaultModel),
      host: process.env.HOST || fileConfig.host || DEFAULT_CONFIG.host,
      port: process.env.PORT ? parseInt(process.env.PORT, 10) : (fileConfig.port || DEFAULT_CONFIG.port),
      publicDomainUrl: process.env.PUBLIC_DOMAIN_URL || process.env.APP_URL || process.env.SERVICE_URL || fileConfig.publicDomainUrl || '',
      adminToken: process.env.PROXY_ADMIN_TOKEN || fileConfig.adminToken || '',
      geminiApiKey: process.env.GEMINI_API_KEY || fileConfig.geminiApiKey || fileConfig.geminiApiKeys?.[0] || fileConfig.providers?.gemini?.apiKey || '',
      geminiApiKeys: Array.isArray(fileConfig.geminiApiKeys) ? fileConfig.geminiApiKeys : (fileConfig.geminiApiKey ? [fileConfig.geminiApiKey] : []),
      kiloApiKey: process.env.KILO_API_KEY || fileConfig.kiloApiKey || fileConfig.kiloApiKeys?.[0] || fileConfig.providers?.kilo?.apiKey || '',
      kiloApiKeys: Array.isArray(fileConfig.kiloApiKeys) ? fileConfig.kiloApiKeys : (fileConfig.kiloApiKey ? [fileConfig.kiloApiKey] : []),
      clineApiKey: process.env.CLINE_API_KEY || fileConfig.clineApiKey || fileConfig.clineApiKeys?.[0] || fileConfig.providers?.cline?.apiKey || '',
      clineApiKeys: Array.isArray(fileConfig.clineApiKeys) ? fileConfig.clineApiKeys : (fileConfig.clineApiKey ? [fileConfig.clineApiKey] : []),
      openrouterApiKey: process.env.OPENROUTER_API_KEY || fileConfig.openrouterApiKey || fileConfig.openrouterApiKeys?.[0] || fileConfig.providers?.openrouter?.apiKey || '',
      openrouterApiKeys: Array.isArray(fileConfig.openrouterApiKeys) ? fileConfig.openrouterApiKeys : (fileConfig.openrouterApiKey ? [fileConfig.openrouterApiKey] : []),
      orcarouterApiKey: process.env.ORCAROUTER_API_KEY || fileConfig.orcarouterApiKey || fileConfig.orcarouterApiKeys?.[0] || fileConfig.providers?.orcarouter?.apiKey || '',
      orcarouterApiKeys: Array.isArray(fileConfig.orcarouterApiKeys) ? fileConfig.orcarouterApiKeys : (fileConfig.orcarouterApiKey ? [fileConfig.orcarouterApiKey] : []),
      globalAutoMode: fileConfig.globalAutoMode ?? true,
      otoMode: fileConfig.otoMode ?? true,
      maxAutoSteps: fileConfig.maxAutoSteps ?? 25,
      autoApproveTools: fileConfig.autoApproveTools ?? true,
      ngrokAuthToken: process.env.NGROK_AUTHTOKEN || fileConfig.ngrokAuthtoken || fileConfig.providers?.ngrok?.authtoken || '',
      providerPriorityOrder: envPriorityOrder || fileConfig.providerPriorityOrder || DEFAULT_CONFIG.providerPriorityOrder,
      customProviders: sanitizedCustomProviders,
    };
  }

  public reloadConfig() {
    this.loadInitialConfig();
    return this.getConfig();
  }

  public getConfig(): KiroGatewayConfig {
    return { ...this.config };
  }

  public setPublicDomainUrl(url: string) {
    if (url && url !== this.config.publicDomainUrl) {
      this.config.publicDomainUrl = url;
    }
  }

  public updateConfig(partial: Partial<KiroGatewayConfig>): { success: boolean; path: string; error?: string } {
    this.config = {
      ...this.config,
      ...partial,
    };

    // Ensure directory exists and write
    const dir = path.dirname(this.activeConfigPath);
    try {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.activeConfigPath, JSON.stringify(this.config, null, 2), 'utf8');
      return { success: true, path: this.activeConfigPath };
    } catch (err: any) {
      // If primary path fails (e.g. read-only container root), fall back to /tmp
      console.warn(`[Config] Failed to write to ${this.activeConfigPath}, trying /tmp fallback:`, err.message);
      try {
        this.activeConfigPath = FALLBACK_CONFIG_PATH;
        fs.writeFileSync(this.activeConfigPath, JSON.stringify(this.config, null, 2), 'utf8');
        return { success: true, path: this.activeConfigPath };
      } catch (fallbackErr: any) {
        return { success: false, path: this.activeConfigPath, error: fallbackErr.message };
      }
    }
  }

  public exportEnvVariables(): string {
    return [
      `# KiroProxy Cloud Deployment Configuration`,
      `# Generated: ${new Date().toISOString()}`,
      `HOST="0.0.0.0"`,
      `PORT="${this.config.port}"`,
      `PUBLIC_DOMAIN_URL="${this.config.publicDomainUrl}"`,
      `PROXY_ADMIN_TOKEN="${this.config.adminToken}"`,
      `PROVIDER_PRIORITY_ORDER="${this.config.providerPriorityOrder.join(',')}"`,
      `CUSTOM_PROVIDERS_JSON='${JSON.stringify(this.config.customProviders)}'`,
      `GLOBAL_AUTOMODE="${this.config.globalAutoMode}"`,
      `OTO_MODE="${this.config.otoMode}"`,
      this.config.geminiApiKey ? `GEMINI_API_KEY="${this.config.geminiApiKey}"` : `# GEMINI_API_KEY=""`,
      this.config.kiloApiKey ? `KILO_API_KEY="${this.config.kiloApiKey}"` : `# KILO_API_KEY=""`,
      this.config.clineApiKey ? `CLINE_API_KEY="${this.config.clineApiKey}"` : `# CLINE_API_KEY=""`,
      this.config.openrouterApiKey ? `OPENROUTER_API_KEY="${this.config.openrouterApiKey}"` : `# OPENROUTER_API_KEY=""`,
      this.config.orcarouterApiKey ? `ORCAROUTER_API_KEY="${this.config.orcarouterApiKey}"` : `# ORCAROUTER_API_KEY=""`,
    ].join('\n');
  }
}

export const configManager = new ConfigManager();
