import React, { useState } from 'react';
import { Lock, Key, Shield, Check, X } from 'lucide-react';

interface SecurityModalProps {
  isOpen: boolean;
  onClose: () => void;
  adminToken: string;
  onSaveToken: (token: string) => void;
}

export const SecurityModal: React.FC<SecurityModalProps> = ({
  isOpen,
  onClose,
  adminToken,
  onSaveToken,
}) => {
  const [tokenInput, setTokenInput] = useState(adminToken);

  if (!isOpen) return null;

  const handleSave = () => {
    onSaveToken(tokenInput.trim());
    onClose();
  };

  const handleClear = () => {
    setTokenInput('');
    onSaveToken('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center justify-center">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Gateway Security Guard</h3>
            <p className="text-xs text-slate-400">PROXY_ADMIN_TOKEN Authorization</p>
          </div>
        </div>

        <p className="text-xs text-slate-300 leading-relaxed">
          When this gateway is hosted on a public domain, protect administrative endpoints (<code className="text-slate-200 font-mono">/api/config</code>) and upstream requests by specifying an authorization token.
        </p>

        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">
            Admin Auth Token (Stored in browser localStorage)
          </label>
          <div className="relative">
            <input
              type="text"
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              placeholder="e.g. secret_admin_token_123"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-indigo-500 pr-10"
            />
            <Key className="w-4 h-4 text-slate-500 absolute right-3 top-2.5 pointer-events-none" />
          </div>
        </div>

        <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-[11px] text-slate-400 space-y-1">
          <p className="font-semibold text-slate-300">How clients authenticate with this token:</p>
          <p>• Kiro IDE: Routed automatically via <code className="text-indigo-400 font-mono">/k/&lt;token&gt;/generateAssistantResponse</code></p>
          <p>• API Clients: Provide header <code className="text-indigo-400 font-mono">Authorization: Bearer &lt;token&gt;</code></p>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          {adminToken && (
            <button
              onClick={handleClear}
              className="px-3 py-1.5 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 text-xs font-medium transition-colors"
            >
              Clear Token
            </button>
          )}
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/20 transition-colors flex items-center gap-1.5"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Save Token</span>
          </button>
        </div>
      </div>
    </div>
  );
};
