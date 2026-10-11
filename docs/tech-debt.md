# Technical Debt & Known Architectural Limitations

> **ENGINEERING AUDIT (FACT):**
> This document catalogs existing shortcuts, fragile areas, and scaling boundaries to guide future refactoring efforts.

---

## 1. Technical Debt Inventory

| Item ID | Component | Description & Code Citation | Severity | Impact on Scaling / Production |
| :--- | :--- | :--- | :--- | :--- |
| **TD-01** | **State Persistence** | **Ephemeral Cloud Run File System**: GUI edits write to `config/kiro_ai_config.json` or `/tmp/kiro_ai_config.json` ([`src/backend/config/index.ts:245-253`](file:///d:/sdlc_studio/projects/kiro-integration/tmp_cloud_audit/src/backend/config/index.ts#L245-L253)). | **HIGH** | Changes saved in the GUI reset upon Cloud Run container cold start or revision deployment. Requires human operators to set Cloud Run environment variables for true persistence. |
| **TD-02** | **Canvas Bridge** | **In-Memory Task Queue**: `CanvasBridge` maintains tasks and emitters in local Node process memory (`Map<string, EventEmitter>`) ([`src/backend/providers/canvas_bridge.ts:28`](file:///d:/sdlc_studio/projects/kiro-integration/tmp_cloud_audit/src/backend/providers/canvas_bridge.ts#L28)). | **HIGH** | Breaks horizontally if Cloud Run autoscales to $>1$ instance. Client request and worker `/poll` land on different container instances, triggering 20s task timeouts. Cloud Run must be constrained to `--max-instances=1`. |
| **TD-03** | **Automated Testing** | **Absence of CI Test Suite**: Zero automated unit or integration tests exist in the cloud repository ([`package.json:7-14`](file:///d:/sdlc_studio/projects/kiro-integration/tmp_cloud_audit/package.json#L7-L14)). | **HIGH** | Regression detection for binary EventStream framing and multi-tier cascading relies entirely on manual testing. |
| **TD-04** | **Security** | **Open Endpoints When Token Is Unset**: If `PROXY_ADMIN_TOKEN` is blank, all endpoints (`/generateAssistantResponse`, `/api/config`) are open to the public internet without rate-limiting ([`src/backend/handlers/bedrock_handler.ts:12`](file:///d:/sdlc_studio/projects/kiro-integration/tmp_cloud_audit/src/backend/handlers/bedrock_handler.ts#L12)). | **MEDIUM** | Vulnerable to unauthorized usage and quota depletion if the Cloud Run URL is scanned. |
| **TD-05** | **Telemetry** | **Volatile Metrics Ring Buffer**: `HealthAndResilienceManager` stores request metrics in an in-memory array capped at 200 items ([`src/backend/resilience/health.ts:71-73`](file:///d:/sdlc_studio/projects/kiro-integration/tmp_cloud_audit/src/backend/resilience/health.ts#L71-L73)). | **LOW** | Historical telemetry is lost on container restart. No persistent analytics storage. |
| **TD-06** | **Frontend Assets** | **Vite Middleware in Production Container**: If `dist/` is missing at container runtime, `server.ts` attempts to dynamically import Vite in middleware mode ([`server.ts:297-304`](file:///d:/sdlc_studio/projects/kiro-integration/tmp_cloud_audit/server.ts#L297-L304)). | **LOW** | Stage 1 of `Dockerfile` compiles `dist/` cleanly, but local bare execution without `npm run build` falls back to dev mode or HTML placeholder. |

---

## 2. Fragile Code Areas (Proceed With Caution)

### 1. `eventstream.ts`: Binary Buffer Slicing
* **Why Fragile**: Byte offsets for length fields (`writeUInt32BE`), prelude CRC, and message CRC are hardcoded integers ([`src/backend/handlers/eventstream.ts:76-93`](file:///d:/sdlc_studio/projects/kiro-integration/tmp_cloud_audit/src/backend/handlers/eventstream.ts#L76-L93)).
* **Risk**: An off-by-one error or incorrect header length calculation immediately corrupts the binary stream, causing Kiro IDE's parser to throw fatal exceptions.

### 2. `patch_kiro_extension.js`: Minified Bytecode Regex Matching
* **Why Fragile**: Relies on specific minification identifiers (`Bte`, `RKo`, `Vjl`, `whgwListModels`, `oos.has()`) inside Kiro IDE's compiled `extension.js` ([`scripts/patch_kiro_extension.js:301-334`](file:///d:/sdlc_studio/projects/kiro-integration/tmp_cloud_audit/scripts/patch_kiro_extension.js#L301-L334)).
* **Risk**: If Kiro IDE releases an update that re-bundles or re-minifies `extension.js` with different variable names, the patch regexes will fail to match (`patchCount = 0`).

---

## 3. Recommended Remediation Roadmap

1. **Phase A (Immediate Priority)**:
   - Add Vitest test harness with unit tests for `eventstream.ts` and `provider_manager.ts`.
   - Enforce mandatory `PROXY_ADMIN_TOKEN` generation on production deployments.
2. **Phase B (Scaling Priority)**:
   - Introduce Redis / Upstash (Zero-Cost Free Tier) to back `CanvasBridge` task queues and allow multi-instance Cloud Run horizontal scaling.
   - Store persistent configuration in Cloud Secret Manager or Upstash Redis rather than flat JSON on the container filesystem.
