import React, { useState } from 'react';
import { Key, Eye, EyeOff, Plus, Trash2, ArrowUp, ArrowDown, Globe, Shield, Check } from 'lucide-react';
import type { GatewayConfig } from '../types.js';

interface ApiKeysTabProps {
  config: GatewayConfig | null;
  onSaveConfig: (updated: Partial<GatewayConfig>) => Promise<boolean>;
}

type CoreProvider = 'kilo' | 'cline' | 'openrouter' | 'orcarouter' | 'gemini';

const CORE_PROVIDERS: { id: CoreProvider; name: string; desc: string; placeholder: string; defaultUrl: string }[] = [
  {
    id: 'kilo',
    name: 'Kilo Gateway',
    desc: 'Works 100% free without an API key (Zero-Key Mode). Add optional keys for personal rate tiers.',
    placeholder: 'Optional Kilo API Token',
    defaultUrl: 'https://api.kilo.ai/api/gateway',
  },
  {
    id: 'cline',
    name: 'Cline API',
    desc: 'Agentic coding keys from app.cline.bot. Auto-rotates across keys on 429 / 5xx.',
    placeholder: 'cline-xxxxxxxxxxxxxxxx',
    defaultUrl: 'https://api.cline.bot/api/v1',
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    desc: 'Access 30+ free tier models with automatic multi-key rotation from openrouter.ai/keys.',
    placeholder: 'sk-or-v1-xxxxxxxxxxxxxxxx',
    defaultUrl: 'https://openrouter.ai/api/v1',
  },
  {
    id: 'orcarouter',
    name: 'OrcaRouter',
    desc: 'High-throughput free tier routing keys from api.orcarouter.ai.',
    placeholder: 'orca-xxxxxxxxxxxxxxxx',
    defaultUrl: 'https://api.orcarouter.ai/v1',
  },
  {
    id: 'gemini',
    name: 'Google Gemini Direct',
    desc: 'Google AI Studio API keys. Rotates across backup keys on 429 quota exhaustion.',
    placeholder: 'AIza... or user secret key',
    defaultUrl: 'https://generativelanguage.googleapis.com/v1beta',
  },
];

