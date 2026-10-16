# Data Model & Configuration Schemas

> **DATA ENTITIES & SCHEMA SPECIFICATION:**
> Detailed specification of configuration entities, state lifecycles, persistence paths, and catalog structures.

---

## 1. Core Configuration Schema (`KiroGatewayConfig`)

Defined in `src/backend/config/index.ts`:

```typescript
export interface CustomProvider {
  id: string;                      // Unique slug (e.g., 'custom-deepinfra')
  name: string;                    // Human-readable provider label
  baseUrls: string[];              // Candidate endpoint URLs (OpenAI-compatible)
  baseUrl?: string;                // Primary base URL (backward compatibility)
  apiKeys: string[];               // Rotated API keys
  apiKey?: string;                 // Primary API key
  modelMapping?: Record<string, string>; // Model ID translation map
  activeModel?: string;            // Currently selected model
  defaultModel?: string;           // Fallback model ID
  priority?: string;               // 'high' | 'medium' | 'low'
  autoPopulate?: boolean;          // Discover models automatically from upstream
  freeOnly?: boolean;              // Restrict to zero-cost free models
  enabled: boolean;                // Active toggle state
  notes?: string;                  // Operational notes
}

export interface KiroGatewayConfig {
  host: string;                    // Bind address (default: '0.0.0.0')
  port: number;                    // Listen port (default: 3000)
  publicDomainUrl: string;         // Canonical public HTTPS URL
  detectedPublicUrl?: string;      // Runtime detected ingress URL
  adminToken: string;              // Optional bearer token for API security
  providerPriorityOrder: string[]; // Order of 7 tiers
  customProviders: CustomProvider[]; // User-defined & pre-loaded custom endpoints (PRELOADED_CUSTOM_PROVIDERS)
  activeDefaultModel: string;      // Default model exposed to clients
  model?: string;                  // Alias for activeDefaultModel
  temperature: number;             // Default inference temperature (0.7)
  maxTokens: number;               // Max output token limit (4096)
  timeoutMs?: number;              // Request timeout in ms
  rateMultiplier?: number;         // Bedrock rate multiplier (0 for zero-cost)
  enableNgrokTunnel: boolean;      // Ingress tunnel flag (false on Cloud Run)
  ngrokAuthToken: string;          // Optional ngrok token
  geminiApiKey: string;            // Primary Gemini API key
  geminiApiKeys?: string[];        // Rotated Gemini API keys
  kiloApiKey?: string;             // Optional Kilo API key
  kiloApiKeys?: string[];          // Rotated Kilo API keys
  clineApiKey?: string;            // Optional Cline API key
  clineApiKeys?: string[];         // Rotated Cline API keys
  openrouterApiKey?: string;       // Optional OpenRouter API key
  openrouterApiKeys?: string[];    // Rotated OpenRouter API keys
  orcarouterApiKey?: string;       // Optional OrcaRouter API key
  orcarouterApiKeys?: string[];    // Rotated OrcaRouter API keys
  globalAutoMode: boolean;         // Enable 7-tier waterfall
  otoMode: boolean;                // Enable intra-provider model cycling
  maxAutoSteps: number;            // Step limit for multi-turn runs (25)
  autoApproveTools: boolean;       // Automated tool execution flag (true)
}
```

---

## 2. Model Catalog Schema (`ModelCatalogEntry`)

Defined in `src/backend/config/catalog.ts`:

```typescript
export interface ModelCatalogEntry {
  id: string;                      // Unique identifier (e.g. 'deepseek/deepseek-r1:free')
  name: string;                    // Formatted display name
  provider: string;                // Upstream provider slug ('openrouter', 'kilo', 'google', etc.)
  contextWindow: number;           // Input context window in tokens (e.g. 128000)
  maxOutputTokens: number;         // Max generation token limit (e.g. 16384)
  free: boolean;                   // Always true in zero-cost catalog
  pricing: {
    prompt: number;                // 0 for free tier
    completion: number;            // 0 for free tier
  };
  description: string;             // Architectural and benchmark description
  capabilities: {
    reasoning?: boolean;           // True for R1, o1, QwQ
    coding?: boolean;              // True for Coder models
    toolCalling?: boolean;         // Function / tool calling support
    vision?: boolean;              // Multimodal image processing support
  };
}
```

---

## 3. Storage & Lifecycle Hierarchy

1. **Local Override Path**: `config/kiro_ai_config.local.json` (highest file precedence, ignored by git).
2. **Project Primary Path**: `config/kiro_ai_config.json` (default deployment configuration).
3. **Container Ephemeral Fallback**: `/tmp/kiro_ai_config.json` (used automatically if filesystem is mounted read-only).
4. **Environment Variables**: `CUSTOM_PROVIDERS_JSON`, `PROVIDER_PRIORITY_ORDER`, `PROXY_ADMIN_TOKEN`, `GEMINI_API_KEY`, `OPENROUTER_API_KEY`, etc. take precedence on boot.
