# Change Impact Analysis — Blast Radius & Coupling Matrix

> **MANDATORY INSTRUCTION FOR AI AGENTS:**
> Consult this table BEFORE modifying any file in this repository.
> Every modification listed here carries verified downstream blast radius.

---

## 1. Quick Blast Radius Matrix

| Change Area | Blast Radius Severity | Directly Coupled Files to Update/Re-verify | Verification Step / Test to Run |
| :--- | :--- | :--- | :--- |
| **`eventstream.ts`** (Binary framing) | **CRITICAL** (Breaks Kiro IDE conversation stream) | [`bedrock_handler.ts`](file:///d:/sdlc_studio/projects/kiro-integration/tmp_cloud_audit/src/backend/handlers/bedrock_handler.ts), [`server.ts`](file:///d:/sdlc_studio/projects/kiro-integration/tmp_cloud_audit/server.ts) | Send prompt from patched Kiro IDE; verify text streams without stream deserialization crash. |
| **`config/index.ts`** (Config schema / env) | **HIGH** (Affects all providers & GUI persistence) | [`ProvidersTab.tsx`](file:///d:/sdlc_studio/projects/kiro-integration/tmp_cloud_audit/src/frontend/components/ProvidersTab.tsx), [`provider_manager.ts`](file:///d:/sdlc_studio/projects/kiro-integration/tmp_cloud_audit/src/backend/providers/provider_manager.ts), [`health.ts`](file:///d:/sdlc_studio/projects/kiro-integration/tmp_cloud_audit/src/backend/resilience/health.ts), [`server.ts`](file:///d:/sdlc_studio/projects/kiro-integration/tmp_cloud_audit/server.ts) | Run `npm run lint` && `npm run build`; verify `GET /api/config` and `POST /api/config`. |
| **`provider_manager.ts`** (Waterfall order) | **HIGH** (Alters routing & fallback sequence) | [`otomode.ts`](file:///d:/sdlc_studio/projects/kiro-integration/tmp_cloud_audit/src/backend/providers/otomode.ts), [`gemini_provider.ts`](file:///d:/sdlc_studio/projects/kiro-integration/tmp_cloud_audit/src/backend/providers/gemini_provider.ts), [`custom_provider.ts`](file:///d:/sdlc_studio/projects/kiro-integration/tmp_cloud_audit/src/backend/providers/custom_provider.ts), [`ProvidersTab.tsx`](file:///d:/sdlc_studio/projects/kiro-integration/tmp_cloud_audit/src/frontend/components/ProvidersTab.tsx) | Test all 7 tiers in `TesterTab.tsx`; verify fallback triggers when upstream returns 429. |
| **`gemini_provider.ts`** (Multi-key loop) | **MEDIUM** (Gemini quota failover behavior) | [`provider_manager.ts`](file:///d:/sdlc_studio/projects/kiro-integration/tmp_cloud_audit/src/backend/providers/provider_manager.ts), [`otomode.ts`](file:///d:/sdlc_studio/projects/kiro-integration/tmp_cloud_audit/src/backend/providers/otomode.ts) | Submit test prompt with model `gemini-3.8-flash` via `POST /api/test/generate`. |
| **`custom_provider.ts`** (Failover logic) | **MEDIUM** (Third-party endpoint execution) | [`config/index.ts`](file:///d:/sdlc_studio/projects/kiro-integration/tmp_cloud_audit/src/backend/config/index.ts), [`ProvidersTab.tsx`](file:///d:/sdlc_studio/projects/kiro-integration/tmp_cloud_audit/src/frontend/components/ProvidersTab.tsx) | Test custom provider with multiple `baseUrls` and dead primary endpoint. |
| **`canvas_bridge.ts`** (Task queue) | **MEDIUM** (Breaks Gemini Canvas reverse polling) | [`canvas_handler.ts`](file:///d:/sdlc_studio/projects/kiro-integration/tmp_cloud_audit/src/backend/handlers/canvas_handler.ts), [`CanvasBridgeTab.tsx`](file:///d:/sdlc_studio/projects/kiro-integration/tmp_cloud_audit/src/frontend/components/CanvasBridgeTab.tsx) | Start Simulator in `CanvasBridgeTab.tsx`; verify `/poll` receives task and returns `/chunk`. |
| **`patch_kiro_extension.js`** (Bytecode patcher) | **CRITICAL** (Corrupts Kiro IDE desktop app) | [`scripts/patch_kiro_extension.js`](file:///d:/sdlc_studio/projects/kiro-integration/tmp_cloud_audit/scripts/patch_kiro_extension.js) | Run `node scripts/patch_kiro_extension.js --check` and test `--revert` on original backup. |
| **Frontend Theme & CSS** (`index.css`) | **LOW** (Visual regression in Web GUI) | All files in `src/frontend/components/` | Run `npm run build` to verify Tailwind v4 Vite compilation cleanly emits CSS. |

---

## 2. Detailed Change Impact by Module

### 1. Modifying `src/backend/handlers/eventstream.ts`
* **Coupling (FACT)**:
  - `buildEventStreamFrame()` formats raw byte buffers according to AWS Bedrock EventStream specifications ([`eventstream.ts:66-96`](file:///d:/sdlc_studio/projects/kiro-integration/tmp_cloud_audit/src/backend/handlers/eventstream.ts#L66-L96)).
  - `createBedrockChunkFrame()` encodes text inside a double JSON base64 wrapper (`bytes: base64(JSON({ delta: { text } }))`) ([`eventstream.ts:102-125`](file:///d:/sdlc_studio/projects/kiro-integration/tmp_cloud_audit/src/backend/handlers/eventstream.ts#L102-L125)).
  - `createBedrockEndFrame()` sends `contentBlockStop: true` and `stopReason` ([`eventstream.ts:130-146`](file:///d:/sdlc_studio/projects/kiro-integration/tmp_cloud_audit/src/backend/handlers/eventstream.ts#L130-L146)).
* **If you change this, also check/update**:
  - [`src/backend/handlers/bedrock_handler.ts:138-142`](file:///d:/sdlc_studio/projects/kiro-integration/tmp_cloud_audit/src/backend/handlers/bedrock_handler.ts#L138-L142): Uses `createBedrockChunkFrame` and `createBedrockEndFrame`.
  - CRC32 polynomial calculation ([`eventstream.ts:7-23`](file:///d:/sdlc_studio/projects/kiro-integration/tmp_cloud_audit/src/backend/handlers/eventstream.ts#L7-L23)): Altering bitwise logic corrupts the 4-byte prelude CRC or 4-byte message CRC.
* **What breaks if wrong**: Kiro IDE throws `EventStreamDeserializationError` or closes the connection silently.

---

### 2. Modifying `src/backend/config/index.ts`
* **Coupling (FACT)**:
  - `KiroGatewayConfig` defines types for `providerPriorityOrder`, `customProviders`, and `globalAutoMode` ([`config/index.ts:21-55`](file:///d:/sdlc_studio/projects/kiro-integration/tmp_cloud_audit/src/backend/config/index.ts#L21-L55)).
  - `normalizeCustomProvider()` ensures `baseUrls` and `apiKeys` are non-empty arrays with legacy string fallbacks ([`config/index.ts:57-90`](file:///d:/sdlc_studio/projects/kiro-integration/tmp_cloud_audit/src/backend/config/index.ts#L57-L90)).
  - `updateConfig()` handles filesystem writing with `/tmp` fallback ([`config/index.ts:230-255`](file:///d:/sdlc_studio/projects/kiro-integration/tmp_cloud_audit/src/backend/config/index.ts#L230-L255)).
* **If you change this, also check/update**:
  - [`src/frontend/types.ts`](file:///d:/sdlc_studio/projects/kiro-integration/tmp_cloud_audit/src/frontend/types.ts): Mirror all interface changes in frontend types.
  - [`src/frontend/components/ProvidersTab.tsx`](file:///d:/sdlc_studio/projects/kiro-integration/tmp_cloud_audit/src/frontend/components/ProvidersTab.tsx): Handles tier order drag/reorder and custom provider modals.
  - [`config/kiro_ai_config.json`](file:///d:/sdlc_studio/projects/kiro-integration/tmp_cloud_audit/config/kiro_ai_config.json): Keep baseline config JSON syntax valid.
* **What breaks if wrong**: Server crashes on startup if `JSON.parse` fails; `/api/config` serialization breaks frontend state; Cloud Run instance becomes unwritable if `/tmp` fallback is removed.

---

### 3. Modifying `src/backend/providers/provider_manager.ts`
* **Coupling (FACT)**:
  - Dispatches to 7 priority tiers: `['kilo', 'cline', 'openrouter', 'orcarouter', 'gemini', 'custom', 'canvas']` ([`provider_manager.ts:135-227`](file:///d:/sdlc_studio/projects/kiro-integration/tmp_cloud_audit/src/backend/providers/provider_manager.ts#L135-L227)).
  - Normalizes requested model aliases (`auto` -> `global-automode`) ([`provider_manager.ts:29-32`](file:///d:/sdlc_studio/projects/kiro-integration/tmp_cloud_audit/src/backend/providers/provider_manager.ts#L29-L32)).
  - Direct execution bypass for models starting with `gemini-`, `canvas-`, or matching custom providers ([`provider_manager.ts:56-129`](file:///d:/sdlc_studio/projects/kiro-integration/tmp_cloud_audit/src/backend/providers/provider_manager.ts#L56-L129)).
* **If you change this, also check/update**:
  - [`src/backend/providers/otomode.ts`](file:///d:/sdlc_studio/projects/kiro-integration/tmp_cloud_audit/src/backend/providers/otomode.ts): Provider names passed to `runProviderOtomode()`.
  - [`src/backend/resilience/health.ts:62-74`](file:///d:/sdlc_studio/projects/kiro-integration/tmp_cloud_audit/src/backend/resilience/health.ts#L62-L74): Records request metrics per tier.
  - [`server.ts:52-190`](file:///d:/sdlc_studio/projects/kiro-integration/tmp_cloud_audit/server.ts#L52-L190): Model catalogs returned by `/listAvailableModels` and `/v1/models`.
* **What breaks if wrong**: Prompts route to dead providers; fallback logic halts prematurely on first error instead of cascading down the tier list.

---

### 4. Modifying `src/backend/providers/canvas_bridge.ts` & `canvas_handler.ts`
* **Coupling (FACT)**:
  - `CanvasBridge` uses an in-memory queue (`this.queue`) and task emitters (`this.taskEmitters`) ([`canvas_bridge.ts:27-28`](file:///d:/sdlc_studio/projects/kiro-integration/tmp_cloud_audit/src/backend/providers/canvas_bridge.ts#L27-L28)).
  - Worker status check requires a heartbeat within 15 seconds (`Date.now() - this.lastWorkerHeartbeat < 15000`) ([`canvas_bridge.ts:135`](file:///d:/sdlc_studio/projects/kiro-integration/tmp_cloud_audit/src/backend/providers/canvas_bridge.ts#L135)).
* **If you change this, also check/update**:
  - [`src/backend/handlers/canvas_handler.ts:1-60`](file:///d:/sdlc_studio/projects/kiro-integration/tmp_cloud_audit/src/backend/handlers/canvas_handler.ts#L1-L60): Endpoints `/poll`, `/chunk`, `/done`.
  - [`src/frontend/components/CanvasBridgeTab.tsx`](file:///d:/sdlc_studio/projects/kiro-integration/tmp_cloud_audit/src/frontend/components/CanvasBridgeTab.tsx): In-browser worker simulator script.
* **What breaks if wrong**: Worker receives 404 or drops stream chunks; tasks hang until the 20-second timeout fires.

---

### 5. Modifying `scripts/patch_kiro_extension.js`
* **Coupling (FACT)**:
  - Surgically injects regex matches into Kiro IDE's compiled `extension.js` ([`patch_kiro_extension.js:276-339`](file:///d:/sdlc_studio/projects/kiro-integration/tmp_cloud_audit/scripts/patch_kiro_extension.js#L276-L339)).
  - Uses `extension.js.original` clean baseline to maintain idempotency ([`patch_kiro_extension.js:253-271`](file:///d:/sdlc_studio/projects/kiro-integration/tmp_cloud_audit/scripts/patch_kiro_extension.js#L253-L271)).
* **If you change this, also check/update**:
  - Upstream Kiro IDE version updates (variable minification names in regex `Bte`, `RKo`, `whgwListModels`).
  - [`server.ts:240-248`](file:///d:/sdlc_studio/projects/kiro-integration/tmp_cloud_audit/server.ts#L240-L248): Direct script download route (`GET /scripts/patch_kiro_extension.js`).
* **What breaks if wrong**: Kiro IDE fails to launch, displays blank sidebar, or permanently crashes on reload.
