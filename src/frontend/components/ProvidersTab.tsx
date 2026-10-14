import React, { useState } from 'react';
import {
  Layers,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Globe,
  Key,
  Check,
  AlertCircle,
  ToggleLeft,
  ToggleRight,
  Settings,
  Sparkles,
} from 'lucide-react';
import type { GatewayConfig, CustomProvider } from '../types.js';

interface ProvidersTabProps {
  config: GatewayConfig | null;
  onSaveConfig: (updated: Partial<GatewayConfig>) => Promise<boolean>;
  isSaving: boolean;
}

const TIER_INFO: Record<string, { label: string; desc: string }> = {
  kilo: { label: 'Kilo Gateway', desc: '177+ Free Models, Zero-Key support, fast fallback' },
  cline: { label: 'Cline API', desc: 'Agentic coding keys with multi-key auto-rotation' },
  openrouter: { label: 'OpenRouter', desc: ':free model catalog with key rotation' },
  orcarouter: { label: 'OrcaRouter', desc: 'High-throughput free tier router' },
  gemini: { label: 'Google Gemini Direct', desc: 'Direct Google AI Studio multi-key failover' },
  custom: { label: 'Custom Endpoints', desc: 'User-defined OpenAI-compatible base URLs & keys' },
  canvas: { label: 'Canvas Bridge', desc: 'Gemini Canvas zero-cost reverse-polling web worker' },
};

