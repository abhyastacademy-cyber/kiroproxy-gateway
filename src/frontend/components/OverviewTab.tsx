import React from 'react';
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
} from 'lucide-react';
import type { HealthData, GatewayConfig } from '../types.js';

interface OverviewTabProps {
  health: HealthData | null;
  config: GatewayConfig | null;
  onNavigateTab: (tab: string) => void;
}

export const OverviewTab: React.FC<OverviewTabProps> = ({
  health,
  config,
  onNavigateTab,
}) => {
  const [copiedCmd, setCopiedCmd] = React.useState(false);
  const publicUrl = health?.environment.publicUrl || window.location.origin;
  const isCloud = health?.environment.isCloudRun;

  const patcherCommand = `curl -fsSL ${publicUrl}/scripts/patch_kiro_extension.js | node - --url ${publicUrl}${
    config?.adminToken ? ` --token ${config.adminToken}` : ''
  }`;

  const handleCopyCmd = () => {
    navigator.clipboard.writeText(patcherCommand);
    setCopiedCmd(true);
    setTimeout(() => setCopiedCmd(false), 2000);
  };

  return (
    <div className="space-y-8">
      {/* Hero Banner with Status & Quickstart */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-indigo-950/40 to-slate-900 border border-slate-800 p-6 sm:p-8">
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 max-w-4xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 mb-4">
            <Radio className="w-3.5 h-3.5 animate-pulse text-emerald-400" />
            <span>Zero-Local-Daemon Gateway Ready</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Cloud-Native KiroProxy Gateway on AI Studio
          </h1>
          <p className="mt-2 text-sm sm:text-base text-slate-300 leading-relaxed">
            Host your Kiro IDE reverse proxy directly on an AI Studio published HTTPS domain.
            Eliminates the need for local Node daemons, supports direct AWS Bedrock EventStream streaming,
            multi-baseUrls failover, and sandboxed Gemini Canvas reverse-polling.
          </p>

          {/* Quick Patch IDE Command */}
          <div className="mt-6 p-4 rounded-xl bg-slate-950/90 border border-slate-800">
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
                <Terminal className="w-3.5 h-3.5 text-indigo-400" />
                Quick Patch: Run in terminal to point Kiro IDE to this cloud gateway
              </span>
              <button
                onClick={handleCopyCmd}
                className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 font-medium px-2 py-1 rounded bg-indigo-500/10 hover:bg-indigo-500/20 transition-colors"
              >
                {copiedCmd ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedCmd ? 'Copied' : 'Copy Command'}</span>
              </button>
            </div>
            <code className="text-xs font-mono text-emerald-400 block break-all selection:bg-indigo-500 selection:text-white">
              {patcherCommand}
            </code>
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1 */}
        <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-400">Gateway Status</p>
            <p className="text-xl font-bold text-white mt-1 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              Healthy
            </p>
            <p className="text-[11px] text-slate-500 mt-1">
              {isCloud ? 'Cloud Run Ingress' : `Listening on 0.0.0.0:${health?.environment.port || 3000}`}
            </p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <Globe className="w-5 h-5" />
          </div>
        </div>

        {/* Metric 2 */}
        <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-400">Total Invocations</p>
            <p className="text-xl font-bold text-white mt-1">
              {health?.stats.totalRequests ?? 0}
            </p>
            <p className="text-[11px] text-emerald-400 mt-1 font-medium">
              {health?.stats.successRate ?? '100%'} success rate
            </p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <Zap className="w-5 h-5" />
          </div>
        </div>

        {/* Metric 3 */}
        <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-400">Active Priority Tiers</p>
            <p className="text-xl font-bold text-white mt-1">
              {config?.providerPriorityOrder.length || 0} Tiers
            </p>
            <p className="text-[11px] text-slate-500 mt-1 truncate max-w-[150px]">
              {config?.providerPriorityOrder.join(' → ') || 'gemini'}
            </p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
            <Layers className="w-5 h-5" />
          </div>
        </div>

        {/* Metric 4 */}
        <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-400">Container Uptime</p>
            <p className="text-xl font-bold text-white mt-1">
              {Math.floor((health?.uptimeSeconds || 0) / 60)}m {((health?.uptimeSeconds || 0) % 60)}s
            </p>
            <p className="text-[11px] text-slate-500 mt-1">
              Memory: {health?.system.memoryMb || 0} MB RSS
            </p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <Cpu className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Architecture Visualizer Card */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Activity className="w-5 h-5 text-indigo-400" />
              Architecture: Local Daemon vs. AI Studio Published Domain
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              How the cloud gateway replaces localhost:8084 and connects Kiro IDE to upstream LLMs
            </p>
          </div>
          <button
            onClick={() => onNavigateTab('patcher')}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 px-3 py-1.5 rounded-lg border border-indigo-500/20 transition-colors self-start sm:self-auto"
          >
            <span>Patcher Details</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Flow Columns */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Node 1: Kiro IDE */}
          <div className="p-5 rounded-xl bg-slate-950/60 border border-slate-800 flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center mb-3">
                <Laptop className="w-5 h-5" />
              </div>
              <h3 className="font-semibold text-white text-sm">1. Kiro IDE (Patched)</h3>
              <p className="text-xs text-slate-400 mt-1">
                Extension patched to send requests to <span className="text-indigo-300 font-mono">{publicUrl}</span> instead of AWS Bedrock.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-800/80 text-[11px] text-slate-500 font-mono">
              POST /generateAssistantResponse
            </div>
          </div>

          {/* Node 2: KiroProxy Cloud Gateway */}
          <div className="p-5 rounded-xl bg-indigo-950/20 border border-indigo-500/30 flex flex-col justify-between relative">
            <div className="absolute -top-3 right-4 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-500 text-white uppercase tracking-wider">
              This Container
            </div>
            <div>
              <div className="w-10 h-10 rounded-lg bg-indigo-500/20 text-indigo-300 flex items-center justify-center mb-3">
                <Cloud className="w-5 h-5" />
              </div>
              <h3 className="font-semibold text-white text-sm">2. AI Studio Published Gateway</h3>
              <p className="text-xs text-slate-300 mt-1">
                Binds 0.0.0.0, encodes binary AWS EventStream frames with CRC32 checksums, routes through priority tiers.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-indigo-500/20 text-[11px] text-indigo-300 font-mono flex items-center justify-between">
              <span>EventStream + CRC32</span>
              <span className="text-emerald-400">Zero Local Daemon</span>
            </div>
          </div>

          {/* Node 3: Upstream Providers */}
          <div className="p-5 rounded-xl bg-slate-950/60 border border-slate-800 flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center mb-3">
                <Server className="w-5 h-5" />
              </div>
              <h3 className="font-semibold text-white text-sm">3. Provider Failover Chain</h3>
              <p className="text-xs text-slate-400 mt-1">
                Gemini 2.5 Flash/Pro, Custom multi-baseUrls endpoints, OpenRouter, and Gemini Canvas sandboxed reverse-polling.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-800/80 text-[11px] text-slate-500 font-mono">
              Auto-Failover on 429 / 500
            </div>
          </div>
        </div>

        {/* Comparison Callout */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl bg-slate-950/40 border border-slate-800/80">
            <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Server className="w-3.5 h-3.5 text-amber-400" />
              Traditional Local Execution
            </h4>
            <ul className="text-xs text-slate-400 space-y-1.5 list-disc list-inside">
              <li>Must keep a Node.js daemon running on your PC on port 8084</li>
              <li>Consumes local RAM and CPU continuously</li>
              <li>Requires ngrok daemon when interacting with Gemini Canvas iframe</li>
              <li>Cannot be shared with your laptop or second workstation</li>
            </ul>
          </div>

          <div className="p-4 rounded-xl bg-indigo-950/30 border border-indigo-500/20">
            <h4 className="text-xs font-semibold text-indigo-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Cloud className="w-3.5 h-3.5 text-emerald-400" />
              AI Studio Published Domain (Cloud-Native)
            </h4>
            <ul className="text-xs text-slate-300 space-y-1.5 list-disc list-inside">
              <li>Zero local processes running on your computer</li>
              <li>Public HTTPS endpoint accessible directly by Kiro IDE anywhere</li>
              <li>Direct reverse-polling for Gemini Canvas without local ngrok tunnel</li>
              <li>Stateless container persistence via env variables + /tmp fallback</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Recent Metrics Activity Stream */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6">
        <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
          <Activity className="w-4 h-4 text-indigo-400" />
          Recent Request Invocations & Telemetry
        </h3>

        {(!health?.recentMetrics || health.recentMetrics.length === 0) ? (
          <div className="py-8 text-center text-xs text-slate-500 border border-dashed border-slate-800 rounded-xl">
            No requests received yet. Test an invocation from the Gateway Tester tab or trigger Kiro IDE!
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/60 text-slate-400 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-2.5 px-3 rounded-l-lg">Time</th>
                  <th className="py-2.5 px-3">Provider</th>
                  <th className="py-2.5 px-3">Model</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Latency</th>
                  <th className="py-2.5 px-3 rounded-r-lg">Bytes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {health.recentMetrics.map((m, idx) => (
                  <tr key={idx} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-2.5 px-3 text-slate-400 font-mono">
                      {new Date(m.timestamp).toLocaleTimeString()}
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-white">
                      {m.provider}
                    </td>
                    <td className="py-2.5 px-3 text-indigo-300 font-mono">
                      {m.model}
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium ${
                          m.status === 'success'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        }`}
                      >
                        {m.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-300 font-mono">
                      {m.durationMs}ms
                    </td>
                    <td className="py-2.5 px-3 text-slate-400 font-mono">
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
