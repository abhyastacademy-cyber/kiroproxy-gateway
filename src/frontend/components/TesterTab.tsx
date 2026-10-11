import React, { useState } from 'react';
import {
  Play,
  RotateCcw,
  Zap,
  Activity,
  CheckCircle2,
  AlertCircle,
  Code,
  Server,
} from 'lucide-react';
import type { GatewayConfig } from '../types.js';

interface TesterTabProps {
  config: GatewayConfig | null;
  adminToken: string;
}

export const TesterTab: React.FC<TesterTabProps> = ({ config, adminToken }) => {
  const [prompt, setPrompt] = useState('Explain why cloud-native container reverse proxies are superior to local daemons in 3 concise bullet points.');
  const [model, setModel] = useState('global-automode');
  const [isLoading, setIsLoading] = useState(false);
  const [streamedText, setStreamedText] = useState('');
  const [chunksCount, setChunksCount] = useState(0);
  const [providerUsed, setProviderUsed] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [durationMs, setDurationMs] = useState<number | null>(null);

  const availableModels = [
    { id: 'global-automode', label: 'global-automode (Cross-Provider 6-Tier Waterfall)' },
    { id: 'auto', label: 'auto (Kiro IDE Auto Waterfall)' },
    { id: 'kilo-otomode', label: 'kilo-otomode (Zero-Key Kilo 177+ Free Models)' },
    { id: 'openrouter-otomode', label: 'openrouter-otomode (OpenRouter Free Rotation)' },
    { id: 'cline-otomode', label: 'cline-otomode (Cline Free Rotation)' },
    { id: 'orcarouter-otomode', label: 'orcarouter-otomode (OrcaRouter Free Rotation)' },
    { id: 'gemini-otomode', label: 'gemini-otomode (Gemini Multi-Model Rotation)' },
    { id: 'gemini-3.8-flash', label: 'Google Gemini 3.8 Flash' },
    { id: 'gemini-2.5-pro', label: 'Google Gemini 2.5 Pro' },
    { id: 'ngrok-gemini-flash', label: 'ngrok-gemini-flash (Gemini Canvas Bridge)' },
    ...(config?.customProviders.map((cp) => ({
      id: cp.activeModel || cp.id,
      label: `${cp.name} (${cp.activeModel || 'Custom'})`,
    })) || []),
  ];

  const handleTest = async () => {
    if (!prompt.trim() || isLoading) return;

    setIsLoading(true);
    setStreamedText('');
    setChunksCount(0);
    setProviderUsed(null);
    setErrorMsg(null);
    setDurationMs(null);

    const startTime = Date.now();

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (adminToken) {
        headers['Authorization'] = `Bearer ${adminToken}`;
      }

      const res = await fetch('/api/test/generate', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          prompt,
          model,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `HTTP ${res.status}`);
      }

      if (!res.body) {
        throw new Error('No response body returned');
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data: ')) continue;
          try {
            const data = JSON.parse(trimmed.slice(6));
            if (data.chunk) {
              setStreamedText((prev) => prev + data.chunk);
              setChunksCount((c) => c + 1);
            }
            if (data.done) {
              setProviderUsed(data.provider || 'default');
            }
            if (data.error) {
              setErrorMsg(data.error);
            }
          } catch {
            // Ignore parse errors
          }
        }
      }

      setDurationMs(Date.now() - startTime);
    } catch (err: any) {
      setErrorMsg(err.message || 'Stream test failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Zap className="w-5 h-5 text-indigo-400" />
          Gateway Playground & Live Stream Inspector
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Directly simulate Kiro IDE Bedrock requests through the gateway pipeline and monitor live chunk decoding.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Controls Column */}
        <div className="lg:col-span-1 p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">
            Test Parameters
          </h3>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Target Model / Tier</label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
            >
              {availableModels.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Prompt</label>
            <textarea
              rows={4}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
              placeholder="Enter prompt..."
            />
          </div>

          <button
            onClick={handleTest}
            disabled={isLoading || !prompt.trim()}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/20 transition-all disabled:opacity-50"
          >
            {isLoading ? <Activity className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            <span>{isLoading ? 'Streaming from Gateway...' : 'Send Test Request'}</span>
          </button>

          {/* Quick Metrics */}
          <div className="pt-4 border-t border-slate-800 space-y-2 text-xs">
            <div className="flex justify-between text-slate-400">
              <span>Chunks Received:</span>
              <span className="font-mono text-white">{chunksCount}</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Provider Handled:</span>
              <span className="font-mono text-indigo-300">{providerUsed || '—'}</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Total Latency:</span>
              <span className="font-mono text-emerald-400">{durationMs ? `${durationMs}ms` : '—'}</span>
            </div>
          </div>
        </div>

        {/* Output Column */}
        <div className="lg:col-span-2 p-6 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Code className="w-4 h-4 text-emerald-400" />
              Live Streamed Response
            </h3>
            {streamedText && (
              <span className="text-[11px] font-mono text-slate-400">
                {streamedText.length} characters
              </span>
            )}
          </div>

          <div className="flex-1 min-h-[260px] p-4 bg-slate-950 rounded-xl border border-slate-800 font-mono text-xs text-slate-200 overflow-y-auto whitespace-pre-wrap">
            {errorMsg ? (
              <div className="text-rose-400 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>Error: {errorMsg}</span>
              </div>
            ) : streamedText ? (
              streamedText
            ) : isLoading ? (
              <span className="text-slate-500 animate-pulse">Waiting for initial chunk...</span>
            ) : (
              <span className="text-slate-600">Click &quot;Send Test Request&quot; to test streaming output from the gateway.</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
