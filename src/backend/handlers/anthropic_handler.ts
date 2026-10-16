/**
 * src/backend/handlers/anthropic_handler.ts - Anthropic Messages API v1 Adapter
 * Enables full compatibility with Claude Code CLI, Cursor, Continue, and Anthropic SDKs.
 * Supports /v1/messages and /messages endpoints with streaming SSE and tool use translation.
 */

import type { Request, Response } from 'express';
import { providerManager } from '../providers/provider_manager.js';
import { validateAdminAuth } from './bedrock_handler.js';
import { toolExtractor } from '../translators/tool_extractor.js';
import type { ChatMessage } from '../providers/gemini_provider.js';

/**
 * Normalizes incoming Anthropic message content into a clean string.
 */
function extractAnthropicContent(content: any): string {
  if (typeof content === 'string') {
    return content;
  }
  if (Array.isArray(content)) {
    return content
      .map((block: any) => {
        if (!block) return '';
        if (typeof block === 'string') return block;
        if (block.type === 'text' && block.text) return block.text;
        if (block.type === 'tool_result') {
          const resText = typeof block.content === 'string' ? block.content : JSON.stringify(block.content || '');
          return `[Tool Result: ${block.tool_use_id || ''}]\n${resText}`;
        }
        if (block.type === 'tool_use') {
          return `[Tool Call: ${block.name}]\n${JSON.stringify(block.input || {})}`;
        }
        if (block.text) return block.text;
        return JSON.stringify(block);
      })
      .filter(Boolean)
      .join('\n');
  }
  if (typeof content === 'object' && content !== null) {
    if (content.text) return String(content.text);
    return JSON.stringify(content);
  }
  return '';
}

/**
 * Normalizes Anthropic system prompt (can be string or array of blocks).
 */
function extractAnthropicSystem(system: any): string | undefined {
  if (!system) return undefined;
  if (typeof system === 'string') return system;
  if (Array.isArray(system)) {
    return system
      .map((b: any) => (typeof b === 'string' ? b : b?.text || ''))
      .filter(Boolean)
      .join('\n\n');
  }
  return String(system);
}

/**
 * Maps requested Anthropic model to gateway model with intelligent defaults.
 */
function mapAnthropicModel(requestedModel: string): string {
  if (!requestedModel) return 'global-automode';
  const clean = requestedModel.toLowerCase().trim();

  // If user requested global-automode, auto, or backend-ai explicitly
  if (clean === 'auto' || clean === 'global-automode' || clean.startsWith('backend-ai')) {
    return clean;
  }

  // Claude 3.7 / 3.5 Sonnet / Opus mapping to premier reasoning models in waterfall
  if (clean.includes('3-7') || clean.includes('3.7') || clean.includes('opus')) {
    return 'backend-ai/gemini-argon';
  }
  if (clean.includes('3-5') || clean.includes('3.5') || clean.includes('sonnet')) {
    return 'backend-ai/auto';
  }
  if (clean.includes('haiku')) {
    return 'backend-ai/gemini-flash';
  }

  return requestedModel;
}

/**
 * Main Anthropic /v1/messages handler compatible with Claude Code CLI.
 */
