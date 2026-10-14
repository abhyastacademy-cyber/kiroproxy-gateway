import type { Request, Response } from 'express';
import { canvasBridge, type CanvasChunkPayload, type CanvasDonePayload } from '../providers/canvas_bridge.js';

/**
 * Sets comprehensive CORS headers to allow browser extensions, userscripts,
 * and external cross-origin web workers to communicate with the Cloud Gateway.
 */
export function setCorsHeaders(req: Request, res: Response): void {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE, PATCH');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-admin-token, x-worker-id, Accept, Origin');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Type, Content-Length, x-admin-token');
  res.setHeader('Access-Control-Max-Age', '86400');
}

/**
 * GET /poll
 * Reverse-polling endpoint for the Gemini Canvas browser extension / user-script worker.
 * Returns the next task from the in-memory queue or null if empty.
 */
export async function handlePoll(req: Request, res: Response): Promise<void> {
  setCorsHeaders(req, res);
  
  // Register worker heartbeat
  canvasBridge.registerWorkerHeartbeat(1);

  const task = canvasBridge.pollTask();
  if (!task) {
    res.status(200).json({ task: null, status: 'idle' });
    return;
  }

  res.status(200).json({
    task,
    id: task.id,
    prompt: task.prompt,
    systemPrompt: task.systemPrompt,
    messages: task.messages,
    model: task.model,
    createdAt: task.createdAt,
  });
}

/**
 * POST /chunk
 * Receives incremental streaming chunks from the active Canvas worker.
 */
export async function handleChunk(req: Request, res: Response): Promise<void> {
  setCorsHeaders(req, res);

  const { taskId, chunk, index } = req.body || {};
  if (!taskId || typeof chunk !== 'string') {
    res.status(400).json({ error: 'taskId and chunk string are required' });
    return;
  }

  const payload: CanvasChunkPayload = {
    taskId,
    chunk,
    index: typeof index === 'number' ? index : 0,
  };

  canvasBridge.handleChunk(payload);
  res.status(200).json({ success: true, taskId });
}

/**
 * POST /done
 * Signals task completion or failure from the Canvas worker.
 */
export async function handleDone(req: Request, res: Response): Promise<void> {
  setCorsHeaders(req, res);

  const { taskId, fullText, error } = req.body || {};
  if (!taskId) {
    res.status(400).json({ error: 'taskId is required' });
    return;
  }

  const payload: CanvasDonePayload = {
    taskId,
    fullText,
    error,
  };

  canvasBridge.handleDone(payload);
  res.status(200).json({ success: true, taskId });
}

/**
 * GET /api/canvas/status
 * Returns current Canvas Bridge worker telemetry, queue depth, and active tasks.
 */
export async function handleCanvasStatus(req: Request, res: Response): Promise<void> {
  setCorsHeaders(req, res);
  const status = canvasBridge.getBridgeStatus();
  res.status(200).json(status);
}
