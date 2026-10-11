import React, { useState } from 'react';
import {
  Terminal,
  Download,
  Copy,
  Check,
  RotateCcw,
  Shield,
  Laptop,
  CheckCircle2,
  ExternalLink,
  Code,
  FileCode,
} from 'lucide-react';
import type { HealthData, GatewayConfig } from '../types.js';

interface PatcherTabProps {
  health: HealthData | null;
  config: GatewayConfig | null;
}

export const PatcherTab: React.FC<PatcherTabProps> = ({ health, config }) => {
  const publicUrl = health?.environment.publicUrl || window.location.origin;

  const [selectedTarget, setSelectedTarget] = useState<'cloud' | 'local' | 'custom'>('cloud');
  const [customTargetUrl, setCustomTargetUrl] = useState('');
  const [tokenInput, setTokenInput] = useState(config?.adminToken || '');
  const [selectedOs, setSelectedOs] = useState<'bash' | 'powershell' | 'manual'>('bash');
  const [copied, setCopied] = useState<string | null>(null);

  const getEffectiveUrl = () => {
    if (selectedTarget === 'cloud') return publicUrl;
    if (selectedTarget === 'local') return 'http://127.0.0.1:8084';
    return customTargetUrl || publicUrl;
  };

  const effectiveUrl = getEffectiveUrl();
  const tokenParam = tokenInput ? ` --token ${tokenInput}` : '';

  // Commands
  const bashCommand = `curl -fsSL ${publicUrl}/scripts/patch_kiro_extension.js | node - --url ${effectiveUrl}${tokenParam}`;
  const powerShellCommand = `Invoke-RestMethod -Uri "${publicUrl}/scripts/patch_kiro_extension.js" -OutFile "$env:TEMP\\patch_kiro.js"; node "$env:TEMP\\patch_kiro.js" --url "${effectiveUrl}"${tokenParam}`;
  const checkCommand = `node patch_kiro_extension.js --check`;
  const revertCommand = `node patch_kiro_extension.js --revert`;

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800">
        <div className="flex items-center gap-2 mb-1">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Terminal className="w-5 h-5 text-indigo-400" />
            Kiro IDE Extension Patcher
          </h2>
          <span className="text-xs px-2 py-0.5 rounded-full font-mono bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
            v5.1 Dual-Mode Edition
          </span>
        </div>
        <p className="text-xs text-slate-400 mt-1">
          Surgically patches Kiro IDE&apos;s extension bundle to route model discovery (<code className="text-slate-300 font-mono">/listAvailableModels</code> &amp; <code className="text-slate-300 font-mono">/v1/models</code>) and <code className="text-slate-300 font-mono">/generateAssistantResponse</code> EventStream inference directly to this published domain.
        </p>
      </div>

      {/* Target Configuration Card */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-6">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider">
          1. Choose Destination Gateway
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            onClick={() => setSelectedTarget('cloud')}
            className={`p-4 rounded-xl border text-left transition-all ${
              selectedTarget === 'cloud'
                ? 'bg-indigo-950/40 border-indigo-500 text-white shadow-lg shadow-indigo-500/10'
                : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-xs uppercase text-indigo-400">Recommended</span>
              {selectedTarget === 'cloud' && <CheckCircle2 className="w-4 h-4 text-indigo-400" />}
            </div>
            <p className="font-semibold text-white text-sm">AI Studio Cloud Domain</p>
            <p className="text-[11px] text-slate-400 mt-1 font-mono truncate">{publicUrl}</p>
          </button>

          <button
            onClick={() => setSelectedTarget('local')}
            className={`p-4 rounded-xl border text-left transition-all ${
              selectedTarget === 'local'
                ? 'bg-indigo-950/40 border-indigo-500 text-white shadow-lg shadow-indigo-500/10'
                : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-xs uppercase text-slate-500">Local Run</span>
              {selectedTarget === 'local' && <CheckCircle2 className="w-4 h-4 text-indigo-400" />}
            </div>
            <p className="font-semibold text-white text-sm">Localhost Daemon</p>
            <p className="text-[11px] text-slate-400 mt-1 font-mono">http://127.0.0.1:8084</p>
          </button>

          <button
            onClick={() => setSelectedTarget('custom')}
            className={`p-4 rounded-xl border text-left transition-all ${
              selectedTarget === 'custom'
                ? 'bg-indigo-950/40 border-indigo-500 text-white shadow-lg shadow-indigo-500/10'
                : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-xs uppercase text-slate-500">Custom URL</span>
              {selectedTarget === 'custom' && <CheckCircle2 className="w-4 h-4 text-indigo-400" />}
            </div>
            <p className="font-semibold text-white text-sm">Custom Gateway URL</p>
            <p className="text-[11px] text-slate-400 mt-1">Specify custom domain or staging</p>
          </button>
        </div>

        {selectedTarget === 'custom' && (
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Custom Gateway URL</label>
            <input
              type="text"
              value={customTargetUrl}
              onChange={(e) => setCustomTargetUrl(e.target.value)}
              placeholder="https://my-custom-proxy.example.com"
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-indigo-500"
            />
          </div>
        )}

        {/* Optional Token */}
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1 flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-indigo-400" />
            Security Guard Token (Optional PROXY_ADMIN_TOKEN)
          </label>
          <input
            type="text"
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            placeholder="e.g. secret-token-xyz (baked into /k/<token> route)"
            className="w-full sm:w-96 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-indigo-500"
          />
        </div>
      </div>

      {/* Generated Patching Command Card */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">
            2. Run Patcher in Terminal
          </h3>
          {/* OS Switcher */}
          <div className="flex items-center p-1 rounded-lg bg-slate-950 border border-slate-800 text-xs">
            <button
              onClick={() => setSelectedOs('bash')}
              className={`px-3 py-1 rounded font-medium transition-colors ${
                selectedOs === 'bash' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              macOS / Linux (Bash)
            </button>
            <button
              onClick={() => setSelectedOs('powershell')}
              className={`px-3 py-1 rounded font-medium transition-colors ${
                selectedOs === 'powershell' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Windows (PowerShell)
            </button>
            <button
              onClick={() => setSelectedOs('manual')}
              className={`px-3 py-1 rounded font-medium transition-colors ${
                selectedOs === 'manual' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Direct Download
            </button>
          </div>
        </div>

        {selectedOs === 'bash' && (
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-xs text-slate-400 font-mono">Terminal Command (Bash / Zsh):</span>
              <button
                onClick={() => copyToClipboard(bashCommand, 'bash')}
                className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 font-medium px-2 py-1 rounded bg-indigo-500/10 hover:bg-indigo-500/20"
              >
                {copied === 'bash' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied === 'bash' ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
            <code className="text-xs font-mono text-emerald-400 block break-all selection:bg-indigo-500 selection:text-white">
              {bashCommand}
            </code>
          </div>
        )}

        {selectedOs === 'powershell' && (
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-xs text-slate-400 font-mono">PowerShell Command:</span>
              <button
                onClick={() => copyToClipboard(powerShellCommand, 'ps')}
                className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 font-medium px-2 py-1 rounded bg-indigo-500/10 hover:bg-indigo-500/20"
              >
                {copied === 'ps' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied === 'ps' ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
            <code className="text-xs font-mono text-emerald-400 block break-all selection:bg-indigo-500 selection:text-white">
              {powerShellCommand}
            </code>
          </div>
        )}

        {selectedOs === 'manual' && (
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
            <p className="text-xs text-slate-300">
              Download the standalone Node.js CLI script directly to your workstation:
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <a
                href="/scripts/patch_kiro_extension.js"
                download="patch_kiro_extension.js"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/20 transition-colors"
              >
                <Download className="w-4 h-4" />
                <span>Download patch_kiro_extension.js</span>
              </a>
              <span className="text-xs text-slate-400">
                Then run: <code className="text-emerald-400 font-mono">node patch_kiro_extension.js --url {effectiveUrl}</code>
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Revert Instructions */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <RotateCcw className="w-4 h-4 text-amber-400" />
          How to Revert Back to Default AWS Bedrock
        </h3>
        <p className="text-xs text-slate-400">
          The patcher creates automatic backups of original bundles (<code className="text-slate-300">*.kiro-backup</code>).
          To restore original AWS Bedrock endpoints at any time, run:
        </p>
        <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between gap-2">
          <code className="text-xs font-mono text-amber-300">{revertCommand}</code>
          <button
            onClick={() => copyToClipboard(revertCommand, 'revert')}
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-white"
          >
            {copied === 'revert' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Verify Patch Status */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          Verify Active Extension Patch Status
        </h3>
        <p className="text-xs text-slate-400">
          Check whether Kiro IDE has the dual-mode patches, runtime overrides, and clean backups applied:
        </p>
        <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between gap-2">
          <code className="text-xs font-mono text-emerald-400">{checkCommand}</code>
          <button
            onClick={() => copyToClipboard(checkCommand, 'check')}
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-white"
          >
            {copied === 'check' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>
    </div>
  );
};
