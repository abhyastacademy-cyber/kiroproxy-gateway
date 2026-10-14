import React, { useState } from 'react';
import {
  Activity,
  Shield,
  ShieldAlert,
  ShieldCheck,
  RefreshCw,
  Zap,
  Copy,
  Check,
  Globe,
  Radio,
  ExternalLink,
} from 'lucide-react';
import type { HealthData, GatewayConfig } from '../types.js';

interface NavbarProps {
  health: HealthData | null;
  config: GatewayConfig | null;
  adminToken: string;
  onOpenSecurityModal: () => void;
  onRefresh: () => void;
  onToggleAutoMode: () => void;
  isRefreshing: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  health,
  config,
  adminToken,
  onOpenSecurityModal,
  onRefresh,
  onToggleAutoMode,
  isRefreshing,
}) => {
  const [copiedUrl, setCopiedUrl] = useState(false);

  const isHealthy = health?.status === 'healthy';
  const autoModeActive = config?.globalAutoMode ?? true;
  const isTokenConfigured = Boolean(adminToken || (config as any)?.adminToken);

  const publicUrl =
    health?.environment.publicUrl ||
    (typeof window !== 'undefined' &&
    (window.location.hostname.includes('ai.studio') || window.location.hostname.includes('run.app'))
      ? window.location.origin
      : 'http://localhost:3000');

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(publicUrl);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  return (
    <header className="sticky top-0 z-40 border-b border-[#27272a] bg-[#09090b]/90 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-500 via-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Radio className="w-5 h-5 text-white animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm tracking-tight text-white">KiroProxy</span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold tracking-wide bg-blue-500/10 text-blue-400 border border-blue-500/20">
                CLOUD v2.8
              </span>
            </div>
            <p className="text-[11px] text-zinc-400 hidden sm:block">
              Zero-Cost Bedrock &amp; OpenAI Gateway
            </p>
          </div>
        </div>

        {/* Center Public URL pill */}
        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#141417] border border-[#27272a] text-xs text-zinc-300">
          <Globe className="w-3.5 h-3.5 text-zinc-400" />
          <span className="font-mono text-[11px] truncate max-w-xs">{publicUrl}</span>
          <button
            onClick={handleCopyUrl}
            title="Copy Public URL"
            className="p-1 rounded hover:bg-[#27272a] text-zinc-400 hover:text-white transition-colors"
          >
            {copiedUrl ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
          </button>
        </div>

        {/* Actions & Status */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Health Badge */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#141417] border border-[#27272a] text-xs">
            <span
              className={`w-2 h-2 rounded-full ${
                isHealthy ? 'bg-emerald-400 animate-pulse shadow-sm shadow-emerald-400/50' : 'bg-rose-400'
              }`}
            />
            <span className="text-[11px] font-medium text-zinc-300 hidden sm:inline">
              {isHealthy ? 'Gateway Live' : 'Connecting'}
            </span>
          </div>

          {/* Global AutoMode Toggle */}
          <button
            onClick={onToggleAutoMode}
            title={autoModeActive ? 'Global AutoMode: Enabled' : 'Global AutoMode: Disabled'}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              autoModeActive
                ? 'bg-emerald-950/40 text-emerald-300 border-emerald-500/30 hover:bg-emerald-900/40'
                : 'bg-zinc-900 text-zinc-400 border-[#27272a] hover:bg-zinc-800'
            }`}
          >
            <Zap className={`w-3.5 h-3.5 ${autoModeActive ? 'text-emerald-400 fill-emerald-400/20' : 'text-zinc-500'}`} />
            <span className="hidden sm:inline">{autoModeActive ? 'AutoMode ON' : 'AutoMode OFF'}</span>
          </button>

          {/* Security / Admin Token Button */}
          <button
            onClick={onOpenSecurityModal}
            title="Configure Admin Security Token"
            className={`p-2 rounded-lg border transition-colors ${
              isTokenConfigured
                ? 'bg-[#141417] text-emerald-400 border-emerald-500/30 hover:bg-[#1a1a20]'
                : 'bg-[#141417] text-zinc-400 border-[#27272a] hover:text-white hover:bg-[#1f1f23]'
            }`}
          >
            {isTokenConfigured ? (
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
            ) : (
              <Shield className="w-4 h-4 text-zinc-400" />
            )}
          </button>

          {/* Refresh Button */}
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            title="Refresh System Health & Status"
            className="p-2 rounded-lg bg-[#141417] border border-[#27272a] text-zinc-400 hover:text-white hover:bg-[#1f1f23] transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-blue-400' : ''}`} />
          </button>
        </div>
      </div>
    </header>
  );
};
