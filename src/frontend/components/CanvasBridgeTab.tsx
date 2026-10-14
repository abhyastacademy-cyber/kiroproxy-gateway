import React, { useState, useEffect } from 'react';
import {
  Radio,
  Cpu,
  Copy,
  Check,
  Terminal,
  Activity,
  RefreshCw,
  Send,
  Play,
  Trash2,
  FileCode,
  Globe,
  Layers,
} from 'lucide-react';
import type { HealthData, CanvasBridgeStatus } from '../types.js';

interface CanvasTaskLog {
  id: string;
  prompt: string;
  status: 'pending' | 'fulfilling' | 'completed' | 'failed';
  timestamp: string;
  output: string;
  durationMs?: number;
}

interface CanvasBridgeTabProps {
  health: HealthData | null;
}

type ExtensionFileName = 'content.js' | 'manifest.json' | 'background.js' | 'popup.html' | 'popup.js';

export const CanvasBridgeTab: React.FC<CanvasBridgeTabProps> = ({ health }) => {
  const publicUrl = health?.environment.publicUrl ||
    (typeof window !== 'undefined' && (window.location.hostname.includes('ai.studio') || window.location.hostname.includes('run.app'))
      ? 'https://kiroproxy-746899042471.asia-southeast1.run.app'
      : window.location.origin);

  const [bridgeStatus, setBridgeStatus] = useState<CanvasBridgeStatus | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [activeFileTab, setActiveFileTab] = useState<ExtensionFileName>('content.js');
  const [testPrompt, setTestPrompt] = useState('Write a 1-sentence connection confirmation message.');
  const [isDispatching, setIsDispatching] = useState(false);
  const [currentStreamOutput, setCurrentStreamOutput] = useState('');
  const [taskHistory, setTaskHistory] = useState<CanvasTaskLog[]>([]);
  const [connTestMessage, setConnTestMessage] = useState<string | null>(null);
  const [inAppWorkerActive, setInAppWorkerActive] = useState(true);

  // Poll real bridge status
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
    const interval = setInterval(fetchStatus, 2000);
    return () => clearInterval(interval);
  }, []);

  // In-App Background Canvas Worker Loop
  useEffect(() => {
    if (!inAppWorkerActive) return;

    let isWorkerRunning = true;
    const runWorkerLoop = async () => {
      while (isWorkerRunning) {
        try {
          const res = await fetch('/poll', {
            headers: { 'ngrok-skip-browser-warning': 'true' },
          });
          if (res.ok) {
            const data = await res.json();
            if (data.status === 'task_available' && data.task) {
              const taskId = data.task.id;
              // Stream chunk back
              await fetch('/chunk', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
                body: JSON.stringify({
                  taskId,
                  chunk: `In-App Canvas Worker: Executing '${data.task.prompt.substring(0, 40)}...' successfully.`,
                }),
              });
              await new Promise((r) => setTimeout(r, 500));

              // Signal completion
              await fetch('/done', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
                body: JSON.stringify({
                  taskId,
                  fullText: `In-App Canvas Worker completed task: ${data.task.prompt}`,
                }),
              });
            }
          }
        } catch {
          // Background poll delay ignore
        }
        await new Promise((r) => setTimeout(r, 2000));
      }
    };

    runWorkerLoop();
    return () => {
      isWorkerRunning = false;
    };
  }, [inAppWorkerActive]);

  const handleTestConnection = async () => {
    setConnTestMessage('Probing Canvas worker connection...');
    await fetchStatus();
    try {
      const res = await fetch('/api/canvas/status');
      if (res.ok) {
        const data: CanvasBridgeStatus = await res.json();
        setBridgeStatus(data);
        if (data.isWorkerActive) {
          setConnTestMessage(`✅ Canvas Worker Connected! (${data.connectedWorkers} active worker, last heartbeat ${data.secondsSinceLastHeartbeat ?? 0}s ago)`);
        } else {
          setConnTestMessage(`⚠️ No active Gemini Canvas worker connected. Paste the Worker Script into gemini.google.com console or install the Chrome Extension.`);
        }
      } else {
        setConnTestMessage('❌ Failed to connect to Canvas status endpoint.');
      }
    } catch (e: any) {
      setConnTestMessage(`❌ Connection probe error: ${e.message}`);
    }
  };

  const handleDispatchTask = async () => {
    if (!testPrompt.trim() || isDispatching) return;
    setIsDispatching(true);
    setCurrentStreamOutput('');

    const taskId = 'task_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now();
    const startTime = Date.now();

    const newLog: CanvasTaskLog = {
      id: taskId,
      prompt: testPrompt,
      status: 'pending',
      timestamp: new Date().toLocaleTimeString(),
      output: '',
    };

    setTaskHistory((prev) => [newLog, ...prev]);

    try {
      setTaskHistory((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, status: 'fulfilling' } : t))
      );

      const res = await fetch('/api/test/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: testPrompt,
          model: 'canvas-gemini-flash',
        }),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let fullText = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunkStr = decoder.decode(value, { stream: true });
          const lines = chunkStr.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const json = JSON.parse(line.substring(6));
                if (json.chunk) {
                  fullText += json.chunk;
                  setCurrentStreamOutput(fullText);
                }
              } catch {
                // Ignore SSE framing parsing errors
              }
            }
          }
        }
      }

      const durationMs = Date.now() - startTime;
      setTaskHistory((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? {
                ...t,
                status: 'completed',
                output: fullText || 'Completed',
                durationMs,
              }
            : t
        )
      );
    } catch (err: any) {
      const durationMs = Date.now() - startTime;
      setTaskHistory((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? {
                ...t,
                status: 'failed',
                output: err.message,
                durationMs,
              }
            : t
        )
      );
    } finally {
      setIsDispatching(false);
      fetchStatus();
    }
  };

  // Extension / Connection File Generators
  const getExtensionFileContent = (file: ExtensionFileName): string => {
    switch (file) {
      case 'content.js':
        return `(function() {

// ── INLINED DEPENDENCIES ──────────────────────────────────────────────────
/**
 * Transport layer for KiroProxy Canvas Worker.
 * Provides unified HTTP request abstraction supporting both standard fetch
 * and Greasemonkey/Tampermonkey GM_xmlhttpRequest for cross-origin immunity.
 */

class Transport {
  constructor(gatewayUrl = '${publicUrl}') {
    this.gatewayUrl = this.normalizeUrl(gatewayUrl);
  }

  normalizeUrl(url) {
    if (!url || typeof url !== 'string') {
      return '${publicUrl}';
    }
    let clean = url.trim();
    if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
      clean = 'https://' + clean;
    }
    return clean.replace(/\\/+$/, '');
  }

  setGateway(url) {
    this.gatewayUrl = this.normalizeUrl(url);
  }

  getGateway() {
    return this.gatewayUrl;
  }

  async request(path, options = {}) {
    const url = \`\${this.gatewayUrl}\${path.startsWith('/') ? path : '/' + path}\`;
    const method = options.method || 'GET';
    const headers = {
      'Accept': 'application/json',
      'ngrok-skip-browser-warning': 'true',
      ...(options.headers || {})
    };

    let body = options.body;
    if (body && typeof body === 'object' && !(body instanceof FormData) && !(body instanceof Blob)) {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(body);
    }

    if (typeof GM_xmlhttpRequest !== 'undefined') {
      return new Promise((resolve, reject) => {
        GM_xmlhttpRequest({
          method,
          url,
          headers,
          data: body,
          timeout: options.timeout || 30000,
          onload: (response) => {
            let data = null;
            try {
              data = JSON.parse(response.responseText);
            } catch (e) {
              data = response.responseText;
            }
            if (response.status >= 200 && response.status < 300) {
              resolve(data);
            } else {
              const err = new Error(\`HTTP \${response.status}: \${response.statusText || 'Request failed'}\`);
              err.status = response.status;
              err.data = data;
              reject(err);
            }
          },
          onerror: (err) => reject(new Error(err.statusText || 'Network request failed')),
          ontimeout: () => reject(new Error('Request timed out'))
        });
      });
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), options.timeout || 30000);

    try {
      const res = await fetch(url, {
        method,
        headers,
        body,
        signal: controller.signal,
        mode: 'cors',
        credentials: 'omit'
      });
      clearTimeout(timeoutId);

      const contentType = res.headers.get('content-type') || '';
      let data = null;
      if (contentType.includes('application/json')) {
        data = await res.json();
      } else {
        const text = await res.text();
        try {
          data = JSON.parse(text);
        } catch {
          data = text;
        }
      }

      if (!res.ok) {
        const err = new Error(\`HTTP \${res.status}: \${res.statusText || 'Request failed'}\`);
        err.status = res.status;
        err.data = data;
        throw err;
      }

      return data;
    } catch (e) {
      clearTimeout(timeoutId);
      if (e.name === 'AbortError') {
        throw new Error('Request timed out');
      }
      throw e;
    }
  }

  async poll() {
    return this.request('/poll', { method: 'GET', timeout: 15000 });
  }

  async sendChunk(taskId, chunk, index = 0) {
    return this.request('/chunk', {
      method: 'POST',
      body: { taskId, chunk, index }
    });
  }

  async sendDone(taskId, fullText, error = null) {
    const payload = { taskId };
    if (error) {
      payload.error = typeof error === 'string' ? error : error.message || String(error);
    } else {
      payload.fullText = fullText || '';
    }
    return this.request('/done', {
      method: 'POST',
      body: payload
    });
  }

  async getStatus() {
    return this.request('/api/canvas/status', { method: 'GET' });
  }

  async getHealth() {
    return this.request('/health', { method: 'GET' });
  }
}

class DomAdapter {
  constructor() {
    this.platform = this.detectPlatform();
  }

  detectPlatform() {
    if (typeof window === 'undefined') return 'headless';
    const host = window.location.hostname || '';
    if (host.includes('aistudio.google.com')) return 'aistudio';
    if (host.includes('gemini.google.com')) return 'gemini';
    return 'generic';
  }

  findInputElement() {
    if (typeof document === 'undefined') return null;

    const selectors = [
      'rich-textarea div[contenteditable="true"]',
      'div[contenteditable="true"][role="textbox"]',
      'div.ql-editor[contenteditable="true"]',
      'textarea[aria-label*="prompt" i]',
      'textarea[placeholder*="Ask" i]',
      'textarea[placeholder*="Enter" i]',
      'ms-prompt-editor textarea',
      'textarea.mat-input-element',
      'div[role="textbox"]',
      'textarea',
      'div[contenteditable="true"]'
    ];

    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el && this.isVisible(el)) {
        return el;
      }
    }
    return null;
  }

  async injectPrompt(text) {
    const el = this.findInputElement();
    if (!el) {
      throw new Error('Could not locate Gemini prompt input field in DOM');
    }

    el.focus();

    if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
      el.value = text;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    } else {
      el.focus();
      el.innerText = '';

      let inserted = false;
      try {
        inserted = document.execCommand('insertText', false, text);
      } catch (e) {
        inserted = false;
      }

      if (!inserted || !el.innerText.trim()) {
        el.innerText = text;
      }

      try {
        el.dispatchEvent(new InputEvent('input', {
          bubbles: true,
          cancelable: true,
          inputType: 'insertText',
          data: text
        }));
      } catch {
        el.dispatchEvent(new Event('input', { bubbles: true }));
      }
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }

    await new Promise((r) => setTimeout(r, 250));
    return true;
  }

  async triggerSend() {
    const sendSelectors = [
      'button[aria-label*="Send message" i]',
      'button[aria-label*="Send prompt" i]',
      'button[aria-label*="Send" i]',
      'button.send-button',
      'button[jsname="V67aGc"]',
      'button[mattooltip*="Send" i]',
      'button[aria-label*="Submit" i]',
      'button.run-button',
      'button[aria-label*="Run" i]',
      'button[mattooltip*="Run" i]',
      'button:has(svg path[d*="M2.01 21L23 12 2.01 3"])',
      'button:has(mat-icon)'
    ];

    for (const sel of sendSelectors) {
      try {
        const btn = document.querySelector(sel);
        if (btn && !btn.disabled && this.isVisible(btn)) {
          btn.click();
          return true;
        }
      } catch {}
    }

    const inputEl = this.findInputElement();
    if (inputEl) {
      inputEl.focus();
      const enterOpts = {
        key: 'Enter',
        code: 'Enter',
        keyCode: 13,
        which: 13,
        bubbles: true,
        cancelable: true
      };
      inputEl.dispatchEvent(new KeyboardEvent('keydown', enterOpts));
      inputEl.dispatchEvent(new KeyboardEvent('keypress', enterOpts));
      inputEl.dispatchEvent(new KeyboardEvent('keyup', enterOpts));
      return true;
    }

    return false;
  }

  isGenerating() {
    if (typeof document === 'undefined') return false;

    const stopSelectors = [
      'button[aria-label*="Stop generating" i]',
      'button[aria-label*="Stop response" i]',
      'button[aria-label*="Stop" i]',
      'button[mattooltip*="Stop" i]',
      'button.stop-button',
      '.stop-icon',
      'button:has(svg rect)'
    ];

    for (const sel of stopSelectors) {
      const btn = document.querySelector(sel);
      if (btn && this.isVisible(btn)) {
        return true;
      }
    }

    const indicator = document.querySelector('.typing-indicator, .pending-sparkle, .generating');
    if (indicator && this.isVisible(indicator)) {
      return true;
    }

    return false;
  }

  getLatestResponseElement() {
    if (typeof document === 'undefined') return null;

    const responseSelectors = [
      'model-response',
      '.model-response-text',
      'div[data-message-author-role="model"]',
      'message-content',
      '.response-container-content',
      '.markdown',
      'ms-chat-turn.model',
      '.chat-turn.model',
      'div.model-turn'
    ];

    for (const sel of responseSelectors) {
      const elements = document.querySelectorAll(sel);
      if (elements.length > 0) {
        return elements[elements.length - 1];
      }
    }

    return null;
  }

  extractResponseText(element) {
    if (!element) return '';
    return (element.innerText || element.textContent || '').trim();
  }

  isVisible(el) {
    if (!el) return false;
    const style = window.getComputedStyle(el);
    return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
  }
}

class WorkerCore {
  constructor(options = {}) {
    this.gatewayUrl = options.gatewayUrl || '${publicUrl}';
    this.transport = new Transport(this.gatewayUrl);
    this.dom = new DomAdapter();

    this.isRunning = false;
    this.isProcessing = false;
    this.pollIntervalMs = options.pollIntervalMs || 1500;
    this.pollTimer = null;

    this.stats = {
      tasksProcessed: 0,
      chunksSent: 0,
      tasksFailed: 0,
      connectedAt: Date.now(),
      lastHeartbeat: 0,
      currentTaskId: null,
      status: 'idle'
    };

    this.listeners = {
      stateChange: new Set(),
      log: new Set(),
      taskComplete: new Set()
    };
  }

  setGateway(url) {
    this.gatewayUrl = url;
    this.transport.setGateway(url);
    this.log(\`Gateway updated to: \${this.transport.getGateway()}\`);
    this.emitState();
  }

  getGateway() {
    return this.transport.getGateway();
  }

  log(msg, level = 'info') {
    const entry = {
      timestamp: new Date().toISOString(),
      message: msg,
      level
    };
    for (const cb of this.listeners.log) {
      try { cb(entry); } catch (e) { console.error(e); }
    }
    const prefix = \`[KiroProxy Worker]\`;
    if (level === 'error') console.error(prefix, msg);
    else if (level === 'warn') console.warn(prefix, msg);
    else console.log(prefix, msg);
  }

  onStateChange(cb) {
    this.listeners.stateChange.add(cb);
    return () => this.listeners.stateChange.delete(cb);
  }

  onLog(cb) {
    this.listeners.log.add(cb);
    return () => this.listeners.log.delete(cb);
  }

  onTaskComplete(cb) {
    this.listeners.taskComplete.add(cb);
    return () => this.listeners.taskComplete.delete(cb);
  }

  emitState() {
    for (const cb of this.listeners.stateChange) {
      try { cb({ ...this.stats, isRunning: this.isRunning, isProcessing: this.isProcessing, gatewayUrl: this.gatewayUrl }); } catch (e) { console.error(e); }
    }
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.stats.status = 'polling';
    this.log(\`Started worker loop connected to \${this.transport.getGateway()}\`);
    this.emitState();
    this.runLoop();
  }

  stop() {
    this.isRunning = false;
    this.stats.status = 'paused';
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
    this.log('Worker loop paused by user.');
    this.emitState();
  }

  async runLoop() {
    if (!this.isRunning) return;

    if (!this.isProcessing) {
      await this.pollOnce();
    }

    if (this.isRunning) {
      this.pollTimer = setTimeout(() => this.runLoop(), this.pollIntervalMs);
    }
  }

  async pollOnce() {
    try {
      this.stats.status = 'polling';
      const data = await this.transport.poll();
      this.stats.lastHeartbeat = Date.now();

      if (data && data.status === 'task_available' && data.task) {
        await this.handleTask(data.task);
      } else {
        this.stats.status = 'idle';
      }
    } catch (err) {
      this.stats.status = 'error';
      this.log(\`Poll network delay / error: \${err.message}\`, 'warn');
    }
    this.emitState();
  }

  formatPrompt(task) {
    if (!task) return '';
    let result = '';

    if (task.systemPrompt) {
      result += \`[System Instruction]:\\n\${task.systemPrompt}\\n\\n\`;
    }

    if (Array.isArray(task.messages) && task.messages.length > 0) {
      for (const msg of task.messages) {
        const role = msg.role === 'assistant' ? 'Assistant' : (msg.role === 'system' ? 'System' : 'User');
        const text = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
        result += \`[\${role}]:\\n\${text}\\n\\n\`;
      }
    } else if (task.prompt) {
      result += task.prompt;
    }

    return result.trim();
  }

  async handleTask(task) {
    if (this.isProcessing) return;
    this.isProcessing = true;
    this.stats.currentTaskId = task.id;
    this.stats.status = 'processing';
    this.log(\`Received task [\${task.id}]. Injecting into Gemini DOM...\`);
    this.emitState();

    const formattedPrompt = this.formatPrompt(task);

    try {
      await this.dom.injectPrompt(formattedPrompt);
      this.log(\`Prompt injected for [\${task.id}]. Triggering Send...\`);

      const sent = await this.dom.triggerSend();
      if (!sent) {
        throw new Error('Failed to trigger Send button in Gemini UI');
      }

      this.log(\`Prompt submitted for [\${task.id}]. Monitoring streaming response...\`);

      const fullResponse = await this.monitorResponseStream(task.id);

      this.stats.tasksProcessed++;
      this.log(\`Task [\${task.id}] fulfilled successfully (\${fullResponse.length} chars)!\`);

      for (const cb of this.listeners.taskComplete) {
        try { cb({ taskId: task.id, fullText: fullResponse }); } catch {}
      }
    } catch (err) {
      this.stats.tasksFailed++;
      this.log(\`Error processing task [\${task.id}]: \${err.message}\`, 'error');

      try {
        await this.transport.sendDone(task.id, null, err.message);
      } catch (notifyErr) {
        this.log(\`Failed to send error status to gateway: \${notifyErr.message}\`, 'error');
      }
    } finally {
      this.isProcessing = false;
      this.stats.currentTaskId = null;
      this.stats.status = this.isRunning ? 'idle' : 'paused';
      this.emitState();
    }
  }

  async monitorResponseStream(taskId) {
    let processedLength = 0;
    let chunkIndex = 0;
    let lastObservedText = '';
    let stableCounter = 0;
    const maxStableCycles = 4;
    const maxWaitMs = 120000;
    const startTime = Date.now();

    await new Promise((r) => setTimeout(r, 300));

    return new Promise((resolve, reject) => {
      const interval = setInterval(async () => {
        try {
          if (Date.now() - startTime > maxWaitMs) {
            clearInterval(interval);
            reject(new Error('Timed out waiting for Gemini response stream'));
            return;
          }

          const responseEl = this.dom.getLatestResponseElement();
          const currentText = this.dom.extractResponseText(responseEl);
          const isGen = this.dom.isGenerating();

          if (currentText.length > processedLength) {
            const newChunk = currentText.slice(processedLength);
            processedLength = currentText.length;
            lastObservedText = currentText;
            stableCounter = 0;

            this.stats.chunksSent++;
            this.emitState();

            try {
              await this.transport.sendChunk(taskId, newChunk, chunkIndex++);
            } catch (chunkErr) {
              this.log(\`Chunk delivery warning [\${taskId}]: \${chunkErr.message}\`, 'warn');
            }
          } else if (currentText.length > 0 && currentText === lastObservedText) {
            if (!isGen) {
              stableCounter++;
            }
          }

          if (currentText.length > 0 && !isGen && stableCounter >= maxStableCycles) {
            clearInterval(interval);
            await this.transport.sendDone(taskId, currentText);
            resolve(currentText);
          }
        } catch (pollErr) {
          clearInterval(interval);
          reject(pollErr);
        }
      }, 300);
    });
  }
}

class Hud {
  constructor(workerCore) {
    this.worker = workerCore;
    this.container = null;
    this.isExpanded = false;
    this.logs = [];
    this.maxLogs = 30;

    this.init();
  }

  init() {
    if (typeof document === 'undefined') return;

    const existing = document.getElementById('kiroproxy-hud-root');
    if (existing) existing.remove();

    this.container = document.createElement('div');
    this.container.id = 'kiroproxy-hud-root';
    this.container.innerHTML = this.renderHtml();
    document.body.appendChild(this.container);

    this.bindEvents();

    this.worker.onStateChange((state) => this.updateState(state));
    this.worker.onLog((entry) => this.appendLog(entry));
  }

  renderHtml() {
    return \`
      <style>
        #kiroproxy-hud-root {
          position: fixed;
          bottom: 20px;
          right: 20px;
          z-index: 9999999;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif;
          font-size: 12px;
          color: #fafafa;
          user-select: none;
        }

        .kp-badge-pill {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 14px;
          background: rgba(15, 15, 18, 0.94);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 9999px;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.05);
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .kp-badge-pill:hover {
          transform: translateY(-2px);
          box-shadow: 0 14px 35px rgba(0, 0, 0, 0.6);
          border-color: rgba(255, 255, 255, 0.25);
        }

        .kp-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #10b981;
          box-shadow: 0 0 10px #10b981;
          transition: background 0.3s;
        }

        .kp-dot.polling { background: #38bdf8; box-shadow: 0 0 10px #38bdf8; animation: kp-pulse 2s infinite; }
        .kp-dot.processing { background: #fbbf24; box-shadow: 0 0 12px #fbbf24; animation: kp-pulse 0.8s infinite; }
        .kp-dot.paused { background: #94a3b8; box-shadow: none; }
        .kp-dot.error { background: #f87171; box-shadow: 0 0 10px #f87171; }

        @keyframes kp-pulse {
          0% { transform: scale(0.95); opacity: 0.8; }
          50% { transform: scale(1.15); opacity: 1; }
          100% { transform: scale(0.95); opacity: 0.8; }
        }

        .kp-title {
          font-weight: 600;
          letter-spacing: -0.01em;
          color: #fafafa;
        }

        .kp-status-text {
          color: #a1a1aa;
          font-size: 11px;
        }

        .kp-card {
          display: none;
          width: 360px;
          background: rgba(15, 15, 18, 0.96);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 16px;
          box-shadow: 0 20px 45px rgba(0, 0, 0, 0.75);
          overflow: hidden;
          margin-bottom: 10px;
          animation: kp-slide-up 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .kp-card.show {
          display: block;
        }

        @keyframes kp-slide-up {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .kp-header {
          padding: 14px 16px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .kp-header-left {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .kp-logo {
          background: #fafafa;
          color: #09090b;
          font-weight: 800;
          font-size: 11px;
          padding: 3px 6px;
          border-radius: 6px;
          letter-spacing: -0.02em;
        }

        .kp-close-btn {
          background: transparent;
          border: none;
          color: #71717a;
          cursor: pointer;
          font-size: 16px;
          line-height: 1;
          padding: 4px;
        }
        .kp-close-btn:hover { color: #fafafa; }

        .kp-body {
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .kp-field {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .kp-label {
          font-size: 10px;
          text-transform: uppercase;
          font-weight: 700;
          color: #71717a;
          letter-spacing: 0.05em;
        }

        .kp-input-row {
          display: flex;
          gap: 6px;
        }

        .kp-input {
          flex: 1;
          background: #09090b;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          padding: 6px 10px;
          color: #fafafa;
          font-family: ui-monospace, SFMono-Regular, monospace;
          font-size: 11px;
          outline: none;
        }
        .kp-input:focus { border-color: #fafafa; }

        .kp-btn {
          background: #27272a;
          color: #fafafa;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          padding: 6px 12px;
          font-size: 11px;
          font-weight: 500;
          cursor: pointer;
          transition: background 0.15s;
        }
        .kp-btn:hover { background: #3f3f46; }
        .kp-btn.primary { background: #fafafa; color: #09090b; border-color: #fafafa; font-weight: 600; }
        .kp-btn.primary:hover { background: #e4e4e7; }

        .kp-stats-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8px;
        }

        .kp-stat-box {
          background: #141417;
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 8px;
          padding: 8px;
          text-align: center;
        }

        .kp-stat-val {
          font-size: 16px;
          font-weight: 700;
          color: #fafafa;
          font-family: ui-monospace, SFMono-Regular, monospace;
        }

        .kp-stat-lbl {
          font-size: 9px;
          color: #71717a;
          text-transform: uppercase;
          margin-top: 2px;
        }

        .kp-task-banner {
          background: #1c1c21;
          border-left: 3px solid #fbbf24;
          border-radius: 6px;
          padding: 8px 10px;
          font-size: 11px;
          display: none;
        }
        .kp-task-banner.active { display: block; }

        .kp-logs-container {
          background: #09090b;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 8px;
          padding: 8px;
          height: 120px;
          overflow-y: auto;
          font-family: ui-monospace, SFMono-Regular, monospace;
          font-size: 10px;
          color: #a1a1aa;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .kp-log-item { word-break: break-all; }
        .kp-log-item.error { color: #f87171; }
        .kp-log-item.warn { color: #fbbf24; }
        .kp-log-item.info { color: #a1a1aa; }
      </style>

      <div class="kp-card" id="kp-card">
        <div class="kp-header">
          <div class="kp-header-left">
            <span class="kp-logo">KIRO</span>
            <div>
              <div class="kp-title">Gemini Canvas AI Bridge</div>
              <div class="kp-status-text" id="kp-card-substatus">Zero-Cost Model Gateway</div>
            </div>
          </div>
          <button class="kp-close-btn" id="kp-btn-close">✕</button>
        </div>

        <div class="kp-body">
          <div class="kp-field">
            <label class="kp-label">Gateway Ingress URL</label>
            <div class="kp-input-row">
              <input type="text" class="kp-input" id="kp-input-gateway" value="\${this.worker.getGateway()}" />
              <button class="kp-btn" id="kp-btn-save-gw">Save</button>
            </div>
          </div>

          <div class="kp-stats-grid">
            <div class="kp-stat-box">
              <div class="kp-stat-val" id="kp-stat-tasks">0</div>
              <div class="kp-stat-lbl">Tasks Done</div>
            </div>
            <div class="kp-stat-box">
              <div class="kp-stat-val" id="kp-stat-chunks">0</div>
              <div class="kp-stat-lbl">Chunks</div>
            </div>
            <div class="kp-stat-box">
              <div class="kp-stat-val" id="kp-stat-failed">0</div>
              <div class="kp-stat-lbl">Errors</div>
            </div>
          </div>

          <div class="kp-task-banner" id="kp-task-banner">
            Processing task: <code id="kp-active-task-id" style="color:#fbbf24;">none</code>
          </div>

          <div class="kp-input-row">
            <button class="kp-btn primary" id="kp-btn-toggle-worker" style="flex:1;">Pause Worker</button>
            <button class="kp-btn" id="kp-btn-ping" title="Test Gateway Health">Ping</button>
          </div>

          <div class="kp-field">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <label class="kp-label">Worker Event Log</label>
              <span id="kp-btn-clear-logs" style="font-size:9px; color:#71717a; cursor:pointer;">Clear</span>
            </div>
            <div class="kp-logs-container" id="kp-logs">
              <div class="kp-log-item info">[System] Bridge initialized.</div>
            </div>
          </div>
        </div>
      </div>

      <div class="kp-badge-pill" id="kp-pill">
        <span class="kp-dot polling" id="kp-dot"></span>
        <span class="kp-title">KiroProxy</span>
        <span class="kp-status-text" id="kp-pill-status">Listening</span>
      </div>
    \`;
  }

  bindEvents() {
    const pill = this.container.querySelector('#kp-pill');
    const card = this.container.querySelector('#kp-card');
    const closeBtn = this.container.querySelector('#kp-btn-close');
    const toggleBtn = this.container.querySelector('#kp-btn-toggle-worker');
    const saveGwBtn = this.container.querySelector('#kp-btn-save-gw');
    const pingBtn = this.container.querySelector('#kp-btn-ping');
    const clearLogsBtn = this.container.querySelector('#kp-btn-clear-logs');
    const inputGw = this.container.querySelector('#kp-input-gateway');

    pill.addEventListener('click', () => {
      this.isExpanded = !this.isExpanded;
      card.classList.toggle('show', this.isExpanded);
    });

    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.isExpanded = false;
      card.classList.remove('show');
    });

    toggleBtn.addEventListener('click', () => {
      if (this.worker.isRunning) {
        this.worker.stop();
        toggleBtn.textContent = 'Resume Worker';
      } else {
        this.worker.start();
        toggleBtn.textContent = 'Pause Worker';
      }
    });

    saveGwBtn.addEventListener('click', () => {
      const newUrl = inputGw.value.trim();
      if (newUrl) {
        this.worker.setGateway(newUrl);
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('kiroproxy_gateway_url', newUrl);
        }
      }
    });

    pingBtn.addEventListener('click', async () => {
      this.appendLog({ timestamp: new Date().toISOString(), message: 'Testing gateway ping...', level: 'info' });
      try {
        const health = await this.worker.transport.getHealth();
        this.appendLog({ timestamp: new Date().toISOString(), message: \`Gateway online! Service: \${health.service || 'OK'}\`, level: 'info' });
      } catch (err) {
        this.appendLog({ timestamp: new Date().toISOString(), message: \`Ping failed: \${err.message}\`, level: 'error' });
      }
    });

    clearLogsBtn.addEventListener('click', () => {
      this.logs = [];
      const logsEl = this.container.querySelector('#kp-logs');
      logsEl.innerHTML = '<div class="kp-log-item info">Logs cleared.</div>';
    });
  }

  updateState(state) {
    if (!this.container) return;

    const dot = this.container.querySelector('#kp-dot');
    const pillStatus = this.container.querySelector('#kp-pill-status');
    const cardSubstatus = this.container.querySelector('#kp-card-substatus');
    const tasksVal = this.container.querySelector('#kp-stat-tasks');
    const chunksVal = this.container.querySelector('#kp-stat-chunks');
    const failedVal = this.container.querySelector('#kp-stat-failed');
    const taskBanner = this.container.querySelector('#kp-task-banner');
    const activeTaskId = this.container.querySelector('#kp-active-task-id');
    const toggleBtn = this.container.querySelector('#kp-btn-toggle-worker');

    tasksVal.textContent = state.tasksProcessed;
    chunksVal.textContent = state.chunksSent;
    failedVal.textContent = state.tasksFailed;

    dot.className = \`kp-dot \${state.status}\`;

    if (state.status === 'processing') {
      pillStatus.textContent = 'Streaming';
      cardSubstatus.textContent = \`Streaming chunk to Kiro IDE...\`;
      taskBanner.classList.add('active');
      activeTaskId.textContent = state.currentTaskId || 'active';
    } else if (state.status === 'polling') {
      pillStatus.textContent = 'Polling';
      cardSubstatus.textContent = 'Waiting for prompts from Kiro...';
      taskBanner.classList.remove('active');
    } else if (state.status === 'paused') {
      pillStatus.textContent = 'Paused';
      cardSubstatus.textContent = 'Worker loop paused';
      taskBanner.classList.remove('active');
    } else if (state.status === 'error') {
      pillStatus.textContent = 'Offline';
      cardSubstatus.textContent = 'Network delay / Connection error';
      taskBanner.classList.remove('active');
    } else {
      pillStatus.textContent = 'Listening';
      cardSubstatus.textContent = 'Connected to Gateway';
      taskBanner.classList.remove('active');
    }

    toggleBtn.textContent = state.isRunning ? 'Pause Worker' : 'Resume Worker';
  }

  appendLog(entry) {
    if (!this.container) return;
    this.logs.push(entry);
    if (this.logs.length > this.maxLogs) this.logs.shift();

    const logsEl = this.container.querySelector('#kp-logs');
    if (!logsEl) return;

    const time = new Date(entry.timestamp).toLocaleTimeString();
    const item = document.createElement('div');
    item.className = \`kp-log-item \${entry.level}\`;
    item.textContent = \`[\${time}] \${entry.message}\`;

    logsEl.appendChild(item);
    logsEl.scrollTop = logsEl.scrollHeight;
  }
}

// ── BOOTSTRAPPER ─────────────────────────────────────────────────────────
(function bootKiroProxyWorker() {
  const DEFAULT_GW = '${publicUrl}';
  let savedGw = DEFAULT_GW;
  try {
    if (typeof localStorage !== 'undefined') {
      savedGw = localStorage.getItem('kiroproxy_gateway_url') || DEFAULT_GW;
    }
  } catch {}

  const worker = new WorkerCore({ gatewayUrl: savedGw });
  const hud = new Hud(worker);

  worker.start();
  window.__kiroWorker = worker;
  window.__kiroHud = hud;
  console.log('[KiroProxy Worker] Booted and listening to ' + worker.getGateway());
})();

})();`;

      case 'manifest.json':
        return JSON.stringify({
          manifest_version: 3,
          name: "KiroProxy — Gemini Canvas AI Bridge",
          version: "1.0.0",
          description: "Connects Google Gemini Web UI & AI Studio to Kiro IDE & Google Antigravity with zero API costs.",
          permissions: ["storage", "activeTab"],
          host_permissions: [
            "https://gemini.google.com/*",
            "https://aistudio.google.com/*",
            "https://*.run.app/*",
            "http://localhost/*",
            "http://127.0.0.1/*"
          ],
          background: {
            service_worker: "background.js"
          },
          content_scripts: [
            {
              matches: [
                "https://gemini.google.com/*",
                "https://aistudio.google.com/*"
              ],
              js: ["content.js"],
              run_at: "document_idle"
            }
          ],
          action: {
            default_popup: "popup.html",
            default_title: "KiroProxy Gemini Bridge"
          }
        }, null, 2);

      case 'background.js':
        return `/**
 * Extension Background Service Worker
 * Manages badge state and cross-tab communication.
 */

chrome.runtime.onInstalled.addListener(() => {
  console.log('[KiroProxy Extension] Installed successfully.');
  chrome.action.setBadgeText({ text: 'ON' });
  chrome.action.setBadgeBackgroundColor({ color: '#10b981' });
});

// Forward messages between popup and content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'get_gateway_url') {
    chrome.storage.sync.get(['gatewayUrl'], (result) => {
      sendResponse({ gatewayUrl: result.gatewayUrl || '${publicUrl}' });
    });
    return true;
  }

  if (request.action === 'set_gateway_url') {
    chrome.storage.sync.set({ gatewayUrl: request.gatewayUrl }, () => {
      sendResponse({ success: true });
    });
    return true;
  }
});`;

      case 'popup.html':
        return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>KiroProxy Bridge</title>
  <style>
    body {
      width: 320px;
      margin: 0;
      padding: 16px;
      background: #09090b;
      color: #fafafa;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 12px;
    }

    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 14px;
      padding-bottom: 10px;
      border-bottom: 1px solid #27272a;
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .logo {
      background: #fafafa;
      color: #09090b;
      font-weight: 800;
      font-size: 11px;
      padding: 2px 6px;
      border-radius: 4px;
    }

    .title {
      font-weight: 600;
      font-size: 13px;
    }

    .status-pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 10px;
      font-family: monospace;
      padding: 3px 8px;
      border-radius: 9999px;
      background: #141417;
      border: 1px solid #27272a;
    }

    .dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #10b981;
    }

    .field {
      margin-bottom: 12px;
    }

    label {
      display: block;
      font-size: 10px;
      text-transform: uppercase;
      font-weight: 700;
      color: #71717a;
      margin-bottom: 4px;
    }

    input {
      width: 100%;
      box-sizing: border-box;
      background: #141417;
      border: 1px solid #27272a;
      border-radius: 6px;
      padding: 8px;
      color: #fafafa;
      font-family: monospace;
      font-size: 11px;
      outline: none;
    }
    input:focus { border-color: #fafafa; }

    .btn {
      width: 100%;
      background: #fafafa;
      color: #09090b;
      border: none;
      border-radius: 6px;
      padding: 8px;
      font-weight: 600;
      cursor: pointer;
      margin-top: 4px;
    }
    .btn:hover { background: #e4e4e7; }

    .btn-secondary {
      background: #141417;
      color: #fafafa;
      border: 1px solid #27272a;
      margin-top: 6px;
    }
    .btn-secondary:hover { background: #27272a; }

    .info-box {
      margin-top: 14px;
      padding: 10px;
      background: #141417;
      border: 1px solid #27272a;
      border-radius: 6px;
      font-size: 11px;
      color: #a1a1aa;
      line-height: 1.4;
    }

    .info-box code {
      color: #10b981;
      font-family: monospace;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="brand">
      <span class="logo">KIRO</span>
      <span class="title">Canvas Bridge</span>
    </div>
    <div class="status-pill">
      <span class="dot" id="dot"></span>
      <span id="status-text">Active</span>
    </div>
  </div>

  <div class="field">
    <label>Gateway Ingress Endpoint</label>
    <input type="text" id="gateway-input" value="${publicUrl}" />
  </div>

  <button class="btn" id="save-btn">Save Configuration</button>
  <button class="btn btn-secondary" id="open-gemini-btn">Open Gemini Web UI</button>

  <div class="info-box">
    <strong>Instructions:</strong><br />
    1. Keep a <code>gemini.google.com</code> tab open in your browser.<br />
    2. The bridge worker will automatically poll and fulfill tasks from Kiro IDE with zero API cost.
  </div>

  <script src="popup.js"></script>
</body>
</html>`;

      case 'popup.js':
        return `document.addEventListener('DOMContentLoaded', () => {
  const input = document.getElementById('gateway-input');
  const saveBtn = document.getElementById('save-btn');
  const openGeminiBtn = document.getElementById('open-gemini-btn');
  const dot = document.getElementById('dot');
  const statusText = document.getElementById('status-text');

  // Load saved gateway URL
  if (chrome.storage && chrome.storage.sync) {
    chrome.storage.sync.get(['gatewayUrl'], (result) => {
      if (result.gatewayUrl) {
        input.value = result.gatewayUrl;
      }
    });
  }

  // Save gateway URL
  saveBtn.addEventListener('click', () => {
    const newUrl = input.value.trim();
    if (newUrl) {
      if (chrome.storage && chrome.storage.sync) {
        chrome.storage.sync.set({ gatewayUrl: newUrl }, () => {
          saveBtn.textContent = 'Saved!';
          setTimeout(() => { saveBtn.textContent = 'Save Configuration'; }, 1500);
        });
      }
    }
  });

  // Open Gemini Tab
  openGeminiBtn.addEventListener('click', () => {
    chrome.tabs.create({ url: 'https://gemini.google.com' });
  });

  // Check gateway health
  async function checkHealth() {
    try {
      const res = await fetch(input.value.replace(/\\/+$/, '') + '/health', { method: 'GET' });
      if (res.ok) {
        dot.style.background = '#10b981';
        statusText.textContent = 'Gateway Online';
      } else {
        dot.style.background = '#fbbf24';
        statusText.textContent = \`HTTP \${res.status}\`;
      }
    } catch {
      dot.style.background = '#f87171';
      statusText.textContent = 'Gateway Offline';
    }
  }

  checkHealth();
});`;
      default:
        return '';
    }
  };

  const handleCopyCode = () => {
    const content = getExtensionFileContent(activeFileTab);
    navigator.clipboard.writeText(content);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const isWorkerActive = bridgeStatus?.isWorkerActive || false;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="rounded-2xl bg-[#0f0f12] border border-[#27272a] p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Radio className="w-5 h-5 text-emerald-400 animate-pulse" />
            <h2 className="text-base font-bold text-[#fafafa]">
              Gemini Canvas Cloud Bridge (Zero-Cost Reverse Polling)
            </h2>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setInAppWorkerActive(!inAppWorkerActive)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border flex items-center gap-1.5 transition-colors cursor-pointer ${
                inAppWorkerActive
                  ? 'bg-emerald-950/60 border-emerald-800 text-emerald-400'
                  : 'bg-[#18181b] border-[#27272a] text-zinc-400'
              }`}
            >
              <Cpu className="w-3.5 h-3.5 text-emerald-400" />
              <span>{inAppWorkerActive ? 'In-App Worker: ACTIVE' : 'In-App Worker: OFF'}</span>
            </button>
            <button
              onClick={handleTestConnection}
              className="px-3 py-1.5 rounded-lg bg-[#18181b] hover:bg-[#27272a] text-xs font-semibold text-zinc-300 border border-[#27272a] flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5 text-brand-400" />
              <span>Test Connection Status</span>
            </button>
            <span className="text-xs font-mono text-zinc-500 hidden md:inline">
              {publicUrl}
            </span>
          </div>
        </div>

        <p className="text-xs text-zinc-300 leading-relaxed max-w-4xl">
          The Canvas Bridge allows Kiro IDE requests to route directly to a browser tab running Google Gemini Canvas or local model workers via HTTPS reverse-polling. No ngrok tunnels, local daemons, or paid API keys required.
        </p>

        {connTestMessage && (
          <div className={`p-3 rounded-xl border text-xs font-mono ${
            connTestMessage.includes('✅')
              ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300'
              : connTestMessage.includes('⚠️')
              ? 'bg-amber-950/40 border-amber-800/60 text-amber-300'
              : 'bg-zinc-900 border-zinc-700 text-zinc-300'
          }`}>
            {connTestMessage}
          </div>
        )}
      </div>

      {/* Real Bridge Status Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-xl bg-[#0f0f12] border border-[#27272a] flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-zinc-400">Worker Status</p>
            <p className="text-xl font-bold text-[#fafafa] mt-1 flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${isWorkerActive ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-600'}`} />
              <span>{isWorkerActive ? 'Worker Connected' : 'Waiting for Worker'}</span>
            </p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-[#141417] border border-[#27272a] flex items-center justify-center text-zinc-300">
            <Cpu className="w-5 h-5" />
          </div>
        </div>

        <div className="p-5 rounded-xl bg-[#0f0f12] border border-[#27272a] flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-zinc-400">Task Queue Depth</p>
            <p className="text-xl font-bold text-[#fafafa] mt-1">
              {bridgeStatus?.queueDepth || 0} Pending
            </p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-[#141417] border border-[#27272a] flex items-center justify-center text-zinc-300">
            <Activity className="w-5 h-5" />
          </div>
        </div>

        <div className="p-5 rounded-xl bg-[#0f0f12] border border-[#27272a] flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-zinc-400">Active Tasks</p>
            <p className="text-xl font-bold text-[#fafafa] mt-1">
              {bridgeStatus?.activeTasksCount || 0} In Flight
            </p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-[#141417] border border-[#27272a] flex items-center justify-center text-zinc-300">
            <Radio className="w-5 h-5" />
          </div>
        </div>

        <div className="p-5 rounded-xl bg-[#0f0f12] border border-[#27272a] flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-zinc-400">Last Worker Heartbeat</p>
            <p className="text-xl font-bold text-[#fafafa] mt-1 font-mono">
              {bridgeStatus?.secondsSinceLastHeartbeat !== null && bridgeStatus?.secondsSinceLastHeartbeat !== undefined
                ? `${bridgeStatus.secondsSinceLastHeartbeat}s ago`
                : 'None'}
            </p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-[#141417] border border-[#27272a] flex items-center justify-center text-zinc-300">
            <RefreshCw className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Dispatch Canvas Task & Task History Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Dispatch Canvas Task */}
        <div className="rounded-2xl bg-[#0f0f12] border border-[#27272a] p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#27272a]">
            <h3 className="text-sm font-bold text-[#fafafa] flex items-center gap-2">
              <Send className="w-4 h-4 text-brand-400" />
              Dispatch Canvas Task (Test Connection)
            </h3>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isWorkerActive ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
              {isWorkerActive ? 'Ready' : 'Worker Offline'}
            </span>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-medium text-zinc-400">
              Prompt / Instructions
            </label>
            <textarea
              rows={3}
              value={testPrompt}
              onChange={(e) => setTestPrompt(e.target.value)}
              placeholder="Enter prompt to execute on Gemini Canvas Worker..."
              className="w-full rounded-xl bg-[#09090b] border border-[#27272a] p-3 text-xs text-zinc-200 font-mono outline-none focus:border-brand-500 resize-none"
            />
          </div>

          <div className="flex items-center justify-between pt-1">
            <p className="text-[11px] text-zinc-500">
              Model: <code className="text-zinc-300">canvas-gemini-flash</code>
            </p>
            <button
              onClick={handleDispatchTask}
              disabled={isDispatching || !testPrompt.trim()}
              className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-2 cursor-pointer transition-colors shadow-lg shadow-brand-600/20"
            >
              {isDispatching ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
              <span>{isDispatching ? 'Streaming...' : 'Enqueue Task'}</span>
            </button>
          </div>

          {/* Real-time Stream Output Preview */}
          {currentStreamOutput && (
            <div className="p-4 rounded-xl bg-[#09090b] border border-[#27272a] space-y-1">
              <div className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">
                Live Stream Response
              </div>
              <pre className="text-xs font-mono text-emerald-400 whitespace-pre-wrap overflow-x-auto max-h-40">
                {currentStreamOutput}
              </pre>
            </div>
          )}
        </div>

        {/* Task Queue History */}
        <div className="rounded-2xl bg-[#0f0f12] border border-[#27272a] p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#27272a]">
            <h3 className="text-sm font-bold text-[#fafafa] flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-400" />
              Task Queue History
            </h3>
            {taskHistory.length > 0 && (
              <button
                onClick={() => setTaskHistory([])}
                className="text-xs text-zinc-400 hover:text-zinc-200 flex items-center gap-1 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear</span>
              </button>
            )}
          </div>

          {taskHistory.length === 0 ? (
            <div className="p-8 text-center text-zinc-500 text-xs font-mono flex flex-col items-center justify-center gap-2 min-h-[160px]">
              <Cpu className="w-8 h-8 text-zinc-600" />
              <span>No active tasks in queue. Dispatch a task to test connection.</span>
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {taskHistory.map((t) => (
                <div
                  key={t.id}
                  className="p-3 rounded-xl bg-[#09090b] border border-[#27272a] space-y-1 text-xs font-mono"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-brand-400 font-bold">{t.id}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-zinc-500 text-[10px]">{t.timestamp}</span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          t.status === 'completed'
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : t.status === 'failed'
                            ? 'bg-red-500/20 text-red-400'
                            : t.status === 'fulfilling'
                            ? 'bg-brand-500/20 text-brand-400 animate-pulse'
                            : 'bg-zinc-800 text-zinc-400'
                        }`}
                      >
                        {t.status.toUpperCase()}
                      </span>
                    </div>
                  </div>
                  <p className="text-zinc-300 truncate">{t.prompt}</p>
                  {t.output && (
                    <p className="text-emerald-400 text-[11px] truncate pt-0.5 border-t border-zinc-800">
                      {t.output}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Extension / Connection Worker Setup Files */}
      <div className="rounded-2xl bg-[#0f0f12] border border-[#27272a] p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#27272a]">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-bold text-[#fafafa]">
              Gemini Canvas AI Bridge — Connection Files & Worker Script
            </h3>
          </div>
          <button
            onClick={handleCopyCode}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#141417] hover:bg-[#1c1c21] text-zinc-300 border border-[#27272a] text-xs cursor-pointer transition-colors self-start sm:self-auto"
          >
            {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-zinc-400" />}
            <span>{copiedCode ? 'Copied!' : `Copy ${activeFileTab}`}</span>
          </button>
        </div>

        {/* File Switcher Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {(['content.js', 'manifest.json', 'background.js', 'popup.html', 'popup.js'] as ExtensionFileName[]).map((fileName) => (
            <button
              key={fileName}
              onClick={() => setActiveFileTab(fileName)}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                activeFileTab === fileName
                  ? 'bg-brand-600/20 border border-brand-500/50 text-brand-300 font-bold'
                  : 'bg-[#141417] hover:bg-[#1c1c21] border border-[#27272a] text-zinc-400'
              }`}
            >
              <FileCode className="w-3.5 h-3.5 text-brand-400" />
              <span>{fileName}</span>
            </button>
          ))}
        </div>

        <p className="text-xs text-zinc-400">
          {activeFileTab === 'content.js' ? (
            <>Paste <code>content.js</code> into the Developer Console on <strong>gemini.google.com</strong> to run directly as a Userscript, or package as a Chrome Extension content script with HUD controls.</>
          ) : (
            <>Chrome Extension component file <code>{activeFileTab}</code> for building a packaged Manifest V3 extension.</>
          )}
        </p>

        <div className="p-4 rounded-xl bg-[#09090b] border border-[#27272a] font-mono text-xs text-emerald-400 overflow-x-auto whitespace-pre max-h-[420px]">
          {getExtensionFileContent(activeFileTab)}
        </div>
      </div>
    </div>
  );
};
