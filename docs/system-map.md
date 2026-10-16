# System Map & Architecture Guide

> **SYSTEM ARCHITECTURE SPECIFICATION:**
> Comprehensive topology of `kiroproxy-gateway-cloud` v2.8.0-cloud detailing entry points, routing layers, resilient provider waterfall, and client integrations.

---

## 1. High-Level Topology

```text
[Kiro IDE Desktop Extension]
       │
       │ (AWS Bedrock EventStream: /generateAssistantResponse)
       ▼
[Cloud Run / AI Studio Ingress] (HTTPS native, 0.0.0.0:3000)
       │
       ▼
[Express Server: server.ts]
  ├── Middlewares: JSON/Raw Buffer (15mb), CORS, Diagnostics
  ├── Handlers:
  │    ├── bedrock_handler.ts  ── AWS EventStream CRC32 binary framer
  │    ├── openai_handler.ts   ── /v1/chat/completions, /v1/models, /listAvailableModels
  │    ├── canvas_handler.ts   ── /poll, /chunk, /done (Canvas reverse polling bridge)
  │    └── config/health APIs  ── /api/config, /health, /status, /metrics
  ▼
[Provider Manager & Resilience Engine]
  ├── circuit_breaker.ts      ── Health tracking & automated circuit tripping per tier
  ├── retry_engine.ts         ── Exponential backoff & jitter
  └── 7-Tier Zero-Cost Waterfall:
       1. Kilo Gateway (api.kilo.ai / openrouter.ai)
       2. Cline Gateway (api.cline.bot / openrouter.ai)
       3. OpenRouter Free Tier (openrouter.ai/api/v1)
       4. OrcaRouter Free Tier (api.orcarouter.com / openrouter.ai)
       5. Direct Gemini API (@google/genai SDK with multi-key rotation)
       6. Custom Providers (Multi-base URLs & multi-API key rotation)
       7. Canvas Bridge (Browser-based worker tab reverse-polling)
```

---

## 2. Directory & Module Breakdown

### Root Files
* `server.ts`: Application bootstrap, Express routing, HTTP keep-alive optimization (65s), graceful shutdown signals (`SIGTERM`, `SIGINT`), Vite middleware integration.
* `package.json`: Module dependencies and operational scripts (`dev`, `build`, `start`, `lint`).
* `Dockerfile`: Production multi-stage Alpine container definition for Cloud Run deployment.
* `metadata.json`: AI Studio runtime capability declarations (`MAJOR_CAPABILITY_SERVER_SIDE_GEMINI_API`).

### `src/backend/`
* **`handlers/`**:
  - `bedrock_handler.ts`: Decodes incoming Kiro IDE ConversationState, messages, and raw prompts; coordinates streaming generation; returns binary EventStream frames.
  - `eventstream.ts`: IEEE 802.3 CRC32-framed AWS binary protocol encoder (`encodeChunkEvent`, `encodeHeaderValue`).
  - `openai_handler.ts`: OpenAI-compatible endpoint handlers for external IDEs, cURL, and `/v1/models` discovery.
  - `canvas_handler.ts`: Coordinates browser worker polling for Gemini Canvas bridge.
* **`providers/`**:
  - `provider_manager.ts`: Core orchestrator managing the 7-tier zero-cost waterfall, circuit breaker guards, and metrics.
  - `otomode.ts`: Intra-provider model cycling and key rotation engine with fast-failover for specific target models.
  - `gemini_provider.ts`: Google Gemini client utilizing `@google/genai` with multi-key rotation and token tracking.
  - `custom_provider.ts`: Multi-base URL and multi-API key router for OpenAI-compatible custom backends.
  - `canvas_bridge.ts`: In-memory FIFO task queue for reverse-polling canvas browser workers.
* **`resilience/`**:
  - `circuit_breaker.ts`: Provider-specific failure threshold tracking and half-open reset logic.
  - `health.ts`: System uptime, active provider counts, token counters, and telemetry metrics.
* **`translators/`**:
  - `tool_extractor.ts`: Multi-format tool extraction engine supporting 13+ LLM formats (Format 1b bare JSON, Format 6b XML tags, Kiro native tool_call, Anthropic tool_use, parameter tags, and code manifest auto-extraction), with tool alias normalization and argument repair.
  - `tool_translator.ts`: Formats tools for OpenAI/Gemini schemas and generates binary EventStream tool use frames.
  - `sanitizer.ts`: Context and system prompt sanitizer stripping telemetry signatures, and unescaped backslash normalizer (`sanitizeJsonBackslashes`).
  - `smithy_parser.ts`: Decodes AWS Bedrock / Smithy conversationState JSON into normalized chat turns.
* **`config/`**:
  - `index.ts`: Thread-safe configuration manager with `/tmp/kiro_ai_config.json` write fallback for Cloud Run.
  - `catalog.ts`: Comprehensive catalog of 80+ zero-cost free models with live provider synchronization and in-memory caching.

### `src/frontend/`
* `App.tsx`: Main application shell with tab switching, navigation, and configuration hydration.
* `components/`:
  - `Navbar.tsx`: Top status bar displaying active public URL, admin token status, and health indicators.
  - `OverviewTab.tsx`: Quick diagnostics, provider health badges, and direct status toggles.
  - `ModelsTab.tsx`: Dynamic zero-cost model catalog with live provider sync and integrated `FreeTierCalculator`.
  - `FreeTierCalculator.tsx`: Interactive free AI budget and cumulative quota calculation matrix.
  - `ProvidersTab.tsx`: Priority tier drag-and-drop ordering and custom provider configuration.
  - `ApiKeysTab.tsx`: Provider API key manager with multi-key list support.
  - `CanvasBridgeTab.tsx`: Interactive simulator and status monitor for Gemini Canvas reverse-worker.
  - `TesterTab.tsx`: Real-time streaming sandbox playground for verifying prompt generation.
  - `PatcherTab.tsx`: Automated installer and instructions for patching Kiro IDE desktop extension.
  - `BackupTab.tsx`: Configuration backup, JSON import/export, and `.env` exporter.
  - `SecurityModal.tsx`: Admin token verification and credential locker modal.

---

## 3. Data & Communication Flow

1. **Model Discovery**: Kiro IDE queries `GET /listAvailableModels` or `GET /v1/models`. The response is served in sub-millisecond time from `catalog.ts` in-memory cache with HTTP 304 / `Cache-Control` stale-while-revalidate headers.
2. **Generation Request**: Kiro IDE transmits `POST /generateAssistantResponse` with conversation JSON or raw text.
3. **Waterfall Traversal**: `providerManager` executes requests across the 7 tiers. Circuit breakers bypass degraded providers.
4. **Binary Wire Framing**: Chunks are immediately transformed into IEEE 802.3 CRC32 binary frames by `eventstream.ts` and flushed over HTTP chunked transfer encoding.
