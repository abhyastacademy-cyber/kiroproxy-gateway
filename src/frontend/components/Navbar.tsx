import React from 'react';
import { Cloud, Lock, Unlock, Server, RefreshCw, Copy, Check, ExternalLink, Zap } from 'lucide-react';
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
  const [copied, setCopied] = React.useState(false);

  const publicUrl = health?.environment.publicUrl || window.location.origin;
  const isCloud = health?.environment.isCloudRun;
  const isAutoModeActive = config?.globalAutoMode !== false;

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-indigo-500/20 text-white font-black text-xl">
            K
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-100 text-lg tracking-tight">KiroProxy</span>
              <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                Cloud Gateway
              </span>
              {isCloud ? (
                <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <Cloud className="w-3 h-3" /> Published Domain
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  <Server className="w-3 h-3" /> Port {health?.environment.port || 3000}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400">AWS Bedrock & OpenAI Drop-In Reverse Proxy</p>
          </div>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-3">
          {/* Global AutoMode / OtoMode Badge */}
          <button
            onClick={onToggleAutoMode}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
              isAutoModeActive
                ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/25 shadow-sm shadow-emerald-500/10'
                : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
            }`}
            title="Toggle Global AutoMode & OtoMode (Continuous autonomous multi-turn agent execution)"
          >
            <Zap className={`w-3.5 h-3.5 ${isAutoModeActive ? 'text-amber-400 fill-amber-400 animate-pulse' : 'text-slate-500'}`} />
            <span>{isAutoModeActive ? 'AutoMode & OtoMode: ACTIVE' : 'AutoMode: PAUSED'}</span>
          </button>

          {/* Public URL Pill */}
          <div className="hidden lg:flex items-center gap-2 bg-slate-950/80 border border-slate-800/80 rounded-lg px-3 py-1.5 text-xs">
            <span className="text-slate-400 font-mono">Gateway:</span>
            <span className="text-indigo-300 font-mono max-w-[200px] truncate" title={publicUrl}>
              {publicUrl}
            </span>
            <button
              onClick={handleCopyUrl}
              className="p-1 hover:text-white text-slate-400 transition-colors"
              title="Copy Gateway Endpoint URL"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>

          {/* Security Token Button */}
          <button
            onClick={onOpenSecurityModal}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              adminToken
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'
                : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
            }`}
          >
            {adminToken ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
            <span>{adminToken ? 'Auth Protected' : 'No Auth Token'}</span>
          </button>

          {/* Refresh Button */}
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors border border-slate-700"
            title="Refresh System Health"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-indigo-400' : ''}`} />
          </button>
        </div>
      </div>
    </header>
  );
};
