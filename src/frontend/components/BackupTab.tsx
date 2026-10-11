import React, { useState, useEffect } from 'react';
import {
  Download,
  Copy,
  Check,
  Upload,
  Save,
  Cloud,
  FileText,
  AlertCircle,
} from 'lucide-react';
import type { GatewayConfig } from '../types.js';

interface BackupTabProps {
  config: GatewayConfig | null;
  adminToken: string;
  onSaveConfig: (updated: Partial<GatewayConfig>) => Promise<boolean>;
}

export const BackupTab: React.FC<BackupTabProps> = ({
  config,
  adminToken,
  onSaveConfig,
}) => {
  const [envContent, setEnvContent] = useState('');
  const [copiedEnv, setCopiedEnv] = useState(false);
  const [copiedJson, setCopiedJson] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);

  useEffect(() => {
    fetchEnvExport();
  }, [config, adminToken]);

  const fetchEnvExport = async () => {
    try {
      const headers: Record<string, string> = {};
      if (adminToken) headers['Authorization'] = `Bearer ${adminToken}`;
      const res = await fetch('/api/export-env', { headers });
      if (res.ok) {
        const data = await res.json();
        setEnvContent(data.envContent);
      }
    } catch {
      // Fallback local generator
      if (config) {
        setEnvContent([
          `HOST="0.0.0.0"`,
          `PORT="${config.port}"`,
          `PUBLIC_DOMAIN_URL="${config.publicDomainUrl}"`,
          `PROXY_ADMIN_TOKEN="${config.adminToken}"`,
          `PROVIDER_PRIORITY_ORDER="${config.providerPriorityOrder.join(',')}"`,
          `CUSTOM_PROVIDERS_JSON='${JSON.stringify(config.customProviders)}'`,
        ].join('\n'));
      }
    }
  };

  const handleCopyEnv = () => {
    navigator.clipboard.writeText(envContent);
    setCopiedEnv(true);
    setTimeout(() => setCopiedEnv(false), 2000);
  };

  const handleCopyJson = () => {
    if (!config) return;
    navigator.clipboard.writeText(JSON.stringify(config, null, 2));
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 2000);
  };

  const handleDownloadJson = () => {
    if (!config) return;
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'kiro_ai_config.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        const success = await onSaveConfig(parsed);
        if (success) {
          setImportStatus('Configuration imported successfully!');
        } else {
          setImportStatus('Import failed. Please verify server connectivity.');
        }
      } catch (err: any) {
        setImportStatus(`Invalid JSON file: ${err.message}`);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Cloud className="w-5 h-5 text-indigo-400" />
          Stateless Cloud Backup & Environment Synchronization
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Cloud containers (Google Cloud Run / AI Studio) have ephemeral disks on cold restarts.
          Export your exact environment variables or save to <code className="text-slate-300 font-mono">kiro_ai_config.json</code>.
        </p>
      </div>

      {/* Cloud Deploy Env Variables Card */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <FileText className="w-4 h-4 text-indigo-400" />
              Environment Variables for Cloud Deployment
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Copy and paste directly into Google Cloud Run / AI Studio deployment settings or your production .env file.
            </p>
          </div>
          <button
            onClick={handleCopyEnv}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/20 transition-colors self-start sm:self-auto"
          >
            {copiedEnv ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedEnv ? 'Copied to Clipboard' : 'Copy Env Variables for Cloud Deploy'}</span>
          </button>
        </div>

        <pre className="p-4 bg-slate-950 rounded-xl border border-slate-800 font-mono text-xs text-emerald-400 overflow-x-auto whitespace-pre">
          {envContent || '# Loading environment configuration...'}
        </pre>
      </div>

      {/* JSON File Backup & Restore */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Export JSON */}
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Download className="w-4 h-4 text-indigo-400" />
            Download kiro_ai_config.json
          </h3>
          <p className="text-xs text-slate-400">
            Export complete configuration JSON file including all custom provider endpoints and model mappings.
          </p>
          <div className="pt-2 flex items-center gap-2">
            <button
              onClick={handleDownloadJson}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium border border-slate-700 transition-colors flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download Config</span>
            </button>
            <button
              onClick={handleCopyJson}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 transition-colors flex items-center gap-1.5"
            >
              {copiedJson ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedJson ? 'Copied' : 'Copy JSON'}</span>
            </button>
          </div>
        </div>

        {/* Import JSON */}
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Upload className="w-4 h-4 text-purple-400" />
            Restore kiro_ai_config.json
          </h3>
          <p className="text-xs text-slate-400">
            Upload an existing configuration file to instantly restore all tiers and providers.
          </p>
          <div className="pt-2">
            <label className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium border border-slate-700 cursor-pointer transition-colors">
              <Upload className="w-3.5 h-3.5" />
              <span>Select File to Restore</span>
              <input
                type="file"
                accept=".json"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
          </div>
          {importStatus && (
            <p className="text-xs text-emerald-400 pt-1 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>{importStatus}</span>
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
