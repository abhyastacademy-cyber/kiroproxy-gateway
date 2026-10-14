import React, { useState, useMemo } from 'react';
import {
  Calculator,
  Zap,
  ShieldCheck,
  TrendingUp,
  Sparkles,
  Layers,
  DollarSign,
  Clock,
  ArrowRight,
  CheckCircle2,
  Sliders,
  Cpu,
  Key,
  Globe,
} from 'lucide-react';
import type { GatewayConfig } from '../types.js';

interface FreeTierCalculatorProps {
  config: GatewayConfig | null;
  onNavigateTab?: (tab: string) => void;
}

interface ProviderLimitInfo {
  id: string;
  name: string;
  description: string;
  freeModelsCount: number;
  dailyRequestsPerKey: number;
  keysCount: number;
  totalDailyRequests: number;
  monthlyTokensEstM: number; // Millions of tokens
  estimatedMonthlyValueUsd: number;
  isEnabled: boolean;
  statusText: string;
}

export const FreeTierCalculator: React.FC<FreeTierCalculatorProps> = ({ config, onNavigateTab }) => {
  // Interactive Simulation Controls
  const [dailyPrompts, setDailyPrompts] = useState<number>(120);
  const [avgTokensPerRequest, setAvgTokensPerRequest] = useState<number>(1800);
  const [isExpanded, setIsExpanded] = useState<boolean>(true);

  // Calculate Provider Limits based on active Gateway Configuration
  const providerStats = useMemo<ProviderLimitInfo[]>(() => {
    // 1. Kilo Gateway (Zero-Key support + optional keys)
    const kiloKeysCount = Math.max(
      1,
      ((config as any)?.kiloApiKeys?.length || 0) + (Boolean((config as any)?.kiloApiKey) ? 1 : 0)
    );
    const isKiloActive = (config?.providerPriorityOrder || []).includes('kilo');

    // 2. Google Gemini Direct (1,500 RPD per key for Flash, 50 RPD for Pro)
    const geminiKeys: string[] = [];
    if (Array.isArray((config as any)?.geminiApiKeys)) {
      for (const k of (config as any).geminiApiKeys) {
        if (k && !geminiKeys.includes(k)) geminiKeys.push(k);
      }
    }
    if (config?.geminiApiKey && !geminiKeys.includes(config.geminiApiKey)) {
      geminiKeys.push(config.geminiApiKey);
    }
    const geminiKeysCount = Math.max(1, geminiKeys.length);
    const isGeminiActive = (config?.providerPriorityOrder || []).includes('gemini');

    // 3. OpenRouter Free Tier (200 RPD per free account/key)
    const orKeys: string[] = [];
    if (Array.isArray((config as any)?.openrouterApiKeys)) {
      for (const k of (config as any).openrouterApiKeys) {
        if (k && !orKeys.includes(k)) orKeys.push(k);
      }
    }
    if ((config as any)?.openrouterApiKey && !orKeys.includes((config as any).openrouterApiKey)) {
      orKeys.push((config as any).openrouterApiKey);
    }
    const orKeysCount = Math.max(1, orKeys.length);
    const isOpenRouterActive = (config?.providerPriorityOrder || []).includes('openrouter');

    // 4. Cline API (300 RPD)
    const isClineActive = (config?.providerPriorityOrder || []).includes('cline');

    // 5. OrcaRouter (250 RPD)
    const isOrcaActive = (config?.providerPriorityOrder || []).includes('orcarouter');

    // 6. Canvas Bridge (Gemini Web reverse-polling ~150 RPD)
    const isCanvasActive = (config?.providerPriorityOrder || []).includes('canvas');

    // 7. Custom Endpoints
    const customList = config?.customProviders || [];
    const enabledCustomCount = customList.filter((cp) => cp.enabled).length;
    const isCustomActive = (config?.providerPriorityOrder || []).includes('custom') && enabledCustomCount > 0;

    const list: ProviderLimitInfo[] = [
      {
        id: 'gemini',
        name: 'Google Gemini Direct',
        description: '1,500 Requests/Day per API key for Gemini 2.5 Flash & 2.0 Flash',
        freeModelsCount: 6,
        dailyRequestsPerKey: 1500,
        keysCount: geminiKeysCount,
        totalDailyRequests: 1500 * geminiKeysCount,
        monthlyTokensEstM: 45 * geminiKeysCount * 1.5, // ~67.5M tokens/key
        estimatedMonthlyValueUsd: 135 * geminiKeysCount,
        isEnabled: isGeminiActive,
        statusText: `${geminiKeysCount} Key${geminiKeysCount > 1 ? 's' : ''} Configured (${(1500 * geminiKeysCount).toLocaleString()} req/day)`,
      },
      {
        id: 'kilo',
        name: 'Kilo Code Gateway',
        description: 'Zero-cost developer tier with 177+ open-weight models',
        freeModelsCount: 177,
        dailyRequestsPerKey: 500,
        keysCount: kiloKeysCount,
        totalDailyRequests: 500 * kiloKeysCount,
        monthlyTokensEstM: 22.5 * kiloKeysCount,
        estimatedMonthlyValueUsd: 85 * kiloKeysCount,
        isEnabled: isKiloActive,
        statusText: `Zero-Key Active (${(500 * kiloKeysCount).toLocaleString()} req/day)`,
      },
      {
        id: 'openrouter',
        name: 'OpenRouter Free Hub',
        description: '200 Requests/Day per account on 40+ :free catalog models',
        freeModelsCount: 42,
        dailyRequestsPerKey: 200,
        keysCount: orKeysCount,
        totalDailyRequests: 200 * orKeysCount,
        monthlyTokensEstM: 9 * orKeysCount,
        estimatedMonthlyValueUsd: 45 * orKeysCount,
        isEnabled: isOpenRouterActive,
        statusText: `${orKeysCount} Key${orKeysCount > 1 ? 's' : ''} (${(200 * orKeysCount).toLocaleString()} req/day)`,
      },
      {
        id: 'cline',
        name: 'Cline Free Engine',
        description: 'Agentic coding quota for DeepSeek V3, Qwen Coder, and Mistral',
        freeModelsCount: 18,
        dailyRequestsPerKey: 300,
        keysCount: 1,
        totalDailyRequests: 300,
        monthlyTokensEstM: 13.5,
        estimatedMonthlyValueUsd: 60,
        isEnabled: isClineActive,
        statusText: 'Active Tier (300 req/day)',
      },
      {
        id: 'orcarouter',
        name: 'OrcaRouter Free Tier',
        description: 'High-throughput reasoning router for DeepSeek R1 & Llama 3.3',
        freeModelsCount: 14,
        dailyRequestsPerKey: 250,
        keysCount: 1,
        totalDailyRequests: 250,
        monthlyTokensEstM: 11.2,
        estimatedMonthlyValueUsd: 50,
        isEnabled: isOrcaActive,
        statusText: 'Active Tier (250 req/day)',
      },
      {
        id: 'canvas',
        name: 'Canvas Web Bridge',
        description: 'Sandboxed browser reverse-polling worker for Gemini Canvas sessions',
        freeModelsCount: 4,
        dailyRequestsPerKey: 150,
        keysCount: 1,
        totalDailyRequests: 150,
        monthlyTokensEstM: 8.0,
        estimatedMonthlyValueUsd: 40,
        isEnabled: isCanvasActive,
        statusText: 'Live Worker (~150 req/day)',
      },
      {
        id: 'custom',
        name: 'Custom Self-Hosted Endpoints',
        description: 'User-configured local Ollama, vLLM, or 3rd-party free API endpoints',
        freeModelsCount: customList.reduce((acc, c) => acc + (c.enabled ? 1 : 0), 0) || 1,
        dailyRequestsPerKey: 1000,
        keysCount: Math.max(1, enabledCustomCount),
        totalDailyRequests: enabledCustomCount > 0 ? enabledCustomCount * 1000 : 0,
        monthlyTokensEstM: enabledCustomCount > 0 ? enabledCustomCount * 45 : 0,
        estimatedMonthlyValueUsd: enabledCustomCount > 0 ? enabledCustomCount * 75 : 0,
        isEnabled: isCustomActive,
        statusText: enabledCustomCount > 0 ? `${enabledCustomCount} Endpoint${enabledCustomCount > 1 ? 's' : ''} Active` : 'None Configured',
      },
    ];

    return list;
  }, [config]);

  // Aggregated Totals
  const activeProviders = useMemo(() => providerStats.filter((p) => p.isEnabled), [providerStats]);

  const aggregatedTotals = useMemo(() => {
    let totalDailyReq = 0;
    let totalMonthlyTokensM = 0;
    let totalMonthlyValueUsd = 0;

    for (const p of activeProviders) {
      totalDailyReq += p.totalDailyRequests;
      totalMonthlyTokensM += p.monthlyTokensEstM;
      totalMonthlyValueUsd += p.estimatedMonthlyValueUsd;
    }

    const totalMonthlyReq = totalDailyReq * 30;

    // Simulation metrics
    const userMonthlyPrompts = dailyPrompts * 30;
    const userMonthlyTokensM = (userMonthlyPrompts * avgTokensPerRequest) / 1_000_000;
    const capacityConsumedPct = totalMonthlyReq > 0 ? (userMonthlyPrompts / totalMonthlyReq) * 100 : 0;
    const runwayDays = dailyPrompts > 0 ? Math.min(30, Math.floor(totalMonthlyReq / dailyPrompts)) : 30;

    // Commercial Cost Comparison (e.g. OpenAI GPT-4o / Claude 3.5 Sonnet blend @ ~$6.50/M tokens)
    const commercialValueSaved = userMonthlyTokensM * 6.5;

    return {
      totalDailyReq,
      totalMonthlyReq,
      totalMonthlyTokensM,
      totalMonthlyValueUsd,
      userMonthlyPrompts,
      userMonthlyTokensM,
      capacityConsumedPct: Math.min(100, Math.round(capacityConsumedPct * 10) / 10),
      runwayDays,
      commercialValueSaved: Math.round(commercialValueSaved * 100) / 100,
    };
  }, [activeProviders, dailyPrompts, avgTokensPerRequest]);

  return (
    <div className="rounded-2xl bg-[#0f0f12] border border-[#27272a] p-5 sm:p-6 space-y-6">
      {/* Header and Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#27272a]">
        <div>
          <div className="flex items-center gap-2">
            <Calculator className="w-5 h-5 text-emerald-400" />
            <h3 className="text-base font-bold text-[#fafafa]">
              Free AI Tier & Monthly Budget Calculator
            </h3>
            <span className="text-[11px] font-mono font-medium text-emerald-400/90 ml-1">
              Active Quota Accumulator
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Visualizes real-time accumulated free limits across all active gateway tiers. When multiple providers offer identical free models (DeepSeek, Llama, Qwen), quotas stack seamlessly.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#141417] hover:bg-[#1c1c21] text-zinc-300 border border-[#27272a] text-xs font-medium cursor-pointer transition-colors"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>{isExpanded ? 'Collapse Calculator' : 'Expand Calculator'}</span>
          </button>
        </div>
      </div>

      {isExpanded && (
        <>
          {/* Top Aggregated Metric Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Total Monthly Value */}
            <div className="p-4 rounded-xl bg-[#09090b] border border-[#27272a] space-y-1">
              <div className="flex items-center justify-between text-zinc-400">
                <span className="text-xs font-medium">Free Monthly Value</span>
                <DollarSign className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-xl sm:text-2xl font-bold font-mono text-emerald-300">
                ${aggregatedTotals.totalMonthlyValueUsd.toLocaleString()}
                <span className="text-xs font-normal text-zinc-500 font-sans ml-1">/mo</span>
              </div>
              <div className="text-[11px] text-zinc-400">
                Equivalent commercial AI compute
              </div>
            </div>

            {/* Total Monthly Requests */}
            <div className="p-4 rounded-xl bg-[#09090b] border border-[#27272a] space-y-1">
              <div className="flex items-center justify-between text-zinc-400">
                <span className="text-xs font-medium">Monthly Requests Limit</span>
                <Zap className="w-4 h-4 text-cyan-400" />
              </div>
              <div className="text-xl sm:text-2xl font-bold font-mono text-cyan-300">
                {aggregatedTotals.totalMonthlyReq.toLocaleString()}
                <span className="text-xs font-normal text-zinc-500 font-sans ml-1">reqs</span>
              </div>
              <div className="text-[11px] text-zinc-400">
                {aggregatedTotals.totalDailyReq.toLocaleString()} requests / day max
              </div>
            </div>

            {/* Monthly Free Tokens */}
            <div className="p-4 rounded-xl bg-[#09090b] border border-[#27272a] space-y-1">
              <div className="flex items-center justify-between text-zinc-400">
                <span className="text-xs font-medium">Monthly Token Budget</span>
                <Cpu className="w-4 h-4 text-purple-400" />
              </div>
              <div className="text-xl sm:text-2xl font-bold font-mono text-purple-300">
                ~{Math.round(aggregatedTotals.totalMonthlyTokensM)}M
                <span className="text-xs font-normal text-zinc-500 font-sans ml-1">tokens</span>
              </div>
              <div className="text-[11px] text-zinc-400">
                Across 7 zero-cost waterfall tiers
              </div>
            </div>

            {/* Active Waterfall Tiers */}
            <div className="p-4 rounded-xl bg-[#09090b] border border-[#27272a] space-y-1">
              <div className="flex items-center justify-between text-zinc-400">
                <span className="text-xs font-medium">Waterfall Resilience</span>
                <ShieldCheck className="w-4 h-4 text-blue-400" />
              </div>
              <div className="text-xl sm:text-2xl font-bold font-mono text-blue-300">
                {activeProviders.length} / {providerStats.length}
                <span className="text-xs font-normal text-zinc-500 font-sans ml-1">tiers</span>
              </div>
              <div className="text-[11px] text-zinc-400">
                Auto-failover on HTTP 429
              </div>
            </div>
          </div>

          {/* Interactive Workload Simulation Slider */}
          <div className="p-4 sm:p-5 rounded-xl bg-[#09090b] border border-[#27272a] space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                <h4 className="text-sm font-semibold text-[#fafafa]">
                  Personal Usage & Runway Simulator
                </h4>
              </div>
              <div className="text-xs text-zinc-400">
                Adjust your daily Kiro IDE workflow to see capacity utilization
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
              {/* Daily Prompts Slider */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-300 font-medium">Your Daily Kiro IDE Prompts:</span>
                  <span className="font-mono font-bold text-emerald-300 text-sm">
                    {dailyPrompts} <span className="text-zinc-500 text-xs font-normal">prompts/day</span>
                  </span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="1000"
                  step="10"
                  value={dailyPrompts}
                  onChange={(e) => setDailyPrompts(Number(e.target.value))}
                  className="w-full h-1.5 bg-[#27272a] rounded-lg appearance-none cursor-pointer accent-emerald-400"
                />
                <div className="flex justify-between text-[10px] text-zinc-500 font-mono">
                  <span>10 (Casual)</span>
                  <span>120 (Standard Dev)</span>
                  <span>500 (Heavy)</span>
                  <span>1000 (Agentic loop)</span>
                </div>
              </div>

              {/* Avg Tokens per Request Slider */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-300 font-medium">Avg Tokens per Prompt + Code:</span>
                  <span className="font-mono font-bold text-cyan-300 text-sm">
                    {avgTokensPerRequest.toLocaleString()} <span className="text-zinc-500 text-xs font-normal">tokens</span>
                  </span>
                </div>
                <input
                  type="range"
                  min="500"
                  max="8000"
                  step="250"
                  value={avgTokensPerRequest}
                  onChange={(e) => setAvgTokensPerRequest(Number(e.target.value))}
                  className="w-full h-1.5 bg-[#27272a] rounded-lg appearance-none cursor-pointer accent-cyan-400"
                />
                <div className="flex justify-between text-[10px] text-zinc-500 font-mono">
                  <span>500 (Snippets)</span>
                  <span>1,800 (Typical)</span>
                  <span>4,000 (Full files)</span>
                  <span>8,000 (Long context)</span>
                </div>
              </div>
            </div>

            {/* Simulated Results Banner */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-[#1c1c21]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                  <Sparkles className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <div className="text-[11px] text-zinc-400">Monthly Cost Saved</div>
                  <div className="text-base font-bold font-mono text-emerald-300">
                    ${aggregatedTotals.commercialValueSaved.toFixed(2)}
                    <span className="text-[10px] text-zinc-500 font-normal font-sans ml-1">/ month</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center shrink-0">
                  <Layers className="w-5 h-5 text-cyan-400" />
                </div>
                <div>
                  <div className="text-[11px] text-zinc-400">Free Quota Consumed</div>
                  <div className="text-base font-bold font-mono text-cyan-300">
                    {aggregatedTotals.capacityConsumedPct}%
                    <span className="text-[10px] text-emerald-400 font-normal font-sans ml-1.5">
                      (Huge Headroom)
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
                  <Clock className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <div className="text-[11px] text-zinc-400">Zero-Cost Runway</div>
                  <div className="text-base font-bold font-mono text-blue-300">
                    30+ Days
                    <span className="text-[10px] text-zinc-400 font-normal font-sans ml-1">
                      (Perpetual Free)
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Provider Limit Matrix */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                Configured Provider Capacity Breakdown
              </span>
              <span className="text-[11px] text-zinc-500">
                Rate limits accumulate when models overlap across providers
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {providerStats.map((prov) => (
                <div
                  key={prov.id}
                  className={`p-3.5 rounded-xl border flex flex-col justify-between space-y-2.5 transition-colors ${
                    prov.isEnabled
                      ? 'bg-[#09090b] border-[#27272a] hover:border-[#3f3f46]'
                      : 'bg-[#09090b]/50 border-[#1c1c21] opacity-60'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[#fafafa] flex items-center gap-1.5">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            prov.isEnabled ? 'bg-emerald-400' : 'bg-zinc-600'
                          }`}
                        />
                        {prov.name}
                      </span>
                      <span className="text-[10px] font-mono text-zinc-400">
                        {prov.statusText}
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-400 leading-snug line-clamp-2">
                      {prov.description}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-[#1c1c21] flex items-center justify-between text-[11px] font-mono">
                    <span className="text-zinc-400">
                      Cap: <strong className="text-emerald-300">{prov.totalDailyRequests.toLocaleString()}</strong> req/d
                    </span>
                    <span className="text-zinc-400">
                      Val: <strong className="text-cyan-300">${prov.estimatedMonthlyValueUsd}</strong>/mo
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Accumulation Rationale & Guide Callout */}
          <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-950/20 via-[#0f0f12] to-blue-950/20 border border-emerald-500/20 space-y-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="text-xs font-bold text-emerald-200">
                Why Multi-Provider Free Limits Multiply Your Available Budget
              </span>
            </div>
            <p className="text-[11px] text-zinc-300 leading-relaxed">
              Leading open models like <strong>DeepSeek R1</strong>, <strong>Meta Llama 3.3 70B</strong>, and <strong>Qwen 2.5 Coder</strong> are hosted on multiple zero-cost upstream providers simultaneously. If you configure keys for Kilo, OpenRouter, and custom endpoints, KiroProxy pools their rate limits: if OpenRouter returns HTTP 429 after 200 requests, KiroProxy instantly switches to Kilo (+500 requests), then OrcaRouter (+250 requests), effectively providing <strong>950+ free prompts per day</strong> without ever breaking flow or incurring API bills.
            </p>
            {onNavigateTab && (
              <div className="pt-1 flex items-center gap-3">
                <button
                  onClick={() => onNavigateTab('keys')}
                  className="text-[11px] text-emerald-300 hover:text-emerald-200 underline font-medium cursor-pointer inline-flex items-center gap-1"
                >
                  <Key className="w-3 h-3" />
                  <span>Add More API Keys to Scale Limits</span>
                </button>
                <span className="text-zinc-600">·</span>
                <button
                  onClick={() => onNavigateTab('providers')}
                  className="text-[11px] text-cyan-300 hover:text-cyan-200 underline font-medium cursor-pointer inline-flex items-center gap-1"
                >
                  <Globe className="w-3 h-3" />
                  <span>Configure Custom Base URLs</span>
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
