import React, { useState, useEffect } from 'react';
import {
  Layers,
  Radio,
  Play,
  Square,
  ShieldCheck,
  CheckCircle2,
  ExternalLink,
  Cpu,
  Copy,
  Check,
  Zap,
  Globe,
  Lock,
} from 'lucide-react';
import type { HealthData, CanvasBridgeStatus } from '../types.js';

interface CanvasBridgeTabProps {
  health: HealthData | null;
}

export const CanvasBridgeTab: React.FC<CanvasBridgeTabProps> = ({ health }) => {
  const publicUrl = health?.environment.publicUrl || window.location.origin;
  const [bridgeStatus, setBridgeStatus] = useState<CanvasBridgeStatus | null>(null);
  const [isWorkerRunning, setIsWorkerRunning] = useState(false);
  const [workerLogs, setWorkerLogs] = useState<string[]>([]);
  const [copiedCode, setCopiedCode] = useState(false);

  // Poll bridge status
  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/canvas/status');
      if (res.ok) {
        const data = await res.json();
        setBridgeStatus(data);
      }
    } catch {
      // Ignore
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 3000);
    return () => clearInterval(interval);
  }, []);

  // In-Browser Simulated Sandbox Worker loop
  useEffect(() => {
    if (!isWorkerRunning) return;

    let isMounted = true;
    let pollTimeout: any = null;

    const appendLog = (msg: string) => {
      if (!isMounted) return;
      setWorkerLogs((prev) => [
        `[${new Date().toLocaleTimeString()}] ${msg}`,
        ...prev.slice(0, 40),
      ]);
    };

    appendLog('Worker started. Polling GET /poll for prompts...');

    const runPoll = async () => {
      try {
        const res = await fetch('/poll');
        if (!res.ok) {
          appendLog(`Poll error: HTTP ${res.status}`);
          pollTimeout = setTimeout(runPoll, 3000);
          return;
        }

        const data = await res.json();
        if (data.status === 'task_available' && data.task) {
          const task = data.task;
          appendLog(`Task received [${task.id}]: "${task.prompt.substring(0, 40)}..."`);

          // Simulate streaming chunks back
          const responseText = `[Gemini Sandboxed AI Output]: Handled prompt successfully using zero-API-key session context. Completed prompt: "${task.prompt.substring(0, 50)}..."`;
          const words = responseText.split(' ');

          for (let i = 0; i < words.length; i++) {
            if (!isMounted || !isWorkerRunning) break;
            const chunk = words[i] + ' ';
            await fetch('/chunk', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                taskId: task.id,
                chunk,
                index: i,
              }),
            });
            await new Promise((r) => setTimeout(r, 60));
          }

          // Complete task
          await fetch('/done', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              taskId: task.id,
              fullText: responseText,
            }),
          });
          appendLog(`Task [${task.id}] fulfilled and streamed to Kiro IDE!`);
        }
      } catch (err: any) {
        appendLog(`Poll network error: ${err.message}`);
      }

      if (isMounted && isWorkerRunning) {
        pollTimeout = setTimeout(runPoll, 1500);
      }
    };

    runPoll();

    return () => {
      isMounted = false;
      if (pollTimeout) clearTimeout(pollTimeout);
      appendLog('Worker stopped.');
    };
  }, [isWorkerRunning]);

  const geminiCanvasSnippet = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>KiroProxy Gemini Canvas Sandboxed Worker</title>
</head>
<body style="font-family:sans-serif;background:#0f172a;color:#f8fafc;padding:24px;">
  <h2>Gemini Canvas AI Worker Bridge</h2>
  <p>Connected to Gateway: <code>${publicUrl}</code></p>
  <div id="status">Polling for tasks...</div>
  <script>
    const GATEWAY = '${publicUrl}';
    async function loop() {
      try {
        const res = await fetch(GATEWAY + '/poll', {
          headers: { 'ngrok-skip-browser-warning': '69420' }
        });
        const data = await res.json();
        if (data.status === 'task_available' && data.task) {
          document.getElementById('status').innerText = 'Processing ' + data.task.id;
          // In Google Gemini Canvas, window.ai or model generateContent stream can be invoked here
          const text = 'Completed via Gemini Canvas Sandboxed worker: ' + data.task.prompt;
          await fetch(GATEWAY + '/chunk', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ taskId: data.task.id, chunk: text, index: 0 })
          });
          await fetch(GATEWAY + '/done', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ taskId: data.task.id, fullText: text })
          });
        }
      } catch(e) {
        console.error(e);
      }
      setTimeout(loop, 1500);
    }
    loop();
  </script>
