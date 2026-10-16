import type { Request, Response } from 'express';
import {
  createAssistantResponseFrame,
  createMetadataEventFrame,
} from './eventstream.js';
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
 * Implements native Smithy EventStream binary framing (assistantResponseEvent, toolUseEvent, metadataEvent)
 * to prevent Kiro IDE "Internal error" unmarshaller crashes.
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

  // Session & conversation tracking
  const rawConvId = req.body?.conversationState?.conversationId ||
    req.headers['x-amzn-kiro-conversation-id'] ||
    `sess_${Date.now()}`;
  const conversationId = String(rawConvId);
  const rawSessionId = req.headers['x-amzn-session-id'] || conversationId;
  const sessionId = String(rawSessionId);
  const rawRequestId = req.headers['x-amzn-requestid'] || `req_${Date.now()}`;
  const requestId = String(rawRequestId);

  // Set AWS Bedrock / Smithy binary EventStream response headers
  res.writeHead(200, {
    'Content-Type': 'application/vnd.amazon.eventstream',
    'x-amzn-kiro-conversation-id': conversationId,
    'x-amzn-kiro-profile-arn': 'arn:aws:kiro:us-east-1:123456789012:profile/default',
    'x-amzn-requestid': requestId,
    'x-amzn-session-id': sessionId,
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
    'Access-Control-Allow-Origin': '*',
  });

  try {
    let toolCallEmitted = false;
    let accumulatedText = '';
    const messageId = `msg_${Date.now()}`;

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
        accumulatedText += chunk;
        const frame = createAssistantResponseFrame(chunk, parsed.modelId || 'auto', messageId);
        res.write(frame);
      }
    );

    // Multi-Format Tool Extraction Fallback:
    // If no native tool call was emitted, extract tool calls embedded in response text across 13+ formats
    if (!toolCallEmitted && accumulatedText) {
      const extractedCalls = toolExtractor.extractToolCalls(accumulatedText, tools);
      if (extractedCalls.length > 0) {
        for (let i = 0; i < extractedCalls.length; i++) {
          const rawCall = extractedCalls[i];
          const normalized = toolExtractor.normalizeAliases(rawCall.name, rawCall.args, accumulatedText);
          const invocation = {
            id: 'call_' + Math.random().toString(36).substring(2, 9) + '_' + i,
            name: normalized.name,
            arguments: typeof normalized.args === 'string' ? normalized.args : JSON.stringify(normalized.args),
          };
          toolCallEmitted = true;
          const frames = toolTranslator.createBedrockFramesForToolCall(invocation, i);
          for (const frame of frames) {
            res.write(frame);
          }
        }
      }
    }

    // If no tool call was emitted, signal clean completion with Smithy metadataEvent
    if (!toolCallEmitted) {
      const outputTokens = Math.max(1, Math.round(accumulatedText.length / 4));
      const endFrame = createMetadataEventFrame('END_TURN', {
        uncachedInputTokens: 500,
        outputTokens,
        totalTokens: 500 + outputTokens,
      });
      res.write(endFrame);
    }
    res.end();
  } catch (err: any) {
    console.error('[BedrockHandler] Streaming error:', err);
    // Send error message as assistantResponseEvent before closing
    const errFrame = createAssistantResponseFrame(`\n[Gateway Error: ${err.message}]`, parsed.modelId || 'auto');
    res.write(errFrame);
    const endFrame = createMetadataEventFrame('END_TURN');
    res.write(endFrame);
    res.end();
  }
}
