# Open Questions & Operational Unknowns

> **HUMAN OPERATOR ACTION REQUIRED:**
> The following items represent technical unknowns identified during codebase analysis that require human confirmation or infrastructure access to resolve.

---

## 1. Operational Unknowns Checklist

- [ ] **OQ-01: Google Cloud Run Autoscaling Parameters**
  - **Status**: **UNKNOWN: needs human confirmation**
  - **Context**: `CanvasBridge` uses in-memory task queues (`Map<string, EventEmitter>`) ([`src/backend/providers/canvas_bridge.ts:28`](file:///d:/sdlc_studio/projects/kiro-integration/tmp_cloud_audit/src/backend/providers/canvas_bridge.ts#L28)). If Cloud Run scales to $>1$ instance, tasks experience timeouts.
  - **Question for Human**: Is the Cloud Run service `kiroproxy` explicitly configured with `--max-instances=1`, or does it autoscale up to 10 instances?
  - **Impact**: If autoscaling is enabled, Gemini Canvas reverse polling will intermittently fail on multi-instance traffic.

- [ ] **OQ-02: Domain Routing & SSL Edge Termination for `kiroproxy.ai.studio`**
  - **Status**: **UNKNOWN: needs human confirmation**
  - **Context**: The canonical Cloud Run URL is `https://kiroproxy-746899042471.asia-southeast1.run.app`, but documentation references `https://kiroproxy.ai.studio`.
  - **Question for Human**: Is `kiroproxy.ai.studio` mapped via Google Cloud Run Custom Domains, Cloudflare Proxied DNS (Orange Cloud), or Firebase Hosting rewrites?
  - **Impact**: Cloudflare edge caching or request buffering could delay streaming EventStream response chunks if buffer flags (`X-Accel-Buffering: no`) are not honored at the edge.

- [ ] **OQ-03: Security & Rate-Limiting Policy**
  - **Status**: **UNKNOWN: needs human confirmation**
  - **Context**: When `PROXY_ADMIN_TOKEN` is unset in Cloud Run environment variables, `validateAdminAuth()` permits all incoming traffic ([`src/backend/handlers/bedrock_handler.ts:12`](file:///d:/sdlc_studio/projects/kiro-integration/tmp_cloud_audit/src/backend/handlers/bedrock_handler.ts#L12)).
  - **Question for Human**: Is the Cloud Run gateway intended to be publicly accessible for community sharing, or should an admin token be mandatory on production deployments?
  - **Impact**: Unauthenticated deployments can be drained of Google AI Studio and third-party API quotas by internet scanners.

- [ ] **OQ-04: Headless Gemini Worker Deployment Strategy**
  - **Status**: **UNKNOWN: needs human confirmation**
  - **Context**: Configuration contains `headlessGeminiWorker: { enabled: boolean, autoStart: boolean, chromeExecutablePath: string }` ([`src/backend/config/index.ts:54`](file:///d:/sdlc_studio/projects/kiro-integration/tmp_cloud_audit/src/backend/config/index.ts#L54)), but Alpine Docker container does not install Chromium.
  - **Question for Human**: Is the Gemini Canvas worker meant to run strictly via developer browser tabs, or will an automated headless Puppeteer/Chrome container be deployed in the future?
  - **Impact**: Determines whether Chromium dependencies should be added to `Dockerfile`.
