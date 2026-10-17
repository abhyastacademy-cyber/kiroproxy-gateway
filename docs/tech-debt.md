# Technical Debt & Architecture Scaling Audit

> **CURRENT TECHNICAL DEBT & ROADMAP:**
> Analysis of in-memory singletons, concurrency boundaries, and future refactoring candidates.

---

## 1. Identified Technical Debt Items

### Debt 1: In-Memory Canvas Bridge Task Queue
* **Location**: `src/backend/providers/canvas_bridge.ts`
* **Limitation**: The reverse-polling canvas queue (`tasks` array and pending promises) resides strictly in Node.js process memory.
* **Impact**: If multiple Cloud Run container instances scale horizontally, a `/poll` request from a browser worker might hit Instance B while the generation request landed on Instance A, causing tasks to time out.
* **Mitigation / Future Work**: For multi-instance scaling, backing the canvas queue with Redis or Firestore would synchronize workers across instances. Currently, Cloud Run should run with max 1 instance or stick to HTTP providers.

### Debt 2: In-Memory Circuit Breakers
* **Location**: `src/backend/resilience/circuit_breaker.ts`
* **Limitation**: Circuit breaker counters (`failures`, `state`) are process-local.
* **Impact**: Each container instance maintains its own trip state.
* **Assessment**: Acceptable for proxy gateway workloads; local circuit trips prevent noisy neighbor cascades without distributed lock latency.

### Debt 3: Synchronous File I/O on Config Save
* **Location**: `src/backend/config/index.ts` (`fs.writeFileSync`)
* **Limitation**: Configuration updates write synchronously to disk or `/tmp`.
* **Impact**: Blocks the event loop for ~1-2ms on configuration mutation.
* **Assessment**: Configuration updates are low-frequency administrative events; minimal user impact.

---

## 2. Refactoring Backlog
1. **Automated Integration Test Harness**: Implement headless test script to verify binary EventStream frame headers without needing a running Kiro IDE instance.
2. **Dynamic Provider Discovery**: Automatically probe custom provider endpoints on startup to pre-validate base URLs and model availability.

---

## 3. Recently Resolved Tech Debt
1. **Unreferenced Legacy Modules Retired**: Archived unreferenced experimental modules (`workflow_handler.ts`, `retry_engine.ts`, `kiro_ai_config.template.json`, `bun.lock`) into `/archive`.
2. **Frontend Bundle Splitting**: Configured manual vendor chunking in `vite.config.ts`, eliminating the monolithic 633 kB bundle and separating `vendor-react` and `vendor-icons` for cached browser distribution.
3. **Static Asset Caching**: Added immutable 1-year cache headers for `/dist/assets/*` in `server.ts`.
4. **Smithy Wire Protocol Alignment**: Fully aligned binary event frames with Kiro IDE's internal unmarshaller (`assistantResponseEvent`, `toolUseEvent`, `metadataEvent`), resolving the "Internal error" crash.
5. **Claude Code CLI & Anthropic Messages v1 Compatibility**: Added `anthropic_handler.ts` implementing `POST /v1/messages` with streaming SSE and tool-calling extraction.
6. **Backend Auto-Auth AI Architecture**: Integrated `backend-ai/*` with server-level runtime credentials (`MAJOR_CAPABILITY_SERVER_SIDE_GEMINI_API`) for zero-key execution.
7. **Dead Keys Auto-Purging & Leaked Key Guard**: Implemented `deadApiKeys` registry in `gemini_provider.ts` to purge 403-revoked keys instantly and cascade down the waterfall.
8. **Atomic Key Synchronization**: Synchronized scalar keys (`geminiApiKey`) and array keys (`geminiApiKeys`) across frontend and backend for persistent key deletions.
9. **Fast Failover on 401/403**: Immediate `baseUrlFailed = true` breaks upon unauthenticated responses, preventing 15-second loop timeouts.
