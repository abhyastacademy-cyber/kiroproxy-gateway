import { configManager, type KiroGatewayConfig } from './index.js';
import {
  KILO_FREE_MODELS,
  OPENROUTER_FREE_MODELS,
  CLINE_FREE_MODELS,
  ORCAROUTER_FREE_MODELS,
  GEMINI_ROTATION_MODELS,
} from '../providers/otomode.js';

export interface ModelCatalogEntry {
  modelId: string;
  modelName: string;
  description: string;
  rateMultiplier: number;
  rateUnit: string;
  supportedInputTypes: ('TEXT' | 'IMAGE')[];
  tokenLimits: {
    maxInputTokens: number;
    maxOutputTokens: number;
  };
  pricing: {
    prompt: string;
    completion: string;
    unit: string;
  };
  capabilities?: {
    toolCalling: boolean;
    codeGeneration: boolean;
    reasoning: boolean;
    multiModal: boolean;
  };
  upstreamSlug?: string;
  owned_by?: string;
}

/**
 * 1. Rich Pre-Seeded Catalog of 60+ Zero-Cost Models.
 * Guaranteed to be immediately available at startup without waiting for network.
 */
export const RICH_MODEL_CATALOG: ModelCatalogEntry[] = [
  // --- 1. Global & Auto Waterfalls ---
  {
    modelId: 'global-automode',
    modelName: 'Global Automode (7-Tier Zero-Cost Waterfall)',
    description: 'Auto-rotates across kilo -> cline -> openrouter -> orcarouter -> gemini -> custom -> canvas with instant failover',
    rateMultiplier: 0,
    rateUnit: 'credit',
    supportedInputTypes: ['TEXT', 'IMAGE'],
    tokenLimits: { maxInputTokens: 128000, maxOutputTokens: 16384 },
    pricing: { prompt: '0', completion: '0', unit: 'credit' },
    capabilities: { toolCalling: true, codeGeneration: true, reasoning: true, multiModal: true },
    owned_by: 'gateway',
  },
  {
    modelId: 'auto',
    modelName: 'Kiro Default Auto (Waterfall)',
    description: 'Direct fallback through full 7-tier cross-provider waterfall',
    rateMultiplier: 0,
    rateUnit: 'credit',
    supportedInputTypes: ['TEXT', 'IMAGE'],
    tokenLimits: { maxInputTokens: 128000, maxOutputTokens: 16384 },
    pricing: { prompt: '0', completion: '0', unit: 'credit' },
    capabilities: { toolCalling: true, codeGeneration: true, reasoning: true, multiModal: true },
    owned_by: 'gateway',
  },
  {
    modelId: 'openrouter/auto',
    modelName: 'OpenRouter Auto (Zero-Cost Free Router)',
    description: 'Dynamic auto-routing across verified free endpoints on OpenRouter',
    rateMultiplier: 0,
    rateUnit: 'credit',
    supportedInputTypes: ['TEXT', 'IMAGE'],
    tokenLimits: { maxInputTokens: 128000, maxOutputTokens: 16384 },
    pricing: { prompt: '0', completion: '0', unit: 'credit' },
    capabilities: { toolCalling: true, codeGeneration: true, reasoning: true, multiModal: true },
    upstreamSlug: 'openrouter/auto',
    owned_by: 'openrouter',
  },
  {
    modelId: 'kilo-auto/free',
    modelName: 'Kilo Auto Free (Zero-Key Gateway)',
    description: 'Zero-key auto-routing across verified free endpoints on Kilo Gateway',
    rateMultiplier: 0,
    rateUnit: 'credit',
    supportedInputTypes: ['TEXT', 'IMAGE'],
    tokenLimits: { maxInputTokens: 128000, maxOutputTokens: 8192 },
    pricing: { prompt: '0', completion: '0', unit: 'credit' },
    capabilities: { toolCalling: true, codeGeneration: true, reasoning: true, multiModal: false },
    upstreamSlug: 'kilo-auto/free',
    owned_by: 'kilo-gateway',
  },
  {
    modelId: 'kilo-free',
    modelName: 'Kilo Free Tier Pool',
    description: 'Community pool of free zero-cost models hosted on Kilo Gateway',
    rateMultiplier: 0,
    rateUnit: 'credit',
    supportedInputTypes: ['TEXT'],
    tokenLimits: { maxInputTokens: 128000, maxOutputTokens: 8192 },
    pricing: { prompt: '0', completion: '0', unit: 'credit' },
    capabilities: { toolCalling: true, codeGeneration: true, reasoning: false, multiModal: false },
    upstreamSlug: 'kilo-free',
    owned_by: 'kilo-gateway',
  },

  // --- 2. Intra-Provider Otomodes ---
  {
    modelId: 'kilo-otomode',
    modelName: 'Kilo Otomode (177+ Free Models)',
    description: 'Intra-provider rotation across top free models on Kilo Gateway',
    rateMultiplier: 0,
    rateUnit: 'credit',
    supportedInputTypes: ['TEXT', 'IMAGE'],
    tokenLimits: { maxInputTokens: 128000, maxOutputTokens: 16384 },
    pricing: { prompt: '0', completion: '0', unit: 'credit' },
    capabilities: { toolCalling: true, codeGeneration: true, reasoning: true, multiModal: true },
    owned_by: 'kilo-gateway',
  },
  {
    modelId: 'openrouter-otomode',
    modelName: 'OpenRouter Otomode (Free Model Rotation)',
    description: 'Rotates through OpenRouter free tier models and API keys',
    rateMultiplier: 0,
    rateUnit: 'credit',
    supportedInputTypes: ['TEXT', 'IMAGE'],
    tokenLimits: { maxInputTokens: 128000, maxOutputTokens: 16384 },
    pricing: { prompt: '0', completion: '0', unit: 'credit' },
    capabilities: { toolCalling: true, codeGeneration: true, reasoning: true, multiModal: true },
    owned_by: 'openrouter',
  },
  {
    modelId: 'cline-otomode',
    modelName: 'Cline Otomode (Intra-Provider Rotation)',
    description: 'Rotates through Cline free models and community keys',
    rateMultiplier: 0,
    rateUnit: 'credit',
    supportedInputTypes: ['TEXT', 'IMAGE'],
    tokenLimits: { maxInputTokens: 128000, maxOutputTokens: 16384 },
    pricing: { prompt: '0', completion: '0', unit: 'credit' },
    capabilities: { toolCalling: true, codeGeneration: true, reasoning: true, multiModal: false },
    owned_by: 'cline',
  },
  {
    modelId: 'orcarouter-otomode',
    modelName: 'OrcaRouter Otomode (Free Model Rotation)',
    description: 'Rotates through OrcaRouter community endpoints and models',
    rateMultiplier: 0,
    rateUnit: 'credit',
    supportedInputTypes: ['TEXT', 'IMAGE'],
    tokenLimits: { maxInputTokens: 128000, maxOutputTokens: 16384 },
    pricing: { prompt: '0', completion: '0', unit: 'credit' },
    capabilities: { toolCalling: true, codeGeneration: true, reasoning: true, multiModal: false },
    owned_by: 'orcarouter',
  },
  {
    modelId: 'gemini-otomode',
    modelName: 'Gemini Otomode (Multi-Model & Key Rotation)',
    description: 'Rotates across Gemini Flash/3.8/Argon models and API keys',
    rateMultiplier: 0,
    rateUnit: 'credit',
    supportedInputTypes: ['TEXT', 'IMAGE'],
    tokenLimits: { maxInputTokens: 1000000, maxOutputTokens: 16384 },
    pricing: { prompt: '0', completion: '0', unit: 'credit' },
    capabilities: { toolCalling: true, codeGeneration: true, reasoning: true, multiModal: true },
    owned_by: 'google',
  },

  // --- 3. Google Gemini Native Models ---
  {
    modelId: 'gemini-flash-latest',
    modelName: 'Google Gemini Flash Latest (High-Speed & Quota)',
    description: 'Recommended Google Gemini Flash model alias for fast low-latency generation',
    rateMultiplier: 0,
    rateUnit: 'credit',
    supportedInputTypes: ['TEXT', 'IMAGE'],
    tokenLimits: { maxInputTokens: 1000000, maxOutputTokens: 8192 },
    pricing: { prompt: '0', completion: '0', unit: 'credit' },
    capabilities: { toolCalling: true, codeGeneration: true, reasoning: true, multiModal: true },
    upstreamSlug: 'gemini-flash-latest',
    owned_by: 'google',
  },
  {
    modelId: 'gemini-3.8-flash',
    modelName: 'Google Gemini 3.8 Flash (High-Throughput)',
    description: 'Cloud Gateway High-Performance Model for general text and coding tasks',
    rateMultiplier: 0,
    rateUnit: 'credit',
    supportedInputTypes: ['TEXT', 'IMAGE'],
    tokenLimits: { maxInputTokens: 1000000, maxOutputTokens: 16384 },
    pricing: { prompt: '0', completion: '0', unit: 'credit' },
    capabilities: { toolCalling: true, codeGeneration: true, reasoning: true, multiModal: true },
    upstreamSlug: 'gemini-3.8-flash',
    owned_by: 'google',
  },
  {
    modelId: 'gemini-4-argon',
    modelName: 'Google Gemini 4 Argon (Advanced Reasoning & Coding)',
    description: 'Google deep reasoning and STEM coding model with massive context',
    rateMultiplier: 0,
    rateUnit: 'credit',
    supportedInputTypes: ['TEXT', 'IMAGE'],
    tokenLimits: { maxInputTokens: 1000000, maxOutputTokens: 32768 },
    pricing: { prompt: '0', completion: '0', unit: 'credit' },
    capabilities: { toolCalling: true, codeGeneration: true, reasoning: true, multiModal: true },
    upstreamSlug: 'gemini-4-argon',
    owned_by: 'google',
  },
  {
    modelId: 'gemini-3.1-flash-lite',
    modelName: 'Google Gemini 3.1 Flash Lite',
    description: 'Lightweight high-efficiency model for quick code edits',
    rateMultiplier: 0,
    rateUnit: 'credit',
    supportedInputTypes: ['TEXT', 'IMAGE'],
    tokenLimits: { maxInputTokens: 1000000, maxOutputTokens: 8192 },
    pricing: { prompt: '0', completion: '0', unit: 'credit' },
    capabilities: { toolCalling: true, codeGeneration: true, reasoning: false, multiModal: true },
    upstreamSlug: 'gemini-3.1-flash-lite',
    owned_by: 'google',
  },
  {
    modelId: 'gemini-2.5-flash',
    modelName: 'Google Gemini 2.5 Flash',
    description: 'Google Gemini 2.5 Flash Model for multimodal generation',
    rateMultiplier: 0,
    rateUnit: 'credit',
    supportedInputTypes: ['TEXT', 'IMAGE'],
    tokenLimits: { maxInputTokens: 1000000, maxOutputTokens: 8192 },
    pricing: { prompt: '0', completion: '0', unit: 'credit' },
    capabilities: { toolCalling: true, codeGeneration: true, reasoning: true, multiModal: true },
    upstreamSlug: 'gemini-2.5-flash',
    owned_by: 'google',
  },
  {
    modelId: 'gemini-2.5-pro',
    modelName: 'Google Gemini 2.5 Pro',
    description: 'Google Gemini 2.5 Pro High-Capability Model',
    rateMultiplier: 0,
    rateUnit: 'credit',
    supportedInputTypes: ['TEXT', 'IMAGE'],
    tokenLimits: { maxInputTokens: 1000000, maxOutputTokens: 16384 },
    pricing: { prompt: '0', completion: '0', unit: 'credit' },
    capabilities: { toolCalling: true, codeGeneration: true, reasoning: true, multiModal: true },
    upstreamSlug: 'gemini-2.5-pro',
    owned_by: 'google',
  },

  // --- 4. DeepSeek Family (Zero-Cost Free Tier) ---
  {
    modelId: 'deepseek/deepseek-r1:free',
    modelName: 'DeepSeek R1 Full Reasoning (Free Tier)',
    description: 'Open-weights flagship reasoning model rivaling OpenAI o1',
    rateMultiplier: 0,
    rateUnit: 'credit',
    supportedInputTypes: ['TEXT'],
    tokenLimits: { maxInputTokens: 128000, maxOutputTokens: 16384 },
    pricing: { prompt: '0', completion: '0', unit: 'credit' },
    capabilities: { toolCalling: false, codeGeneration: true, reasoning: true, multiModal: false },
    upstreamSlug: 'deepseek/deepseek-r1:free',
    owned_by: 'deepseek',
  },
  {
    modelId: 'deepseek/deepseek-chat:free',
    modelName: 'DeepSeek V3 671B MoE (Free Tier)',
    description: 'Flagship DeepSeek V3 Mixture-of-Experts high-efficiency model',
    rateMultiplier: 0,
    rateUnit: 'credit',
    supportedInputTypes: ['TEXT'],
    tokenLimits: { maxInputTokens: 128000, maxOutputTokens: 8192 },
    pricing: { prompt: '0', completion: '0', unit: 'credit' },
    capabilities: { toolCalling: true, codeGeneration: true, reasoning: true, multiModal: false },
    upstreamSlug: 'deepseek/deepseek-chat:free',
    owned_by: 'deepseek',
  },
  {
    modelId: 'deepseek/deepseek-r1-distill-llama-70b:free',
    modelName: 'DeepSeek R1 Distill Llama 70B (Free Tier)',
    description: 'R1 reasoning capabilities distilled into Llama 3.3 70B architecture',
    rateMultiplier: 0,
    rateUnit: 'credit',
    supportedInputTypes: ['TEXT'],
    tokenLimits: { maxInputTokens: 128000, maxOutputTokens: 16384 },
    pricing: { prompt: '0', completion: '0', unit: 'credit' },
    capabilities: { toolCalling: false, codeGeneration: true, reasoning: true, multiModal: false },
    upstreamSlug: 'deepseek/deepseek-r1-distill-llama-70b:free',
    owned_by: 'deepseek',
  },
  {
    modelId: 'deepseek/deepseek-r1-distill-qwen-32b:free',
    modelName: 'DeepSeek R1 Distill Qwen 32B (Free Tier)',
    description: 'R1 reasoning distilled into Qwen 2.5 32B for efficient deep thought',
    rateMultiplier: 0,
    rateUnit: 'credit',
    supportedInputTypes: ['TEXT'],
    tokenLimits: { maxInputTokens: 128000, maxOutputTokens: 16384 },
    pricing: { prompt: '0', completion: '0', unit: 'credit' },
    capabilities: { toolCalling: false, codeGeneration: true, reasoning: true, multiModal: false },
    upstreamSlug: 'deepseek/deepseek-r1-distill-qwen-32b:free',
    owned_by: 'deepseek',
  },
  {
    modelId: 'deepseek/deepseek-r1-distill-qwen-14b:free',
    modelName: 'DeepSeek R1 Distill Qwen 14B (Free Tier)',
    description: 'Fast lightweight R1 distilled reasoning model',
    rateMultiplier: 0,
    rateUnit: 'credit',
    supportedInputTypes: ['TEXT'],
    tokenLimits: { maxInputTokens: 128000, maxOutputTokens: 8192 },
    pricing: { prompt: '0', completion: '0', unit: 'credit' },
    capabilities: { toolCalling: false, codeGeneration: true, reasoning: true, multiModal: false },
    upstreamSlug: 'deepseek/deepseek-r1-distill-qwen-14b:free',
    owned_by: 'deepseek',
  },
  {
    modelId: 'deepseek/deepseek-coder:free',
    modelName: 'DeepSeek Coder 33B (Free Tier)',
    description: 'Dedicated code generation and debugging specialist',
    rateMultiplier: 0,
    rateUnit: 'credit',
    supportedInputTypes: ['TEXT'],
    tokenLimits: { maxInputTokens: 128000, maxOutputTokens: 8192 },
    pricing: { prompt: '0', completion: '0', unit: 'credit' },
    capabilities: { toolCalling: true, codeGeneration: true, reasoning: false, multiModal: false },
    upstreamSlug: 'deepseek/deepseek-coder:free',
    owned_by: 'deepseek',
  },

  // --- 5. Meta Llama Family (Zero-Cost Free Tier) ---
  {
    modelId: 'meta-llama/llama-3.3-70b-instruct:free',
    modelName: 'Meta Llama 3.3 70B Instruct (Free Tier)',
    description: 'Meta flagship open intelligence model with industry-leading performance',
    rateMultiplier: 0,
    rateUnit: 'credit',
    supportedInputTypes: ['TEXT'],
    tokenLimits: { maxInputTokens: 128000, maxOutputTokens: 8192 },
    pricing: { prompt: '0', completion: '0', unit: 'credit' },
    capabilities: { toolCalling: true, codeGeneration: true, reasoning: true, multiModal: false },
    upstreamSlug: 'meta-llama/llama-3.3-70b-instruct:free',
    owned_by: 'meta',
  },
  {
    modelId: 'meta-llama/llama-3.2-11b-vision-instruct:free',
    modelName: 'Meta Llama 3.2 11B Vision (Free Tier)',
    description: 'Multimodal vision model for image inspection and document comprehension',
    rateMultiplier: 0,
    rateUnit: 'credit',
    supportedInputTypes: ['TEXT', 'IMAGE'],
    tokenLimits: { maxInputTokens: 128000, maxOutputTokens: 8192 },
    pricing: { prompt: '0', completion: '0', unit: 'credit' },
    capabilities: { toolCalling: true, codeGeneration: true, reasoning: false, multiModal: true },
    upstreamSlug: 'meta-llama/llama-3.2-11b-vision-instruct:free',
    owned_by: 'meta',
  },
  {
    modelId: 'meta-llama/llama-3.2-3b-instruct:free',
    modelName: 'Meta Llama 3.2 3B Instruct (Free Tier)',
    description: 'Ultra-fast low-latency edge-optimized model for quick responses',
    rateMultiplier: 0,
    rateUnit: 'credit',
    supportedInputTypes: ['TEXT'],
    tokenLimits: { maxInputTokens: 128000, maxOutputTokens: 4096 },
    pricing: { prompt: '0', completion: '0', unit: 'credit' },
    capabilities: { toolCalling: true, codeGeneration: true, reasoning: false, multiModal: false },
    upstreamSlug: 'meta-llama/llama-3.2-3b-instruct:free',
    owned_by: 'meta',
  },
  {
    modelId: 'meta-llama/llama-3.2-1b-instruct:free',
    modelName: 'Meta Llama 3.2 1B Instruct (Free Tier)',
    description: 'Extremely lightweight 1B instruction-tuned model',
    rateMultiplier: 0,
    rateUnit: 'credit',
    supportedInputTypes: ['TEXT'],
    tokenLimits: { maxInputTokens: 128000, maxOutputTokens: 2048 },
    pricing: { prompt: '0', completion: '0', unit: 'credit' },
    capabilities: { toolCalling: false, codeGeneration: false, reasoning: false, multiModal: false },
    upstreamSlug: 'meta-llama/llama-3.2-1b-instruct:free',
    owned_by: 'meta',
  },
  {
    modelId: 'meta-llama/llama-3.1-405b-instruct:free',
    modelName: 'Meta Llama 3.1 405B Instruct (Free Tier)',
    description: 'Massive 405B open foundation model for complex reasoning and synthesis',
    rateMultiplier: 0,
    rateUnit: 'credit',
    supportedInputTypes: ['TEXT'],
    tokenLimits: { maxInputTokens: 128000, maxOutputTokens: 8192 },
    pricing: { prompt: '0', completion: '0', unit: 'credit' },
    capabilities: { toolCalling: true, codeGeneration: true, reasoning: true, multiModal: false },
    upstreamSlug: 'meta-llama/llama-3.1-405b-instruct:free',
    owned_by: 'meta',
  },
  {
    modelId: 'meta-llama/llama-3.1-70b-instruct:free',
    modelName: 'Meta Llama 3.1 70B Instruct (Free Tier)',
    description: 'General-purpose instruction tuned 70B model with 128k context',
    rateMultiplier: 0,
    rateUnit: 'credit',
    supportedInputTypes: ['TEXT'],
    tokenLimits: { maxInputTokens: 128000, maxOutputTokens: 8192 },
    pricing: { prompt: '0', completion: '0', unit: 'credit' },
    capabilities: { toolCalling: true, codeGeneration: true, reasoning: true, multiModal: false },
    upstreamSlug: 'meta-llama/llama-3.1-70b-instruct:free',
    owned_by: 'meta',
  },
  {
    modelId: 'meta-llama/llama-3.1-8b-instruct:free',
    modelName: 'Meta Llama 3.1 8B Instruct (Free Tier)',
    description: 'Fast versatile 8B instruction tuned model with 128k context',
    rateMultiplier: 0,
    rateUnit: 'credit',
    supportedInputTypes: ['TEXT'],
    tokenLimits: { maxInputTokens: 128000, maxOutputTokens: 8192 },
    pricing: { prompt: '0', completion: '0', unit: 'credit' },
    capabilities: { toolCalling: true, codeGeneration: true, reasoning: false, multiModal: false },
    upstreamSlug: 'meta-llama/llama-3.1-8b-instruct:free',
    owned_by: 'meta',
  },
  {
    modelId: 'meta-llama/llama-3-70b-instruct:free',
    modelName: 'Meta Llama 3 70B Instruct (Free Tier)',
    description: 'Original Llama 3 70B high capability instruction model',
    rateMultiplier: 0,
    rateUnit: 'credit',
    supportedInputTypes: ['TEXT'],
    tokenLimits: { maxInputTokens: 8192, maxOutputTokens: 4096 },
    pricing: { prompt: '0', completion: '0', unit: 'credit' },
    capabilities: { toolCalling: true, codeGeneration: true, reasoning: true, multiModal: false },
    upstreamSlug: 'meta-llama/llama-3-70b-instruct:free',
    owned_by: 'meta',
  },
  {
    modelId: 'meta-llama/llama-3-8b-instruct:free',
    modelName: 'Meta Llama 3 8B Instruct (Free Tier)',
    description: 'Original Llama 3 8B instruction model',
    rateMultiplier: 0,
    rateUnit: 'credit',
    supportedInputTypes: ['TEXT'],
    tokenLimits: { maxInputTokens: 8192, maxOutputTokens: 4096 },
    pricing: { prompt: '0', completion: '0', unit: 'credit' },
    capabilities: { toolCalling: true, codeGeneration: true, reasoning: false, multiModal: false },
    upstreamSlug: 'meta-llama/llama-3-8b-instruct:free',
    owned_by: 'meta',
  },

  // --- 6. Qwen Family (Zero-Cost Free Tier) ---
  {
    modelId: 'qwen/qwen-2.5-72b-instruct:free',
    modelName: 'Qwen 2.5 72B Instruct (Free Tier)',
    description: 'Alibaba top open weights model surpassing most proprietary benchmarks',
    rateMultiplier: 0,
    rateUnit: 'credit',
    supportedInputTypes: ['TEXT'],
    tokenLimits: { maxInputTokens: 128000, maxOutputTokens: 8192 },
    pricing: { prompt: '0', completion: '0', unit: 'credit' },
    capabilities: { toolCalling: true, codeGeneration: true, reasoning: true, multiModal: false },
    upstreamSlug: 'qwen/qwen-2.5-72b-instruct:free',
    owned_by: 'qwen',
  },
  {
    modelId: 'qwen/qwen-2.5-coder-32b-instruct:free',
    modelName: 'Qwen 2.5 Coder 32B Instruct (Free Tier)',
    description: 'Premier open coding model rivaling Claude 3.5 Sonnet in programming benchmarks',
    rateMultiplier: 0,
    rateUnit: 'credit',
    supportedInputTypes: ['TEXT'],
    tokenLimits: { maxInputTokens: 128000, maxOutputTokens: 16384 },
    pricing: { prompt: '0', completion: '0', unit: 'credit' },
    capabilities: { toolCalling: true, codeGeneration: true, reasoning: true, multiModal: false },
    upstreamSlug: 'qwen/qwen-2.5-coder-32b-instruct:free',
    owned_by: 'qwen',
  },
  {
    modelId: 'qwen/qwq-32b-preview:free',
    modelName: 'Qwen QwQ 32B Reasoning (Free Tier)',
    description: 'Deep mathematical and logical reasoning specialist by Qwen',
    rateMultiplier: 0,
    rateUnit: 'credit',
    supportedInputTypes: ['TEXT'],
    tokenLimits: { maxInputTokens: 32768, maxOutputTokens: 16384 },
    pricing: { prompt: '0', completion: '0', unit: 'credit' },
    capabilities: { toolCalling: false, codeGeneration: true, reasoning: true, multiModal: false },
    upstreamSlug: 'qwen/qwq-32b-preview:free',
    owned_by: 'qwen',
  },
  {
    modelId: 'qwen/qwen-2.5-7b-instruct:free',
    modelName: 'Qwen 2.5 7B Instruct (Free Tier)',
    description: 'Lightweight fast 7B model by Qwen with strong multilingual support',
    rateMultiplier: 0,
    rateUnit: 'credit',
    supportedInputTypes: ['TEXT'],
    tokenLimits: { maxInputTokens: 128000, maxOutputTokens: 8192 },
    pricing: { prompt: '0', completion: '0', unit: 'credit' },
    capabilities: { toolCalling: true, codeGeneration: true, reasoning: false, multiModal: false },
    upstreamSlug: 'qwen/qwen-2.5-7b-instruct:free',
    owned_by: 'qwen',
  },
  {
    modelId: 'qwen/qwen-2-vl-72b-instruct:free',
    modelName: 'Qwen 2 VL 72B Vision (Free Tier)',
    description: 'Advanced vision-language model understanding charts, video frames, and diagrams',
    rateMultiplier: 0,
    rateUnit: 'credit',
    supportedInputTypes: ['TEXT', 'IMAGE'],
    tokenLimits: { maxInputTokens: 32768, maxOutputTokens: 8192 },
    pricing: { prompt: '0', completion: '0', unit: 'credit' },
    capabilities: { toolCalling: true, codeGeneration: true, reasoning: true, multiModal: true },
    upstreamSlug: 'qwen/qwen-2-vl-72b-instruct:free',
    owned_by: 'qwen',
  },

  // --- 7. Mistral AI Family (Zero-Cost Free Tier) ---
  {
    modelId: 'mistralai/mistral-small-24b-instruct-2501:free',
    modelName: 'Mistral Small 24B Instruct (Free Tier)',
    description: 'Mistral 2025 release with state-of-the-art reasoning, code, and agent capabilities',
    rateMultiplier: 0,
    rateUnit: 'credit',
    supportedInputTypes: ['TEXT'],
    tokenLimits: { maxInputTokens: 32768, maxOutputTokens: 8192 },
    pricing: { prompt: '0', completion: '0', unit: 'credit' },
    capabilities: { toolCalling: true, codeGeneration: true, reasoning: true, multiModal: false },
    upstreamSlug: 'mistralai/mistral-small-24b-instruct-2501:free',
    owned_by: 'mistral',
  },
  {
    modelId: 'mistralai/mistral-nemo:free',
    modelName: 'Mistral Nemo 12B (Free Tier)',
    description: '12B parameter model built with NVIDIA featuring 128k context',
    rateMultiplier: 0,
    rateUnit: 'credit',
    supportedInputTypes: ['TEXT'],
    tokenLimits: { maxInputTokens: 128000, maxOutputTokens: 8192 },
    pricing: { prompt: '0', completion: '0', unit: 'credit' },
    capabilities: { toolCalling: true, codeGeneration: true, reasoning: false, multiModal: false },
    upstreamSlug: 'mistralai/mistral-nemo:free',
    owned_by: 'mistral',
  },
  {
    modelId: 'mistralai/mistral-7b-instruct:free',
    modelName: 'Mistral 7B Instruct (Free Tier)',
    description: 'Classic high-speed 7B instruction model',
    rateMultiplier: 0,
    rateUnit: 'credit',
    supportedInputTypes: ['TEXT'],
    tokenLimits: { maxInputTokens: 32768, maxOutputTokens: 4096 },
    pricing: { prompt: '0', completion: '0', unit: 'credit' },
    capabilities: { toolCalling: true, codeGeneration: true, reasoning: false, multiModal: false },
    upstreamSlug: 'mistralai/mistral-7b-instruct:free',
    owned_by: 'mistral',
  },
  {
    modelId: 'mistralai/pixtral-12b:free',
    modelName: 'Mistral Pixtral 12B Vision (Free Tier)',
    description: 'Multimodal image and text understanding model by Mistral',
    rateMultiplier: 0,
    rateUnit: 'credit',
    supportedInputTypes: ['TEXT', 'IMAGE'],
    tokenLimits: { maxInputTokens: 128000, maxOutputTokens: 8192 },
    pricing: { prompt: '0', completion: '0', unit: 'credit' },
    capabilities: { toolCalling: true, codeGeneration: true, reasoning: false, multiModal: true },
    upstreamSlug: 'mistralai/pixtral-12b:free',
    owned_by: 'mistral',
  },
  {
    modelId: 'mistralai/codestral-2501:free',
    modelName: 'Mistral Codestral 2501 (Free Tier)',
    description: 'Dedicated coding and fill-in-the-middle specialist',
    rateMultiplier: 0,
    rateUnit: 'credit',
    supportedInputTypes: ['TEXT'],
    tokenLimits: { maxInputTokens: 128000, maxOutputTokens: 16384 },
    pricing: { prompt: '0', completion: '0', unit: 'credit' },
    capabilities: { toolCalling: true, codeGeneration: true, reasoning: true, multiModal: false },
    upstreamSlug: 'mistralai/codestral-2501:free',
    owned_by: 'mistral',
  },

  // --- 8. Google Open Weights & Experiments (Free Tier) ---
  {
    modelId: 'google/gemini-2.0-flash-exp:free',
    modelName: 'Google Gemini 2.0 Flash Exp (Free Tier)',
    description: 'Experimental Gemini 2.0 Flash endpoint with multimodal tool calling',
    rateMultiplier: 0,
    rateUnit: 'credit',
    supportedInputTypes: ['TEXT', 'IMAGE'],
    tokenLimits: { maxInputTokens: 1000000, maxOutputTokens: 8192 },
    pricing: { prompt: '0', completion: '0', unit: 'credit' },
    capabilities: { toolCalling: true, codeGeneration: true, reasoning: true, multiModal: true },
    upstreamSlug: 'google/gemini-2.0-flash-exp:free',
    owned_by: 'google',
  },
  {
    modelId: 'google/gemini-2.0-flash-thinking-exp:free',
    modelName: 'Google Gemini 2.0 Flash Thinking Exp (Free Tier)',
    description: 'Gemini reasoning model that exposes internal chain of thought',
    rateMultiplier: 0,
    rateUnit: 'credit',
    supportedInputTypes: ['TEXT', 'IMAGE'],
    tokenLimits: { maxInputTokens: 1000000, maxOutputTokens: 16384 },
    pricing: { prompt: '0', completion: '0', unit: 'credit' },
    capabilities: { toolCalling: true, codeGeneration: true, reasoning: true, multiModal: true },
    upstreamSlug: 'google/gemini-2.0-flash-thinking-exp:free',
    owned_by: 'google',
  },
  {
    modelId: 'google/gemini-2.0-pro-exp-02-05:free',
    modelName: 'Google Gemini 2.0 Pro Exp 02-05 (Free Tier)',
    description: 'Latest Gemini 2.0 Pro experimental release with coding excellence',
    rateMultiplier: 0,
    rateUnit: 'credit',
    supportedInputTypes: ['TEXT', 'IMAGE'],
    tokenLimits: { maxInputTokens: 1000000, maxOutputTokens: 16384 },
    pricing: { prompt: '0', completion: '0', unit: 'credit' },
    capabilities: { toolCalling: true, codeGeneration: true, reasoning: true, multiModal: true },
    upstreamSlug: 'google/gemini-2.0-pro-exp-02-05:free',
    owned_by: 'google',
  },
  {
    modelId: 'google/gemma-2-27b-it:free',
    modelName: 'Google Gemma 2 27B Instruct (Free Tier)',
    description: 'Google open weights 27B instruction model running on free compute',
    rateMultiplier: 0,
    rateUnit: 'credit',
    supportedInputTypes: ['TEXT'],
    tokenLimits: { maxInputTokens: 8192, maxOutputTokens: 4096 },
    pricing: { prompt: '0', completion: '0', unit: 'credit' },
    capabilities: { toolCalling: false, codeGeneration: true, reasoning: true, multiModal: false },
    upstreamSlug: 'google/gemma-2-27b-it:free',
    owned_by: 'google',
  },
  {
    modelId: 'google/gemma-2-9b-it:free',
    modelName: 'Google Gemma 2 9B Instruct (Free Tier)',
    description: 'Google open weights 9B instruction model for fast general tasks',
    rateMultiplier: 0,
    rateUnit: 'credit',
    supportedInputTypes: ['TEXT'],
    tokenLimits: { maxInputTokens: 8192, maxOutputTokens: 4096 },
    pricing: { prompt: '0', completion: '0', unit: 'credit' },
    capabilities: { toolCalling: false, codeGeneration: true, reasoning: false, multiModal: false },
    upstreamSlug: 'google/gemma-2-9b-it:free',
    owned_by: 'google',
  },

  // --- 9. Microsoft Family (Zero-Cost Free Tier) ---
  {
    modelId: 'microsoft/phi-4:free',
    modelName: 'Microsoft Phi-4 14B (Free Tier)',
    description: 'Microsoft state-of-the-art 14B synthetic data reasoning model',
    rateMultiplier: 0,
    rateUnit: 'credit',
    supportedInputTypes: ['TEXT'],
    tokenLimits: { maxInputTokens: 16384, maxOutputTokens: 8192 },
    pricing: { prompt: '0', completion: '0', unit: 'credit' },
    capabilities: { toolCalling: false, codeGeneration: true, reasoning: true, multiModal: false },
    upstreamSlug: 'microsoft/phi-4:free',
    owned_by: 'microsoft',
  },
  {
    modelId: 'microsoft/phi-3-medium-128k-instruct:free',
    modelName: 'Microsoft Phi-3 Medium 14B 128k (Free Tier)',
    description: '14B parameters with 128k long context capability',
    rateMultiplier: 0,
    rateUnit: 'credit',
    supportedInputTypes: ['TEXT'],
    tokenLimits: { maxInputTokens: 128000, maxOutputTokens: 8192 },
    pricing: { prompt: '0', completion: '0', unit: 'credit' },
    capabilities: { toolCalling: false, codeGeneration: true, reasoning: false, multiModal: false },
    upstreamSlug: 'microsoft/phi-3-medium-128k-instruct:free',
    owned_by: 'microsoft',
  },
  {
    modelId: 'microsoft/phi-3-mini-128k-instruct:free',
    modelName: 'Microsoft Phi-3 Mini 3.8B 128k (Free Tier)',
    description: 'Fast lightweight 3.8B model with 128k context',
    rateMultiplier: 0,
    rateUnit: 'credit',
    supportedInputTypes: ['TEXT'],
    tokenLimits: { maxInputTokens: 128000, maxOutputTokens: 4096 },
    pricing: { prompt: '0', completion: '0', unit: 'credit' },
    capabilities: { toolCalling: false, codeGeneration: false, reasoning: false, multiModal: false },
    upstreamSlug: 'microsoft/phi-3-mini-128k-instruct:free',
    owned_by: 'microsoft',
  },

  // --- 10. Community & Frontier Uncensored (Zero-Cost Free Tier) ---
  {
    modelId: 'nousresearch/hermes-3-llama-3.1-405b:free',
    modelName: 'Nous Hermes 3 Llama 3.1 405B (Free Tier)',
    description: 'Frontier open agentic model with advanced steering and tool use',
    rateMultiplier: 0,
    rateUnit: 'credit',
    supportedInputTypes: ['TEXT'],
    tokenLimits: { maxInputTokens: 128000, maxOutputTokens: 16384 },
    pricing: { prompt: '0', completion: '0', unit: 'credit' },
    capabilities: { toolCalling: true, codeGeneration: true, reasoning: true, multiModal: false },
    upstreamSlug: 'nousresearch/hermes-3-llama-3.1-405b:free',
    owned_by: 'nousresearch',
  },
  {
    modelId: 'cognitivecomputations/dolphin3.0-r1-mistral-24b:free',
    modelName: 'Dolphin 3.0 R1 Mistral 24B (Free Tier)',
    description: 'Uncensored reasoning model distilled with DeepSeek R1 logic on Mistral 24B',
    rateMultiplier: 0,
    rateUnit: 'credit',
    supportedInputTypes: ['TEXT'],
    tokenLimits: { maxInputTokens: 32768, maxOutputTokens: 8192 },
    pricing: { prompt: '0', completion: '0', unit: 'credit' },
    capabilities: { toolCalling: false, codeGeneration: true, reasoning: true, multiModal: false },
    upstreamSlug: 'cognitivecomputations/dolphin3.0-r1-mistral-24b:free',
    owned_by: 'cognitivecomputations',
  },
  {
    modelId: 'cognitivecomputations/dolphin3.0-mistral-24b:free',
    modelName: 'Dolphin 3.0 Mistral 24B (Free Tier)',
    description: 'High-capability uncensored instruction model by Cognitive Computations',
    rateMultiplier: 0,
    rateUnit: 'credit',
    supportedInputTypes: ['TEXT'],
    tokenLimits: { maxInputTokens: 32768, maxOutputTokens: 8192 },
    pricing: { prompt: '0', completion: '0', unit: 'credit' },
    capabilities: { toolCalling: false, codeGeneration: true, reasoning: false, multiModal: false },
    upstreamSlug: 'cognitivecomputations/dolphin3.0-mistral-24b:free',
    owned_by: 'cognitivecomputations',
  },
  {
    modelId: 'sophosympatheia/rogue-rose-103b-v0.2:free',
    modelName: 'Rogue Rose 103B v0.2 (Free Tier)',
    description: 'High parameter creative writing and roleplay community model',
    rateMultiplier: 0,
    rateUnit: 'credit',
    supportedInputTypes: ['TEXT'],
    tokenLimits: { maxInputTokens: 4096, maxOutputTokens: 4096 },
    pricing: { prompt: '0', completion: '0', unit: 'credit' },
    capabilities: { toolCalling: false, codeGeneration: false, reasoning: false, multiModal: false },
    upstreamSlug: 'sophosympatheia/rogue-rose-103b-v0.2:free',
    owned_by: 'community',
  },
  {
    modelId: 'gryphe/mythomax-l2-13b:free',
    modelName: 'MythoMax L2 13B (Free Tier)',
    description: 'Legendary versatile merge model for narrative and dialog generation',
    rateMultiplier: 0,
    rateUnit: 'credit',
    supportedInputTypes: ['TEXT'],
    tokenLimits: { maxInputTokens: 4096, maxOutputTokens: 4096 },
    pricing: { prompt: '0', completion: '0', unit: 'credit' },
    capabilities: { toolCalling: false, codeGeneration: false, reasoning: false, multiModal: false },
    upstreamSlug: 'gryphe/mythomax-l2-13b:free',
    owned_by: 'community',
  },
  {
    modelId: 'openchat/openchat-7b:free',
    modelName: 'OpenChat 7B (Free Tier)',
    description: 'Conditioned RL fine-tuned 7B model surpassing earlier benchmarks',
    rateMultiplier: 0,
    rateUnit: 'credit',
    supportedInputTypes: ['TEXT'],
    tokenLimits: { maxInputTokens: 8192, maxOutputTokens: 4096 },
    pricing: { prompt: '0', completion: '0', unit: 'credit' },
    capabilities: { toolCalling: false, codeGeneration: true, reasoning: false, multiModal: false },
    upstreamSlug: 'openchat/openchat-7b:free',
    owned_by: 'community',
  },
  {
    modelId: 'undi95/toppy-m-7b:free',
    modelName: 'Toppy M 7B (Free Tier)',
    description: 'Multi-model merge of top 7B models',
    rateMultiplier: 0,
    rateUnit: 'credit',
    supportedInputTypes: ['TEXT'],
    tokenLimits: { maxInputTokens: 4096, maxOutputTokens: 4096 },
    pricing: { prompt: '0', completion: '0', unit: 'credit' },
    capabilities: { toolCalling: false, codeGeneration: false, reasoning: false, multiModal: false },
    upstreamSlug: 'undi95/toppy-m-7b:free',
    owned_by: 'community',
  },
  {
    modelId: 'huggingfaceh4/zephyr-7b-beta:free',
    modelName: 'Zephyr 7B Beta (Free Tier)',
    description: 'Direct Preference Optimization (DPO) tuned 7B assistant',
    rateMultiplier: 0,
    rateUnit: 'credit',
    supportedInputTypes: ['TEXT'],
    tokenLimits: { maxInputTokens: 4096, maxOutputTokens: 4096 },
    pricing: { prompt: '0', completion: '0', unit: 'credit' },
    capabilities: { toolCalling: false, codeGeneration: false, reasoning: false, multiModal: false },
    upstreamSlug: 'huggingfaceh4/zephyr-7b-beta:free',
    owned_by: 'community',
  },

  // --- 11. Canvas Reverse-Polling Bridge ---
  {
    modelId: 'canvas-auto',
    modelName: 'Gemini Canvas Cloud Bridge (Auto)',
    description: 'Zero-cost browser extension bridge to Gemini Web UI with automatic fallbacks',
    rateMultiplier: 0,
    rateUnit: 'credit',
    supportedInputTypes: ['TEXT', 'IMAGE'],
    tokenLimits: { maxInputTokens: 128000, maxOutputTokens: 16384 },
    pricing: { prompt: '0', completion: '0', unit: 'credit' },
    capabilities: { toolCalling: false, codeGeneration: true, reasoning: true, multiModal: true },
    owned_by: 'canvas-bridge',
  },
  {
    modelId: 'canvas-gemini-flash',
    modelName: 'Gemini Canvas Flash Bridge (Zero-Cost)',
    description: 'Native Cloud HTTPS reverse-polling bridge model (no ngrok required)',
    rateMultiplier: 0,
    rateUnit: 'credit',
    supportedInputTypes: ['TEXT', 'IMAGE'],
    tokenLimits: { maxInputTokens: 128000, maxOutputTokens: 16384 },
    pricing: { prompt: '0', completion: '0', unit: 'credit' },
    capabilities: { toolCalling: false, codeGeneration: true, reasoning: false, multiModal: false },
    owned_by: 'canvas-bridge',
  },
  {
    modelId: 'canvas-gemini-pro',
    modelName: 'Gemini Canvas Pro Bridge (Zero-Cost)',
    description: 'Native Cloud HTTPS reverse-polling bridge to Gemini Pro Web UI',
    rateMultiplier: 0,
    rateUnit: 'credit',
    supportedInputTypes: ['TEXT', 'IMAGE'],
    tokenLimits: { maxInputTokens: 128000, maxOutputTokens: 32768 },
    pricing: { prompt: '0', completion: '0', unit: 'credit' },
    capabilities: { toolCalling: false, codeGeneration: true, reasoning: true, multiModal: true },
    owned_by: 'canvas-bridge',
  },
  {
    modelId: 'ngrok-gemini-flash',
    modelName: 'Gemini Canvas Bridge (Legacy Alias)',
    description: 'Reverse-polling bridge model alias for backwards compatibility',
    rateMultiplier: 0,
    rateUnit: 'credit',
    supportedInputTypes: ['TEXT', 'IMAGE'],
    tokenLimits: { maxInputTokens: 128000, maxOutputTokens: 16384 },
    pricing: { prompt: '0', completion: '0', unit: 'credit' },
    capabilities: { toolCalling: false, codeGeneration: true, reasoning: false, multiModal: false },
    owned_by: 'canvas-bridge',
  },
];

