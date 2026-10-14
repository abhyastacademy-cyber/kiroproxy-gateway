import React, { useState } from 'react';
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  Cloud,
  Cpu,
  Globe,
  Layers,
  Laptop,
  Radio,
  Server,
  Terminal,
  Zap,
  Copy,
  Check,
  RotateCcw,
  RefreshCw,
  ArrowLeft,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react';
import type { HealthData, GatewayConfig } from '../types.js';

interface OverviewTabProps {
  health: HealthData | null;
  config: GatewayConfig | null;
  onNavigateTab: (tab: string) => void;
  onSaveConfig?: (updated: Partial<GatewayConfig>) => Promise<boolean>;
  onRefreshHealth?: () => void;
}

const TIER_METADATA: Record<string, { title: string; meta: string }> = {
  kilo: { title: 'Kilo Gateway', meta: 'Zero-Key 177+ Free Models' },
  cline: { title: 'Cline API', meta: 'Agentic Coding Engine' },
  openrouter: { title: 'OpenRouter', meta: ':free Tier Model Catalog' },
  orcarouter: { title: 'OrcaRouter', meta: 'Multi-Key Free Gateway' },
  gemini: { title: 'Google Gemini Direct', meta: 'AI Studio Multi-Key' },
  custom: { title: 'Custom Endpoints', meta: 'Multi-Base-URL & Multi-Key' },
  canvas: { title: 'Gemini Canvas Bridge', meta: 'Zero-Cost Reverse-Poll' },
};

const DEFAULT_PRIORITY_ORDER = [
  'kilo',
  'cline',
  'openrouter',
  'orcarouter',
  'gemini',
  'custom',
  'canvas',
];

