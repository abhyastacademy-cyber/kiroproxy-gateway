import React, { useState, useEffect } from 'react';
import { Search, Copy, Check, Play, Sparkles, RefreshCw, Zap, ShieldCheck, CheckCircle2, Globe } from 'lucide-react';
import { FreeTierCalculator } from './FreeTierCalculator.js';
import type { GatewayConfig } from '../types.js';

export interface ModelItem {
  id: string;
  name?: string;
  description?: string;
  owned_by?: string;
}

interface ModelsTabProps {
  onTestModel: (modelId: string) => void;
  config?: GatewayConfig | null;
  onNavigateTab?: (tab: string) => void;
}

export const ModelsTab: React.FC<ModelsTabProps> = ({ onTestModel, config, onNavigateTab }) => {
  const [models, setModels] = useState<ModelItem[]>([]);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);

  const fetchModels = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/v1/models');
      if (res.ok) {
        const data = await res.json();
        const seen = new Set<string>();
        const uniqueModels: ModelItem[] = [];
        for (const item of data.data || []) {
          if (item?.id && !seen.has(item.id)) {
            seen.add(item.id);
            uniqueModels.push(item);
          }
        }
        setModels(uniqueModels);
      }
    } catch (e) {
      console.warn('Failed to fetch models:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSyncProviders = async () => {
    setIsSyncing(true);
    setSyncStatus('Querying live provider endpoints for newly released free models...');
    try {
      const res = await fetch('/api/models/refresh', { method: 'POST' });
      if (res.ok) {
        const result = await res.json();
        setSyncStatus(result.message || 'Models refreshed successfully!');
        await fetchModels();
      } else {
        await fetchModels();
        setSyncStatus('Refreshed local model catalog.');
      }
    } catch (e) {
      await fetchModels();
      setSyncStatus('Refreshed local model catalog.');
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncStatus(null), 4000);
    }
  };

  useEffect(() => {
    fetchModels();
  }, []);

  const handleCopy = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  const filteredModels = models.filter((m) => {
    const id = (m.id || '').toLowerCase();
    const owner = (m.owned_by || '').toLowerCase();
    const desc = (m.description || m.name || '').toLowerCase();
    const q = search.toLowerCase().trim();

    if (activeFilter !== 'all') {
      if (activeFilter === 'auto') {
        if (!id.includes('auto') && !id.includes('otomode')) return false;
      } else if (activeFilter === 'deepseek') {
        if (!id.includes('deepseek')) return false;
      } else if (activeFilter === 'llama') {
        if (!id.includes('llama')) return false;
      } else if (activeFilter === 'qwen') {
        if (!id.includes('qwen') && !id.includes('qwq')) return false;
      } else if (activeFilter === 'mistral') {
        if (!id.includes('mistral') && !id.includes('codestral') && !id.includes('pixtral')) return false;
      } else if (activeFilter === 'gemini') {
        if (!id.includes('gemini') && !id.includes('gemma')) return false;
      } else if (activeFilter === 'canvas') {
        if (!id.includes('canvas') && !id.includes('ngrok')) return false;
      } else if (activeFilter === 'microsoft') {
        if (!id.includes('phi')) return false;
      } else if (activeFilter === 'community') {
        const communitySlugs = ['hermes', 'dolphin', 'openchat', 'zephyr', 'mythomax', 'rogue', 'toppy'];
        if (!communitySlugs.some((s) => id.includes(s))) return false;
      }
    }

    if (q && !id.includes(q) && !owner.includes(q) && !desc.includes(q)) {
      return false;
    }

    return true;
  });

  return (
    <div className="space-y-6">
      {/* Free AI Tier & Accumulated Budget Calculator */}
      <FreeTierCalculator config={config || null} onNavigateTab={onNavigateTab} />

      {/* Header section */}
      <div className="rounded-2xl bg-[#0f0f12] border border-[#27272a] p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-[#fafafa] flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-emerald-400" />
              Zero-Cost Model Catalog ({models.length} Models Loaded - Auto-Populated From All Providers)
            </h2>
            <p className="text-xs text-zinc-400 mt-1">
              Select or copy any model ID into Kiro IDE. All models are automatically exposed to Kiro IDE via{' '}
              <code className="text-emerald-300 font-mono">/listAvailableModels</code> with 7-tier zero-cost failover.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSyncProviders}
              disabled={isSyncing || isLoading}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-medium cursor-pointer transition-colors"
              title="Sync latest live free models from OpenRouter and upstream providers"
            >
              <Globe className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Syncing...' : 'Sync All Providers'}</span>
            </button>
            <button
              onClick={fetchModels}
              disabled={isLoading || isSyncing}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#141417] hover:bg-[#1c1c21] text-[#fafafa] border border-[#27272a] text-xs font-medium cursor-pointer transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Reload</span>
            </button>
          </div>
        </div>

        {syncStatus && (
          <div className="p-2.5 rounded-lg bg-emerald-950/20 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2 animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{syncStatus}</span>
          </div>
        )}

        {/* Accumulated Free AI Limits Banner */}
        <div className="p-3.5 rounded-xl bg-gradient-to-r from-emerald-950/30 to-blue-950/20 border border-emerald-500/30 flex items-start gap-3">
          <Zap className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <div className="text-xs space-y-1">
            <span className="font-semibold text-emerald-200">
              Accumulated Multi-Provider Free AI Quota Active
            </span>
            <p className="text-zinc-300 leading-relaxed text-[11px]">
              When multiple providers offer the same zero-cost model (e.g. DeepSeek R1, Llama 3.3 70B, Qwen 2.5), rate limits and daily free quotas accumulate across Kilo, Cline, OpenRouter, OrcaRouter, and Custom Endpoints. On HTTP 429 quota exhaustion, the gateway transparently fails over to the next tier, multiplying total available daily tokens and request limits.
            </p>
          </div>
        </div>

        {/* Filter bar */}
        <div className="flex flex-col gap-3 pt-2">
          <div className="relative">
            <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search 60+ models by ID, family, or provider (e.g. deepseek, r1, qwen, llama, gemini, mistral)..."
              className="w-full bg-[#09090b] border border-[#27272a] rounded-lg pl-9 pr-3 py-2 text-xs text-[#fafafa] focus:outline-none focus:border-[#fafafa]"
            />
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {[
              { id: 'all', label: `All (${models.length})` },
              { id: 'auto', label: 'Automode & Otomode' },
              { id: 'deepseek', label: 'DeepSeek (R1 / V3)' },
              { id: 'llama', label: 'Meta Llama' },
              { id: 'qwen', label: 'Qwen & QwQ' },
              { id: 'mistral', label: 'Mistral' },
              { id: 'gemini', label: 'Google Gemini' },
              { id: 'canvas', label: 'Canvas Bridge' },
              { id: 'microsoft', label: 'Microsoft Phi' },
              { id: 'community', label: 'Community' },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setActiveFilter(f.id)}
                className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-colors cursor-pointer ${
                  activeFilter === f.id
                    ? 'bg-[#fafafa] text-[#09090b] font-bold shadow-sm'
                    : 'bg-[#09090b] text-zinc-400 border border-[#27272a] hover:text-[#fafafa]'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Model Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {filteredModels.map((m, idx) => {
          const isCopied = copiedId === m.id;
          const isReasoning = m.id.includes('r1') || m.id.includes('qwq') || m.id.includes('thinking');
          const isCoder = m.id.includes('coder') || m.id.includes('codestral');
          const isVision = m.id.includes('vision') || m.id.includes('vl') || m.id.includes('pixtral');

          return (
            <div
              key={`${m.id}-${idx}`}
              className="p-4 rounded-xl bg-[#0f0f12] border border-[#27272a] hover:border-[#3f3f46] flex flex-col justify-between space-y-3 transition-colors"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <span className="font-mono text-xs font-bold text-[#fafafa] break-all">
                    {m.id}
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 whitespace-nowrap">
                    $0 FREE
                  </span>
                </div>
                <p className="text-[11px] text-zinc-400 mt-1 line-clamp-2">
                  {m.description || m.name || 'Zero-cost free model'}
                </p>

                {/* Capability tags */}
                <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                  {isReasoning && (
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-semibold bg-purple-500/10 text-purple-300 border border-purple-500/20">
                      Reasoning
                    </span>
                  )}
                  {isCoder && (
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-semibold bg-blue-500/10 text-blue-300 border border-blue-500/20">
                      Code Specialist
                    </span>
                  )}
                  {isVision && (
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/20">
                      Vision
                    </span>
                  )}
                </div>
              </div>

              <div className="pt-2 border-t border-[#27272a] flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-[#141417] text-zinc-400 border border-[#27272a]">
                  {m.owned_by || 'kiroproxy'}
                </span>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleCopy(m.id)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-[#141417] hover:bg-[#1c1c21] text-zinc-300 border border-[#27272a] text-[11px] cursor-pointer transition-colors"
                    title="Copy model ID for Kiro IDE"
                  >
                    {isCopied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{isCopied ? 'Copied' : 'Copy ID'}</span>
                  </button>

                  <button
                    onClick={() => onTestModel(m.id)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-[#fafafa] hover:bg-[#e4e4e7] text-[#09090b] text-[11px] font-semibold cursor-pointer transition-colors"
                    title="Test this model in Playground"
                  >
                    <Play className="w-3 h-3 fill-current" />
                    <span>Test</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filteredModels.length === 0 && (
        <div className="text-center py-12 text-zinc-500 text-xs">
          No models matched your search query. Try another term or clear the filter.
        </div>
      )}
    </div>
  );
};
