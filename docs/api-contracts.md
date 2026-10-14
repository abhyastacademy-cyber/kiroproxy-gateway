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
  - `Cache-Control: no-cache, no-transform`
  - `Connection: keep-alive`
  - `X-Accel-Buffering: no`
* **Response Body**: Binary AWS EventStream stream. Frames are chunk events containing base64 JSON ([`src/backend/handlers/eventstream.ts:102-125`](file:///d:/sdlc_studio/projects/kiro-integration/tmp_cloud_audit/src/backend/handlers/eventstream.ts#L102-L125)).

---

### 2. `GET /listAvailableModels` (and `/k/:token/listAvailableModels`)
* **Consumer**: Kiro IDE extension patch v5.1 (`whgwListModels`).
* **Auth**: Public or token-gated.
* **Auto-Populated Catalog**: Returns 60+ to 80+ zero-cost free models auto-populated from Kilo, OpenRouter, Cline, OrcaRouter, Gemini, and Canvas Bridge.
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
* **Function**: Triggers a live background sync to fetch newly released free tier models from OpenRouter public API and upstream providers.
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
