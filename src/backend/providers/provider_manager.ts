import { configManager } from '../config/index.js';
import { healthManager } from '../resilience/health.js';
import { circuitBreakers } from '../resilience/circuit_breaker.js';
import { contextSanitizer } from '../translators/sanitizer.js';
import { geminiProvider, type ChatMessage } from './gemini_provider.js';
import { customProviderService } from './custom_provider.js';
import { canvasBridge } from './canvas_bridge.js';
import { runProviderOtomode, type OtomodeType } from './otomode.js';

export interface StreamGenerationOptions {
  model?: string;
  messages: ChatMessage[];
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  tools?: any[];
  onToolCall?: (call: { id: string; name: string; arguments: string }) => void;
}

export class ProviderManager {
  /**
   * Main dispatch that loops through priority tiers and executes fallback.
   */
  public async streamResponse(
    options: StreamGenerationOptions,
    onChunk: (chunk: string) => void
  ): Promise<{ text: string; providerUsed: string; modelUsed: string }> {
    const config = configManager.getConfig();
    const startTime = Date.now();

    // Sanitize messages and system prompt to strip telemetry and bloat
    options.messages = contextSanitizer.sanitizeMessages(options.messages);
    options.systemPrompt = contextSanitizer.sanitizeSystemPrompt(options.systemPrompt);

    let requestedModel = options.model || config.activeDefaultModel || 'gemini-flash-latest';

    // Normalize auto aliases: "auto" -> "global-automode"
    const isAutomode = requestedModel === 'global-automode' || requestedModel === 'auto';
    if (requestedModel === 'auto') {
      requestedModel = 'global-automode';
    }

    // 1. Direct *-otomode handling (kilo-otomode, openrouter-otomode, cline-otomode, orcarouter-otomode, gemini-otomode)
    if (requestedModel.endsWith('-otomode')) {
      const prefix = requestedModel.replace('-otomode', '').toLowerCase();
      if (['kilo', 'openrouter', 'cline', 'orcarouter', 'gemini'].includes(prefix)) {
        try {
          const otoResult = await runProviderOtomode(prefix as OtomodeType, options, onChunk);
          healthManager.recordMetric({
            timestamp: Date.now(),
            provider: otoResult.providerUsed,
            model: otoResult.modelUsed,
            durationMs: Date.now() - startTime,
            status: 'success',
            bytesSent: otoResult.text.length,
          });
          return otoResult;
        } catch (otoErr: any) {
          console.warn(`[ProviderManager] ${requestedModel} rotation failed (${otoErr.message}). Falling back to priority waterfall...`);
        }
      }
    }

    // 2. Special case: if requested model starts with "ngrok-gemini-" or "canvas-", route to Canvas bridge if worker active
    if (requestedModel.startsWith('ngrok-gemini-') || requestedModel.startsWith('canvas-')) {
      const bridgeStatus = canvasBridge.getBridgeStatus();
      if (bridgeStatus.isWorkerActive) {
        try {
          const text = await this.executeCanvasBridge(options, requestedModel, onChunk);
          healthManager.recordMetric({
            timestamp: Date.now(),
            provider: 'canvas-bridge',
            model: requestedModel,
            durationMs: Date.now() - startTime,
            status: 'success',
            bytesSent: text.length,
          });
          return { text, providerUsed: 'canvas-bridge', modelUsed: requestedModel };
        } catch (err: any) {
          console.warn(`[ProviderManager] Canvas bridge execution failed or timed out (${err.message}). Falling back to Gemini Provider...`);
        }
      } else {
        console.warn(`[ProviderManager] No active Canvas worker connected for '${requestedModel}'. Auto-routing to Gemini Provider fallback...`);
      }

      // Auto-fallback to Gemini Provider for canvas models when worker is offline or failed
      if (geminiProvider.isAvailable()) {
        try {
          const fallbackModel = requestedModel.includes('pro') ? 'gemini-4-argon' : 'gemini-flash-latest';
          const text = await geminiProvider.streamGenerate(
            options.messages,
            options.systemPrompt,
            fallbackModel,
            onChunk
          );
          healthManager.recordMetric({
            timestamp: Date.now(),
            provider: 'gemini',
            model: fallbackModel,
            durationMs: Date.now() - startTime,
            status: 'success',
            bytesSent: text.length,
          });
          return { text, providerUsed: 'gemini (canvas-fallback)', modelUsed: fallbackModel };
        } catch (gemErr: any) {
          console.warn(`[ProviderManager] Canvas fallback to Gemini Provider failed: ${gemErr.message}. Proceeding to priority waterfall...`);
        }
      }
    }

    // 3. Special case: if user explicitly selected a Gemini model (and NOT in global-automode)
    if (!isAutomode && requestedModel.toLowerCase().startsWith('gemini-') && geminiProvider.isAvailable()) {
      try {
        const text = await geminiProvider.streamGenerate(
          options.messages,
          options.systemPrompt,
          requestedModel,
          onChunk
        );
        healthManager.recordMetric({
          timestamp: Date.now(),
          provider: 'gemini',
          model: requestedModel,
          durationMs: Date.now() - startTime,
          status: 'success',
          bytesSent: text.length,
        });
        return { text, providerUsed: 'gemini', modelUsed: requestedModel };
      } catch (geminiErr: any) {
        console.warn(`[ProviderManager] Direct Gemini request failed (${geminiErr.message}). Falling back to priority waterfall...`);
      }
    }

    // 4. Special case: if requested model matches an enabled custom provider
    if (!isAutomode) {
      const matchingCustom = config.customProviders.find(
        (cp) => cp.enabled && (cp.activeModel === requestedModel || cp.defaultModel === requestedModel || cp.modelMapping?.[requestedModel])
      );
      if (matchingCustom && !requestedModel.toLowerCase().includes('gemini')) {
        try {
          const text = await customProviderService.executeWithFailover(
            matchingCustom,
            options.messages,
            requestedModel,
            onChunk
          );
          healthManager.recordMetric({
            timestamp: Date.now(),
            provider: `custom:${matchingCustom.name}`,
            model: matchingCustom.activeModel || requestedModel,
            durationMs: Date.now() - startTime,
            status: 'success',
            bytesSent: text.length,
          });
          return {
            text,
            providerUsed: `custom:${matchingCustom.name}`,
            modelUsed: matchingCustom.activeModel || requestedModel,
          };
        } catch (custErr: any) {
          console.warn(`[ProviderManager] Matching custom provider ${matchingCustom.name} failed:`, custErr.message);
        }
      }
    }

    // 5. Full 7-Tier Waterfall: kilo -> cline -> openrouter -> orcarouter -> gemini -> custom -> canvas
    const priorityTiers = config.providerPriorityOrder;
    let lastError: Error = new Error('No providers available in priority list');

    for (const tier of priorityTiers) {
      const tierClean = tier.toLowerCase().trim();
      const breaker = circuitBreakers.getBreaker(tierClean);

      if (!breaker.canExecute()) {
        console.warn(`[ProviderManager] Circuit breaker for tier '${tierClean}' is OPEN. Skipping.`);
        continue;
      }

      const tierStartTime = Date.now();

      try {
        // HTTP/Otomode tiers: kilo, openrouter, cline, orcarouter
        if (['kilo', 'openrouter', 'cline', 'orcarouter'].includes(tierClean)) {
          const hasKey = Boolean(
            (config as any)[`${tierClean}ApiKey`] ||
            ((config as any)[`${tierClean}ApiKeys`]?.length > 0) ||
            ((config as any).providers?.[tierClean]?.apiKey)
          );
          const isUpstreamFreeModel =
            requestedModel.includes('/') ||
            requestedModel.includes(':free') ||
            requestedModel.startsWith('kilo-') ||
            requestedModel.startsWith('openrouter-');
          const isKiloZeroKey = tierClean === 'kilo';

          const shouldRunOto =
            isAutomode ||
            isUpstreamFreeModel ||
            hasKey ||
            isKiloZeroKey ||
            requestedModel === `${tierClean}-otomode` ||
            requestedModel.startsWith(`${tierClean}/`);

          if (shouldRunOto) {
            try {
              const otoRes = await runProviderOtomode(
                tierClean as OtomodeType,
                { ...options, targetModel: isAutomode ? undefined : requestedModel },
                onChunk
              );
              breaker.recordSuccess();
              healthManager.recordMetric({
                timestamp: Date.now(),
                provider: `${tierClean}-tier`,
                model: otoRes.modelUsed,
                durationMs: Date.now() - tierStartTime,
                status: 'success',
                bytesSent: otoRes.text.length,
              });
              return {
                text: otoRes.text,
                providerUsed: otoRes.providerUsed,
                modelUsed: otoRes.modelUsed,
              };
            } catch (otoErr: any) {
              breaker.recordFailure(otoErr);
              console.warn(`[ProviderManager] Tier '${tierClean}' failed: ${otoErr.message}. Trying next tier...`);
              lastError = otoErr;
            }
          }
        } else if (tierClean === 'gemini') {
          if (geminiProvider.isAvailable()) {
            const isGeminiFamily =
              requestedModel.toLowerCase().startsWith('gemini-') ||
              requestedModel.toLowerCase().startsWith('google/');
            const geminiModel = isAutomode || !isGeminiFamily
              ? (requestedModel.includes('reason') || requestedModel.includes('r1') ? 'gemini-4-argon' : 'gemini-flash-latest')
              : requestedModel;

            const text = await geminiProvider.streamGenerate(
              options.messages,
              options.systemPrompt,
              geminiModel,
              onChunk
            );
            breaker.recordSuccess();
            healthManager.recordMetric({
              timestamp: Date.now(),
              provider: 'gemini',
              model: geminiModel,
              durationMs: Date.now() - tierStartTime,
              status: 'success',
              bytesSent: text.length,
            });
            return { text, providerUsed: 'gemini', modelUsed: geminiModel };
          }
        } else if (tierClean === 'custom') {
          const enabledCustoms = config.customProviders.filter((p) => p.enabled);
          for (const customProvider of enabledCustoms) {
            try {
              const targetModel = isAutomode ? (customProvider.activeModel || 'gemini-flash-latest') : requestedModel;
              const text = await customProviderService.executeWithFailover(
                customProvider,
                options.messages,
                targetModel,
                onChunk
              );
              breaker.recordSuccess();
              healthManager.recordMetric({
                timestamp: Date.now(),
                provider: `custom:${customProvider.name}`,
                model: customProvider.activeModel || targetModel,
                durationMs: Date.now() - tierStartTime,
                status: 'success',
                bytesSent: text.length,
              });
              return {
                text,
                providerUsed: `custom:${customProvider.name}`,
                modelUsed: customProvider.activeModel || targetModel,
              };
            } catch (custErr: any) {
              console.warn(`[ProviderManager] Custom provider ${customProvider.name} failed:`, custErr.message);
              lastError = custErr;
            }
          }
        } else if (tierClean === 'canvas') {
          const bridgeStatus = canvasBridge.getBridgeStatus();
          if (bridgeStatus.isWorkerActive) {
            const canvasModel = isAutomode ? 'canvas-gemini-flash' : requestedModel;
            const text = await this.executeCanvasBridge(options, canvasModel, onChunk);
            breaker.recordSuccess();
            healthManager.recordMetric({
              timestamp: Date.now(),
              provider: 'canvas-bridge',
              model: canvasModel,
              durationMs: Date.now() - tierStartTime,
              status: 'success',
              bytesSent: text.length,
            });
            return { text, providerUsed: 'canvas-bridge', modelUsed: canvasModel };
          }
        }
      } catch (err: any) {
        lastError = err;
        breaker.recordFailure(err);
        healthManager.recordMetric({
          timestamp: Date.now(),
          provider: tierClean,
          model: requestedModel,
          durationMs: Date.now() - tierStartTime,
          status: 'error',
          errorMessage: err.message,
          bytesSent: 0,
        });
        console.warn(`[ProviderManager] Tier '${tierClean}' failed with error: ${err.message}. Trying next tier...`);
      }
    }

    // If all configured tiers failed, stream helpful diagnostic setup guide
    const diagnosticMessage = `[KiroProxy Cloud Gateway Ready]\n` +
      `Your Kiro IDE is successfully connected to the Cloud Gateway on Google AI Studio / Cloud Run!\n` +
      `Native Cloud HTTPS ingress is active (no local ngrok daemon required).\n\n` +
      `To generate responses, please configure at least one active provider tier in the Web GUI:\n` +
      `1. Kilo Gateway: Tier 'kilo' rotates across 177+ free models (Zero-Key mode enabled)\n` +
      `2. Gemini API: Add GEMINI_API_KEY in AI Studio Secrets / .env (Tier 'gemini')\n` +
      `3. Custom Upstream: In Web GUI -> 'Priority Tiers & Failover' -> add OpenRouter or OpenAI (Tier 'custom')\n` +
      `4. Canvas Bridge: In Web GUI -> 'Gemini Canvas Bridge' -> connect worker script on gemini.google.com (Tier 'canvas')\n\n` +
      `Reason: ${lastError.message}`;

    onChunk(diagnosticMessage);
    return {
      text: diagnosticMessage,
      providerUsed: 'gateway-diagnostic',
      modelUsed: requestedModel,
    };
  }

  private async executeCanvasBridge(
    options: StreamGenerationOptions,
    model: string,
    onChunk: (chunk: string) => void
  ): Promise<string> {
    const userPrompt = options.messages
      .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
      .join('\n\n');

    const taskHandle = canvasBridge.enqueueTask({
      model,
      prompt: userPrompt,
      systemPrompt: options.systemPrompt,
    });

    taskHandle.onChunk(onChunk);
    return taskHandle.promise;
  }
}

export const providerManager = new ProviderManager();