/**
 * In-memory dynamic free models discovered from live provider endpoints.
 */
const dynamicFreeModels = new Map<string, ModelCatalogEntry>();
let lastSyncTimestamp = 0;
let isSyncing = false;

/**
 * Formats a raw model ID into a user-friendly name.
 */
function formatModelName(modelId: string): string {
  const parts = modelId.split('/');
  const raw = parts[parts.length - 1] || modelId;
  const clean = raw
    .replace(/:free$/, '')
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
  return `${clean} (Free Tier)`;
}

/**
 * Fetches the latest free models from OpenRouter public API (no key required)
 * and auto-populates dynamicFreeModels cache.
 */
export async function syncFreeModelsFromProviders(cfg?: KiroGatewayConfig): Promise<{ count: number; total: number }> {
  if (isSyncing) {
    return { count: dynamicFreeModels.size, total: RICH_MODEL_CATALOG.length + dynamicFreeModels.size };
  }
  isSyncing = true;
  const config = cfg || configManager.getConfig();

  try {
    // 1. Fetch live free models from OpenRouter public API (authenticated if key present)
    const orController = new AbortController();
    const orTimeout = setTimeout(() => orController.abort(), 6000);
    const orHeaders: Record<string, string> = {
      'Accept': 'application/json',
      'User-Agent': 'KiroProxy-Gateway/2.8.0',
    };
    if (config.openrouterApiKey) {
      orHeaders['Authorization'] = `Bearer ${config.openrouterApiKey}`;
    }

    try {
      const resp = await fetch('https://openrouter.ai/api/v1/models', {
        headers: orHeaders,
        signal: orController.signal,
      }).finally(() => clearTimeout(orTimeout));

      if (resp.ok) {
        const data: any = await resp.json();
        if (Array.isArray(data.data)) {
          for (const item of data.data) {
            const id = item.id || '';
            const isFreeSlug = id.endsWith(':free');
            const isZeroPricing =
              (item.pricing?.prompt === '0' || item.pricing?.prompt === 0) &&
              (item.pricing?.completion === '0' || item.pricing?.completion === 0);

            if (isFreeSlug || isZeroPricing) {
              const friendlyName = item.name || formatModelName(id);
              const description = item.description || `Zero-cost free model on OpenRouter (${id})`;
              const contextLength = item.context_length || 128000;
              const maxOutput = item.top_provider?.max_completion_tokens || 8192;

              dynamicFreeModels.set(id, {
                modelId: id,
                modelName: friendlyName.includes('Free') ? friendlyName : `${friendlyName} (Free)`,
                description: description.slice(0, 150),
                rateMultiplier: 0,
                rateUnit: 'credit',
                supportedInputTypes: item.architecture?.modality?.includes('image') ? ['TEXT', 'IMAGE'] : ['TEXT'],
                tokenLimits: {
                  maxInputTokens: contextLength,
                  maxOutputTokens: maxOutput,
                },
                pricing: { prompt: '0', completion: '0', unit: 'credit' },
                capabilities: {
                  toolCalling: Boolean(item.description?.toLowerCase().includes('tool') || id.includes('instruct') || id.includes('chat')),
                  codeGeneration: Boolean(id.includes('code') || id.includes('qwen') || id.includes('llama') || id.includes('deepseek') || id.includes('gemini')),
                  reasoning: Boolean(id.includes('r1') || id.includes('qwq') || id.includes('thinking') || id.includes('reason')),
                  multiModal: Boolean(item.architecture?.modality?.includes('image') || id.includes('vl') || id.includes('vision')),
                },
                upstreamSlug: id,
                owned_by: item.id?.split('/')[0] || 'openrouter-free',
              });
            }
          }
          lastSyncTimestamp = Date.now();
          console.log(`[ModelCatalog] Auto-populated ${dynamicFreeModels.size} live free models from OpenRouter.`);
        }
      }
    } catch (orErr: any) {
      console.warn(`[ModelCatalog] OpenRouter sync warning: ${orErr.message}`);
    }

    // 2. Auto-populate models from configured Custom Providers (e.g. Groq, Together, DeepSeek, Cerebras, GLM)
    if (Array.isArray(config.customProviders)) {
      for (const cp of config.customProviders) {
        if (!cp.enabled || cp.autoPopulate === false) continue;

        const candidateUrls = (Array.isArray(cp.baseUrls) && cp.baseUrls.length > 0)
          ? cp.baseUrls
          : (cp.baseUrl ? [cp.baseUrl] : []);
        const candidateKeys = (Array.isArray(cp.apiKeys) && cp.apiKeys.length > 0)
          ? cp.apiKeys
          : (cp.apiKey ? [cp.apiKey] : ['']);

        for (const rawUrl of candidateUrls) {
          if (!rawUrl || rawUrl.includes('generativelanguage.googleapis.com')) continue;
          let modelsUrl = rawUrl.trim().replace(/\/+$/, '');
          if (modelsUrl.endsWith('/chat/completions')) {
            modelsUrl = modelsUrl.replace(/\/chat\/completions$/, '/models');
          } else if (modelsUrl.endsWith('/v1') || modelsUrl.endsWith('/api/v1')) {
            modelsUrl = `${modelsUrl}/models`;
          } else if (!modelsUrl.endsWith('/models')) {
            modelsUrl = `${modelsUrl}/models`;
          }

          let providerDiscovered = false;
          for (const key of candidateKeys) {
            try {
              const cpController = new AbortController();
              const cpTimeout = setTimeout(() => cpController.abort(), 4000);
              const cpHeaders: Record<string, string> = {
                'Accept': 'application/json',
                'User-Agent': 'KiroProxy-Gateway/2.8.0',
              };
              if (key && key.trim().length > 0) {
                cpHeaders['Authorization'] = `Bearer ${key.trim()}`;
              }

              const cpResp = await fetch(modelsUrl, {
                headers: cpHeaders,
                signal: cpController.signal,
              }).finally(() => clearTimeout(cpTimeout));

              if (cpResp.ok) {
                const cpData: any = await cpResp.json();
                const modelList = Array.isArray(cpData.data)
                  ? cpData.data
                  : (Array.isArray(cpData.models) ? cpData.models : []);

                for (const item of modelList) {
                  const id = typeof item === 'string' ? item : (item.id || item.name || '');
                  if (!id) continue;

                  if (cp.freeOnly) {
                    const isFree = id.includes('free') || item.pricing?.prompt === '0' || item.pricing?.prompt === 0;
                    if (!isFree) continue;
                  }

                  const rawName = typeof item === 'object' && item.name ? item.name : formatModelName(id);
                  const friendlyName = `${cp.name} - ${rawName}`;
                  const description = typeof item === 'object' && item.description
                    ? item.description
                    : `Discovered model from custom provider ${cp.name} (${id})`;

                  dynamicFreeModels.set(id, {
                    modelId: id,
                    modelName: friendlyName,
                    description: description.slice(0, 160),
                    rateMultiplier: 0,
                    rateUnit: 'credit',
                    supportedInputTypes: ['TEXT', 'IMAGE'],
                    tokenLimits: {
                      maxInputTokens: typeof item === 'object' && item.context_length ? item.context_length : 128000,
                      maxOutputTokens: 16384,
                    },
                    pricing: { prompt: '0', completion: '0', unit: 'credit' },
                    capabilities: {
                      toolCalling: true,
                      codeGeneration: true,
                      reasoning: id.includes('r1') || id.includes('qwq') || id.includes('reason'),
                      multiModal: Boolean(id.includes('vl') || id.includes('vision') || id.includes('4o')),
                    },
                    upstreamSlug: id,
                    owned_by: cp.name.toLowerCase().replace(/\s+/g, '-'),
                  });
                }
                console.log(`[ModelCatalog] Auto-populated ${modelList.length} models from custom provider ${cp.name} (${modelsUrl}).`);
                providerDiscovered = true;
                break;
              }
            } catch {
              // Ignore and try next key or url
            }
          }
          if (providerDiscovered) break;
        }
      }
    }
  } catch (err: any) {
    console.warn(`[ModelCatalog] Background live free model sync: ${err.message}. Using built-in catalog.`);
  } finally {
    isSyncing = false;
    cachedCatalog = null;
    lastCacheKey = '';
  }

  return {
    count: dynamicFreeModels.size,
    total: RICH_MODEL_CATALOG.length + dynamicFreeModels.size,
  };
}

