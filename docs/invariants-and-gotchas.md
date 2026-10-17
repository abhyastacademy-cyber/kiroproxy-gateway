# System Invariants & Architectural Gotchas

> **NON-NEGOTIABLE LAWS & TRAPS:**
> This document lists immutable architectural invariants, known gotchas, and race conditions in `kiroproxy-gateway-cloud`.

---

## 1. Unbreakable Invariants

### Invariant 1: IEEE 802.3 CRC32 EventStream Framing & Smithy Event Types
* **The Rule**: Responses streamed to Kiro IDE on `/generateAssistantResponse` MUST adhere strictly to the binary AWS EventStream protocol using Smithy event types (`assistantResponseEvent`, `toolUseEvent`, `metadataEvent`).
* **The Structure**:
  - `Total Length` (4 bytes, Big Endian)
  - `Headers Length` (4 bytes, Big Endian)
  - `Prelude CRC32` (4 bytes, Big Endian)
  - `Headers`:
    - `:content-type` (`application/json`)
    - `:message-type` (`event`)
    - `:event-type` (`assistantResponseEvent` for text chunks, `toolUseEvent` for tools, `metadataEvent` for completion)
  - `Payload`: Direct UTF-8 JSON (`{"content":"..."}` or `{"toolUseId":"...","name":"...","input":"...","stop":true}`)
  - `Message CRC32` (4 bytes, Big Endian)
* **The Trap**: Emitting AWS Bedrock Converse `:event-type: chunk` or wrapping in base64 `bytes` causes Kiro IDE's internal extension unmarshaller to crash with `Error sending prompt: Internal error`. Kiro IDE strictly recognizes Smithy binary frames.

### Invariant 2: Cloud Run Read-Only Filesystem & `/tmp` Fallback
* **The Rule**: Cloud Run container filesystems are strictly read-only everywhere except `/tmp`.
* **The Trap**: Any write attempt to `config/kiro_ai_config.json` inside a containerized production deployment will throw `EROFS: read-only file system`.
* **The Enforcement**: `src/backend/config/index.ts` must catch write errors to project paths and immediately redirect persistence to `/tmp/kiro_ai_config.json`.

### Invariant 3: The 7 Fixed Priority Tiers
* **The Rule**: The default waterfall consists of exactly 7 priority tiers:
  `kilo -> cline -> openrouter -> orcarouter -> gemini -> custom -> canvas`
* **The Trap**: Removing or mutating the tier names breaks circuit breaker state keys, dashboard status indicators, and frontend priority sliders.

### Invariant 4: Dual-Mode Model List Discovery
* **The Rule**: Model discovery must support both Smithy format (`/listAvailableModels`) and OpenAI format (`/v1/models`).
* **The Trap**: Older Kiro IDE extension patches expect the Smithy payload `{ models: [...], defaultModel: {...} }`, whereas modern OpenAI integrations expect `{ object: "list", data: [...] }`. `whgwListModels` in `openai_handler.ts` inspects headers and query routes to transparently serve both formats.

### Invariant 5: Unique React & Catalog Keys
* **The Rule**: Every model in `catalog.ts` must have a guaranteed unique `id`.
* **The Trap**: If OpenRouter and custom providers emit models with identical IDs, React throws a duplicate key error in the model catalog list, disrupting UI reconciliation.

### Invariant 6: Multi-Format Tool Extraction Normalization
* **The Rule**: Open-source models returning embedded tool syntax (fenced JSON, bare JSON, Anthropic XML, Kiro native tool_call, Qwen/DeepSeek tags, or code manifests) MUST be extracted, normalized via `normalizeToolAliases` (`write_file` -> `fs_write`, `run_command` -> `execute_pwsh`), and emitted as native AWS Bedrock EventStream toolUse frames.
* **The Trap**: If tool syntax is sent only as plain chat text, Kiro IDE will not trigger automated file modifications or terminal commands.

### Invariant 7: Universal AWS Catch-All & Telemetry Isolation
* **The Rule**: The gateway MUST absorb auxiliary AWS / Kiro background requests (`POST /`, `POST /mcp/stream`, `POST /events`, `POST /telemetry`, `POST /activity/publish`) and respond with HTTP 200 OK `{ __type: "com.amazon.kiro.runtimeservice#Success", status: "ok" }`.
* **The Trap**: If any auxiliary call hits an unhandled 404 or 405 Method Not Allowed (e.g. Next.js static root route rejection), Kiro IDE's internal `IUu` unmarshaller crashes immediately with `Error sending prompt: Internal error`. Extension Patch 3B (`resolveTarget` returning `void 0`) prevents telemetry spam from reaching the network.

