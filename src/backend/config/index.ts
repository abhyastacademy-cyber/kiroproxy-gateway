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

  const activeModel = p.activeModel || p.defaultModel || 'gemini-3.8-flash';

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
    activeModel: activeModel === 'gemini-2.5-flash' ? 'gemini-3.8-flash' : activeModel,
    priority: p.priority || 'high',
    autoPopulate: p.autoPopulate ?? true,
    freeOnly: p.freeOnly ?? false,
    enabled: p.enabled !== false,
    notes: p.notes || (p.priority ? `Priority: ${p.priority}` : ''),
    modelMapping: p.modelMapping,
  };
}

const DEFAULT_CONFIG: KiroGatewayConfig = {
  host: process.env.HOST || '0.0.0.0',
  port: process.env.PORT ? parseInt(process.env.PORT, 10) : 3000,
  publicDomainUrl: process.env.PUBLIC_DOMAIN_URL || process.env.APP_URL || process.env.SERVICE_URL || '',
  adminToken: process.env.PROXY_ADMIN_TOKEN || '',
  providerPriorityOrder: (process.env.PROVIDER_PRIORITY_ORDER || 'kilo,cline,openrouter,orcarouter,gemini,custom')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  customProviders: [],
  activeDefaultModel: 'gemini-3.8-flash',
  temperature: 0.7,
  maxTokens: 4096,
  enableNgrokTunnel: false,
  ngrokAuthToken: process.env.NGROK_AUTHTOKEN || '',
  geminiApiKey: process.env.GEMINI_API_KEY || '',
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

    const sanitizedCustomProviders = rawCustomProviders.map((p: any, idx: number) =>
      normalizeCustomProvider(p, idx)
    );

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
      this.config.geminiApiKey ? `GEMINI_API_KEY="${this.config.geminiApiKey}"` : `# GEMINI_API_KEY=""`,
      this.config.ngrokAuthToken ? `NGROK_AUTHTOKEN="${this.config.ngrokAuthToken}"` : `# NGROK_AUTHTOKEN=""`,
    ].join('\n');
  }
}

export const configManager = new ConfigManager();
