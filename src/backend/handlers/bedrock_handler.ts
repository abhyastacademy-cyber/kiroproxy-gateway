import type { Request, Response } from 'express';
import { createBedrockChunkFrame, createBedrockEndFrame } from './eventstream.js';
import { providerManager } from '../providers/provider_manager.js';
import { configManager } from '../config/index.js';
import type { ChatMessage } from '../providers/gemini_provider.js';

/**
 * Validates security token if adminToken is configured.
 */
export function validateAdminAuth(req: Request): boolean {
  const adminToken = configManager.getConfig().adminToken;
  if (!adminToken) return true; // No protection required

  // 1. Path param: /k/:token/generateAssistantResponse
  const pathToken = req.params?.token;
  if (pathToken && pathToken === adminToken) return true;

  // 2. Query param: ?token=...
  if (req.query?.token && req.query.token === adminToken) return true;

  // 3. Header: Authorization Bearer ...
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    if (authHeader.slice(7).trim() === adminToken) return true;
  }

  // 4. Header: x-admin-token
  const customHeader = req.headers['x-admin-token'];
  if (customHeader === adminToken) return true;

  return false;
}

/**
 * Parses messages from various Kiro IDE / Bedrock payload structures.
 */
function extractMessages(body: any): { messages: ChatMessage[]; systemPrompt?: string; model?: string } {
  const messages: ChatMessage[] = [];
  let systemPrompt: string | undefined = undefined;
  let model: string | undefined = body?.modelId || body?.model;

  // 1. Kiro conversationState format
  if (body?.conversationState) {
    const cs = body.conversationState;
    if (cs.systemPrompt) {
      systemPrompt = typeof cs.systemPrompt === 'string' ? cs.systemPrompt : JSON.stringify(cs.systemPrompt);
    }

    if (Array.isArray(cs.history)) {
      for (const item of cs.history) {
        const role = (item.sender || item.role || '').toUpperCase() === 'ASSISTANT' ? 'assistant' : 'user';
        const content = item.content || item.text || (typeof item === 'string' ? item : JSON.stringify(item));
        messages.push({ role, content });
      }
    }

    if (cs.currentMessage) {
      const cur = cs.currentMessage;
      const content = cur.content || cur.text || (typeof cur === 'string' ? cur : JSON.stringify(cur));
      messages.push({ role: 'user', content });
    }
  }

  // 2. Bedrock messages format (Claude / Bedrock standard)
  if (Array.isArray(body?.messages) && messages.length === 0) {
    if (body.system) {
      systemPrompt = typeof body.system === 'string' ? body.system : JSON.stringify(body.system);
    }
    for (const m of body.messages) {
      const role = m.role === 'assistant' ? 'assistant' : 'user';
      let content = '';
      if (typeof m.content === 'string') {
        content = m.content;
      } else if (Array.isArray(m.content)) {
        content = m.content.map((c: any) => c.text || '').join('\n');
      }
      messages.push({ role, content });
    }
  }

  // 3. Simple prompt format
  if (messages.length === 0 && (body?.prompt || body?.inputText)) {
    messages.push({
      role: 'user',
      content: body.prompt || body.inputText,
    });
  }

  // Fallback if still empty
  if (messages.length === 0) {
    messages.push({
      role: 'user',
      content: 'Hello, please assist me.',
    });
  }

  // Global AutoMode / OtoMode autonomous execution guidance
  const config = configManager.getConfig();
  const isAutoMode = config.globalAutoMode || config.otoMode || body?.conversationState?.chatTriggerType === 'auto';
  if (isAutoMode) {
    const autoGuidance = '\n[Global AutoMode / OtoMode Active]: You are running in continuous autonomous agent execution mode. Execute tool calls and task completion steps directly without pausing for unnecessary user confirmations.';
    systemPrompt = systemPrompt ? `${systemPrompt}\n${autoGuidance}` : autoGuidance;
  }

  return { messages, systemPrompt, model };
}

/**
 * Handles POST /generateAssistantResponse and POST /k/:token/generateAssistantResponse
 */
export async function handleGenerateAssistantResponse(req: Request, res: Response) {
  // Check security
  if (!validateAdminAuth(req)) {
    return res.status(401).json({
      error: 'Unauthorized: Valid PROXY_ADMIN_TOKEN required',
    });
  }

  const { messages, systemPrompt, model } = extractMessages(req.body);

  // Set AWS Bedrock binary EventStream response headers
  res.writeHead(200, {
    'Content-Type': 'application/vnd.amazon.eventstream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
    'Access-Control-Allow-Origin': '*',
  });

  try {
    await providerManager.streamResponse(
      {
        model,
        messages,
        systemPrompt,
      },
      (chunk: string) => {
        const frame = createBedrockChunkFrame(chunk);
        res.write(frame);
      }
    );

    // Write final Bedrock completion frame
    const endFrame = createBedrockEndFrame();
    res.write(endFrame);
    res.end();
  } catch (err: any) {
    console.error('[BedrockHandler] Streaming error:', err);
    // Send error chunk frame before ending
    const errFrame = createBedrockChunkFrame(`\n[Gateway Error: ${err.message}]`);
    res.write(errFrame);
    const endFrame = createBedrockEndFrame();
    res.write(endFrame);
    res.end();
  }
}
