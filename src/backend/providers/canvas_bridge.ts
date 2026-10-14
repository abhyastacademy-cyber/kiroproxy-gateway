import { EventEmitter } from 'node:events';

export interface CanvasTask {
  id: string;
  model: string;
  prompt: string;
  systemPrompt?: string;
  messages?: Array<{ role: string; content: string }>;
  temperature?: number;
  maxTokens?: number;
  createdAt: number;
}

export interface CanvasChunkPayload {
  taskId: string;
  chunk: string;
  index: number;
}

export interface CanvasDonePayload {
  taskId: string;
  fullText?: string;
  error?: string;
}

class CanvasBridge extends EventEmitter {
  private queue: CanvasTask[] = [];
  private taskEmitters: Map<string, EventEmitter> = new Map();
  private lastWorkerHeartbeat: number = 0;
  private workerCount: number = 0;

  constructor() {
    super();
  }

  public enqueueTask(taskData: Omit<CanvasTask, 'id' | 'createdAt'>): {
    taskId: string;
    onChunk: (cb: (chunk: string) => void) => void;
    onDone: (cb: (fullText: string) => void) => void;
    onError: (cb: (err: Error) => void) => void;
    promise: Promise<string>;
  } {
    const taskId = 'task_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now();
    const task: CanvasTask = {
      ...taskData,
      id: taskId,
      createdAt: Date.now(),
    };

    const emitter = new EventEmitter();
    this.taskEmitters.set(taskId, emitter);
    this.queue.push(task);

    let accumulatedText = '';

    const promise = new Promise<string>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.cleanupTask(taskId);
        reject(new Error(`Canvas task ${taskId} timed out waiting for worker response (no worker polled or responded in 15s)`));
      }, 15000);

      emitter.on('chunk', (chunk: string) => {
        accumulatedText += chunk;
      });

      emitter.on('done', (fullText?: string) => {
        clearTimeout(timeoutId);
        this.cleanupTask(taskId);
        resolve(fullText || accumulatedText);
      });

      emitter.on('error', (err: Error) => {
        clearTimeout(timeoutId);
        this.cleanupTask(taskId);
        reject(err);
      });
    });

    return {
      taskId,
      onChunk: (cb) => emitter.on('chunk', cb),
      onDone: (cb) => emitter.on('done', cb),
      onError: (cb) => emitter.on('error', cb),
      promise,
    };
  }

  public pollTask(): CanvasTask | null {
    this.lastWorkerHeartbeat = Date.now();
    if (this.queue.length === 0) {
      return null;
    }
    return this.queue.shift() || null;
  }

  public handleChunk(payload: CanvasChunkPayload) {
    this.lastWorkerHeartbeat = Date.now();
    const emitter = this.taskEmitters.get(payload.taskId);
    if (emitter) {
      emitter.emit('chunk', payload.chunk);
    }
  }

  public handleDone(payload: CanvasDonePayload) {
    this.lastWorkerHeartbeat = Date.now();
    const emitter = this.taskEmitters.get(payload.taskId);
    if (emitter) {
      if (payload.error) {
        emitter.emit('error', new Error(payload.error));
      } else {
        if (payload.fullText) {
          emitter.emit('chunk', payload.fullText);
        }
        emitter.emit('done', payload.fullText);
      }
    }
    this.cleanupTask(payload.taskId);
  }

  private cleanupTask(taskId: string) {
    const emitter = this.taskEmitters.get(taskId);
    if (emitter) {
      emitter.removeAllListeners();
      this.taskEmitters.delete(taskId);
    }
  }

  public registerWorkerHeartbeat(count = 1) {
    this.lastWorkerHeartbeat = Date.now();
    this.workerCount = count;
  }

  public getBridgeStatus() {
    const isWorkerActive = Date.now() - this.lastWorkerHeartbeat < 15000;
    return {
      isWorkerActive,
      secondsSinceLastHeartbeat: this.lastWorkerHeartbeat > 0 ? Math.floor((Date.now() - this.lastWorkerHeartbeat) / 1000) : null,
      queueDepth: this.queue.length,
      activeTasksCount: this.taskEmitters.size,
      connectedWorkers: isWorkerActive ? Math.max(1, this.workerCount) : 0,
    };
  }
}

export const canvasBridge = new CanvasBridge();