export async function handleAnthropicMessages(req: Request, res: Response) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'authorization, x-api-key, anthropic-version, content-type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Validate admin token if PROXY_ADMIN_TOKEN is configured
  if (!validateAdminAuth(req)) {
    return res.status(401).json({
      type: 'error',
      error: {
        type: 'authentication_error',
        message: 'Unauthorized: PROXY_ADMIN_TOKEN required',
      },
    });
  }

  const {
    model = 'claude-3-5-sonnet-20241022',
    messages,
    system,
    max_tokens = 4096,
    temperature = 0.7,
    stream = false,
    tools = [],
  } = req.body;

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({
      type: 'error',
      error: {
        type: 'invalid_request_error',
        message: 'messages array is required and must not be empty',
      },
    });
  }

  // Convert Anthropic messages to normalized ChatMessage turns
  const normalizedMessages: ChatMessage[] = messages.map((m: any) => ({
    role: m.role === 'assistant' ? 'assistant' : 'user',
    content: extractAnthropicContent(m.content),
  }));

  const systemInstruction = extractAnthropicSystem(system);
  const targetModel = mapAnthropicModel(model);
  const messageId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  // --- STREAMING MODE (Claude Code CLI default) ---
  if (stream) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    const sendEvent = (event: string, data: Record<string, any>) => {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    // 1. message_start event
    sendEvent('message_start', {
      type: 'message_start',
      message: {
        id: messageId,
        type: 'message',
        role: 'assistant',
        content: [],
        model,
        stop_reason: null,
        stop_sequence: null,
        usage: {
          input_tokens: 100,
          output_tokens: 0,
        },
      },
    });

    // 2. content_block_start (text block at index 0)
    sendEvent('content_block_start', {
      type: 'content_block_start',
      index: 0,
      content_block: {
        type: 'text',
        text: '',
      },
    });

    let accumulatedText = '';
    let outputTokens = 0;

    try {
      const responseResult = await providerManager.streamResponse(
        {
          model: targetModel,
          messages: normalizedMessages,
          systemPrompt: systemInstruction,
          temperature,
          maxTokens: max_tokens,
          tools,
        },
        (chunk: string) => {
          if (chunk) {
            accumulatedText += chunk;
            outputTokens += Math.ceil(chunk.length / 4);
            sendEvent('content_block_delta', {
              type: 'content_block_delta',
              index: 0,
              delta: {
                type: 'text_delta',
                text: chunk,
              },
            });
          }
        }
      );

      // Stop index 0 text block
      sendEvent('content_block_stop', {
        type: 'content_block_stop',
        index: 0,
      });

      // Check if response contained embedded tool calls (multi-format tool extraction)
      const extraction = toolExtractor.extractFromResponse(accumulatedText || responseResult.text, tools);
      let stopReason = 'end_turn';

      if (extraction.toolCalls && extraction.toolCalls.length > 0) {
        stopReason = 'tool_use';
        for (let i = 0; i < extraction.toolCalls.length; i++) {
          const tc = extraction.toolCalls[i];
          const toolIndex = i + 1;
          const toolId = `toolu_${Date.now()}_${i}`;

          // Start tool_use content block
          sendEvent('content_block_start', {
            type: 'content_block_start',
            index: toolIndex,
            content_block: {
              type: 'tool_use',
              id: toolId,
              name: tc.name,
              input: {},
            },
          });

          // Send partial JSON delta
          sendEvent('content_block_delta', {
            type: 'content_block_delta',
            index: toolIndex,
            delta: {
              type: 'input_json_delta',
              partial_json: JSON.stringify(tc.args || {}),
            },
          });

          // Stop tool_use content block
          sendEvent('content_block_stop', {
            type: 'content_block_stop',
            index: toolIndex,
          });
        }
      }

      // 3. message_delta event
      sendEvent('message_delta', {
        type: 'message_delta',
        delta: {
          stop_reason: stopReason,
          stop_sequence: null,
        },
        usage: {
          output_tokens: Math.max(outputTokens, 1),
        },
      });

      // 4. message_stop event
      sendEvent('message_stop', {
        type: 'message_stop',
      });

      res.end();
    } catch (err: any) {
      console.error('[AnthropicHandler] Stream error:', err.message);
      sendEvent('error', {
        type: 'error',
        error: {
          type: 'api_error',
          message: err.message || 'Stream processing failure',
        },
      });
      res.end();
    }
    return;
  }

  // --- NON-STREAMING MODE ---
  try {
    let accumulatedText = '';
    const responseResult = await providerManager.streamResponse(
      {
        model: targetModel,
        messages: normalizedMessages,
        systemPrompt: systemInstruction,
        temperature,
        maxTokens: max_tokens,
        tools,
      },
      (chunk: string) => {
        accumulatedText += chunk;
      }
    );

    const fullText = accumulatedText || responseResult.text;
    const extraction = toolExtractor.extractFromResponse(fullText, tools);

    const contentBlocks: any[] = [];
    if (extraction.text && extraction.text.trim().length > 0) {
      contentBlocks.push({
        type: 'text',
        text: extraction.text,
      });
    }

    let stopReason = 'end_turn';
    if (extraction.toolCalls && extraction.toolCalls.length > 0) {
      stopReason = 'tool_use';
      for (let i = 0; i < extraction.toolCalls.length; i++) {
        const tc = extraction.toolCalls[i];
        contentBlocks.push({
          type: 'tool_use',
          id: `toolu_${Date.now()}_${i}`,
          name: tc.name,
          input: tc.args || {},
        });
      }
    }

    if (contentBlocks.length === 0) {
      contentBlocks.push({
        type: 'text',
        text: fullText || 'No response generated',
      });
    }

    return res.json({
      id: messageId,
      type: 'message',
      role: 'assistant',
      content: contentBlocks,
      model,
      stop_reason: stopReason,
      stop_sequence: null,
      usage: {
        input_tokens: 100,
        output_tokens: Math.max(Math.ceil(fullText.length / 4), 1),
      },
    });
  } catch (err: any) {
    console.error('[AnthropicHandler] Non-stream error:', err.message);
    return res.status(500).json({
      type: 'error',
      error: {
        type: 'api_error',
        message: err.message || 'Generation failed across all provider tiers',
      },
    });
  }
}