</body>
</html>`;

  const handleCopySnippet = () => {
    navigator.clipboard.writeText(geminiCanvasSnippet);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Radio className="w-5 h-5 text-indigo-400" />
          Gemini Sandboxed Canvas Application Bridge
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Zero-API-key AI generation via Google Gemini&apos;s Canvas preview iframe (<code className="text-slate-300 font-mono">gemini-3-flash-preview</code>).
        </p>
      </div>

      {/* Architectural Deep-Dive Explanation Card */}
      <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-900 via-indigo-950/20 to-slate-900 border border-slate-800 space-y-4">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          Why @ngrok/ngrok Was Needed Locally & How Cloud Run Solves It
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
            <h4 className="font-semibold text-amber-300 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5" />
              1. The Local Sandbox Isolation Problem
            </h4>
            <p className="text-slate-400 leading-relaxed">
              When code executes inside Google Gemini Canvas (at <span className="text-slate-200">https://gemini.google.com</span>),
              it runs inside a sandboxed HTTPS iframe (<span className="text-slate-200 font-mono">*.googleusercontent.com</span>).
              Browser security standards (Mixed Content + Private Network Access) strictly block an HTTPS sandboxed webpage
              from calling <span className="text-rose-400 font-mono">http://localhost:8084</span> directly.
            </p>
            <p className="text-slate-400 leading-relaxed">
              Hence, when running locally, KiroProxy started a local <span className="text-indigo-300 font-mono">@ngrok/ngrok</span> tunnel
              to assign localhost a public <span className="text-emerald-400 font-mono">https://*.ngrok-free.dev</span> address with CORS headers.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-indigo-950/40 border border-indigo-500/30 space-y-2">
            <h4 className="font-semibold text-emerald-300 flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5" />
              2. The AI Studio Published Domain Solution
            </h4>
            <p className="text-slate-300 leading-relaxed">
              On Google AI Studio, this container is ALREADY deployed with native public HTTPS ingress:
            </p>
            <div className="p-2 rounded bg-slate-950 border border-slate-800 font-mono text-emerald-400 text-[11px] truncate">
              {publicUrl}
            </div>
            <p className="text-slate-300 leading-relaxed">
              The sandboxed Gemini Canvas iframe can call <span className="text-emerald-300 font-mono">{publicUrl}/poll</span> directly
              over standard HTTPS! No local ngrok daemon, no authtoken, and no process on your PC required.
            </p>
          </div>
        </div>

        {/* 4-Step Diagram */}
        <div className="pt-4 border-t border-slate-800">
          <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
            End-to-End Reverse Polling Sequence:
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-xs">
            <div className="p-3 bg-slate-950/80 rounded-lg border border-slate-800">
              <span className="text-indigo-400 font-bold font-mono">Step 1</span>
              <p className="text-white font-semibold mt-1">Kiro IDE Request</p>
              <p className="text-[11px] text-slate-400 mt-1">Client requests model <code className="text-indigo-300 font-mono">ngrok-gemini-flash</code></p>
            </div>
            <div className="p-3 bg-slate-950/80 rounded-lg border border-slate-800">
              <span className="text-indigo-400 font-bold font-mono">Step 2</span>
              <p className="text-white font-semibold mt-1">Queue Enqueue</p>
              <p className="text-[11px] text-slate-400 mt-1">Gateway places prompt into <code className="text-indigo-300 font-mono">geminiQueue</code></p>
            </div>
            <div className="p-3 bg-slate-950/80 rounded-lg border border-slate-800">
              <span className="text-indigo-400 font-bold font-mono">Step 3</span>
              <p className="text-white font-semibold mt-1">Worker Polls & Streams</p>
              <p className="text-[11px] text-slate-400 mt-1">Canvas app polls <code className="text-emerald-400 font-mono">/poll</code>, executes AI, posts chunks to <code className="text-emerald-400 font-mono">/chunk</code></p>
            </div>
            <div className="p-3 bg-slate-950/80 rounded-lg border border-slate-800">
              <span className="text-indigo-400 font-bold font-mono">Step 4</span>
              <p className="text-white font-semibold mt-1">Bedrock EventStream</p>
              <p className="text-[11px] text-slate-400 mt-1">Gateway encodes chunks into AWS Bedrock frames with CRC32</p>
            </div>
          </div>
        </div>
      </div>

      {/* Live Bridge Control & Interactive Simulator */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Cpu className="w-4 h-4 text-indigo-400" />
              In-Browser Sandbox Worker Simulator
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Start a simulated worker in this browser tab to immediately fulfill incoming tasks without needing Gemini Canvas open.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span
              className={`text-xs px-2.5 py-1 rounded-full font-medium flex items-center gap-1.5 ${
                bridgeStatus?.isWorkerActive
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : 'bg-slate-800 text-slate-400'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  bridgeStatus?.isWorkerActive ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'
                }`}
              />
              {bridgeStatus?.isWorkerActive ? 'Active Worker Connected' : 'No Worker Connected'}
            </span>

            <button
              onClick={() => setIsWorkerRunning(!isWorkerRunning)}
              className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                isWorkerRunning
                  ? 'bg-rose-500 hover:bg-rose-600 text-white'
                  : 'bg-indigo-600 hover:bg-indigo-500 text-white'
              }`}
            >
              {isWorkerRunning ? <Square className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              <span>{isWorkerRunning ? 'Stop Simulator' : 'Start Simulator'}</span>
            </button>
          </div>
        </div>

        {/* Worker Logs */}
        <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 h-44 overflow-y-auto font-mono text-[11px] space-y-1">
          {workerLogs.length === 0 ? (
            <p className="text-slate-500">Worker simulator idle. Click &quot;Start Simulator&quot; to begin polling.</p>
          ) : (
            workerLogs.map((log, idx) => (
              <p
                key={idx}
                className={
                  log.includes('fulfilled')
                    ? 'text-emerald-400'
                    : log.includes('error')
                    ? 'text-rose-400'
                    : log.includes('Task received')
                    ? 'text-indigo-300'
                    : 'text-slate-400'
                }
              >
                {log}
              </p>
            ))
          )}
        </div>
      </div>

      {/* Standalone Canvas HTML Embed Code */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-white">
              HTML Template to Paste in Google Gemini Canvas
            </h3>
            <p className="text-xs text-slate-400">
              Paste this into Gemini Canvas to turn your Gemini session into an active remote worker.
            </p>
          </div>
          <button
            onClick={handleCopySnippet}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 text-xs font-semibold transition-colors"
          >
            {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedCode ? 'Copied' : 'Copy HTML'}</span>
          </button>
        </div>

        <pre className="p-4 bg-slate-950 rounded-xl border border-slate-800 font-mono text-xs text-slate-300 overflow-x-auto max-h-48">
          {geminiCanvasSnippet}
        </pre>
      </div>
    </div>
  );
};
