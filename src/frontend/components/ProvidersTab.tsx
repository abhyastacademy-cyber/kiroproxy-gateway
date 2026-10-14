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
  Edit2,
  X,
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
  custom: { label: 'Custom Endpoints', desc: 'User-defined OpenAI-compatible multi-base URLs & multi-keys' },
  canvas: { label: 'Canvas Bridge', desc: 'Gemini Canvas zero-cost reverse-polling web worker' },
};

export const ProvidersTab: React.FC<ProvidersTabProps> = ({ config, onSaveConfig, isSaving }) => {
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form State for Add / Edit
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingProviderId, setEditingProviderId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formBaseUrls, setFormBaseUrls] = useState('');
  const [formApiKeys, setFormApiKeys] = useState('');
  const [formModel, setFormModel] = useState('');
  const [formNotes, setFormNotes] = useState('');

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

  const handleOpenAdd = () => {
    setEditingProviderId(null);
    setFormName('');
    setFormBaseUrls('');
    setFormApiKeys('');
    setFormModel('');
    setFormNotes('');
    setIsFormOpen(true);
  };

  const handleOpenEdit = (provider: CustomProvider) => {
    setEditingProviderId(provider.id);
    setFormName(provider.name);
    const urls = Array.isArray(provider.baseUrls) && provider.baseUrls.length > 0
      ? provider.baseUrls.join('\n')
      : (provider.baseUrl || '');
    setFormBaseUrls(urls);
    const keys = Array.isArray(provider.apiKeys) && provider.apiKeys.length > 0
      ? provider.apiKeys.join('\n')
      : (provider.apiKey || '');
    setFormApiKeys(keys);
    setFormModel(provider.activeModel || provider.defaultModel || '');
    setFormNotes(provider.notes || '');
    setIsFormOpen(true);
  };

  const handleSaveProvider = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formBaseUrls.trim()) return;

    const parsedUrls = formBaseUrls
      .split(/[\n,]+/)
      .map((u) => u.trim())
      .filter((u) => u.length > 0);

    const parsedKeys = formApiKeys
      .split(/[\n,]+/)
      .map((k) => k.trim())
      .filter((k) => k.length > 0);

    if (parsedUrls.length === 0) return;

    if (editingProviderId) {
      // Update existing provider
      const updated = customProviders.map((p) => {
        if (p.id === editingProviderId) {
          return {
            ...p,
            name: formName.trim(),
            baseUrls: parsedUrls,
            baseUrl: parsedUrls[0],
            apiKeys: parsedKeys,
            apiKey: parsedKeys[0] || '',
            activeModel: formModel.trim() || p.activeModel || 'gemini-2.5-flash',
            notes: formNotes.trim() || undefined,
          };
        }
        return p;
      });
      const ok = await onSaveConfig({ customProviders: updated });
      if (ok) {
        setIsFormOpen(false);
        setEditingProviderId(null);
        setSuccessMsg(`Updated ${formName.trim()} with ${parsedUrls.length} URL(s) and ${parsedKeys.length} key(s)`);
        setTimeout(() => setSuccessMsg(null), 3000);
      }
    } else {
      // Add new provider
      const newProvider: CustomProvider = {
        id: formName.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + Date.now().toString(36),
        name: formName.trim(),
        baseUrls: parsedUrls,
        baseUrl: parsedUrls[0],
        apiKeys: parsedKeys,
        apiKey: parsedKeys[0] || '',
        activeModel: formModel.trim() || 'gemini-2.5-flash',
        enabled: true,
        notes: formNotes.trim() || undefined,
      };

      const updated = [...customProviders, newProvider];
      const ok = await onSaveConfig({ customProviders: updated });
      if (ok) {
        setIsFormOpen(false);
        setSuccessMsg(`Added ${formName.trim()} with ${parsedUrls.length} URL(s) and ${parsedKeys.length} key(s)`);
        setTimeout(() => setSuccessMsg(null), 3000);
      }
    }
  };

  return (
    <div className="space-y-6">
      {successMsg && (
        <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2 animate-fadeIn">
          <Check className="w-4 h-4 text-emerald-400 shrink-0" />
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
                Fallback order executed whenever <code>global-automode</code> routes a request or an upstream provider returns 429/5xx.
                Free tier limits and quotas accumulate across all active providers.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          {priorityOrder.map((tier, idx) => {
            const info = TIER_INFO[tier] || { label: tier, desc: 'Configured tier' };
            return (
              <div
                key={`${tier}-${idx}`}
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
                    className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-[#27272a] disabled:opacity-30 transition-colors cursor-pointer"
                    title="Move Up"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleMoveTier(idx, 'down')}
                    disabled={idx === priorityOrder.length - 1 || isSaving}
                    className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-[#27272a] disabled:opacity-30 transition-colors cursor-pointer"
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

      {/* 2. Custom Providers with Multi-Base URL and Multi-Key Support */}
      <section className="p-5 rounded-2xl bg-[#0f0f12] border border-[#27272a] space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Globe className="w-5 h-5 text-indigo-400" />
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <span>Custom Endpoints &amp; Proxies</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/30 font-mono">
                  Multi-Base URL &amp; Multi-Key
                </span>
              </h2>
              <p className="text-xs text-zinc-400">
                Configure OpenAI-compatible providers (Groq, Together, DeepInfra, Ollama, vLLM, LiteLLM) with multi-base URL failover and multi-API key rotation.
              </p>
            </div>
          </div>
          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Provider</span>
          </button>
        </div>

        {/* Add/Edit Provider Modal Form */}
        {isFormOpen && (
          <form
            onSubmit={handleSaveProvider}
            className="p-4 rounded-xl bg-[#141417] border border-blue-500/40 space-y-4 animate-fadeIn"
          >
            <div className="flex items-center justify-between pb-2 border-b border-[#27272a]">
              <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                <span>{editingProviderId ? 'Edit Custom Provider' : 'Add New Custom Provider'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="text-zinc-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-semibold text-zinc-300 mb-1">Provider Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Groq Production, DeepInfra Backup"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg bg-[#18181b] border border-[#27272a] text-xs text-white focus:outline-none focus:border-blue-500 font-medium"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-zinc-300 mb-1">
                  Active Model / Upstream Slug
                </label>
                <input
                  type="text"
                  placeholder="e.g. llama-3.3-70b-versatile, openai/gpt-oss-120b"
                  value={formModel}
                  onChange={(e) => setFormModel(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg bg-[#18181b] border border-[#27272a] text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>
            </div>

            {/* Multi-Base URL Textarea */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-semibold text-zinc-300 flex items-center gap-1">
                  <Globe className="w-3 h-3 text-indigo-400" />
                  <span>Base URLs (Multi-URL Failover)</span>
                </label>
                <span className="text-[10px] text-zinc-500">One URL per line or comma-separated</span>
              </div>
              <textarea
                rows={2}
                required
                placeholder={`https://api.groq.com/openai/v1\nhttps://openrouter.ai/api/v1\nhttps://api.together.xyz/v1`}
                value={formBaseUrls}
                onChange={(e) => setFormBaseUrls(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[#18181b] border border-[#27272a] text-xs font-mono text-zinc-200 focus:outline-none focus:border-blue-500 leading-relaxed"
              />
              <p className="text-[10px] text-zinc-400 mt-1">
                Gateway tries URL #1 first. If URL #1 returns 5xx, network error, or host down, it automatically cascades to URL #2, #3, etc.
              </p>
            </div>

            {/* Multi-API Key Textarea */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-semibold text-zinc-300 flex items-center gap-1">
                  <Key className="w-3 h-3 text-amber-400" />
                  <span>API Keys (Multi-Key Auto-Rotation)</span>
                </label>
                <span className="text-[10px] text-zinc-500">One key per line or comma-separated (Optional)</span>
              </div>
              <textarea
                rows={2}
                placeholder={`sk-key-primary-...\nsk-key-backup-...\nsk-key-failover-...`}
                value={formApiKeys}
                onChange={(e) => setFormApiKeys(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[#18181b] border border-[#27272a] text-xs font-mono text-zinc-200 focus:outline-none focus:border-blue-500 leading-relaxed"
              />
              <p className="text-[10px] text-zinc-400 mt-1">
                Gateway automatically rotates across keys. When an API key hits HTTP 429 quota traps or invalid key errors, it immediately fails over to the next key.
              </p>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-zinc-300 mb-1">Notes / Description (Optional)</label>
              <input
                type="text"
                placeholder="Optional notes (e.g. Free Tier, Dedicated Cluster, High Priority)"
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg bg-[#18181b] border border-[#27272a] text-xs text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#27272a]">
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-400 hover:text-white hover:bg-[#27272a] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white cursor-pointer transition-colors"
              >
                {editingProviderId ? 'Update Provider' : 'Save Provider'}
              </button>
            </div>
          </form>
        )}

        {/* Existing Providers List */}
        {customProviders.length === 0 ? (
          <div className="text-center py-8 text-zinc-400 text-xs">
            No custom providers configured yet. Click "Add Provider" above to add your own upstream model APIs with multi-base URL and multi-key failover.
          </div>
        ) : (
          <div className="space-y-3">
            {customProviders.map((provider) => {
              const urlList = Array.isArray(provider.baseUrls) && provider.baseUrls.length > 0
                ? provider.baseUrls
                : (provider.baseUrl ? [provider.baseUrl] : []);
              const keyCount = Array.isArray(provider.apiKeys) && provider.apiKeys.length > 0
                ? provider.apiKeys.length
                : (provider.apiKey ? 1 : 0);

              return (
                <div
                  key={provider.id}
                  className="p-4 rounded-xl bg-[#141417] border border-[#27272a] flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-zinc-700 transition-colors"
                >
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
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
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-indigo-950/30 text-indigo-300 border border-indigo-500/20">
                        {urlList.length} Base URL{urlList.length > 1 ? 's (failover)' : ''}
                      </span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-950/30 text-amber-300 border border-amber-500/20">
                        {keyCount} API Key{keyCount > 1 ? 's (rotation)' : keyCount === 0 ? 's (zero-key)' : ''}
                      </span>
                    </div>

                    <div className="space-y-1">
                      {urlList.map((url, uIdx) => (
                        <p key={uIdx} className="text-[11px] font-mono text-zinc-400 flex items-center gap-1.5">
                          <span className="text-[9px] text-zinc-500">#{uIdx + 1}</span>
                          <span className="text-zinc-300 truncate max-w-sm sm:max-w-md">{url}</span>
                        </p>
                      ))}
                    </div>

                    {provider.notes && <p className="text-[11px] text-zinc-400">{provider.notes}</p>}
                  </div>

                  <div className="flex items-center gap-1.5 self-end sm:self-center">
                    <button
                      onClick={() => handleOpenEdit(provider)}
                      className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-[#27272a] transition-colors cursor-pointer"
                      title="Edit Provider & Multi-URLs/Keys"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => handleToggleProvider(provider.id)}
                      className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-[#27272a] transition-colors cursor-pointer"
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
                      className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-400 hover:bg-rose-950/30 transition-colors cursor-pointer"
                      title="Delete Provider"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};
