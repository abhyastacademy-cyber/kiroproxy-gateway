import type { Request, Response } from 'express';
import { providerManager } from '../providers/provider_manager.js';
import { validateAdminAuth } from './bedrock_handler.js';
import { configManager } from '../config/index.js';
import { getCompleteModelCatalog } from '../config/catalog.js';

/**
 * Dual-mode model list discovery handler (v5.1 compliant).
 * Supports both Bedrock/Smithy /listAvailableModels for Kiro IDE
 * and OpenAI standard /v1/models for external tools and the Web UI.
 */
export async function whgwListModels(req: Request, res: Response) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const config = configManager.getConfig();
  const catalog = getCompleteModelCatalog(config);

  // If path is Smithy /listAvailableModels (or Kiro IDE discovery request)
  if (req.path.includes('listAvailableModels')) {
    return res.json({
      models: catalog,
      defaultModel: {
        modelId: 'global-automode',
        modelName: 'Global Automode (7-Tier Zero-Cost Waterfall)',
      },
    });
  }

  // Otherwise, default to OpenAI /v1/models JSON shape
  const openAiModels = catalog.map((m) => ({
    id: m.modelId,
    object: 'model',
    name: m.modelName,
    description: m.description,
    owned_by: m.owned_by || (m.modelId.includes('gemini') ? 'google' : m.modelId.includes('kilo') ? 'kilo-gateway' : 'kiroproxy'),
  }));

  return res.json({
    object: 'list',
    data: openAiModels,
  });
}

/**
 * Alias for OpenAI /v1/models
 */
export async function handleModels(req: Request, res: Response) {
  return whgwListModels(req, res);
}

export async function handleChatCompletions(req: Request, res: Response) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  // Validate admin token if configured
  if (!validateAdminAuth(req)) {
    return res.status(401).json({
      error: {
        message: 'Unauthorized: PROXY_ADMIN_TOKEN required',
        type: 'invalid_request_error',
        code: 401,
      },
    });
  }

  const { model = 'gemini-flash-latest', messages, stream = false, temperature, max_tokens } = req.body;

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({
      error: {
        message: 'messages array is required',
        type: 'invalid_request_error',
      },
    });
  }

  const promptMessages = messages.map((m: any) => ({
    role: m.role || 'user',
    content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
  }));

  const systemMessage = promptMessages.find((m: any) => m.role === 'system')?.content;

  if (stream) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    const completionId = `chatcmpl-${Date.now()}`;

    try {
      await providerManager.streamResponse(
        {
          model,
          messages: promptMessages,
          systemPrompt: systemMessage,
          temperature,
          maxTokens: max_tokens,
        },
        (chunk: string) => {
          const payload = {
            id: completionId,
            object: 'chat.completion.chunk',
            created: Math.floor(Date.now() / 1000),
            model,
            choices: [
              {
                index: 0,
                delta: { content: chunk },
                finish_reason: null,
              },
            ],
          };
          res.write(`data: ${JSON.stringify(payload)}\n\n`);
        }
      );

      // Send termination chunk
      const endPayload = {
        id: completionId,
        object: 'chat.completion.chunk',
        created: Math.floor(Date.now() / 1000),
        model,
        choices: [
          {
            index: 0,
            delta: {},
            finish_reason: 'stop',
          },
        ],
      };
      res.write(`data: ${JSON.stringify(endPayload)}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
    } catch (err: any) {
      console.error('[OpenAIHandler] Stream error:', err);
      const errPayload = {
        error: {
          message: err.message,
          type: 'gateway_error',
        },
      };
      res.write(`data: ${JSON.stringify(errPayload)}\n\n`);
      res.end();
    }
  } else {
    // Non-streaming response
    try {
      let fullText = '';
      const result = await providerManager.streamResponse(
        {
          model,
          messages: promptMessages,
          systemPrompt: systemMessage,
          temperature,
          maxTokens: max_tokens,
        },
        (chunk: string) => {
          fullText += chunk;
        }
      );

      return res.json({
        id: `chatcmpl-${Date.now()}`,
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: result.modelUsed,
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: fullText,
            },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: 0,
          completion_tokens: fullText.length / 4,
          total_tokens: fullText.length / 4,
        },
      });
    } catch (err: any) {
      return res.status(500).json({
        error: {
          message: err.message,
          type: 'gateway_error',
        },
      });
    }
  }
}
