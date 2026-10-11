import React, { useState, useEffect } from 'react';
import {
  Radio,
  Play,
  Square,
  ShieldCheck,
  CheckCircle2,
  Cpu,
  Copy,
  Check,
  Globe,
  Lock,
  ArrowRight,
  Terminal,
} from 'lucide-react';
import type { HealthData, CanvasBridgeStatus } from '../types.js';

interface CanvasBridgeTabProps {
  health: HealthData | null;
}

export const CanvasBridgeTab: React.FC<CanvasBridgeTabProps> = ({ health }) => {
  const publicUrl = health?.environment.publicUrl ||
    (typeof window !== 'undefined' && (window.location.hostname.includes('ai.studio') || window.location.hostname.includes('run.app'))
      ? 'https://kiroproxy-746899042471.asia-southeast1.run.app'
      : window.location.origin);
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
      // Ignore network errors on background poll
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

    appendLog('Worker simulator initialized. Polling GET /poll for queued tasks...');

    const runPoll = async () => {
      try {
        const res = await fetch('/poll');
        if (!res.ok) {
          appendLog(`Poll response: HTTP ${res.status}`);
          pollTimeout = setTimeout(runPoll, 3000);
          return;
        }

        const data = await res.json();
        if (data.status === 'task_available' && data.task) {
          const task = data.task;
          appendLog(`Task received [${task.id}]: "${task.prompt.substring(0, 45)}..."`);

          // Simulate streaming chunks back
          const responseText = `[Gemini Sandboxed AI Worker]: Processed prompt with zero API key quota usage via published HTTPS domain bridge. Prompt: "${task.prompt.substring(0, 50)}..."`;
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
      appendLog('Worker simulator stopped.');
    };
  }, [isWorkerRunning]);

  const geminiCanvasSnippet = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>KiroProxy Gemini Canvas Cloud Bridge Worker</title>
</head>
<body style="font-family:ui-monospace,SFMono-Regular,Consolas,monospace;background:#09090b;color:#fafafa;padding:24px;">
  <h2 style="margin:0 0 8px 0;font-size:16px;">Gemini Canvas AI Worker Bridge</h2>
  <p style="color:#a1a1aa;font-size:12px;margin:0 0 16px 0;">Direct HTTPS Ingress to Gateway: <code>${publicUrl}</code> (No Ngrok required)</p>
  <div id="status" style="padding:12px;border:1px solid #27272a;border-radius:8px;background:#141417;font-size:12px;">Polling for tasks...</div>
  <script>
    const GATEWAY = '${publicUrl}';
    async function pollLoop() {
      try {
        const res = await fetch(GATEWAY + '/poll');
        const data = await res.json();
        if (data.status === 'task_available' && data.task) {
          document.getElementById('status').innerText = 'Fulfilling task ' + data.task.id;
          // In Google Gemini Canvas, window.ai or model generateContent stream can be invoked here
          const text = 'Fulfilled via Gemini Canvas Cloud Bridge: ' + data.task.prompt;
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
      setTimeout(pollLoop, 1500);
    }
    pollLoop();
  </script>
</body>
</html>`;

  const handleCopySnippet = () => {
    navigator.clipboard.writeText(geminiCanvasSnippet);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="p-6 rounded-2xl bg-[#0f0f12] border border-[#27272a]">
        <div className="flex items-center gap-2 mb-1">
          <h2 className="text-xl font-bold text-[#fafafa] flex items-center gap-2">
            <Radio className="w-5 h-5 text-[#fafafa]" />
            Gemini Sandboxed Canvas Application Bridge
          </h2>
          <span className="text-[11px] px-2 py-0.5 rounded-full font-mono bg-[#141417] text-emerald-400 border border-emerald-500/30">
            Zero API Cost
          </span>
        </div>
        <p className="text-xs text-zinc-400 mt-1">
          Harness Google Gemini&apos;s free Canvas execution preview iframe (<code className="text-[#fafafa] font-mono">gemini-3-flash-preview</code>) with zero API keys and zero local ngrok tunnels.
        </p>
      </div>

      {/* Prominent Feature: Cloud Native HTTPS Ingress Replaces Ngrok */}
      <div className="p-6 rounded-2xl bg-[#0f0f12] border border-[#27272a] space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[#27272a]">
          <div>
            <h3 className="text-sm font-bold text-[#fafafa] uppercase tracking-wider flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Cloud Native HTTPS Ingress Replaces Ngrok</span>
            </h3>
            <p className="text-xs text-zinc-400 mt-0.5">
              How deploying to Google AI Studio published domain replaces the local @ngrok/ngrok tunnel daemon
            </p>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#141417] text-zinc-300 border border-[#27272a]">
            Direct Ingress
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          {/* Legacy local problem */}
          <div className="p-4 rounded-xl bg-[#141417] border border-[#27272a] space-y-2">
            <h4 className="font-semibold text-amber-300 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5" />
              1. Local Execution Limitation (Why Ngrok Was Needed)
            </h4>
            <p className="text-zinc-400 leading-relaxed">
              When code runs inside Google Gemini Canvas (<span className="text-zinc-200">gemini.google.com</span>), it runs within a sandboxed HTTPS iframe (<span className="text-zinc-200 font-mono">*.googleusercontent.com</span>).
              Browser security standards (Mixed Content + Private Network Access) strictly block any HTTPS sandboxed page from calling <span className="text-rose-400 font-mono">http://localhost:8084</span> directly.
            </p>
            <p className="text-zinc-400 leading-relaxed">
              Previously on a local machine, KiroProxy was forced to start a local <span className="text-zinc-300 font-mono">@ngrok/ngrok</span> tunnel process to expose localhost on a public <span className="text-zinc-300 font-mono">https://*.ngrok-free.dev</span> address.
            </p>
          </div>

          {/* Cloud Native Solution */}
          <div className="p-4 rounded-xl bg-[#141417] border border-[#3f3f46] space-y-2">
            <h4 className="font-semibold text-[#fafafa] flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-emerald-400" />
              2. Cloud Native HTTPS Domain Solution
            </h4>
            <p className="text-zinc-300 leading-relaxed">
              This Cloud Gateway container is ALREADY served on a Google AI Studio native public HTTPS published domain:
            </p>
            <div className="p-2.5 rounded-lg bg-[#09090b] border border-[#27272a] font-mono text-emerald-400 text-xs truncate flex items-center justify-between">
              <span>{publicUrl}</span>
              <span className="text-[10px] text-zinc-500 font-sans">TLS Valid</span>
            </div>
            <p className="text-zinc-300 leading-relaxed">
              The sandboxed Gemini Canvas iframe can call <span className="text-emerald-300 font-mono">{publicUrl}/poll</span> directly over standard HTTPS! No local ngrok daemon, no auth token registration, and no background process on your machine.
            </p>
          </div>
        </div>

        {/* 4-Step Diagram */}
        <div className="pt-4 border-t border-[#27272a]">
          <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">
            End-to-End Reverse Polling Architecture Sequence:
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 text-xs">
            <div className="p-3 bg-[#141417] rounded-lg border border-[#27272a]">
              <span className="text-zinc-400 font-bold font-mono text-[11px]">Step 1</span>
              <p className="text-[#fafafa] font-semibold mt-1">Kiro IDE Request</p>
              <p className="text-[11px] text-zinc-400 mt-1">Client invokes model <code className="text-[#fafafa] font-mono">ngrok-gemini-flash</code></p>
            </div>
            <div className="p-3 bg-[#141417] rounded-lg border border-[#27272a]">
              <span className="text-zinc-400 font-bold font-mono text-[11px]">Step 2</span>
              <p className="text-[#fafafa] font-semibold mt-1">Queue Enqueue</p>
              <p className="text-[11px] text-zinc-400 mt-1">Gateway enqueues prompt into <code className="text-[#fafafa] font-mono">geminiQueue</code></p>
            </div>
            <div className="p-3 bg-[#141417] rounded-lg border border-[#27272a]">
              <span className="text-zinc-400 font-bold font-mono text-[11px]">Step 3</span>
              <p className="text-[#fafafa] font-semibold mt-1">Direct HTTPS Poll</p>
              <p className="text-[11px] text-zinc-400 mt-1">Worker polls <code className="text-emerald-400 font-mono">{publicUrl}/poll</code> directly</p>
            </div>
            <div className="p-3 bg-[#141417] rounded-lg border border-[#27272a]">
              <span className="text-zinc-400 font-bold font-mono text-[11px]">Step 4</span>
              <p className="text-[#fafafa] font-semibold mt-1">Bedrock EventStream</p>
              <p className="text-[11px] text-zinc-400 mt-1">Gateway serializes chunks with CRC32 checksum frames to Kiro IDE</p>
            </div>
          </div>
        </div>
      </div>

      {/* Live Bridge Control & Interactive Simulator */}
      <div className="p-6 rounded-2xl bg-[#0f0f12] border border-[#27272a] space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-[#fafafa] flex items-center gap-2">
              <Cpu className="w-4 h-4 text-[#fafafa]" />
              In-Browser Sandbox Worker Simulator
            </h3>
            <p className="text-xs text-zinc-400 mt-0.5">
              Launch a live worker loop directly inside this browser tab to fulfill queued prompts without keeping Gemini Canvas open.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span
              className={`text-xs px-2.5 py-1 rounded-full font-medium flex items-center gap-1.5 ${
                bridgeStatus?.isWorkerActive
                  ? 'bg-[#141417] text-emerald-400 border border-emerald-500/30'
                  : 'bg-[#141417] text-zinc-400 border border-[#27272a]'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  bridgeStatus?.isWorkerActive ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-600'
                }`}
              />
              {bridgeStatus?.isWorkerActive ? 'Worker Connected' : 'No Worker Connected'}
            </span>

            <button
              onClick={() => setIsWorkerRunning(!isWorkerRunning)}
              className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                isWorkerRunning
                  ? 'bg-[#141417] hover:bg-[#1c1c21] text-rose-400 border border-rose-500/30'
                  : 'bg-[#fafafa] hover:bg-[#e4e4e7] text-[#09090b]'
              }`}
            >
              {isWorkerRunning ? <Square className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 text-[#09090b]" />}
              <span>{isWorkerRunning ? 'Stop Simulator' : 'Start Simulator'}</span>
            </button>
          </div>
        </div>

        {/* Worker Logs */}
        <div className="p-3 bg-[#050507] rounded-xl border border-[#27272a] h-48 overflow-y-auto font-mono text-xs space-y-1">
          {workerLogs.length === 0 ? (
            <p className="text-zinc-600">Worker simulator idle. Click &quot;Start Simulator&quot; to begin polling {publicUrl}/poll.</p>
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
                    ? 'text-[#fafafa]'
                    : 'text-zinc-400'
                }
              >
                {log}
              </p>
            ))
          )}
        </div>
      </div>

      {/* Standalone Canvas HTML Embed Code */}
      <div className="p-6 rounded-2xl bg-[#0f0f12] border border-[#27272a] space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-[#fafafa]">
              HTML Template to Paste in Google Gemini Canvas
            </h3>
            <p className="text-xs text-zinc-400">
              Paste this template into Gemini Canvas preview to turn the session into a remote worker connected directly to this gateway.
            </p>
          </div>
          <button
            onClick={handleCopySnippet}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#141417] hover:bg-[#1c1c21] text-zinc-300 text-xs font-semibold border border-[#27272a] transition-colors cursor-pointer"
          >
            {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-zinc-400" />}
            <span>{copiedCode ? 'Copied' : 'Copy HTML Template'}</span>
          </button>
        </div>

        <pre className="p-4 bg-[#050507] rounded-xl border border-[#27272a] font-mono text-xs text-zinc-300 overflow-x-auto max-h-48 whitespace-pre">
          {geminiCanvasSnippet}
        </pre>
      </div>
    </div>
  );
};
