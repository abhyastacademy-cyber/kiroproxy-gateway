import type { Request, Response } from 'express';
import { createBedrockChunkFrame, createBedrockEndFrame } from './eventstream.js';
import { providerManager } from '../providers/provider_manager.js';
import { configManager } from '../config/index.js';
import { smithyParser } from '../translators/smithy_parser.js';
import { toolExtractor } from '../translators/tool_extractor.js';
import { toolTranslator } from '../translators/tool_translator.js';
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
 * Handles POST /generateAssistantResponse and POST /k/:token/generateAssistantResponse
 */
export async function handleGenerateAssistantResponse(req: Request, res: Response) {
  // Check security
  if (!validateAdminAuth(req)) {
    return res.status(401).json({
      error: 'Unauthorized: Valid PROXY_ADMIN_TOKEN required',
    });
  }

  // Use rich Smithy & conversationState parser
  const parsed = smithyParser.parsePayload(req.body);
  const tools = toolExtractor.extractTools(req.body);

  // Global AutoMode / OtoMode autonomous execution guidance
  const config = configManager.getConfig();
  const isAutoMode = config.globalAutoMode || config.otoMode || req.body?.conversationState?.chatTriggerType === 'auto';
  let systemPrompt = parsed.systemPrompt;
  if (isAutoMode) {
    const autoGuidance = '\n[Global AutoMode / OtoMode Active]: Continuous autonomous agent execution mode enabled. Execute tool calls directly without pausing for unnecessary user confirmations.';
    systemPrompt = systemPrompt ? `${systemPrompt}\n${autoGuidance}` : autoGuidance;
  }

  // Ensure fallback message if history is empty
  const messages = parsed.messages.length > 0 ? parsed.messages : [{ role: 'user' as const, content: 'Hello, please assist me.' }];

  // Set AWS Bedrock binary EventStream response headers
  res.writeHead(200, {
    'Content-Type': 'application/vnd.amazon.eventstream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
    'Access-Control-Allow-Origin': '*',
  });

  try {
    let toolCallEmitted = false;

    await providerManager.streamResponse(
      {
        model: parsed.modelId || 'auto',
        messages,
        systemPrompt,
        tools,
        onToolCall: (call) => {
          toolCallEmitted = true;
          const frames = toolTranslator.createBedrockFramesForToolCall(call);
          for (const frame of frames) {
            res.write(frame);
          }
        },
      },
      (chunk: string) => {
        const frame = createBedrockChunkFrame(chunk);
        res.write(frame);
      }
    );

    // If no tool call was emitted, write default end frame
    if (!toolCallEmitted) {
      const endFrame = createBedrockEndFrame();
      res.write(endFrame);
    }
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

