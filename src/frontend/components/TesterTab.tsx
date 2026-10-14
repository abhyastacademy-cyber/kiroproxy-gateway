import React, { useState } from 'react';
import {
  Play,
  RotateCcw,
  Zap,
  Activity,
  AlertCircle,
  Code,
} from 'lucide-react';
import type { GatewayConfig } from '../types.js';

interface TesterTabProps {
  config: GatewayConfig | null;
  adminToken: string;
  initialModel?: string;
}

export const TesterTab: React.FC<TesterTabProps> = ({ config, adminToken, initialModel }) => {
  const [prompt, setPrompt] = useState('Explain why cloud-native container reverse proxies are superior to local daemons in 3 concise bullet points.');
  const [model, setModel] = useState(initialModel || 'global-automode');
  const [isLoading, setIsLoading] = useState(false);
  const [streamedText, setStreamedText] = useState('');
  const [chunksCount, setChunksCount] = useState(0);
  const [providerUsed, setProviderUsed] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [durationMs, setDurationMs] = useState<number | null>(null);
  const [loadedModels, setLoadedModels] = useState<{ id: string; label: string }[]>([]);

  React.useEffect(() => {
    if (initialModel) {
      setModel(initialModel);
    }
  }, [initialModel]);

  React.useEffect(() => {
    fetch('/v1/models')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data.data)) {
          setLoadedModels(
            data.data.map((m: any) => ({
              id: m.id,
              label: m.name ? `${m.id} (${m.name})` : m.id,
            }))
          );
        }
      })
      .catch(() => {});
  }, []);

  const fallbackModels = [
    { id: 'global-automode', label: 'global-automode (Cross-Provider 7-Tier Cascade)' },
    { id: 'auto', label: 'auto (Kiro IDE Auto Waterfall)' },
    { id: 'deepseek/deepseek-r1:free', label: 'deepseek/deepseek-r1:free (DeepSeek R1 Full Reasoning)' },
    { id: 'deepseek/deepseek-chat:free', label: 'deepseek/deepseek-chat:free (DeepSeek V3 671B MoE)' },
    { id: 'meta-llama/llama-3.3-70b-instruct:free', label: 'meta-llama/llama-3.3-70b-instruct:free (Llama 3.3 70B)' },
    { id: 'qwen/qwen-2.5-72b-instruct:free', label: 'qwen/qwen-2.5-72b-instruct:free (Qwen 2.5 72B)' },
    { id: 'qwen/qwen-2.5-coder-32b-instruct:free', label: 'qwen/qwen-2.5-coder-32b-instruct:free (Qwen Coder 32B)' },
    { id: 'kilo-auto/free', label: 'kilo-auto/free (Zero-Key Kilo Verified Gateway)' },
    { id: 'kilo-otomode', label: 'kilo-otomode (Kilo 177+ Free Models Rotation)' },
    { id: 'openrouter/auto', label: 'openrouter/auto (OpenRouter Zero-Cost Router)' },
    { id: 'openrouter-otomode', label: 'openrouter-otomode (OpenRouter Multi-Model Rotation)' },
    { id: 'cline-otomode', label: 'cline-otomode (Cline Autonomous Coding Pool)' },
    { id: 'orcarouter-otomode', label: 'orcarouter-otomode (OrcaRouter Free Inference Gateway)' },
    { id: 'gemini-otomode', label: 'gemini-otomode (Gemini Direct Key Rotation)' },
    { id: 'gemini-flash-latest', label: 'Google Gemini Flash Latest' },
    { id: 'gemini-3.8-flash', label: 'Google Gemini 3.8 Flash' },
    { id: 'gemini-4-argon', label: 'Google Gemini 4 Argon (Reasoning)' },
    { id: 'gemini-2.5-flash', label: 'Google Gemini 2.5 Flash' },
    { id: 'gemini-2.5-pro', label: 'Google Gemini 2.5 Pro' },
    { id: 'canvas-gemini-flash', label: 'canvas-gemini-flash (Gemini Canvas Cloud Bridge)' },
    ...(config?.customProviders.map((cp) => ({
      id: cp.activeModel || cp.id,
      label: `${cp.name} (${cp.activeModel || 'Custom Endpoint'})`,
    })) || []),
  ];

  const availableModels = loadedModels.length > 0 ? loadedModels : fallbackModels;

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
        throw new Error('No response body returned from stream');
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
            // Ignore parse errors on SSE delimiters
          }
        }
      }

      setDurationMs(Date.now() - startTime);
    } catch (err: any) {
      setErrorMsg(err.message || 'Stream test request failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="p-6 rounded-2xl bg-[#0f0f12] border border-[#27272a]">
        <h2 className="text-xl font-bold text-[#fafafa] flex items-center gap-2">
          <Zap className="w-5 h-5 text-[#fafafa]" />
          Gateway Playground &amp; Live Stream Inspector
        </h2>
        <p className="text-xs text-zinc-400 mt-1">
          Test Kiro IDE Bedrock requests through the gateway pipeline and monitor live chunk decoding across all 7 tiers.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Controls Column */}
        <div className="lg:col-span-1 p-6 rounded-2xl bg-[#0f0f12] border border-[#27272a] space-y-4">
          <h3 className="text-sm font-bold text-[#fafafa] uppercase tracking-wider">
            Test Parameters
          </h3>

          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">Target Model / Tier</label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full bg-[#09090b] border border-[#27272a] rounded-lg px-3 py-2 text-xs text-[#fafafa] focus:outline-none focus:border-[#fafafa]"
            >
              {availableModels.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">Prompt</label>
            <textarea
              rows={4}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="w-full bg-[#09090b] border border-[#27272a] rounded-lg px-3 py-2 text-xs text-[#fafafa] focus:outline-none focus:border-[#fafafa]"
              placeholder="Enter prompt..."
            />
            <div className="flex gap-2 flex-wrap mt-2">
              <button
                type="button"
                onClick={() => setPrompt('Respond with: OK')}
                className="px-2.5 py-1 rounded-md bg-[#141417] hover:bg-[#1c1c21] text-zinc-300 border border-[#27272a] text-[11px] cursor-pointer"
              >
                Ping &quot;OK&quot;
              </button>
              <button
                type="button"
                onClick={() => setPrompt('Write a 5-line JavaScript function to compute CRC32.')}
                className="px-2.5 py-1 rounded-md bg-[#141417] hover:bg-[#1c1c21] text-zinc-300 border border-[#27272a] text-[11px] cursor-pointer"
              >
                Code Gen (CRC32)
              </button>
              <button
                type="button"
                onClick={() => setPrompt('Explain the Strangler Fig pattern in 2 bullet points.')}
                className="px-2.5 py-1 rounded-md bg-[#141417] hover:bg-[#1c1c21] text-zinc-300 border border-[#27272a] text-[11px] cursor-pointer"
              >
                Architecture Prompt
              </button>
            </div>
          </div>

          <button
            onClick={handleTest}
            disabled={isLoading || !prompt.trim()}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#fafafa] hover:bg-[#e4e4e7] text-[#09090b] text-xs font-semibold shadow-sm transition-all disabled:opacity-50 cursor-pointer"
          >
            {isLoading ? <Activity className="w-4 h-4 animate-spin text-[#09090b]" /> : <Play className="w-4 h-4 text-[#09090b]" />}
            <span>{isLoading ? 'Streaming from Gateway...' : 'Send Test Request'}</span>
          </button>

          {/* Quick Metrics */}
          <div className="pt-4 border-t border-[#27272a] space-y-2 text-xs">
            <div className="flex justify-between text-zinc-400">
              <span>Chunks Received:</span>
              <span className="font-mono text-[#fafafa]">{chunksCount}</span>
            </div>
            <div className="flex justify-between text-zinc-400">
              <span>Provider Handled:</span>
              <span className="font-mono text-[#fafafa]">{providerUsed || '—'}</span>
            </div>
            <div className="flex justify-between text-zinc-400">
              <span>Total Latency:</span>
              <span className="font-mono text-emerald-400">{durationMs ? `${durationMs}ms` : '—'}</span>
            </div>
          </div>
        </div>

        {/* Output Column */}
        <div className="lg:col-span-2 p-6 rounded-2xl bg-[#0f0f12] border border-[#27272a] flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#27272a]">
            <h3 className="text-sm font-bold text-[#fafafa] flex items-center gap-2">
              <Code className="w-4 h-4 text-emerald-400" />
              Live Streamed Response
            </h3>
            {streamedText && (
              <span className="text-[11px] font-mono text-zinc-400">
                {streamedText.length} characters
              </span>
            )}
          </div>

          <div className="flex-1 min-h-[280px] p-4 bg-[#050507] rounded-xl border border-[#27272a] font-mono text-xs text-zinc-200 overflow-y-auto whitespace-pre-wrap">
            {errorMsg ? (
              <div className="text-rose-400 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>Error: {errorMsg}</span>
              </div>
            ) : streamedText ? (
              streamedText
            ) : isLoading ? (
              <span className="text-zinc-500 animate-pulse">Waiting for initial chunk from upstream tier...</span>
            ) : (
              <span className="text-zinc-600">Click &quot;Send Test Request&quot; to test streaming output from the gateway.</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
