import type { Request, Response } from 'express';
import { canvasBridge } from '../providers/canvas_bridge.js';

/**
 * Injects required CORS headers for Sandboxed Gemini Canvas iframe / ngrok / cross-origin polling.
 */
export function setCorsHeaders(req: Request, res: Response) {
  const origin = req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, ngrok-skip-browser-warning, x-admin-token');
  res.setHeader('ngrok-skip-browser-warning', '69420');
}

/**
 * GET /poll - Sandboxed Gemini Canvas app polls for new jobs
 */
export async function handlePoll(req: Request, res: Response) {
  setCorsHeaders(req, res);
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  canvasBridge.registerWorkerHeartbeat();
  const task = canvasBridge.pollTask();

  if (!task) {
    return res.status(200).json({ status: 'idle', task: null });
  }

  return res.status(200).json({
    status: 'task_available',
    task,
  });
}

/**
 * POST /chunk - Sandboxed worker streams a chunk back
 */
export async function handleChunk(req: Request, res: Response) {
  setCorsHeaders(req, res);
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const { taskId, chunk, index } = req.body || {};
  if (!taskId || typeof chunk !== 'string') {
    return res.status(400).json({ error: 'taskId and chunk string required' });
  }

  canvasBridge.handleChunk({
    taskId,
    chunk,
    index: Number(index) || 0,
  });

  return res.status(200).json({ received: true });
}

/**
 * POST /done - Sandboxed worker signals task completion or error
 */
export async function handleDone(req: Request, res: Response) {
  setCorsHeaders(req, res);
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const { taskId, fullText, error } = req.body || {};
  if (!taskId) {
    return res.status(400).json({ error: 'taskId required' });
  }

  canvasBridge.handleDone({
    taskId,
    fullText,
    error,
  });

  return res.status(200).json({ done: true });
}

/**
 * GET /api/canvas/status - Bridge status
 */
export async function handleCanvasStatus(req: Request, res: Response) {
  setCorsHeaders(req, res);
  return res.status(200).json(canvasBridge.getBridgeStatus());
}
