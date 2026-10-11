# System Invariants & Operational Gotchas

> **CRITICAL ARCHITECTURAL CONSTRAINTS:**
> These invariants are load-bearing. Violating any invariant listed below will cause silent system failure, stream corruption, or container crash loops.

---

## 1. Load-Bearing Invariants (Must ALWAYS Remain True)

### Invariant 1: Cloud Run Filesystem is Read-Only Outside `/tmp`
* **Statement (FACT)**: Cloud Run containers do not guarantee write access to the application directory (`process.cwd()`). Writes to `config/kiro_ai_config.json` can throw `EROFS` (Read-only file system).
* **Code Reference**: [`src/backend/config/index.ts:245-253`](file:///d:/sdlc_studio/projects/kiro-integration/tmp_cloud_audit/src/backend/config/index.ts#L245-L253).
* **Requirement**: `ConfigManager.updateConfig()` MUST catch filesystem write errors and seamlessly fallback to writing to `/tmp/kiro_ai_config.json`. Never remove the `try/catch` fallback block.

### Invariant 2: AWS Bedrock CRC32 Frame Calculation Exactness
* **Statement (FACT)**: Kiro IDE verifies the binary EventStream prelude CRC (bytes 8-11) and message CRC (last 4 bytes) using IEEE 802.3 CRC32 ([`src/backend/handlers/eventstream.ts:80-93`](file:///d:/sdlc_studio/projects/kiro-integration/tmp_cloud_audit/src/backend/handlers/eventstream.ts#L80-L93)).
* **Code Reference**: [`src/backend/handlers/eventstream.ts:17-23`](file:///d:/sdlc_studio/projects/kiro-integration/tmp_cloud_audit/src/backend/handlers/eventstream.ts#L17-L23).
* **Requirement**: Never change `0xedb88320` polynomial or byte slice calculations. `preludeCrc` covers bytes 0 to 7. `messageCrc` covers bytes 0 to `totalLen - 5`.

### Invariant 3: Native Cloud Ingress Replaces `@ngrok/ngrok`
* **Statement (FACT)**: Google Cloud Run provides managed HTTPS termination at `https://kiroproxy-746899042471.asia-southeast1.run.app`. The `@ngrok/ngrok` npm dependency is deliberately excluded from `package.json` ([`package.json:15-27`](file:///d:/sdlc_studio/projects/kiro-integration/tmp_cloud_audit/package.json#L15-L27)).
* **Code Reference**: [`src/backend/resilience/health.ts:94-96`](file:///d:/sdlc_studio/projects/kiro-integration/tmp_cloud_audit/src/backend/resilience/health.ts#L94-L96).
* **Requirement**: Never import `@ngrok/ngrok` in `server.ts` or backend modules in this package.

### Invariant 4: Dual-Mode Model List Compatibility
* **Statement (FACT)**: Kiro IDE extension patch v5.1 queries `/listAvailableModels` first (expecting Smithy JSON format `{ models: [...] }`). If that returns HTML (SPA fallback), it immediately queries `/v1/models` (expecting OpenAI format `{ data: [...] }`).
* **Code Reference**: [`scripts/patch_kiro_extension.js:212`](file:///d:/sdlc_studio/projects/kiro-integration/tmp_cloud_audit/scripts/patch_kiro_extension.js#L212), [`server.ts:52-190`](file:///d:/sdlc_studio/projects/kiro-integration/tmp_cloud_audit/server.ts#L52-L190).
* **Requirement**: Both `/listAvailableModels` and `/v1/models` must remain registered on `server.ts` and return valid model arrays.

### Invariant 5: Sticky Gemini Multi-Key Rotation on Quota Limits
* **Statement (FACT)**: When Google GenAI returns `429`, `RESOURCE_EXHAUSTED`, or quota errors, `GeminiProvider` rotates through candidate keys sequentially and retains the successful key index (`activeKeyIndex = keyIndex`) ([`src/backend/providers/gemini_provider.ts:88-124`](file:///d:/sdlc_studio/projects/kiro-integration/tmp_cloud_audit/src/backend/providers/gemini_provider.ts#L88-L124)).
* **Requirement**: Do not reset `activeKeyIndex` to 0 on every request; sticky rotation prevents hammering depleted keys.

---

## 2. Non-Obvious Behavior & Operational Gotchas

### Gotcha 1: Cloud Run Ephemeral Cold Starts Wipe In-Memory Configuration Changes
* **Symptom**: Settings adjusted in the Web GUI (e.g. changing provider priority or adding custom keys) disappear after several hours of inactivity.
* **Root Cause (FACT)**: Cloud Run scales container instances to zero when idle. Upon the next request, a fresh container boots using environment variables and `config/kiro_ai_config.json`.
* **Fix**: For persistent configuration in Cloud Run, define environment variables in the Cloud Run service definition (`CUSTOM_PROVIDERS_JSON`, `PROVIDER_PRIORITY_ORDER`, `GEMINI_API_KEY`, etc.) or export them via `GET /api/export-env` ([`src/backend/config/index.ts:257-273`](file:///d:/sdlc_studio/projects/kiro-integration/tmp_cloud_audit/src/backend/config/index.ts#L257-L273)).

### Gotcha 2: Canvas Bridge Task Starvation on Multi-Instance Cloud Run
* **Symptom**: Requests to `canvas-gemini-flash` hang for 20 seconds and fail with `Canvas task task_... timed out waiting for worker response`.
* **Root Cause (FACT)**: `CanvasBridge` stores task emitters in an in-memory `Map` inside the Node process ([`src/backend/providers/canvas_bridge.ts:28`](file:///d:/sdlc_studio/projects/kiro-integration/tmp_cloud_audit/src/backend/providers/canvas_bridge.ts#L28)). If Cloud Run runs $>1$ instance, the client request lands on Instance 1 while the browser worker's `/poll` lands on Instance 2.
* **Fix**: Cloud Run service MUST be restricted to `--max-instances=1` if the Gemini Canvas Bridge worker is in use.

### Gotcha 3: Kiro IDE Model Aliases (`auto` vs `global-automode`)
* **Symptom**: Kiro IDE sends `model: "auto"` or `modelId: "auto"`, but provider managers expect `global-automode`.
* **Root Cause (FACT)**: In Kiro IDE UI, the dropdown displays `auto`.
* **Code Reference**: [`src/backend/providers/provider_manager.ts:29-32`](file:///d:/sdlc_studio/projects/kiro-integration/tmp_cloud_audit/src/backend/providers/provider_manager.ts#L29-L32).
* **Fix**: `ProviderManager` automatically normalizes `auto` -> `global-automode`. Never assume the model ID received from Kiro matches catalog IDs verbatim.

### Gotcha 4: SPA Catch-All Route Masking API Errors
* **Symptom**: Calling an unhandled API endpoint returns HTTP 200 with HTML instead of 404 JSON.
* **Root Cause (FACT)**: `server.ts` registers `app.get('*')` to serve `dist/index.html` for client-side React routing ([`server.ts:293-295`](file:///d:/sdlc_studio/projects/kiro-integration/tmp_cloud_audit/server.ts#L293-L295)).
* **Fix**: All API routes MUST be registered before the static asset and wildcard fallback middleware.

---

## 3. Past Regressions & Verified Fixes

| Past Defect | Root Cause | Fix Applied | Code Reference |
| :--- | :--- | :--- | :--- |
| **GUI Crash on AutoMode Toggle** | `App.tsx` did not pass `config` or `onToggleAutoMode` props to `<Navbar />`. | Bound `handleToggleAutoMode` in `App.tsx` to call `configManager.updateConfig({ globalAutoMode })`. | [`src/App.tsx:90-95`](file:///d:/sdlc_studio/projects/kiro-integration/tmp_cloud_audit/src/App.tsx#L90-L95) |
| **Container Crash on `tsx` Missing** | `tsx` was placed under `devDependencies`, causing production Docker builds without dev dependencies to fail. | Promoted `tsx` to `dependencies` in `package.json`. | [`package.json:25`](file:///d:/sdlc_studio/projects/kiro-integration/tmp_cloud_audit/package.json#L25) |
| **Model Catalog HTML Mismatch** | Kiro IDE extension patch v5.0 expected JSON from `/listAvailableModels`, but received SPA HTML fallback on Cloud Run. | Upgraded patch to v5.1 to check content-type JSON and fallback to `/v1/models`. | [`scripts/patch_kiro_extension.js:212`](file:///d:/sdlc_studio/projects/kiro-integration/tmp_cloud_audit/scripts/patch_kiro_extension.js#L212) |
