# Troubleshooting Guide — Diagnostics & Resolution Matrix

> **DIAGNOSTIC PROTOCOL:**
> Match the observed symptom with the table below. Follow "Where to Look" and "Resolution" verbatim.

---

## 1. Symptom Resolution Matrix

| Symptom | Likely Cause | Where to Look | Resolution (Exact Fix) |
| :--- | :--- | :--- | :--- |
| **HTTP 401 Unauthorized on `/generateAssistantResponse` or `/api/config`** | `PROXY_ADMIN_TOKEN` is configured on the server, but client request is missing token. | [`src/backend/handlers/bedrock_handler.ts:10-32`](file:///d:/sdlc_studio/projects/kiro-integration/tmp_cloud_audit/src/backend/handlers/bedrock_handler.ts#L10-L32) | Provide token via header `x-admin-token: <TOKEN>`, query `?token=<TOKEN>`, or patch Kiro with `node scripts/patch_kiro_extension.js --token <TOKEN> --url <URL>`. |
| **Kiro IDE Model Selector Shows "Not Patched (Native AWS)"** | Kiro extension bundle was overwritten by an auto-update or patch was reverted. | [`scripts/patch_kiro_extension.js:171-184`](file:///d:/sdlc_studio/projects/kiro-integration/tmp_cloud_audit/scripts/patch_kiro_extension.js#L171-L184) | Re-run patcher: `node scripts/patch_kiro_extension.js --url https://kiroproxy-746899042471.asia-southeast1.run.app`, then reload Kiro window. |
| **HTTP 429 / ResourceExhausted from Gemini** | API quota exceeded on active Google AI Studio key. | [`src/backend/providers/gemini_provider.ts:88-124`](file:///d:/sdlc_studio/projects/kiro-integration/tmp_cloud_audit/src/backend/providers/gemini_provider.ts#L88-L124) | Add additional keys into `geminiApiKeys: []` in config or Cloud Run env var `GEMINI_API_KEY`. The provider rotates automatically across all candidate keys. |
| **"Canvas task timed out waiting for worker response (20000ms)"** | No active Gemini Canvas worker tab is connected, or Cloud Run instance autoscaled to $>1$ instance. | [`src/backend/providers/canvas_bridge.ts:61-64`](file:///d:/sdlc_studio/projects/kiro-integration/tmp_cloud_audit/src/backend/providers/canvas_bridge.ts#L61-L64) | Open Web GUI -> "Gemini Canvas Bridge" tab -> click "Start Sandbox Worker Simulator", or ensure Cloud Run `--max-instances=1`. |
| **HTTP 500 / "All endpoints and API keys for provider X failed"** | Custom provider upstream is unreachable or returned invalid JSON/SSE stream. | [`src/backend/providers/custom_provider.ts:38-65`](file:///d:/sdlc_studio/projects/kiro-integration/tmp_cloud_audit/src/backend/providers/custom_provider.ts#L38-L65) | Check provider's `baseUrls` in Web GUI -> "Priority Tiers & Failover". Ensure endpoints terminate with `/v1` or `/chat/completions`. |
| **Config Edits Lost After Cloud Run Service Restarts** | GUI changes wrote to ephemeral filesystem (`/tmp/kiro_ai_config.json`), which resets on cold start. | [`src/backend/config/index.ts:257-273`](file:///d:/sdlc_studio/projects/kiro-integration/tmp_cloud_audit/src/backend/config/index.ts#L257-L273) | Export settings via `GET /api/export-env` and configure them as Cloud Run environment variables (`gcloud run services update kiroproxy --set-env-vars ...`). |
| **Vite Build Error: "Cannot find module @tailwindcss/vite"** | NPM dependencies out of sync or Tailwind v4 plugin mismatch. | [`package.json:17`](file:///d:/sdlc_studio/projects/kiro-integration/tmp_cloud_audit/package.json#L17), [`vite.config.ts`](file:///d:/sdlc_studio/projects/kiro-integration/tmp_cloud_audit/vite.config.ts) | Run `npm install` and verify Node version is $\ge 20$. Execute `npm run clean && npm run build`. |
| **Kiro IDE Chat Hangs Indefinitely with Spinning Indicator** | AWS EventStream framing error or unhandled exception in stream generator. | [`src/backend/handlers/eventstream.ts:66-96`](file:///d:/sdlc_studio/projects/kiro-integration/tmp_cloud_audit/src/backend/handlers/eventstream.ts#L66-L96) | Verify server stdout logs for `[BedrockHandler]` exceptions. Ensure end frame is sent with `createBedrockEndFrame('end_turn')`. |

---

## 2. Reading Server Telemetry & Logs

### Where Logs Live
* **Production (Google Cloud Run)**: Accessible via Google Cloud Console -> Cloud Run -> `kiroproxy` -> Logs tab, or via CLI:
  ```bash
  gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=kiroproxy" --limit 50 --format json
  ```
* **Local Development**: Standard `stdout` / `stderr` in terminal where `tsx server.ts` is running.
* **In-Memory Ring Buffer**: Query `GET /api/health` or `GET /api/status`. The field `recentMetrics` contains the last 15 requests with duration, status, and error messages ([`src/backend/resilience/health.ts:117`](file:///d:/sdlc_studio/projects/kiro-integration/tmp_cloud_audit/src/backend/resilience/health.ts#L117)).

### Key Log Signatures & Meanings

```text
[GeminiProvider] Key #1 failed (...RESOURCE_EXHAUSTED...). Rotating to next Gemini key...
Meaning: Google AI Studio returned 429 quota exhaustion. Provider is attempting Key #2.

[ProviderManager] Tier 'kilo' failed: ... Trying next tier...
Meaning: Otomode tier failed or rate-limited. Dispatcher is cascading down to the next tier in providerPriorityOrder.

[CustomProvider] Provider X failover: URL #1 (https://...) with Key #1 failed (...). Trying next candidate...
Meaning: Primary base URL for custom provider failed. Service is executing inner key rotation or next baseUrl.

[Config] Failed to write to .../config/kiro_ai_config.json, trying /tmp fallback
Meaning: Read-only container filesystem detected. Configuration was successfully redirected to /tmp/kiro_ai_config.json.
```

---

## 3. Local Reproduction Procedure

To reproduce production bugs locally in an identical Node 22 environment:

```bash
# 1. Clone/Navigate to release directory
cd d:\sdlc_studio\projects\kiro-integration\tmp_cloud_audit

# 2. Install exact production dependencies
npm install

# 3. Compile frontend assets
npm run build

# 4. Launch server with Cloud Run simulation env vars
$env:PORT="3000"
$env:HOST="127.0.0.1"
$env:PUBLIC_DOMAIN_URL="http://127.0.0.1:3000"
npm run start
```

Verify endpoints:
```bash
# Health check
curl -s http://127.0.0.1:3000/health

# Model discovery
curl -s http://127.0.0.1:3000/v1/models

# Synthetic test generation
curl -s -X POST http://127.0.0.1:3000/api/test/generate -H "Content-Type: application/json" -d '{"prompt":"test connection"}'
```

---

## 4. Rollback & Emergency Recovery

### Rollback Kiro IDE Extension to Official AWS Bedrock
If Kiro IDE encounters rendering or extension crashes, immediately revert the patch:
```bash
node scripts/patch_kiro_extension.js --revert
```
*Effect*: Restores `extension.js` from `extension.js.original`. Reload Kiro IDE window (<kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>P</kbd> -> `Developer: Reload Window`).

### Rollback Cloud Run Service Revision
If a broken Docker image was deployed to Cloud Run, roll back to the previous healthy revision:
```bash
gcloud run services update-traffic kiroproxy --to-revisions=PREVIOUS_HEALTHY_REVISION_NAME=100
```