export const OverviewTab: React.FC<OverviewTabProps> = ({
  health,
  config,
  onNavigateTab,
  onSaveConfig,
  onRefreshHealth,
}) => {
  const publicUrl = health?.environment.publicUrl ||
    (typeof window !== 'undefined' && (window.location.hostname.includes('ai.studio') || window.location.hostname.includes('run.app'))
      ? 'https://kiroproxy-746899042471.asia-southeast1.run.app'
      : window.location.origin);
  const isCloud = health?.environment.isCloudRun;
  const [copiedCmd, setCopiedCmd] = useState(false);
  const [isResettingBreakers, setIsResettingBreakers] = useState(false);

  const patcherCommand = `curl -fsSL ${publicUrl}/scripts/patch_kiro_extension.js | node - --url ${publicUrl}${
    config?.adminToken ? ` --token ${config.adminToken}` : ''
  }`;

  const handleCopyCmd = () => {
    navigator.clipboard.writeText(patcherCommand);
    setCopiedCmd(true);
    setTimeout(() => setCopiedCmd(false), 2000);
  };

  const priorityList = config?.providerPriorityOrder || DEFAULT_PRIORITY_ORDER;

  const handleMoveTier = async (idx: number, direction: -1 | 1) => {
    if (!onSaveConfig) return;
    const target = idx + direction;
    if (target < 0 || target >= priorityList.length) return;

    const updated = [...priorityList];
    const tmp = updated[idx];
    updated[idx] = updated[target];
    updated[target] = tmp;

    await onSaveConfig({ providerPriorityOrder: updated });
  };

  const handleResetPriority = async () => {
    if (!onSaveConfig) return;
    await onSaveConfig({ providerPriorityOrder: [...DEFAULT_PRIORITY_ORDER] });
  };

  const handleResetCircuitBreakers = async () => {
    setIsResettingBreakers(true);
    try {
      await fetch('/api/circuit/reset', { method: 'POST' });
      if (onRefreshHealth) onRefreshHealth();
    } catch (e) {
      console.warn('Failed to reset circuit breakers:', e);
    } finally {
      setIsResettingBreakers(false);
    }
  };

  const handleRefreshHealthNow = async () => {
    try {
      await fetch('/api/health/refresh', { method: 'POST' });
      if (onRefreshHealth) onRefreshHealth();
    } catch (e) {
      console.warn('Failed to refresh health:', e);
    }
  };

  const circuitBreakers = health?.circuitBreakers || {};

  return (
    <div className="space-y-6">
      {/* Hero Banner with Status & Quickstart */}
      <div className="rounded-2xl bg-[#0f0f12] border border-[#27272a] p-6 sm:p-8 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-[#141417] text-zinc-300 border border-[#27272a]">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Zero-Local-Daemon Gateway Ready</span>
          </div>
          <span className="text-xs font-mono text-zinc-500">
            Node.js {health?.system.nodeVersion || 'v22+'} • {health?.system.platform || 'linux'}
          </span>
        </div>

        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#fafafa] tracking-tight">
            Cloud-Native KiroProxy Gateway on AI Studio
          </h1>
          <p className="mt-2 text-xs sm:text-sm text-zinc-300 leading-relaxed max-w-4xl">
            Host your Kiro IDE reverse proxy directly on an AI Studio published HTTPS domain.
            Supports AWS Bedrock EventStream binary streaming, autonomous agentic tool calling (<code>fs_write</code>, <code>execute_command</code>),
            7-tier zero-cost waterfall, and sandboxed Gemini Canvas reverse-polling without local daemons.
          </p>
        </div>

        {/* Quick Patch IDE Command */}
        <div className="p-4 rounded-xl bg-[#09090b] border border-[#27272a] space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-zinc-400 flex items-center gap-1.5">
              <Terminal className="w-3.5 h-3.5 text-[#fafafa]" />
              Quick Patch: Run in terminal to point Kiro IDE to this cloud gateway
            </span>
            <button
              onClick={handleCopyCmd}
              className="flex items-center gap-1 text-xs text-zinc-300 hover:text-white font-medium px-2.5 py-1 rounded bg-[#141417] hover:bg-[#1c1c21] border border-[#27272a] transition-colors cursor-pointer"
            >
              {copiedCmd ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-zinc-400" />}
              <span>{copiedCmd ? 'Copied' : 'Copy Command'}</span>
            </button>
          </div>
          <code className="text-xs font-mono text-emerald-400 block break-all selection:bg-[#27272a] selection:text-white">
            {patcherCommand}
          </code>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1 */}
        <div className="p-5 rounded-xl bg-[#0f0f12] border border-[#27272a] hover:border-[#3f3f46] transition-colors flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-zinc-400">Gateway Status</p>
            <p className="text-xl font-bold text-[#fafafa] mt-1 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
              <span>Healthy</span>
            </p>
            <p className="text-[11px] text-zinc-500 mt-1 font-mono">
              {health?.service} v{health?.version}
            </p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-[#141417] border border-[#27272a] flex items-center justify-center text-zinc-300">
            <Server className="w-5 h-5" />
          </div>
        </div>

        {/* Metric 2 */}
        <div className="p-5 rounded-xl bg-[#0f0f12] border border-[#27272a] hover:border-[#3f3f46] transition-colors flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-zinc-400">Total Invocations</p>
            <p className="text-xl font-bold text-[#fafafa] mt-1">
              {health?.stats.totalRequests ?? 0}
            </p>
            <p className="text-[11px] text-emerald-400 mt-1 font-medium">
              {health?.stats.successRate ?? '100%'} success rate
            </p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-[#141417] border border-[#27272a] flex items-center justify-center text-zinc-300">
            <Zap className="w-5 h-5" />
          </div>
        </div>

        {/* Metric 3 */}
        <div className="p-5 rounded-xl bg-[#0f0f12] border border-[#27272a] hover:border-[#3f3f46] transition-colors flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-zinc-400">Active Priority Tiers</p>
            <p className="text-xl font-bold text-[#fafafa] mt-1">
              {priorityList.length} Tiers
            </p>
            <p className="text-[11px] text-zinc-500 mt-1 truncate max-w-[150px] uppercase font-mono">
              {priorityList.slice(0, 3).join(' → ')}...
            </p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-[#141417] border border-[#27272a] flex items-center justify-center text-zinc-300">
            <Layers className="w-5 h-5" />
          </div>
        </div>

        {/* Metric 4 */}
        <div className="p-5 rounded-xl bg-[#0f0f12] border border-[#27272a] hover:border-[#3f3f46] transition-colors flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-zinc-400">Container Uptime</p>
            <p className="text-xl font-bold text-[#fafafa] mt-1">
              {Math.floor((health?.uptimeSeconds || 0) / 60)}m {((health?.uptimeSeconds || 0) % 60)}s
            </p>
            <p className="text-[11px] text-zinc-500 mt-1 font-mono">
              RSS: {health?.system.memoryMb || 0} MB
            </p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-[#141417] border border-[#27272a] flex items-center justify-center text-zinc-300">
            <Cpu className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Global Automode Reorderable Waterfall Section */}
      <div className="rounded-2xl bg-[#0f0f12] border border-[#27272a] p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#27272a]">
          <div>
            <h2 className="text-sm font-bold text-[#fafafa] flex items-center gap-2">
              <Layers className="w-4 h-4 text-emerald-400" />
              Global Automode Provider Priority Order (User-Selectable)
            </h2>
            <p className="text-xs text-zinc-400 mt-1">
              When a provider hits HTTP 429, 401/403, 5xx, or circuit breaker trip, KiroProxy cascades across your ordered tiers below. Use <strong>⬅️ / ➡️</strong> to reorder.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleResetPriority}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#141417] hover:bg-[#1c1c21] text-zinc-300 border border-[#27272a] text-xs cursor-pointer transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Default</span>
            </button>
            <button
              onClick={handleRefreshHealthNow}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#141417] hover:bg-[#1c1c21] text-zinc-300 border border-[#27272a] text-xs cursor-pointer transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Probe Providers</span>
            </button>
            <button
              onClick={handleResetCircuitBreakers}
              disabled={isResettingBreakers}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#141417] hover:bg-[#1c1c21] text-amber-300 border border-[#27272a] text-xs cursor-pointer transition-colors"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Reset Circuit Breakers</span>
            </button>
          </div>
        </div>

        {/* Waterfall Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
          {priorityList.map((tier, idx) => {
            const meta = TIER_METADATA[tier] || { title: tier.toUpperCase(), meta: 'Provider Tier' };
            const cb = circuitBreakers[tier];
            const isTripped = cb && cb.state === 'OPEN';

            return (
              <div
                key={`${tier}-${idx}`}
                className={`p-3 rounded-xl border flex flex-col justify-between space-y-2 transition-all ${
                  isTripped
                    ? 'bg-rose-950/20 border-rose-500/40 text-rose-300'
                    : 'bg-[#141417] border-[#27272a] text-[#fafafa]'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-[#09090b] text-zinc-300 border border-[#27272a]">
                      #{idx + 1}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleMoveTier(idx, -1)}
                        disabled={idx === 0}
                        className="p-1 rounded hover:bg-[#27272a] text-zinc-400 disabled:opacity-20 cursor-pointer"
                        title="Move higher priority"
                      >
                        <ArrowLeft className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => handleMoveTier(idx, 1)}
                        disabled={idx === priorityList.length - 1}
                        className="p-1 rounded hover:bg-[#27272a] text-zinc-400 disabled:opacity-20 cursor-pointer"
                        title="Move lower priority"
                      >
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                  <h4 className="font-bold text-xs truncate">{meta.title}</h4>
                  <p className="text-[10px] text-zinc-400 truncate mt-0.5">{meta.meta}</p>
                </div>

                <div className="pt-2 border-t border-[#27272a] text-[10px] font-mono flex items-center justify-between">
                  <span className={isTripped ? 'text-rose-400' : 'text-emerald-400'}>
                    {isTripped ? 'TRIPPED' : 'READY'}
                  </span>
                  <span className="text-zinc-500">{tier}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Upstream Provider Telemetry & Circuit Breakers */}
      <div className="rounded-2xl bg-[#0f0f12] border border-[#27272a] p-6 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[#27272a]">
          <h3 className="text-sm font-bold text-[#fafafa] flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            Live Provider Health &amp; Circuit Breakers
          </h3>
          <span className="text-xs text-zinc-500 font-mono">Auto-refreshes continuously</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {priorityList.map((tier, idx) => {
            const cb = circuitBreakers[tier];
            const state = cb?.state || 'CLOSED';
            const failures = cb?.consecutiveFailures || 0;
            const meta = TIER_METADATA[tier] || { title: tier.toUpperCase(), meta: 'Provider Tier' };

            return (
              <div
                key={`${tier}-${idx}`}
                className="p-4 rounded-xl bg-[#141417] border border-[#27272a] flex items-center justify-between gap-3 text-xs"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${state === 'OPEN' ? 'bg-rose-400 animate-pulse' : 'bg-emerald-400'}`} />
                    <span className="font-bold text-zinc-200">{meta.title}</span>
                  </div>
                  <div className="text-[11px] text-zinc-400 font-mono mt-1">
                    Failures: {failures} • Trips: {cb?.totalTrips || 0}
                  </div>
                </div>

                <div>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                      state === 'CLOSED'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : state === 'HALF_OPEN'
                        ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                    }`}
                  >
                    Circuit: {state}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent Metrics Activity Stream */}
      <div className="rounded-2xl bg-[#0f0f12] border border-[#27272a] p-6">
        <h3 className="text-sm font-bold text-[#fafafa] mb-4 flex items-center gap-2">
          <Activity className="w-4 h-4 text-[#fafafa]" />
          Recent Request Invocations &amp; Telemetry
        </h3>

        {(!health?.recentMetrics || health.recentMetrics.length === 0) ? (
          <div className="py-8 text-center text-xs text-zinc-500 border border-dashed border-[#27272a] rounded-xl bg-[#09090b]">
            No requests received yet. Test an invocation from the Quick Test tab or trigger Kiro IDE!
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#09090b] text-zinc-400 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-2.5 px-3 rounded-l-lg">Time</th>
                  <th className="py-2.5 px-3">Provider</th>
                  <th className="py-2.5 px-3">Model</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Latency</th>
                  <th className="py-2.5 px-3 rounded-r-lg">Bytes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#27272a]">
                {health.recentMetrics.map((m, idx) => (
                  <tr key={idx} className="hover:bg-[#141417] transition-colors">
                    <td className="py-2.5 px-3 text-zinc-400 font-mono">
                      {new Date(m.timestamp).toLocaleTimeString()}
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-[#fafafa]">
                      {m.provider}
                    </td>
                    <td className="py-2.5 px-3 text-zinc-300 font-mono">
                      {m.model}
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium ${
                          m.status === 'success'
                            ? 'bg-[#141417] text-emerald-400 border border-emerald-500/30'
                            : 'bg-[#141417] text-rose-400 border border-rose-500/30'
                        }`}
                      >
                        {m.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-zinc-300 font-mono">
                      {m.durationMs}ms
                    </td>
                    <td className="py-2.5 px-3 text-zinc-400 font-mono">
                      {m.bytesSent} B
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