export const ProvidersTab: React.FC<ProvidersTabProps> = ({ config, onSaveConfig, isSaving }) => {
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // New Provider Form State
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newBaseUrl, setNewBaseUrl] = useState('');
  const [newApiKey, setNewApiKey] = useState('');
  const [newModel, setNewModel] = useState('');
  const [newNotes, setNewNotes] = useState('');

  const priorityOrder = config?.providerPriorityOrder || [
    'kilo',
    'cline',
    'openrouter',
    'orcarouter',
    'gemini',
    'custom',
    'canvas',
  ];

  const customProviders = config?.customProviders || [];

  const handleMoveTier = async (idx: number, dir: 'up' | 'down') => {
    const newOrder = [...priorityOrder];
    const targetIdx = dir === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= newOrder.length) return;

    const temp = newOrder[idx];
    newOrder[idx] = newOrder[targetIdx];
    newOrder[targetIdx] = temp;

    const ok = await onSaveConfig({ providerPriorityOrder: newOrder });
    if (ok) {
      setSuccessMsg('Priority order updated');
      setTimeout(() => setSuccessMsg(null), 2000);
    }
  };

  const handleToggleProvider = async (providerId: string) => {
    const updated = customProviders.map((p) =>
      p.id === providerId ? { ...p, enabled: !p.enabled } : p
    );
    await onSaveConfig({ customProviders: updated });
  };

  const handleDeleteProvider = async (providerId: string) => {
    if (!confirm('Are you sure you want to remove this custom provider?')) return;
    const updated = customProviders.filter((p) => p.id !== providerId);
    await onSaveConfig({ customProviders: updated });
  };

  const handleAddProvider = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newBaseUrl.trim()) return;

    const newProvider: CustomProvider = {
      id: newName.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + Date.now().toString(36),
      name: newName.trim(),
      baseUrls: [newBaseUrl.trim()],
      apiKeys: newApiKey.trim() ? [newApiKey.trim()] : [],
      activeModel: newModel.trim() || 'gemini-2.5-flash',
      enabled: true,
      notes: newNotes.trim() || undefined,
    };

    const updated = [...customProviders, newProvider];
    const ok = await onSaveConfig({ customProviders: updated });
    if (ok) {
      setNewName('');
      setNewBaseUrl('');
      setNewApiKey('');
      setNewModel('');
      setNewNotes('');
      setIsAdding(false);
      setSuccessMsg('Custom provider added successfully');
      setTimeout(() => setSuccessMsg(null), 2000);
    }
  };

  return (
    <div className="space-y-6">
      {successMsg && (
        <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* 1. 7-Tier Priority Waterfall */}
      <section className="p-5 rounded-2xl bg-[#0f0f12] border border-[#27272a] space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Layers className="w-5 h-5 text-blue-400" />
            <div>
              <h2 className="text-sm font-bold text-white">7-Tier Waterfall Priority Order</h2>
              <p className="text-xs text-zinc-400">
                Fallback order executed whenever auto-mode routes a request or upstream provider returns 429/5xx.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          {priorityOrder.map((tier, idx) => {
            const info = TIER_INFO[tier] || { label: tier, desc: 'Configured tier' };
            return (
              <div
                key={tier}
                className="flex items-center justify-between p-3 rounded-xl bg-[#141417] border border-[#27272a] hover:border-zinc-700 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-lg bg-[#27272a] flex items-center justify-center text-xs font-bold text-zinc-300">
                    {idx + 1}
                  </span>
                  <div>
                    <span className="text-xs font-semibold text-white">{info.label}</span>
                    <span className="ml-2 font-mono text-[10px] text-zinc-400 bg-zinc-800/60 px-1.5 py-0.5 rounded">
                      {tier}
                    </span>
                    <p className="text-[11px] text-zinc-400">{info.desc}</p>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleMoveTier(idx, 'up')}
                    disabled={idx === 0 || isSaving}
                    className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-[#27272a] disabled:opacity-30 transition-colors"
                    title="Move Up"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleMoveTier(idx, 'down')}
                    disabled={idx === priorityOrder.length - 1 || isSaving}
                    className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-[#27272a] disabled:opacity-30 transition-colors"
                    title="Move Down"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 2. Custom Providers */}
      <section className="p-5 rounded-2xl bg-[#0f0f12] border border-[#27272a] space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Globe className="w-5 h-5 text-indigo-400" />
            <div>
              <h2 className="text-sm font-bold text-white">Custom Endpoints &amp; Proxies</h2>
              <p className="text-xs text-zinc-400">
                Plug in any OpenAI-compatible base URL (e.g. Ollama, vLLM, DeepInfra, Together, LiteLLM)
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsAdding(!isAdding)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Provider</span>
          </button>
        </div>

        {/* Add Provider Modal/Form */}
        {isAdding && (
          <form
            onSubmit={handleAddProvider}
            className="p-4 rounded-xl bg-[#141417] border border-blue-500/30 space-y-3"
          >
            <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-blue-400" />
              <span>New Custom Provider</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-zinc-300 mb-1">Provider Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Local Ollama, DeepInfra"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg bg-[#18181b] border border-[#27272a] text-xs text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-zinc-300 mb-1">
                  Base URL (OpenAI-compatible)
                </label>
                <input
                  type="url"
                  required
                  placeholder="https://api.example.com/v1"
                  value={newBaseUrl}
                  onChange={(e) => setNewBaseUrl(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg bg-[#18181b] border border-[#27272a] text-xs text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-zinc-300 mb-1">API Key (Optional)</label>
                <input
                  type="password"
                  placeholder="Bearer token or sk-..."
                  value={newApiKey}
                  onChange={(e) => setNewApiKey(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg bg-[#18181b] border border-[#27272a] text-xs text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-zinc-300 mb-1">Active Model</label>
                <input
                  type="text"
                  placeholder="e.g. deepseek-ai/DeepSeek-V3"
                  value={newModel}
                  onChange={(e) => setNewModel(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg bg-[#18181b] border border-[#27272a] text-xs text-white focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-zinc-300 mb-1">Notes / Description</label>
              <input
                type="text"
                placeholder="Optional notes"
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg bg-[#18181b] border border-[#27272a] text-xs text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsAdding(false)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-400 hover:text-white hover:bg-[#27272a]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white"
              >
                Save Provider
              </button>
            </div>
          </form>
        )}

        {/* Existing Providers List */}
        {customProviders.length === 0 ? (
          <div className="text-center py-8 text-zinc-400 text-xs">
            No custom providers configured yet. Click "Add Provider" above to add your own upstream model APIs.
          </div>
        ) : (
          <div className="space-y-3">
            {customProviders.map((provider) => (
              <div
                key={provider.id}
                className="p-4 rounded-xl bg-[#141417] border border-[#27272a] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white">{provider.name}</span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                        provider.enabled
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-zinc-800 text-zinc-400'
                      }`}
                    >
                      {provider.enabled ? 'Enabled' : 'Disabled'}
                    </span>
                    {provider.activeModel && (
                      <span className="font-mono text-[10px] text-cyan-400 bg-cyan-950/40 px-1.5 py-0.5 rounded border border-cyan-800/30">
                        {provider.activeModel}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] font-mono text-zinc-400">
                    {provider.baseUrls?.[0] || 'No base URL configured'}
                  </p>
                  {provider.notes && <p className="text-[11px] text-zinc-400">{provider.notes}</p>}
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center">
                  <button
                    onClick={() => handleToggleProvider(provider.id)}
                    className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-[#27272a] transition-colors"
                    title={provider.enabled ? 'Disable' : 'Enable'}
                  >
                    {provider.enabled ? (
                      <ToggleRight className="w-5 h-5 text-emerald-400" />
                    ) : (
                      <ToggleLeft className="w-5 h-5 text-zinc-500" />
                    )}
                  </button>

                  <button
                    onClick={() => handleDeleteProvider(provider.id)}
                    className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-400 hover:bg-rose-950/30 transition-colors"
                    title="Delete Provider"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