### Invariant 8: Zero Plain-Text Secrets in Repository Configs
* **The Rule**: Plain API keys must NEVER be committed or persisted in `config/kiro_ai_config.json` or `.env.example`.
* **The Trap**: Automated cloud security scanners (such as Google Cloud Secret Scanner) continuously monitor repository config files. Any key stored in plaintext on disk is automatically flagged as leaked and permanently revoked with `HTTP 403 PERMISSION_DENIED: Your API key was reported as leaked`.
* **The Enforcement**: Key configuration uses stateless environment variables (`process.env.GEMINI_API_KEY`, `process.env.OPENROUTER_API_KEY`) and in-memory dead-key auto-purging.

### Invariant 9: Atomic SingleKey & ArrayKey State Synchronization
* **The Rule**: Core providers maintaining both scalar properties (`geminiApiKey`) and vector arrays (`geminiApiKeys`) must be synchronized atomically upon any add, remove, or reorder action.
* **The Trap**: Deleting from `geminiApiKeys` without clearing `geminiApiKey` causes subsequent reloads to re-populate the deleted key from the scalar property.

---

## 2. Known Gotchas & Race Conditions

### Gotcha 1: Dead Upstream Endpoints & 20s Gateway Timeouts
* **Issue**: Kiro IDE enforces a ~20–30s timeout on assistant completions.
* **Gotcha**: If an upstream provider (e.g. `api.kilo.ai`) is down or unroutable, a naive 10-second connect timeout per candidate model will exceed Kiro's overall timeout before the waterfall reaches OpenRouter or Gemini.
* **Fix**: `otomode.ts` applies a fast-fail check: connection timeouts for unkeyed requests are capped at 3,500ms, and unresponsive base URLs are flagged so subsequent models on that dead host fail over immediately.

### Gotcha 2: HTTP 429 Quota Cascades vs Model Substitution
* **Issue**: Users selecting a specific model (e.g. `deepseek/deepseek-r1:free`) expect that exact model's reasoning capabilities, not a generic fallback.
* **Gotcha**: Falling back to a different model family when the user chose a specific model causes unexpected behavior.
* **Behavior**: When a specific `targetModel` is provided, KiroProxy locks onto that model ID and cascades across providers that supply it (OpenRouter -> OrcaRouter -> Cline -> Custom), accumulating the combined free quota. Only when in `global-automode` does the system rotate models.

### Gotcha 3: Admin Token Authentication Bypass
* **Issue**: If `PROXY_ADMIN_TOKEN` is unset or empty, the gateway functions in open/public mode.
* **Gotcha**: When configuring security tokens, Kiro IDE needs the token either in the URL (`/k/<token>/...`) or via the `x-admin-token` header. The Patcher tab generates the exact patch script including this token.

### Gotcha 4: Fast Failover on 401/403 vs Linear Model Iteration
* **Issue**: Unkeyed requests hitting endpoints requiring auth credentials return HTTP 401 ("No cookie auth credentials found").
* **Gotcha**: Iterating sequentially through all candidate models on an unauthenticated tier wastes up to 15 seconds.
* **Fix**: Catch blocks in `otomode.ts` immediately flag `baseUrlFailed = true` upon receiving 401, 403, or "No cookie auth", bypassing the remainder of that tier in under 1ms.

### Gotcha 5: Claude Code CLI Anthropic Messages Compatibility
* **Issue**: Claude Code CLI (`@anthropic-ai/claude-code`) speaks the Anthropic Messages API (`POST /v1/messages`), not OpenAI or Bedrock EventStream.
* **Gotcha**: Standard OpenAI streaming chunks lack the Anthropic event lifecycle (`message_start`, `content_block_start`, `content_block_delta`, `content_block_stop`, `message_delta`, `message_stop`) and cause CLI hangs.
* **Fix**: `src/backend/handlers/anthropic_handler.ts` translates messages, tools (`Bash`, `FileEdit`, `GlobTool`), and model names with full SSE streaming and `tool_use` deltas.