export const ApiKeysTab: React.FC<ApiKeysTabProps> = ({ config, onSaveConfig }) => {
  const [revealedKeys, setRevealedKeys] = useState<Set<string>>(new Set());
  const [newKeyInputs, setNewKeyInputs] = useState<Record<string, string>>({});
  const [newUrlInputs, setNewUrlInputs] = useState<Record<string, string>>({});

  const maskKey = (key: string) => {
    if (!key || key.length <= 8) return '••••••••';
    return `${key.slice(0, 6)}••••••••${key.slice(-4)}`;
  };

  const toggleReveal = (provider: string, idx: number) => {
    const key = `${provider}:${idx}`;
    setRevealedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleAddKey = async (provider: CoreProvider) => {
    const raw = (newKeyInputs[provider] || '').trim();
    if (!raw || !config) return;

    const arrayKey = `${provider}ApiKeys` as keyof GatewayConfig;
    const currentKeys: string[] = Array.isArray(config[arrayKey]) ? [...(config[arrayKey] as string[])] : [];
    const keysToAdd = raw.split(/[\n,]+/).map((k) => k.trim()).filter(Boolean);

    for (const k of keysToAdd) {
      if (!currentKeys.includes(k)) {
        currentKeys.push(k);
      }
    }

    const ok = await onSaveConfig({ [arrayKey]: currentKeys } as any);
    if (ok) {
      setNewKeyInputs((prev) => ({ ...prev, [provider]: '' }));
    }
  };

  const handleRemoveKey = async (provider: CoreProvider, idx: number) => {
    if (!config) return;
    const arrayKey = `${provider}ApiKeys` as keyof GatewayConfig;
    const currentKeys = Array.isArray(config[arrayKey]) ? [...(config[arrayKey] as string[])] : [];
    currentKeys.splice(idx, 1);
    await onSaveConfig({ [arrayKey]: currentKeys } as any);
  };

  const handleMoveKey = async (provider: CoreProvider, idx: number, dir: -1 | 1) => {
    if (!config) return;
    const arrayKey = `${provider}ApiKeys` as keyof GatewayConfig;
    const currentKeys = Array.isArray(config[arrayKey]) ? [...(config[arrayKey] as string[])] : [];
    const target = idx + dir;
    if (target < 0 || target >= currentKeys.length) return;

    const tmp = currentKeys[idx];
    currentKeys[idx] = currentKeys[target];
    currentKeys[target] = tmp;

    await onSaveConfig({ [arrayKey]: currentKeys } as any);
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-[#0f0f12] border border-[#27272a] p-6 space-y-2">
        <h2 className="text-base font-bold text-[#fafafa] flex items-center gap-2">
          <Key className="w-5 h-5 text-amber-400" />
          Core Provider Multi-Key &amp; Failover Chains
        </h2>
        <p className="text-xs text-zinc-400">
          Configure backup keys and endpoint failover chains for each core tier. When an upstream API hits 429 quota limits or transient errors, KiroProxy immediately rotates to the next available key and base URL.
        </p>
      </div>

      <div className="space-y-6">
        {CORE_PROVIDERS.map((p) => {
          const arrayKey = `${p.id}ApiKeys` as keyof GatewayConfig;
          const singleKey = `${p.id}ApiKey` as keyof GatewayConfig;
          const keys: string[] = Array.isArray(config?.[arrayKey]) && (config?.[arrayKey] as string[]).length > 0
            ? (config?.[arrayKey] as string[])
            : (config?.[singleKey] ? [config[singleKey] as string] : []);

          return (
            <div key={p.id} className="rounded-2xl bg-[#0f0f12] border border-[#27272a] p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#27272a]">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-sm text-[#fafafa]">{p.name}</h3>
                    {p.id === 'kilo' ? (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        Zero-Key Mode Active
                      </span>
                    ) : keys.length > 0 ? (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        {keys.length} Key(s) Configured
                      </span>
                    ) : (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">
                        Optional / Unset
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-zinc-400 mt-1">{p.desc}</p>
                </div>
              </div>

              {/* Add Key Form */}
              <div className="flex gap-2">
                <input
                  type="password"
                  value={newKeyInputs[p.id] || ''}
                  onChange={(e) => setNewKeyInputs((prev) => ({ ...prev, [p.id]: e.target.value }))}
                  placeholder={p.placeholder}
                  className="flex-1 bg-[#09090b] border border-[#27272a] rounded-lg px-3 py-2 text-xs font-mono text-[#fafafa] focus:outline-none focus:border-[#fafafa]"
                />
                <button
                  onClick={() => handleAddKey(p.id)}
                  disabled={!newKeyInputs[p.id]?.trim()}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#fafafa] hover:bg-[#e4e4e7] text-[#09090b] text-xs font-semibold cursor-pointer disabled:opacity-40 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Key</span>
                </button>
              </div>

              {/* Keys List */}
              <div className="space-y-2 pt-2">
                {keys.map((k, idx) => {
                  const revId = `${p.id}:${idx}`;
                  const isRevealed = revealedKeys.has(revId);

                  return (
                    <div
                      key={idx}
                      className="p-3 rounded-lg bg-[#141417] border border-[#27272a] flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center gap-3 overflow-hidden">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                          idx === 0 ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-zinc-800 text-zinc-300'
                        }`}>
                          {idx === 0 ? 'Key #1 (Primary)' : `Key #${idx + 1}`}
                        </span>
                        <span className="font-mono text-zinc-300 truncate">
                          {isRevealed ? k : maskKey(k)}
                        </span>
                      </div>

                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={() => handleMoveKey(p.id, idx, -1)}
                          disabled={idx === 0}
                          className="p-1.5 rounded hover:bg-[#27272a] text-zinc-400 disabled:opacity-20 cursor-pointer"
                          title="Move key up"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleMoveKey(p.id, idx, 1)}
                          disabled={idx === keys.length - 1}
                          className="p-1.5 rounded hover:bg-[#27272a] text-zinc-400 disabled:opacity-20 cursor-pointer"
                          title="Move key down"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => toggleReveal(p.id, idx)}
                          className="p-1.5 rounded hover:bg-[#27272a] text-zinc-400 cursor-pointer"
                          title={isRevealed ? 'Hide key' : 'Show key'}
                        >
                          {isRevealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          onClick={() => handleRemoveKey(p.id, idx)}
                          className="p-1.5 rounded hover:bg-rose-500/20 text-rose-400 cursor-pointer ml-1"
                          title="Remove key"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}

                {keys.length === 0 && (
                  <p className="text-zinc-500 text-xs italic py-1">
                    No explicit API keys stored in configuration for {p.name}.
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
