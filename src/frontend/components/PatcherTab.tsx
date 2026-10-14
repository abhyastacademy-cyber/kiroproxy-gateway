import React, { useState } from 'react';
import {
  Terminal,
  Copy,
  Check,
  Download,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  FileCode,
  Laptop,
  FolderOpen,
} from 'lucide-react';
import type { HealthData, GatewayConfig } from '../types.js';

interface PatcherTabProps {
  health: HealthData | null;
  config: GatewayConfig | null;
}

export const PatcherTab: React.FC<PatcherTabProps> = ({ health, config }) => {
  const [copiedScript, setCopiedScript] = useState<string | null>(null);
  const [activeOs, setActiveOs] = useState<'windows' | 'mac' | 'linux'>('windows');

  const publicUrl =
    health?.environment.publicUrl ||
    (typeof window !== 'undefined' &&
    (window.location.hostname.includes('ai.studio') || window.location.hostname.includes('run.app'))
      ? window.location.origin
      : 'http://localhost:3000');

  const token = config?.adminToken || '';
  const bedrockUrl = token
    ? `${publicUrl}/k/${token}/generateAssistantResponse`
    : `${publicUrl}/generateAssistantResponse`;
  const listModelsUrl = token
    ? `${publicUrl}/k/${token}/listAvailableModels`
    : `${publicUrl}/listAvailableModels`;

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedScript(id);
    setTimeout(() => setCopiedScript(null), 2000);
  };

  const powershellCommand = `irm "${publicUrl}/scripts/patch_kiro_extension.js" -OutFile "$env:TEMP\\patch_kiro.js"; node "$env:TEMP\\patch_kiro.js" "${publicUrl}" "${token}"`;
  const bashCommand = `curl -fsSL "${publicUrl}/scripts/patch_kiro_extension.js" -o /tmp/patch_kiro.js && node /tmp/patch_kiro.js "${publicUrl}" "${token}"`;

  return (
    <div className="space-y-6">
      {/* Overview Banner */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-blue-950/40 via-[#0f0f12] to-indigo-950/40 border border-blue-500/20">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-400 flex-shrink-0">
            <Terminal className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h2 className="text-base font-bold text-white">Kiro IDE Patcher &amp; Extension Connector</h2>
            <p className="text-xs text-zinc-300 leading-relaxed">
              Connect your local Kiro IDE desktop app directly to this Cloud Gateway. All AWS Bedrock EventStream requests will be transparently routed through your zero-cost priority waterfall.
            </p>
          </div>
        </div>
      </div>

      {/* Quick Setup 1-Liner */}
      <section className="p-5 rounded-2xl bg-[#0f0f12] border border-[#27272a] space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-white">1-Click Automated Patching Command</h3>
            <p className="text-xs text-zinc-400">
              Run this command in your terminal while Kiro IDE is closed to patch the extension automatically.
            </p>
          </div>

          <div className="flex items-center gap-1 p-1 rounded-xl bg-[#141417] border border-[#27272a] text-xs">
            <button
              onClick={() => setActiveOs('windows')}
              className={`px-3 py-1 rounded-lg font-medium transition-colors ${
                activeOs === 'windows' ? 'bg-[#27272a] text-white' : 'text-zinc-400 hover:text-white'
              }`}
            >
              Windows (PowerShell)
            </button>
            <button
              onClick={() => setActiveOs('mac')}
              className={`px-3 py-1 rounded-lg font-medium transition-colors ${
                activeOs === 'mac' ? 'bg-[#27272a] text-white' : 'text-zinc-400 hover:text-white'
              }`}
            >
              macOS
            </button>
            <button
              onClick={() => setActiveOs('linux')}
              className={`px-3 py-1 rounded-lg font-medium transition-colors ${
                activeOs === 'linux' ? 'bg-[#27272a] text-white' : 'text-zinc-400 hover:text-white'
              }`}
            >
              Linux
            </button>
          </div>
        </div>

        <div className="relative">
          <pre className="p-4 rounded-xl bg-[#09090b] border border-[#27272a] font-mono text-xs text-cyan-300 overflow-x-auto selection:bg-cyan-900 selection:text-white">
            {activeOs === 'windows' ? powershellCommand : bashCommand}
          </pre>
          <button
            onClick={() =>
              copyToClipboard(
                activeOs === 'windows' ? powershellCommand : bashCommand,
                'cmd'
              )
            }
            className="absolute top-3 right-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#27272a] hover:bg-[#3f3f46] text-xs text-white transition-colors"
          >
            {copiedScript === 'cmd' ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400 font-semibold">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy Command</span>
              </>
            )}
          </button>
        </div>
      </section>

      {/* Manual Configuration Endpoints */}
      <section className="p-5 rounded-2xl bg-[#0f0f12] border border-[#27272a] space-y-4">
        <h3 className="text-sm font-bold text-white">Manual Endpoint Configuration</h3>
        <p className="text-xs text-zinc-400">
          If configuring an IDE proxy extension or settings.json manually, use these endpoint URLs:
        </p>

        <div className="space-y-3">
          <div className="p-3.5 rounded-xl bg-[#141417] border border-[#27272a] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <span className="text-[11px] font-semibold text-zinc-400">AWS Bedrock Streaming Endpoint:</span>
              <p className="font-mono text-xs text-zinc-200 break-all">{bedrockUrl}</p>
            </div>
            <button
              onClick={() => copyToClipboard(bedrockUrl, 'bedrock')}
              className="p-1.5 rounded-lg bg-[#27272a] hover:bg-[#3f3f46] text-zinc-300 self-end sm:self-center"
            >
              {copiedScript === 'bedrock' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>

          <div className="p-3.5 rounded-xl bg-[#141417] border border-[#27272a] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <span className="text-[11px] font-semibold text-zinc-400">Model List Discovery Endpoint:</span>
              <p className="font-mono text-xs text-zinc-200 break-all">{listModelsUrl}</p>
            </div>
            <button
              onClick={() => copyToClipboard(listModelsUrl, 'models')}
              className="p-1.5 rounded-lg bg-[#27272a] hover:bg-[#3f3f46] text-zinc-300 self-end sm:self-center"
            >
              {copiedScript === 'models' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};
