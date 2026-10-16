import express, { type Request, type Response } from 'express';
import path from 'node:path';
import fs from 'node:fs';
import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';

dotenv.config();

import { configManager } from './src/backend/config/index.js';
import { healthManager } from './src/backend/resilience/health.js';
import { circuitBreakers } from './src/backend/resilience/circuit_breaker.js';
import { installGlobalAutomodeInterceptor } from './src/backend/resilience/global_automode_interceptor.js';

installGlobalAutomodeInterceptor();
import { handleGenerateAssistantResponse, validateAdminAuth } from './src/backend/handlers/bedrock_handler.js';
import { handleChatCompletions, handleModels, whgwListModels } from './src/backend/handlers/openai_handler.js';
import { handleAnthropicMessages } from './src/backend/handlers/anthropic_handler.js';
import { handlePoll, handleChunk, handleDone, handleCanvasStatus, setCorsHeaders } from './src/backend/handlers/canvas_handler.js';
import { providerManager } from './src/backend/providers/provider_manager.js';
import { ngrokService } from './src/backend/resilience/ngrok_service.js';

import { syncFreeModelsFromProviders } from './src/backend/config/catalog.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  app.set('trust proxy', true);

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

  // 2b. Universal AWS Catch-All for Kiro IDE auxiliary background requests
  // Absorbs background telemetry (POST /), requirements MCP streams (POST /mcp/stream),
  // events (POST /events), and telemetry calls, returning HTTP 200 OK.
  // Prevents Kiro IDE client unmarshaller (IUu) crashes on HTTP 405/404.
  const handleAwsCatchAll = (req: Request, res: Response) => {
    const reqId = (req.headers['x-amzn-requestid'] as string) || `req_${Date.now()}`;

    // If request asks for EventStream or is /mcp/stream
    if (req.path.endsWith('/mcp/stream') || req.headers.accept?.includes('application/vnd.amazon.eventstream')) {
      res.writeHead(200, {
        'Content-Type': 'application/vnd.amazon.eventstream',
        'x-amzn-requestid': reqId,
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
      });
      res.end();
      return;
    }

    // Standard AWS Smithy Success response for telemetry, events, and root calls
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'x-amzn-requestid': reqId,
      'Access-Control-Allow-Origin': '*',
    });
    res.end(JSON.stringify({
      __type: 'com.amazon.kiro.runtimeservice#Success',
      status: 'ok',
    }));
  };

  app.post(['/', '/k/:token/'], handleAwsCatchAll);
  app.post(['/mcp/stream', '/k/:token/mcp/stream'], handleAwsCatchAll);
  app.post(['/events', '/k/:token/events'], handleAwsCatchAll);
  app.post(['/telemetry', '/k/:token/telemetry'], handleAwsCatchAll);
  app.post(['/activity/publish', '/k/:token/activity/publish'], handleAwsCatchAll);

  // 3. Model Discovery Endpoints (Smithy /listAvailableModels & OpenAI /v1/models)
  app.get(['/listAvailableModels', '/k/:token/listAvailableModels'], whgwListModels);
  app.get(['/v1/models', '/k/:token/v1/models'], whgwListModels);
  app.post('/v1/chat/completions', handleChatCompletions);
  app.post('/k/:token/v1/chat/completions', handleChatCompletions);

  // 3b. Anthropic Messages API (Claude Code CLI, Cursor, Continue, Anthropic SDKs)
  app.post(['/v1/messages', '/messages'], handleAnthropicMessages);
  app.post(['/k/:token/v1/messages', '/k/:token/messages'], handleAnthropicMessages);

  // Live model catalog refresh across all providers
  app.post(['/api/models/refresh', '/api/models/sync'], async (_req: Request, res: Response) => {
    try {
      const result = await syncFreeModelsFromProviders();
      res.json({
        success: true,
        message: `Synced ${result.count} live free models from providers. Total catalog: ${result.total} models.`,
        data: result,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 4. Gemini Canvas Sandboxed Reverse-Polling Bridge
  app.get('/poll', handlePoll);
  app.post('/chunk', handleChunk);
  app.post('/done', handleDone);
  app.get('/api/canvas/status', handleCanvasStatus);

  // Operations & Resilience APIs
  app.post('/api/circuit/reset', (_req: Request, res: Response) => {
    circuitBreakers.resetAll();
    res.json({ success: true, message: 'All circuit breakers reset to CLOSED' });
  });

  app.post('/api/health/refresh', (_req: Request, res: Response) => {
    res.json({ success: true, message: 'Health telemetry refreshed' });
  });

  app.get('/metrics', (req: Request, res: Response) => {
    res.json(healthManager.getStatusData(req.get('host'), req.protocol));
  });

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
    // Background auto-population of models with newly added provider keys/endpoints
    syncFreeModelsFromProviders().catch(() => {});
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

  // 7b. Universal Fallback AWS / Kiro Catch-All for any auxiliary POST requests
  app.post('*', (req: Request, res: Response) => {
    handleAwsCatchAll(req, res);
  });

  // 8. Serve Frontend (dist in production/if exists, Vite middleware in dev)
  const distPath = path.resolve(__dirname, 'dist');
  const distExists = fs.existsSync(distPath) && fs.existsSync(path.resolve(distPath, 'index.html'));

  if (distExists) {
    app.use(
      express.static(distPath, {
        maxAge: '1h',
        setHeaders: (res, filePath) => {
          if (filePath.includes('/assets/')) {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          }
        },
      })
    );
    app.get('*', (_req: Request, res: Response) => {
      res.setHeader('Cache-Control', 'no-cache');
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

  const server = app.listen(PORT, HOST, async () => {
    // Initialize ngrok tunnel if token is configured
    const ngrokUrl = await ngrokService.startTunnel();
    const detectedUrl = ngrokUrl || healthManager.getTunnelUrl();
    console.log(`=======================================================`);
    console.log(`🚀 KiroProxy Cloud Gateway is live!`);
    console.log(`📡 Listening on: http://${HOST}:${PORT}`);
    console.log(`🌐 Public Endpoint: ${detectedUrl || `http://${HOST}:${PORT}`}`);
    console.log(`⚡ AWS Bedrock: POST ${detectedUrl || `http://${HOST}:${PORT}`}/generateAssistantResponse`);
    console.log(`🔌 OpenAI /v1:  POST ${detectedUrl || `http://${HOST}:${PORT}`}/v1/chat/completions`);
    console.log(`🖼️ Canvas Poll:  GET  ${detectedUrl || `http://${HOST}:${PORT}`}/poll`);
    if (ngrokUrl) {
      console.log(`🔒 Ngrok Tunnel: ${ngrokUrl}`);
    }
    console.log(`=======================================================`);
  });

  // Optimize HTTP keep-alive for Cloud Run & reverse proxies (prevents TCP teardown overhead)
  server.keepAliveTimeout = 65000;
  server.headersTimeout = 66000;

  // Graceful shutdown handling for Cloud Run & container orchestration
  const shutdown = (signal: string) => {
    console.log(`[Server] Received ${signal}. Draining active connections...`);
    server.close(async () => {
      console.log('[Server] HTTP server closed gracefully.');
      await ngrokService.stopTunnel();
      process.exit(0);
    });

    // Hard exit timeout after 10s if connections refuse to drain
    setTimeout(() => {
      console.warn('[Server] Forcing shutdown after drain timeout.');
      process.exit(0);
    }, 10000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

startServer().catch((err) => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});