let cachedCatalog: ModelCatalogEntry[] | null = null;
let lastCacheKey = '';

export function invalidateCatalogCache(): void {
  cachedCatalog = null;
  lastCacheKey = '';
}

/**
 * Returns the unified model catalog with all free models auto-populated from all providers.
 */
export function getCompleteModelCatalog(config: KiroGatewayConfig): ModelCatalogEntry[] {
  const cacheKey = `${dynamicFreeModels.size}:${(config.customProviders || []).map((cp) => `${cp.enabled}:${cp.activeModel}`).join('|')}`;
  if (cachedCatalog && lastCacheKey === cacheKey) {
    return cachedCatalog;
  }

  const modelMap = new Map<string, ModelCatalogEntry>();

  // 1. Pre-seeded Rich Catalog (highest precedence for carefully crafted names and token limits)
  for (const entry of RICH_MODEL_CATALOG) {
    modelMap.set(entry.modelId, entry);
  }

  // 2. Dynamically discovered free models from live provider endpoints
  for (const [id, entry] of dynamicFreeModels.entries()) {
    if (!modelMap.has(id)) {
      modelMap.set(id, entry);
    }
  }

  // 3. Fallback for all configured free models across Kilo, OpenRouter, Cline, OrcaRouter, Gemini
  const allOtomodeSlugs = [
    ...KILO_FREE_MODELS,
    ...OPENROUTER_FREE_MODELS,
    ...CLINE_FREE_MODELS,
    ...ORCAROUTER_FREE_MODELS,
    ...GEMINI_ROTATION_MODELS,
  ];

  for (const slug of allOtomodeSlugs) {
    if (!modelMap.has(slug)) {
      const parts = slug.split('/');
      const friendlyName = formatModelName(slug);
      const isGemini = slug.includes('gemini');

      modelMap.set(slug, {
        modelId: slug,
        modelName: friendlyName,
        description: `Zero-cost community free model (${slug})`,
        rateMultiplier: 0,
        rateUnit: 'credit',
        supportedInputTypes: isGemini ? ['TEXT', 'IMAGE'] : ['TEXT'],
        tokenLimits: { maxInputTokens: 128000, maxOutputTokens: 8192 },
        pricing: { prompt: '0', completion: '0', unit: 'credit' },
        capabilities: {
          toolCalling: true,
          codeGeneration: true,
          reasoning: slug.includes('r1') || slug.includes('qwq'),
          multiModal: isGemini || slug.includes('vision') || slug.includes('vl'),
        },
        upstreamSlug: slug,
        owned_by: parts.length > 1 ? parts[0] : (isGemini ? 'google' : 'community'),
      });
    }
  }

  // 4. Custom Providers from config
  if (Array.isArray(config.customProviders)) {
    for (const cp of config.customProviders) {
      if (cp.enabled && cp.activeModel && !modelMap.has(cp.activeModel)) {
        modelMap.set(cp.activeModel, {
          modelId: cp.activeModel,
          modelName: `${cp.name} (${cp.activeModel})`,
          description: cp.notes || `Custom provider upstream model for ${cp.name}`,
          rateMultiplier: 0,
          rateUnit: 'credit',
          supportedInputTypes: ['TEXT', 'IMAGE'],
          tokenLimits: { maxInputTokens: 128000, maxOutputTokens: 16384 },
          pricing: { prompt: '0', completion: '0', unit: 'credit' },
          capabilities: { toolCalling: true, codeGeneration: true, reasoning: true, multiModal: true },
          owned_by: cp.name.toLowerCase().replace(/\s+/g, '-'),
        });
      }
    }
  }

  const result = Array.from(modelMap.values());
  cachedCatalog = result;
  lastCacheKey = cacheKey;
  return result;
}

// Kick off initial background auto-sync immediately (non-blocking)
setTimeout(() => {
  syncFreeModelsFromProviders().catch(() => {});
}, 1000);
