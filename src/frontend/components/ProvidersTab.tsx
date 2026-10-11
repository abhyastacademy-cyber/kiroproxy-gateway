import React, { useState } from 'react';
import {
  Layers,
  Plus,
  Trash2,
  Edit2,
  Check,
  ArrowUp,
  ArrowDown,
  Globe,
  Key,
  Shield,
  Zap,
  Save,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import type { GatewayConfig, CustomProvider } from '../types.js';

interface ProvidersTabProps {
  config: GatewayConfig | null;
  onSaveConfig: (updated: Partial<GatewayConfig>) => Promise<boolean>;
  isSaving: boolean;
}

export const ProvidersTab: React.FC<ProvidersTabProps> = ({
  config,
  onSaveConfig,
  isSaving,
}) => {
  const [priorityOrder, setPriorityOrder] = useState<string[]>(
    config?.providerPriorityOrder || ['gemini', 'custom', 'openrouter', 'canvas']
  );
  const [customProviders, setCustomProviders] = useState<CustomProvider[]>(
    config?.customProviders || []
  );

  // Edit / Add modal state
  const [editingProvider, setEditingProvider] = useState<CustomProvider | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [testResult, setTestResult] = useState<{ id: string; status: 'testing' | 'success' | 'error'; message: string } | null>(null);

  // Keep local state in sync when config loads
  React.useEffect(() => {
    if (config) {
      setPriorityOrder(config.providerPriorityOrder || []);
      setCustomProviders(config.customProviders || []);
    }
  }, [config]);

  // Priority order manipulation
  const moveTier = (index: number, direction: 'up' | 'down') => {
    const newOrder = [...priorityOrder];
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= newOrder.length) return;

    const temp = newOrder[index];
    newOrder[index] = newOrder[targetIdx];
    newOrder[targetIdx] = temp;
    setPriorityOrder(newOrder);
  };

  const handleSaveAll = async () => {
    await onSaveConfig({
      providerPriorityOrder: priorityOrder,
      customProviders,
    });
  };

  // Provider CRUD
  const handleToggleProvider = (id: string) => {
    setCustomProviders((prev) =>
      prev.map((p) => (p.id === id ? { ...p, enabled: !p.enabled } : p))
    );
  };

  const handleDeleteProvider = (id: string) => {
    if (confirm('Delete this custom provider?')) {
      setCustomProviders((prev) => prev.filter((p) => p.id !== id));
    }
  };

  const handleSaveModal = (provider: CustomProvider) => {
    if (isCreating) {
      setCustomProviders((prev) => [...prev, provider]);
    } else {
      setCustomProviders((prev) =>
        prev.map((p) => (p.id === provider.id ? provider : p))
      );
    }
    setEditingProvider(null);
    setIsCreating(false);
  };

  const testProviderEndpoint = async (provider: CustomProvider) => {
    setTestResult({ id: provider.id, status: 'testing', message: 'Testing endpoint connectivity...' });
    const url = provider.baseUrls[0];
    if (!url) {
      setTestResult({ id: provider.id, status: 'error', message: 'No base URL specified.' });
      return;
    }

    try {
      // Test models or root endpoint
      const testUrl = url.endsWith('/v1') ? `${url}/models` : `${url}/v1/models`;
      const res = await fetch(testUrl, {
        headers: provider.apiKeys[0] ? { Authorization: `Bearer ${provider.apiKeys[0]}` } : {},
      });
      if (res.ok || res.status === 404 || res.status === 401) {
        setTestResult({
          id: provider.id,
          status: 'success',
          message: `Endpoint reachable (HTTP ${res.status}).`,
        });
      } else {
        setTestResult({
          id: provider.id,
          status: 'error',
          message: `Endpoint returned HTTP ${res.status}`,
        });
      }
    } catch (err: any) {
      setTestResult({
        id: provider.id,
        status: 'error',
        message: err.message || 'Connection failed',
      });
    }
  };

  return (
    <div className="space-y-8">
      {/* Header with Save Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-2xl bg-slate-900 border border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Layers className="w-5 h-5 text-indigo-400" />
            Provider Priority & Failover Tiers
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Configure tier fallbacks: if an upstream provider hits rate limits (429) or fails (500), the gateway instantly tries the next tier.
          </p>
        </div>
        <button
          onClick={handleSaveAll}
          disabled={isSaving}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/20 transition-all disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          <span>{isSaving ? 'Saving Config...' : 'Save & Persist Changes'}</span>
        </button>
      </div>

      {/* Tier Order Card */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center justify-between">
          <span>Tier Priority Order</span>
          <span className="text-xs font-normal text-slate-400 lowercase">
            executed sequentially from top to bottom
          </span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {priorityOrder.map((tier, idx) => (
            <div
              key={tier}
              className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between"
            >
              <div className="flex items-center gap-2.5">
                <span className="w-6 h-6 rounded-full bg-slate-800 text-slate-300 text-xs font-mono font-bold flex items-center justify-center">
                  {idx + 1}
                </span>
                <div>
                  <p className="text-xs font-bold text-white uppercase tracking-wide">
                    {tier}
                  </p>
                  <p className="text-[10px] text-slate-400">
                    {tier === 'gemini'
                      ? 'Google Gemini Direct'
                      : tier === 'custom'
                      ? 'Custom Failover Chain'
                      : tier === 'canvas'
                      ? 'Gemini Canvas Bridge'
                      : 'Third-party API'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => moveTier(idx, 'up')}
                  disabled={idx === 0}
                  className="p-1 text-slate-400 hover:text-white disabled:opacity-30 transition-colors"
                  title="Move Up"
                >
                  <ArrowUp className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => moveTier(idx, 'down')}
                  disabled={idx === priorityOrder.length - 1}
                  className="p-1 text-slate-400 hover:text-white disabled:opacity-30 transition-colors"
                  title="Move Down"
                >
                  <ArrowDown className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Custom Providers Section */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Globe className="w-4 h-4 text-purple-400" />
              Custom Providers (Multi-Endpoint Failover)
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Each custom provider supports a list of baseUrls that are tried sequentially if an endpoint goes down.
            </p>
          </div>
          <button
            onClick={() => {
              setIsCreating(true);
              setEditingProvider({
                id: 'custom-' + Date.now(),
                name: 'New Custom Provider',
                baseUrls: ['https://openrouter.ai/api/v1'],
                apiKeys: [''],
                activeModel: 'openai/gpt-4o',
                enabled: true,
                notes: '',
              });
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-xs font-semibold hover:bg-indigo-500/20 transition-colors self-start sm:self-auto"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Custom Provider</span>
          </button>
        </div>

        {/* Provider Cards */}
        {customProviders.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-500 border border-dashed border-slate-800 rounded-xl">
            No custom providers configured yet. Click &quot;Add Custom Provider&quot; to configure OpenAI, OpenRouter, or private gateways.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {customProviders.map((cp) => (
              <div
                key={cp.id}
                className={`p-4 rounded-xl border transition-all ${
                  cp.enabled
                    ? 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                    : 'bg-slate-950/20 border-slate-900 opacity-60'
                }`}
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white text-sm">{cp.name}</span>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                          cp.enabled
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {cp.enabled ? 'Enabled' : 'Disabled'}
                      </span>
                      {cp.activeModel && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-mono bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                          {cp.activeModel}
                        </span>
                      )}
                    </div>
                    {cp.notes && <p className="text-xs text-slate-400">{cp.notes}</p>}
                    <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-slate-400 font-mono">
                      <span className="text-slate-500">Endpoints ({cp.baseUrls.length}):</span>
                      {cp.baseUrls.map((url, uidx) => (
                        <span key={uidx} className="bg-slate-900 px-2 py-0.5 rounded border border-slate-800 text-slate-300">
                          {url}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end md:self-auto">
                    <button
                      onClick={() => testProviderEndpoint(cp)}
                      className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition-colors flex items-center gap-1 border border-slate-700"
                    >
                      <Zap className="w-3 h-3 text-amber-400" />
                      <span>Test Ping</span>
                    </button>
                    <button
                      onClick={() => handleToggleProvider(cp.id)}
                      className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition-colors border border-slate-700"
                    >
                      {cp.enabled ? 'Disable' : 'Enable'}
                    </button>
                    <button
                      onClick={() => {
                        setIsCreating(false);
                        setEditingProvider({ ...cp });
                      }}
                      className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors border border-slate-700"
                      title="Edit Provider"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteProvider(cp.id)}
                      className="p-1.5 rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition-colors border border-rose-500/20"
                      title="Delete Provider"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {testResult?.id === cp.id && (
                  <div
                    className={`mt-3 p-2.5 rounded-lg text-xs flex items-center gap-2 border ${
                      testResult.status === 'success'
                        ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-300'
                        : testResult.status === 'error'
                        ? 'bg-rose-950/30 border-rose-500/30 text-rose-300'
                        : 'bg-indigo-950/30 border-indigo-500/30 text-indigo-300'
                    }`}
                  >
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>{testResult.message}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Upstream Failover Instructions Callout */}
      <div className="p-6 rounded-2xl bg-gradient-to-br from-indigo-950/30 via-slate-900 to-slate-900 border border-indigo-500/20 space-y-3">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Zap className="w-4 h-4 text-indigo-400" />
          Using This Cloud Gateway As an Upstream Failover Endpoint
        </h3>
        <p className="text-xs text-slate-300 leading-relaxed">
          If you already have a local KiroProxy running on your developer machine (at <code className="text-indigo-300 font-mono">http://localhost:8084</code>),
          you can add this AI Studio published domain as a seamless upstream cloud fallback:
        </p>
        <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 text-xs space-y-1 font-mono text-slate-300">
          <p className="text-slate-500">// In your local KiroProxy GUI (http://localhost:8084/config):</p>
          <p>1. Go to ⚙️ Custom Providers → Add &quot;AI-Studio-Cloud-Gateway&quot;</p>
          <p>2. Set Base URL: <span className="text-emerald-400">{config?.detectedPublicUrl || window.location.origin}/v1</span></p>
          <p>3. If PROXY_ADMIN_TOKEN is active, set API Key to your token.</p>
        </div>
      </div>

      {/* Edit / Add Modal */}
      {editingProvider && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl p-6 space-y-4 shadow-2xl">
            <h3 className="text-lg font-bold text-white">
              {isCreating ? 'Add Custom Provider' : 'Edit Custom Provider'}
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1 font-medium">Provider Name</label>
                <input
                  type="text"
                  value={editingProvider.name}
                  onChange={(e) => setEditingProvider({ ...editingProvider, name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                  placeholder="e.g. OpenRouter Primary"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">
                  Base URLs (Failover Chain - One per line)
                </label>
                <textarea
                  rows={3}
                  value={editingProvider.baseUrls.join('\n')}
                  onChange={(e) =>
                    setEditingProvider({
                      ...editingProvider,
                      baseUrls: e.target.value.split('\n').map((s) => s.trim()).filter(Boolean),
                    })
                  }
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-indigo-500"
                  placeholder="https://openrouter.ai/api/v1&#10;https://backup-endpoint.ai/v1"
                />
                <span className="text-[11px] text-slate-500">
                  First URL is tried first; if it returns 429 or fails, the gateway automatically shifts to line 2.
                </span>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">
                  API Keys (One per line for rotation/failover)
                </label>
                <textarea
                  rows={2}
                  value={editingProvider.apiKeys.join('\n')}
                  onChange={(e) =>
                    setEditingProvider({
                      ...editingProvider,
                      apiKeys: e.target.value.split('\n').map((s) => s.trim()).filter(Boolean),
                    })
                  }
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-indigo-500"
                  placeholder="sk-or-v1-..."
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Default Model ID</label>
                  <input
                    type="text"
                    value={editingProvider.activeModel || ''}
                    onChange={(e) => setEditingProvider({ ...editingProvider, activeModel: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-indigo-500"
                    placeholder="anthropic/claude-3.5-sonnet"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Notes / Label</label>
                  <input
                    type="text"
                    value={editingProvider.notes || ''}
                    onChange={(e) => setEditingProvider({ ...editingProvider, notes: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                    placeholder="High throughput tier"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-800">
              <button
                onClick={() => setEditingProvider(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleSaveModal(editingProvider)}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/20 transition-colors"
              >
                Save Provider
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
