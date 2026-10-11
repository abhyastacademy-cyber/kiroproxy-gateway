import express, { type Request, type Response } from 'express';
import path from 'node:path';
import fs from 'node:fs';
import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';

dotenv.config();

import { configManager } from './src/backend/config/index.js';
import { healthManager } from './src/backend/resilience/health.js';
import { handleGenerateAssistantResponse, validateAdminAuth } from './src/backend/handlers/bedrock_handler.js';
import { handleChatCompletions, handleModels } from './src/backend/handlers/openai_handler.js';
import { handlePoll, handleChunk, handleDone, handleCanvasStatus, setCorsHeaders } from './src/backend/handlers/canvas_handler.js';
import { providerManager } from './src/backend/providers/provider_manager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();

  // Basic middleware
  app.use(express.json({ limit: '15mb' }));
  app.use(express.urlencoded({ extended: true, limit: '15mb' }));
  app.use(express.raw({ type: ['application/octet-stream', 'application/vnd.amazon.eventstream'], limit: '15mb' }));

  // Global CORS and diagnostics headers
  app.use((req, res, next) => {
    setCorsHeaders(req, res);
    if (req.method === 'OPTIONS') {
      return res.status(204).end();
    }
    next();
  });

  // 1. Health & Status endpoints
  app.get(['/health', '/api/health'], (req: Request, res: Response) => {
    const data = healthManager.getHealthData(req.get('host'), req.protocol);
    res.json(data);
  });

  app.get(['/status', '/api/status'], (req: Request, res: Response) => {
    const data = healthManager.getStatusData(req.get('host'), req.protocol);
    res.json(data);
  });

  // 2. AWS Bedrock EventStream Endpoints for Kiro IDE
  app.post('/generateAssistantResponse', handleGenerateAssistantResponse);
  app.post('/k/:token/generateAssistantResponse', handleGenerateAssistantResponse);

  // 3. Model Discovery Endpoints (Smithy /listAvailableModels & OpenAI /v1/models)
  app.get(['/listAvailableModels', '/k/:token/listAvailableModels'], (req: Request, res: Response) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    const cfg = configManager.getConfig();
    const models = [
      {
        modelId: 'global-automode',
        modelName: 'Global Automode (6-Tier Waterfall)',
        description: 'Auto-rotates across kilo -> cline -> openrouter -> orcarouter -> gemini -> custom',
        rateMultiplier: 0,
        rateUnit: 'credit',
        supportedInputTypes: ['TEXT', 'IMAGE'],
        tokenLimits: { maxInputTokens: 128000, maxOutputTokens: 16384 },
        pricing: { prompt: '0', completion: '0', unit: 'credit' },
      },
      {
        modelId: 'auto',
        modelName: 'Kiro Default Auto (Waterfall)',
        description: 'Direct fallback through full 6-tier cross-provider waterfall',
        rateMultiplier: 0,
        rateUnit: 'credit',
        supportedInputTypes: ['TEXT', 'IMAGE'],
        tokenLimits: { maxInputTokens: 128000, maxOutputTokens: 16384 },
        pricing: { prompt: '0', completion: '0', unit: 'credit' },
      },
      {
        modelId: 'kilo-otomode',
        modelName: 'Kilo Otomode (Zero-Key Free Rotation)',
        description: 'Rotates across 177+ free models on Kilo Gateway',
        rateMultiplier: 0,
        rateUnit: 'credit',
        supportedInputTypes: ['TEXT', 'IMAGE'],
        tokenLimits: { maxInputTokens: 128000, maxOutputTokens: 16384 },
        pricing: { prompt: '0', completion: '0', unit: 'credit' },
      },
      {
        modelId: 'openrouter-otomode',
        modelName: 'OpenRouter Otomode (Free Model Rotation)',
        description: 'Rotates through OpenRouter free tier models and API keys',
        rateMultiplier: 0,
        rateUnit: 'credit',
        supportedInputTypes: ['TEXT', 'IMAGE'],
        tokenLimits: { maxInputTokens: 128000, maxOutputTokens: 16384 },
        pricing: { prompt: '0', completion: '0', unit: 'credit' },
      },
      {
        modelId: 'cline-otomode',
        modelName: 'Cline Otomode (Intra-Provider Rotation)',
        description: 'Rotates through Cline free models and keys',
        rateMultiplier: 0,
        rateUnit: 'credit',
        supportedInputTypes: ['TEXT', 'IMAGE'],
        tokenLimits: { maxInputTokens: 128000, maxOutputTokens: 16384 },
        pricing: { prompt: '0', completion: '0', unit: 'credit' },
      },
      {
        modelId: 'orcarouter-otomode',
        modelName: 'OrcaRouter Otomode (Free Model Rotation)',
        description: 'Rotates through OrcaRouter models',
        rateMultiplier: 0,
        rateUnit: 'credit',
        supportedInputTypes: ['TEXT', 'IMAGE'],
        tokenLimits: { maxInputTokens: 128000, maxOutputTokens: 16384 },
        pricing: { prompt: '0', completion: '0', unit: 'credit' },
      },
      {
        modelId: 'gemini-otomode',
        modelName: 'Gemini Otomode (Multi-Model & Key Rotation)',
        description: 'Rotates across Gemini 3.8/2.5/2.0 models and API keys',
        rateMultiplier: 0,
        rateUnit: 'credit',
        supportedInputTypes: ['TEXT', 'IMAGE'],
        tokenLimits: { maxInputTokens: 128000, maxOutputTokens: 16384 },
        pricing: { prompt: '0', completion: '0', unit: 'credit' },
      },
      {
        modelId: 'gemini-3.8-flash',
        modelName: 'Google Gemini 3.8 Flash',
        description: 'Cloud Gateway Active Primary Model',
        rateMultiplier: 0,
        rateUnit: 'credit',
        supportedInputTypes: ['TEXT', 'IMAGE'],
        tokenLimits: { maxInputTokens: 128000, maxOutputTokens: 16384 },
        pricing: { prompt: '0', completion: '0', unit: 'credit' },
      },
      {
        modelId: 'gemini-2.5-pro',
        modelName: 'Google Gemini 2.5 Pro (Deep Reasoning)',
        description: 'Cloud Gateway Advanced Model',
        rateMultiplier: 0,
        rateUnit: 'credit',
        supportedInputTypes: ['TEXT', 'IMAGE'],
        tokenLimits: { maxInputTokens: 128000, maxOutputTokens: 16384 },
        pricing: { prompt: '0', completion: '0', unit: 'credit' },
      },
      {
        modelId: 'canvas-gemini-flash',
        modelName: 'Gemini Canvas Cloud Bridge (Zero Cost)',
        description: 'Native Cloud HTTPS reverse-polling bridge model (no ngrok required)',
        rateMultiplier: 0,
        rateUnit: 'credit',
        supportedInputTypes: ['TEXT', 'IMAGE'],
        tokenLimits: { maxInputTokens: 128000, maxOutputTokens: 16384 },
        pricing: { prompt: '0', completion: '0', unit: 'credit' },
      },
      {
        modelId: 'ngrok-gemini-flash',
        modelName: 'Gemini Canvas Bridge (Legacy Alias)',
        description: 'Reverse-polling bridge model',
        rateMultiplier: 0,
        rateUnit: 'credit',
        supportedInputTypes: ['TEXT', 'IMAGE'],
        tokenLimits: { maxInputTokens: 128000, maxOutputTokens: 16384 },
        pricing: { prompt: '0', completion: '0', unit: 'credit' },
      },
    ];

    for (const cp of cfg.customProviders) {
      if (cp.enabled && cp.activeModel) {
        models.push({
          modelId: cp.activeModel,
          modelName: `${cp.name} (${cp.activeModel})`,
          description: cp.notes || 'Custom Provider Model',
          rateMultiplier: 0,
          rateUnit: 'credit',
          supportedInputTypes: ['TEXT', 'IMAGE'],
          tokenLimits: { maxInputTokens: 128000, maxOutputTokens: 16384 },
          pricing: { prompt: '0', completion: '0', unit: 'credit' },
        });
      }
    }

    res.json({
      models,
      defaultModel: {
        modelId: 'global-automode',
        modelName: 'Global Automode (6-Tier Waterfall)',
      },
    });
  });

  app.get('/v1/models', handleModels);
  app.get('/k/:token/v1/models', handleModels);
  app.post('/v1/chat/completions', handleChatCompletions);
  app.post('/k/:token/v1/chat/completions', handleChatCompletions);

  // 4. Gemini Canvas Sandboxed Reverse-Polling Bridge
  app.get('/poll', handlePoll);
  app.post('/chunk', handleChunk);
  app.post('/done', handleDone);
  app.get('/api/canvas/status', handleCanvasStatus);

  // 5. Config Management API
  app.get('/api/config', (req: Request, res: Response) => {
    // If admin token is set, require authentication
    if (!validateAdminAuth(req)) {
      return res.status(401).json({ error: 'Unauthorized: PROXY_ADMIN_TOKEN required' });
    }
    const cfg = configManager.getConfig();
    // Return sanitized config (mask sensitive api keys if needed)
    res.json({
      ...cfg,
      detectedPublicUrl: healthManager.getTunnelUrl(req.get('host'), req.protocol),
    });
  });

  app.post('/api/config', (req: Request, res: Response) => {
    if (!validateAdminAuth(req)) {
      return res.status(401).json({ error: 'Unauthorized: PROXY_ADMIN_TOKEN required' });
    }
    const updateResult = configManager.updateConfig(req.body);
    res.json({
      success: updateResult.success,
      configPath: updateResult.path,
      error: updateResult.error,
      config: configManager.getConfig(),
    });
  });

  app.get('/api/export-env', (req: Request, res: Response) => {
    if (!validateAdminAuth(req)) {
      return res.status(401).json({ error: 'Unauthorized: PROXY_ADMIN_TOKEN required' });
    }
    res.json({
      envContent: configManager.exportEnvVariables(),
    });
  });

  // 6. Direct script download for patch_kiro_extension.js
  app.get('/scripts/patch_kiro_extension.js', (req: Request, res: Response) => {
    const scriptPath = path.resolve(__dirname, 'scripts', 'patch_kiro_extension.js');
    if (fs.existsSync(scriptPath)) {
      res.setHeader('Content-Type', 'application/javascript');
      res.sendFile(scriptPath);
    } else {
      res.status(404).send('Patcher script not found');
    }
  });

  // 7. Interactive Playground Gateway Test Endpoint
  app.post('/api/test/generate', async (req: Request, res: Response) => {
    if (!validateAdminAuth(req)) {
      return res.status(401).json({ error: 'Unauthorized: PROXY_ADMIN_TOKEN required' });
    }

    const { prompt, model, systemPrompt } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: 'prompt is required' });
    }

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });

    try {
      const result = await providerManager.streamResponse(
        {
          model,
          messages: [{ role: 'user', content: prompt }],
          systemPrompt,
        },
        (chunk: string) => {
          res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
        }
      );

      res.write(`data: ${JSON.stringify({ done: true, provider: result.providerUsed, model: result.modelUsed })}\n\n`);
      res.end();
    } catch (err: any) {
      res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
      res.end();
    }
  });

  // 8. Serve Frontend (dist in production/if exists, Vite middleware in dev)
  const distPath = path.resolve(__dirname, 'dist');
  const distExists = fs.existsSync(distPath) && fs.existsSync(path.resolve(distPath, 'index.html'));

  if (distExists) {
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  } else {
    try {
      const { createServer: createViteServer } = await import('vite');
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
      });
      app.use(vite.middlewares);
    } catch (viteErr) {
      console.warn('[Server] dist/ does not exist and Vite cannot be loaded. Serving fallback API status.');
      app.get('*', (_req: Request, res: Response) => {
        res.setHeader('Content-Type', 'text/html');
        res.send('<!doctype html><html><body style="font-family:sans-serif;background:#09090b;color:#fafafa;padding:40px;"><h1>KiroProxy Cloud Gateway is live</h1><p>Frontend assets are not yet compiled. Connect Kiro IDE or call <a href="/health" style="color:#a1a1aa">/health</a>, <a href="/v1/models" style="color:#a1a1aa">/v1/models</a>, or <a href="/api/config" style="color:#a1a1aa">/api/config</a>.</p></body></html>');
      });
    }
  }

  // Bind to 0.0.0.0 and PORT
  const HOST = process.env.HOST || '0.0.0.0';
  const PORT = Number(process.env.PORT) || 3000;

  app.listen(PORT, HOST, () => {
    const detectedUrl = healthManager.getTunnelUrl();
    console.log(`=======================================================`);
    console.log(`🚀 KiroProxy Cloud Gateway is live!`);
    console.log(`📡 Listening on: http://${HOST}:${PORT}`);
    console.log(`🌐 Public Endpoint: ${detectedUrl || `http://${HOST}:${PORT}`}`);
    console.log(`⚡ AWS Bedrock: POST ${detectedUrl || `http://${HOST}:${PORT}`}/generateAssistantResponse`);
    console.log(`🔌 OpenAI /v1:  POST ${detectedUrl || `http://${HOST}:${PORT}`}/v1/chat/completions`);
    console.log(`🖼️ Canvas Poll:  GET  ${detectedUrl || `http://${HOST}:${PORT}`}/poll`);
    console.log(`=======================================================`);
  });
}

startServer().catch((err) => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});
