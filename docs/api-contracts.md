# API Contracts & Wire Protocol Specifications

> **COMPREHENSIVE HTTP SPECIFICATION:**
> Every inbound endpoint, security mechanism, payload structure, and client dependency is documented below.

---

## 1. Authentication Mechanisms

Authentication is handled by `validateAdminAuth()` in [`src/backend/handlers/bedrock_handler.ts:10-32`](file:///d:/sdlc_studio/projects/kiro-integration/tmp_cloud_audit/src/backend/handlers/bedrock_handler.ts#L10-L32).
* If `PROXY_ADMIN_TOKEN` is **empty/unset**, all endpoints are **publicly accessible** without authentication (FACT).
* If `PROXY_ADMIN_TOKEN` is **set**, callers must satisfy **any one** of the following 4 methods (FACT):
  1. **URL Path Parameter**: `/k/:token/<endpoint>` (e.g. `/k/mySecret/generateAssistantResponse`).
  2. **Query Parameter**: `?<endpoint>?token=mySecret`.
  3. **Authorization Header**: `Authorization: Bearer mySecret`.
  4. **Custom HTTP Header**: `x-admin-token: mySecret`.

---

## 2. Inbound Endpoint Specifications

### 1. `POST /generateAssistantResponse` (and `/k/:token/generateAssistantResponse`)
* **Consumer**: Kiro IDE desktop application (`extension.js`).
* **Auth**: `validateAdminAuth()`
* **Headers In**: `Content-Type: application/json` or `application/octet-stream`
* **Request Body Formats Supported (FACT)** ([`src/backend/handlers/bedrock_handler.ts:37-96`](file:///d:/sdlc_studio/projects/kiro-integration/tmp_cloud_audit/src/backend/handlers/bedrock_handler.ts#L37-L96)):
  1. **Kiro ConversationState**:
     ```json
     {
       "conversationState": {
         "systemPrompt": "You are Kiro assistant...",
         "history": [
           { "sender": "USER", "content": "hello" },
           { "sender": "ASSISTANT", "content": "hi" }
         ],
         "currentMessage": { "content": "write code" }
       },
       "modelId": "auto"
     }
     ```
  2. **Standard Bedrock Messages**: `{ "system": "...", "messages": [{ "role": "user", "content": "..." }] }`
  3. **Raw Prompt Fallback**: `{ "prompt": "..." }` or `{ "inputText": "..." }`
* **Response Headers**:
  - `Content-Type: application/vnd.amazon.eventstream`
  - `x-amzn-kiro-conversation-id: sess_<id>`
  - `x-amzn-kiro-profile-arn: arn:aws:kiro:us-east-1:123456789012:profile/default`
  - `x-amzn-requestid: req_<id>`
  - `x-amzn-session-id: sess_<id>`
  - `Cache-Control: no-cache, no-transform`
  - `Connection: keep-alive`
  - `X-Accel-Buffering: no`
* **Response Body**: Binary IEEE 802.3 CRC32-framed AWS EventStream stream conforming to Smithy protocol (`assistantResponseEvent`, `toolUseEvent`, `metadataEvent`). Payloads are direct UTF-8 JSON (`{"content":"..."}`) preventing Kiro IDE unmarshaller crashes ([`src/backend/handlers/eventstream.ts`](file:///d:/sdlc_studio/projects/kiro-integration/tmp_cloud_audit/src/backend/handlers/eventstream.ts)).

---

### 2. `GET /listAvailableModels` (and `/k/:token/listAvailableModels`)
* **Consumer**: Kiro IDE extension patch v5.1 (`whgwListModels`).
* **Auth**: Public or token-gated.
* **Auto-Populated Catalog**: Returns 100+ zero-cost free models auto-populated from Backend Auto-Auth AI (`backend-ai/auto`, `backend-ai/gemini-flash`, `backend-ai/gemini-argon`), Kilo, OpenRouter, Cline, OrcaRouter, Gemini, Canvas Bridge, and pre-loaded custom endpoints (Groq, Cerebras, Mistral, GitHub Models, SambaNova, Together AI, SiliconFlow, Pollinations).
* **Performance**: Sub-millisecond response time backed by an in-memory cache and `Cache-Control: public, max-age=5, stale-while-revalidate=30`.
* **Response Shape (Smithy Format)**:
  ```json
  {
    "models": [
      {
        "modelId": "global-automode",
        "modelName": "Global Automode (7-Tier Zero-Cost Waterfall)",
        "description": "Auto-rotates across kilo -> cline -> openrouter -> orcarouter -> gemini -> custom -> canvas with instant failover",
        "rateMultiplier": 0,
        "rateUnit": "credit",
        "supportedInputTypes": ["TEXT", "IMAGE"],
        "tokenLimits": { "maxInputTokens": 128000, "maxOutputTokens": 16384 },
        "pricing": { "prompt": "0", "completion": "0", "unit": "credit" },
        "capabilities": { "toolCalling": true, "codeGeneration": true, "reasoning": true, "multiModal": true }
      }
    ],
    "defaultModel": {
      "modelId": "global-automode",
      "modelName": "Global Automode (7-Tier Zero-Cost Waterfall)"
    }
  }
  ```

---

### 3. `GET /v1/models` (and `/k/:token/v1/models`)
* **Consumer**: OpenAI clients, cURL, Kiro IDE patch v5.1 secondary discovery fallback, Web GUI.
* **Auth**: Public or token-gated.
* **Response Shape (OpenAI Format)** ([`src/backend/handlers/openai_handler.ts`](file:///d:/sdlc_studio/projects/kiro-integration/tmp_cloud_audit/src/backend/handlers/openai_handler.ts)):
  ```json
  {
    "object": "list",
    "data": [
      { "id": "global-automode", "object": "model", "name": "Global Automode (7-Tier Zero-Cost Waterfall)", "description": "...", "owned_by": "gateway" },
      { "id": "deepseek/deepseek-r1:free", "object": "model", "name": "DeepSeek R1 Full Reasoning (Free Tier)", "description": "...", "owned_by": "deepseek" }
    ]
  }
  ```

---

### 3b. `POST /api/models/refresh` (and `/api/models/sync`)
* **Consumer**: Web GUI (`ModelsTab.tsx`) and automation scripts.
* **Function**: Triggers a live background sync to fetch newly released free tier models from OpenRouter public API, upstream providers, and any configured Custom Providers (`baseUrls` + `apiKeys`) with `autoPopulate !== false`.
* **Accumulated Free Limits**: Multiple providers offering the same zero-cost model (e.g. DeepSeek R1, Llama 3.3, Qwen 2.5) accumulate independent rate limits and daily quotas. On HTTP 429 quota exhaustion on any tier, the gateway automatically cascades requests across tiers without session drops.
* **Response Shape**:
  ```json
  {
    "success": true,
    "message": "Synced 17 live free models from providers. Total catalog: 80 models.",
    "data": { "count": 17, "total": 80 }
  }
  ```

---

### 4. `POST /v1/chat/completions` (and `/k/:token/v1/chat/completions`)
* **Consumer**: Standard OpenAI SDKs, external IDE extensions, curl scripts.
* **Auth**: `validateAdminAuth()`.
* **Request Body**: Standard OpenAI format (`{ model: string, messages: [], stream: boolean }`).
* **Response (Streaming)**: `text/event-stream` chunks (`data: {"choices":[{"delta":{"content":"..."}}]}\n\n`).
* **Response (Non-streaming)**: Standard OpenAI completion JSON response object.

---

### 4b. `POST /v1/messages` (and `/messages`, `/k/:token/v1/messages`)
* **Consumer**: **Claude Code CLI** (`@anthropic-ai/claude-code`), Cursor, Continue, Anthropic TypeScript/Python SDKs.
* **Auth**: `validateAdminAuth()`.
* **Request Headers**: `anthropic-version: 2023-06-01`, `x-api-key: ...` or `Authorization: Bearer ...`.
* **Request Body**: Standard Anthropic format (`{ model: string, messages: [], system?: string, tools?: [], stream?: boolean }`).
* **Response (Streaming)**: Anthropic SSE events (`message_start`, `content_block_start`, `content_block_delta`, `content_block_stop`, `message_delta`, `message_stop`).
* **Response (Non-streaming)**: Standard Anthropic message JSON object.
* **Claude Code CLI Setup**:
  ```bash
  export ANTHROPIC_BASE_URL="https://<gateway-domain>"
  export ANTHROPIC_API_KEY="auto-auth"
  claude
  ```

---

### 5. `GET /poll`, `POST /chunk`, `POST /done`, `GET /api/canvas/status`
* **Consumer**: Browser-based Gemini Canvas web worker tab or sandbox simulator.
* **Auth**: Public.
* **Contracts**:
  - `GET /poll`: Returns next `CanvasTask` JSON or `HTTP 204 No Content` / `{ task: null }` if queue is empty. Registers worker heartbeat.
  - `POST /chunk`: Body `{ taskId: string, chunk: string, index: number }`. Emits chunk event to active task stream. Returns `{ success: true }`.
  - `POST /done`: Body `{ taskId: string, fullText?: string, error?: string }`. Completes task promise. Returns `{ success: true }`.
  - `GET /api/canvas/status`: Returns `{ isWorkerActive: boolean, secondsSinceLastHeartbeat: number, queueDepth: number }`.

---

### 6. Management & Diagnostic Endpoints

| Endpoint | Method | Auth Required | Purpose | Response Shape |
| :--- | :--- | :--- | :--- | :--- |
| `/health`, `/api/health` | GET | No | Liveness/readiness probe, metrics | JSON with uptime, status, stats, environment |
| `/status`, `/api/status` | GET | No | Provider count and security status | JSON with tierOrder, customProviders |
| `/api/config` | GET | Yes (if token set) | Returns active configuration | Sanitized `KiroGatewayConfig` JSON |
| `/api/config` | POST | Yes (if token set) | Updates configuration on disk | `{ success: boolean, path: string, config: ... }` |
| `/api/export-env` | GET | Yes (if token set) | Exports settings as `.env` text | `{ envContent: "HOST=\"0.0.0.0\"..." }` |
| `/api/test/generate` | POST | Yes (if token set) | Interactive test generation harness | SSE stream (`data: {"chunk":"..."}`) |
| `/scripts/patch_kiro_extension.js` | GET | No | Direct client script download | Raw JavaScript file contents |
| `/`, `/mcp/stream`, `/events`, `/telemetry` | POST | No | Universal AWS Catch-All for auxiliary Kiro IDE requests | `{ "__type": "com.amazon.kiro.runtimeservice#Success", "status": "ok" }` or empty stream |

---

## 7. The Three Modes of Non-Stop AI Access & Accumulated Free Quota

KiroProxy Gateway provides three distinct routing archetypes to achieve zero-downtime, zero-cost AI generation:

### Archetype 1: Global Automode (`global-automode`)
* **Behavior**: **Cross-Provider + Cross-Model Full Cascade**.
* **Flow**:
  ```text
  kilo [m1 -> m2 -> m3...] 
    ↳ cline [m1 -> m2 -> m3...] 
      ↳ openrouter [m1 -> m2 -> m3...] 
        ↳ orcarouter [m1 -> m2 -> m3...] 
          ↳ gemini [flash -> argon -> lite...] 
            ↳ custom providers [baseUrl1 -> baseUrl2 with key rotation] 
              ↳ canvas bridge
  ```
* **Resilience**: If any model or provider returns HTTP 429, 502, or timeout, it cascades to the next candidate model and subsequently the next provider tier in the 7-tier order.

### Archetype 2: Provider-Specific Otomode (`<provider>-otomode`)
* **Behavior**: **Intra-Provider Model Cascade with Multi-Key Rotation**.
* **Flow**: Locks to a single designated provider (e.g. `openrouter-otomode`, `kilo-otomode`, `cline-otomode`) and cascades through that provider's catalog of zero-cost models (`Model 1 -> Model 2 -> Model 3...`), rotating across all configured API keys for that provider.
* **Resilience**: Protects against model-specific rate limits or context limitations while keeping requests within a preferred provider ecosystem.

### Archetype 3: Specific Model Access (`<vendor>/<model>:free`)
* **Behavior**: **Cross-Provider Quota Accumulation for the Exact Requested Model**.
* **Flow**:
  ```text
  Target Model (e.g., deepseek/deepseek-r1:free)
    ↳ Provider 1 (Tier 1) [API Key 1 -> Key 2]
      ↳ [429 Quota Exhausted] ↳ Provider 2 (Tier 2) [API Key 1 -> Key 2]
        ↳ [429 Quota Exhausted] ↳ Provider 3 (Tier 3)
          ↳ [429 Quota Exhausted] ↳ Custom Provider (Matching endpoints)
  ```
* **Accumulated Free Limits (Multiplied Budget)**:
  - Each upstream provider grants independent free quotas (e.g., 20 RPM / 200 RPD on OpenRouter, 20 RPM on OrcaRouter, free gateway tier on Kilo, plus custom endpoint limits).
  - Because KiroProxy routes the identical target model across all providers in sequence upon rate limit encounters, the user effectively enjoys the **accumulated aggregate throughput and combined monthly token budget** of all providers combined without model substitution.

---

## 8. Pre-Loaded Zero-Cost Custom Providers & Model Directory

KiroProxy Gateway v2.8.0-cloud includes 8 pre-loaded zero-cost provider configurations with 1-click setup templates and model mappings:

| Provider | Base URL | Active Model | Free Tier Limits | Upstream Model Mapping |
| :--- | :--- | :--- | :--- | :--- |
| **Groq Cloud** | `https://api.groq.com/openai/v1` | `llama-3.3-70b-versatile` | 14.4k req/day (8B), 1k req/day (70B), 30 RPM | `llama-3.3-70b`, `llama-3.1-8b`, `gemma2-9b` |
| **Cerebras Cloud** | `https://api.cerebras.ai/v1` | `llama-3.3-70b` | **1,000,000 tokens/day free**, 30 RPM | `llama-3.3-70b`, `llama3.1-8b`, `deepseek-r1` |
| **Mistral AI** | `https://api.mistral.ai/v1` | `codestral-latest` | 60 RPM free experimentation mode | `codestral-latest`, `mistral-small`, `mistral-nemo` |
| **GitHub Models** | `https://models.inference.ai.azure.com` | `gpt-4o-mini` | 50–150 req/day with GitHub PAT (`ghp_...`) | `gpt-4o`, `gpt-4o-mini`, `phi-4`, `deepseek-r1` |
| **SambaNova Cloud**| `https://api.sambanova.ai/v1` | `Meta-Llama-3.3-70B-Instruct` | 200k tokens/day free on custom RDUs | `llama-3.3-70b`, `deepseek-r1`, `qwen-72b` |
| **Together AI** | `https://api.together.ai/v1` | `meta-llama/Llama-3.3-70B-Instruct-Turbo-Free` | 60 RPM on dedicated free endpoints | `llama-3.3-70b-free`, `deepseek-r1-distill-70b-free` |
| **SiliconFlow** | `https://api.siliconflow.cn/v1` | `Qwen/Qwen2.5-7B-Instruct` | Permanently free open-source catalog | `qwen-7b`, `deepseek-v2.5`, `glm-4-9b` |
| **Pollinations AI**| `https://text.pollinations.ai/openai` | `mistral` | **Zero-auth free tier**, no API key required | `mistral`, `llama`, `qwen` |


