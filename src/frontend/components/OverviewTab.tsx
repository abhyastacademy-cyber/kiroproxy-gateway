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
  const publicUrl = health?.environment.publicUrl ||
    (typeof window !== 'undefined' && (window.location.hostname.includes('ai.studio') || window.location.hostname.includes('run.app'))
      ? 'https://kiroproxy-746899042471.asia-southeast1.run.app'
      : window.location.origin);
  const isCloud = health?.environment.isCloudRun;
  const [copiedCmd, setCopiedCmd] = useState(false);

  const patcherCommand = `curl -fsSL ${publicUrl}/scripts/patch_kiro_extension.js | node - --url ${publicUrl}${
    config?.adminToken ? ` --token ${config.adminToken}` : ''
  }`;

  const handleCopyCmd = () => {
    navigator.clipboard.writeText(patcherCommand);
    setCopiedCmd(true);
    setTimeout(() => setCopiedCmd(false), 2000);
  };

  const priorityList = config?.providerPriorityOrder || [
    'kilo',
    'cline',
    'openrouter',
    'orcarouter',
    'gemini',
    'custom',
    'canvas',
  ];

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
            Eliminates the need for local Node daemons, supports direct AWS Bedrock EventStream binary streaming,
            7-tier failover cascade, and sandboxed Gemini Canvas reverse-polling without ngrok.
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
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              Healthy
            </p>
            <p className="text-[11px] text-zinc-500 mt-1">
              {isCloud ? 'Published Domain Ingress' : `Port ${health?.environment.port || 3000}`}
            </p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-[#141417] border border-[#27272a] flex items-center justify-center text-zinc-300">
            <Globe className="w-5 h-5" />
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
            <p className="text-[11px] text-zinc-500 mt-1">
              RSS: {health?.system.memoryMb || 0} MB
            </p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-[#141417] border border-[#27272a] flex items-center justify-center text-zinc-300">
            <Cpu className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Architecture Visualizer Card */}
      <div className="rounded-2xl bg-[#0f0f12] border border-[#27272a] p-6 sm:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#27272a]">
          <div>
            <h2 className="text-lg font-bold text-[#fafafa] flex items-center gap-2">
              <Activity className="w-5 h-5 text-[#fafafa]" />
              Architecture: Local Daemon vs. AI Studio Published Domain
            </h2>
            <p className="text-xs text-zinc-400 mt-1">
              How the cloud gateway replaces localhost:8084 and connects Kiro IDE to upstream LLMs
            </p>
          </div>
          <button
            onClick={() => onNavigateTab('patcher')}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#09090b] bg-[#fafafa] hover:bg-[#e4e4e7] px-3.5 py-1.5 rounded-lg transition-colors self-start sm:self-auto cursor-pointer"
          >
            <span>Patcher Details</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Flow Columns */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Node 1: Kiro IDE */}
          <div className="p-5 rounded-xl bg-[#141417] border border-[#27272a] flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-lg bg-[#09090b] border border-[#27272a] text-zinc-300 flex items-center justify-center mb-3">
                <Laptop className="w-5 h-5" />
              </div>
              <h3 className="font-semibold text-[#fafafa] text-sm">1. Kiro IDE (Patched)</h3>
              <p className="text-xs text-zinc-400 mt-1">
                Extension patched to send requests to <span className="text-[#fafafa] font-mono">{publicUrl}</span> instead of AWS Bedrock.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-[#27272a] text-[11px] text-zinc-500 font-mono">
              POST /generateAssistantResponse
            </div>
          </div>

          {/* Node 2: KiroProxy Cloud Gateway */}
          <div className="p-5 rounded-xl bg-[#141417] border border-[#3f3f46] flex flex-col justify-between relative">
            <div className="absolute -top-2.5 right-4 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#fafafa] text-[#09090b] uppercase tracking-wider">
              This Container
            </div>
            <div>
              <div className="w-10 h-10 rounded-lg bg-[#09090b] border border-[#27272a] text-emerald-400 flex items-center justify-center mb-3">
                <Cloud className="w-5 h-5" />
              </div>
              <h3 className="font-semibold text-[#fafafa] text-sm">2. AI Studio Published Gateway</h3>
              <p className="text-xs text-zinc-300 mt-1">
                Binds 0.0.0.0, encodes binary AWS EventStream frames with CRC32 checksums, routes through priority tiers.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-[#27272a] text-[11px] text-zinc-400 font-mono flex items-center justify-between">
              <span>EventStream + CRC32</span>
              <span className="text-emerald-400 font-medium">Zero Local Daemon</span>
            </div>
          </div>

          {/* Node 3: Upstream Providers */}
          <div className="p-5 rounded-xl bg-[#141417] border border-[#27272a] flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-lg bg-[#09090b] border border-[#27272a] text-zinc-300 flex items-center justify-center mb-3">
                <Server className="w-5 h-5" />
              </div>
              <h3 className="font-semibold text-[#fafafa] text-sm">3. 7-Tier Failover Cascade</h3>
              <p className="text-xs text-zinc-400 mt-1">
                Kilo, Cline, OpenRouter, OrcaRouter, Gemini Direct, Custom reverse proxies, and Gemini Canvas sandboxed bridge.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-[#27272a] text-[11px] text-zinc-500 font-mono">
              Auto-Failover on 429 / 500
            </div>
          </div>
        </div>

        {/* Comparison Callout */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl bg-[#141417] border border-[#27272a]">
            <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Server className="w-3.5 h-3.5 text-zinc-400" />
              Traditional Local Execution
            </h4>
            <ul className="text-xs text-zinc-400 space-y-1.5 list-disc list-inside">
              <li>Must keep a Node.js daemon running on your PC on port 8084</li>
              <li>Consumes local RAM and CPU continuously</li>
              <li>Requires ngrok daemon when interacting with Gemini Canvas iframe</li>
              <li>Cannot be shared with your laptop or second workstation</li>
            </ul>
          </div>

          <div className="p-4 rounded-xl bg-[#141417] border border-[#3f3f46]">
            <h4 className="text-xs font-semibold text-[#fafafa] uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Cloud className="w-3.5 h-3.5 text-emerald-400" />
              AI Studio Published Domain (Cloud-Native)
            </h4>
            <ul className="text-xs text-zinc-300 space-y-1.5 list-disc list-inside">
              <li>Zero local processes running on your computer</li>
              <li>Public HTTPS endpoint accessible directly by Kiro IDE anywhere</li>
              <li>Direct reverse-polling for Gemini Canvas without local ngrok tunnel</li>
              <li>Stateless container persistence via env variables + config sync</li>
            </ul>
          </div>
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
            No requests received yet. Test an invocation from the Stream Playground tab or trigger Kiro IDE!
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
