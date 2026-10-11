import type { Request, Response } from 'express';
import { providerManager } from '../providers/provider_manager.js';
import { validateAdminAuth } from './bedrock_handler.js';
import { configManager } from '../config/index.js';

export async function handleModels(req: Request, res: Response) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const config = configManager.getConfig();

  const models = [
    { id: 'global-automode', object: 'model', owned_by: 'kiroproxy-waterfall' },
    { id: 'auto', object: 'model', owned_by: 'kiroproxy-waterfall' },
    { id: 'kilo-otomode', object: 'model', owned_by: 'kilo-gateway' },
    { id: 'openrouter-otomode', object: 'model', owned_by: 'openrouter' },
    { id: 'cline-otomode', object: 'model', owned_by: 'cline' },
    { id: 'orcarouter-otomode', object: 'model', owned_by: 'orcarouter' },
    { id: 'gemini-otomode', object: 'model', owned_by: 'google' },
    { id: 'gemini-3.8-flash', object: 'model', owned_by: 'google' },
    { id: 'gemini-2.5-pro', object: 'model', owned_by: 'google' },
    { id: 'gemini-3-flash-preview', object: 'model', owned_by: 'google' },
    { id: 'ngrok-gemini-flash', object: 'model', owned_by: 'canvas-bridge' },
    { id: 'ngrok-gemini-pro', object: 'model', owned_by: 'canvas-bridge' },
  ];

  for (const cp of config.customProviders) {
    if (cp.activeModel) {
      models.push({ id: cp.activeModel, object: 'model', owned_by: cp.name });
    }
  }

  return res.json({
    object: 'list',
    data: models,
  });
}

export async function handleChatCompletions(req: Request, res: Response) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (!validateAdminAuth(req)) {
    return res.status(401).json({
      error: { message: 'Unauthorized: PROXY_ADMIN_TOKEN required', type: 'authentication_error' },
    });
  }

  const { model, messages = [], stream = false, temperature, max_tokens } = req.body || {};
  const formattedMessages = messages.map((m: any) => ({
    role: m.role || 'user',
    content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
  }));

  const systemMessage = messages.find((m: any) => m.role === 'system')?.content;

  if (stream) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    const completionId = 'chatcmpl-' + Math.random().toString(36).substring(2, 11);
    const created = Math.floor(Date.now() / 1000);

    try {
      await providerManager.streamResponse(
        {
          model,
          messages: formattedMessages,
          systemPrompt: systemMessage,
          temperature,
          maxTokens: max_tokens,
        },
        (chunk: string) => {
          const sseData = {
            id: completionId,
            object: 'chat.completion.chunk',
            created,
            model: model || 'gemini-2.5-flash',
            choices: [
              {
                index: 0,
                delta: { content: chunk },
                finish_reason: null,
              },
            ],
          };
          res.write(`data: ${JSON.stringify(sseData)}\n\n`);
        }
      );

      const finalData = {
        id: completionId,
        object: 'chat.completion.chunk',
        created,
        model: model || 'gemini-2.5-flash',
        choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
      };
      res.write(`data: ${JSON.stringify(finalData)}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
    } catch (err: any) {
      console.error('[OpenAIHandler] Stream error:', err);
      res.write(`data: ${JSON.stringify({ error: { message: err.message } })}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
    }
  } else {
    // Non-streaming
    let accumulated = '';
    try {
      const result = await providerManager.streamResponse(
        {
          model,
          messages: formattedMessages,
          systemPrompt: systemMessage,
          temperature,
          maxTokens: max_tokens,
        },
        (chunk: string) => {
          accumulated += chunk;
        }
      );

      return res.json({
        id: 'chatcmpl-' + Math.random().toString(36).substring(2, 11),
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: result.modelUsed,
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content: accumulated },
            finish_reason: 'stop',
          },
        ],
      });
    } catch (err: any) {
      return res.status(500).json({
        error: { message: err.message, type: 'api_error' },
      });
    }
  }
}
