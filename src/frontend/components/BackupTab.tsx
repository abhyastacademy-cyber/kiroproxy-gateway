import React, { useState, useEffect } from 'react';
import { Cloud, Download, Copy, Check, Save, FileText, AlertCircle, RefreshCw } from 'lucide-react';
import type { GatewayConfig } from '../types.js';

interface BackupTabProps {
  config: GatewayConfig | null;
  adminToken: string;
  onSaveConfig: (updated: Partial<GatewayConfig>) => Promise<boolean>;
}

export const BackupTab: React.FC<BackupTabProps> = ({ config, adminToken, onSaveConfig }) => {
  const [jsonText, setJsonText] = useState('');
  const [envContent, setEnvContent] = useState('');
  const [isCopiedJson, setIsCopiedJson] = useState(false);
  const [isCopiedEnv, setIsCopiedEnv] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (config) {
      setJsonText(JSON.stringify(config, null, 2));
    }
  }, [config]);

  const fetchEnv = async () => {
    try {
      const headers: Record<string, string> = {};
      if (adminToken) headers['Authorization'] = `Bearer ${adminToken}`;
      const res = await fetch('/api/export-env', { headers });
      if (res.ok) {
        const data = await res.json();
        setEnvContent(data.envContent || '');
      }
    } catch (err) {
      console.warn('Failed to fetch env export:', err);
    }
  };

  useEffect(() => {
    fetchEnv();
  }, [adminToken]);

  const handleCopyJson = () => {
    navigator.clipboard.writeText(jsonText);
    setIsCopiedJson(true);
    setTimeout(() => setIsCopiedJson(false), 2000);
  };

  const handleCopyEnv = () => {
    navigator.clipboard.writeText(envContent);
    setIsCopiedEnv(true);
    setTimeout(() => setIsCopiedEnv(false), 2000);
  };

  const handleDownloadJson = () => {
    const blob = new Blob([jsonText], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kiro_ai_config_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleApplyJson = async () => {
    setParseError(null);
    try {
      const parsed = JSON.parse(jsonText);
      setIsSaving(true);
      const ok = await onSaveConfig(parsed);
      if (ok) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2000);
      } else {
        setParseError('Failed to apply configuration to backend.');
      }
    } catch (err: any) {
      setParseError(`JSON Syntax Error: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Configuration JSON Editor */}
      <section className="p-5 rounded-2xl bg-[#0f0f12] border border-[#27272a] space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Cloud className="w-5 h-5 text-blue-400" />
            <div>
              <h2 className="text-sm font-bold text-white">Active JSON Configuration</h2>
              <p className="text-xs text-zinc-400">
                Direct view and edit of the serialized config stored in <code className="text-zinc-300">/tmp/kiro_ai_config.json</code>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyJson}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#141417] hover:bg-[#27272a] border border-[#27272a] text-xs text-zinc-300 transition-colors"
            >
              {isCopiedJson ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{isCopiedJson ? 'Copied' : 'Copy JSON'}</span>
            </button>

            <button
              onClick={handleDownloadJson}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#141417] hover:bg-[#27272a] border border-[#27272a] text-xs text-zinc-300 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download</span>
            </button>

            <button
              onClick={handleApplyJson}
              disabled={isSaving}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-600/20 transition-all disabled:opacity-50"
            >
              {saveSuccess ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-300" />
                  <span>Saved!</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  <span>Apply Changes</span>
                </>
              )}
            </button>
          </div>
        </div>

        {parseError && (
          <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
            <span>{parseError}</span>
          </div>
        )}

        <textarea
          rows={16}
          value={jsonText}
          onChange={(e) => setJsonText(e.target.value)}
          className="w-full p-4 rounded-xl bg-[#09090b] border border-[#27272a] font-mono text-xs text-emerald-300 focus:outline-none focus:border-blue-500 selection:bg-emerald-950 selection:text-white"
        />
      </section>

      {/* 2. Environment Variables Export */}
      <section className="p-5 rounded-2xl bg-[#0f0f12] border border-[#27272a] space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <FileText className="w-5 h-5 text-amber-400" />
            <div>
              <h2 className="text-sm font-bold text-white">Generated .env Configuration</h2>
              <p className="text-xs text-zinc-400">
                Exported environment variables for deployment to Cloud Run or container runtimes
              </p>
            </div>
          </div>

          <button
            onClick={handleCopyEnv}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#141417] hover:bg-[#27272a] border border-[#27272a] text-xs text-zinc-300 transition-colors"
          >
            {isCopiedEnv ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{isCopiedEnv ? 'Copied' : 'Copy .env'}</span>
          </button>
        </div>

        <textarea
          rows={8}
          readOnly
          value={envContent}
          className="w-full p-4 rounded-xl bg-[#09090b] border border-[#27272a] font-mono text-xs text-amber-200/90 focus:outline-none"
        />
      </section>
    </div>
  );
};
