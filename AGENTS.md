# AGENTS.md — KiroProxy Cloud Gateway AI Maintenance Guide

> **CRITICAL INSTRUCTION FOR ALL AI CODING ASSISTANTS:**
> Before modifying code, read `docs/change-impact.md` and `docs/invariants-and-gotchas.md`.
> After making code changes, update all affected documentation in `/docs`.

---

## 1. App Summary
`kiroproxy-gateway-cloud` (v2.8.0-cloud) is a high-performance proxy gateway hosted on Google Cloud Run (`https://kiroproxy-746899042471.asia-southeast1.run.app`) and Google AI Studio (`https://kiroproxy.ai.studio`). It intercepts AWS Bedrock binary EventStream requests (`/generateAssistantResponse`) from Kiro IDE and transparently proxies them across a 7-tier zero-cost waterfall (`kilo -> cline -> openrouter -> orcarouter -> gemini -> custom -> canvas`), returning responses encoded in IEEE 802.3 CRC32-framed binary EventStream buffers matching native Smithy unmarshaller protocols. Cloud Run native HTTPS ingress replaces `@ngrok/ngrok`.

---

## 2. Documentation Index

| Documentation File | Read This When... |
| :--- | :--- |
| [`docs/system-map.md`](docs/system-map.md) | Understanding architecture, module dependencies, entry points, or external integrations. |
| [`docs/change-impact.md`](docs/change-impact.md) | **MUST READ BEFORE CODE EDITS:** Evaluating blast radius, coupled files, and required verification. |
| [`docs/invariants-and-gotchas.md`](docs/invariants-and-gotchas.md) | **MUST READ BEFORE CODE EDITS:** Reviewing unbreakable system invariants, race conditions, and traps. |
| [`docs/troubleshooting.md`](docs/troubleshooting.md) | Diagnosing errors, auth rejections, 429 quota traps, 20s timeouts, or Cloud Run cold starts. |
| [`docs/data-model.md`](docs/data-model.md) | Inspecting configuration entities, state lifecycles, `/tmp` fallbacks, and schema constraints. |
| [`docs/api-contracts.md`](docs/api-contracts.md) | Modifying or verifying HTTP endpoints, headers, Bedrock EventStream frames, or SSE events. |
| [`docs/config-and-env.md`](docs/config-and-env.md) | Adding, editing, or auditing environment variables and feature flags. |
| [`docs/decisions/`](docs/decisions/) | Reviewing architectural decision records (ADRs) to know what code is load-bearing. |
| [`docs/testing.md`](docs/testing.md) | Verifying manual workflows, test harness execution, and synthetic regression scripts. |
| [`docs/tech-debt.md`](docs/tech-debt.md) | Auditing scaling limits, in-memory queues, and planned architectural refactors. |
| [`docs/open-questions.md`](docs/open-questions.md) | Checking unresolved technical unknowns requiring human confirmation. |

---

## 3. Hard Rules (Non-Negotiable)
1. **NEVER add `@ngrok/ngrok` back into the cloud package** (`tmp_cloud_audit`). Cloud Run provides native SSL ingress.
2. **NEVER break IEEE 802.3 CRC32 EventStream wire framing** in [`src/backend/handlers/eventstream.ts`](src/backend/handlers/eventstream.ts). Kiro IDE requires native Smithy frames (`assistantResponseEvent`, `toolUseEvent`, `metadataEvent`). Standard Bedrock Converse `:event-type: chunk` crashes the extension unmarshaller.
3. **NEVER mutate the 7 default priority tiers** (`kilo,cline,openrouter,orcarouter,gemini,custom,canvas`) without updating both backend defaults and frontend types.
4. **ALWAYS maintain `/tmp/kiro_ai_config.json` write fallback** in [`src/backend/config/index.ts`](src/backend/config/index.ts). Cloud Run filesystems are read-only outside `/tmp`.
5. **ALWAYS support dual-mode model list discovery** (`whgwListModels` supports both `/listAvailableModels` and `/v1/models`).
6. **NEVER commit plain API keys** or auth tokens to `config/kiro_ai_config.json` or `.env.example`.
7. **ALWAYS maintain the Universal AWS Catch-All** (`handleAwsCatchAll` in `server.ts`) to absorb auxiliary requests (`POST /`, `POST /mcp/stream`, `POST /events`, telemetry) with HTTP 200 OK.

---

## 4. Operational Commands

| Task | Command | Purpose |
| :--- | :--- | :--- |
| **Run Dev Server** | `npm run dev` | Runs `tsx server.ts` locally with hot TypeScript execution. |
| **Production Start**| `npm run start` | Executes `tsx server.ts` directly on Node 22 runtime. |
| **Build Frontend** | `npm run build` | Compiles React 19 SPA with Vite into production `dist/` with vendor chunks. |
| **Preview Frontend**| `npm run preview`| Previews compiled `dist/` directory. |
| **Typecheck / Lint**| `npm run lint` | Runs `tsc --noEmit` to validate TypeScript strict types. |
| **Clean Build** | `npm run clean` | Deletes `dist/` compiler artifacts. |
| **Docker Build** | `docker build -t kiroproxy-cloud .` | Builds the multi-stage production Alpine container. |

---

## 5. Maintenance Workflow
1. **Before Touching Code**: Identify modified modules in [`docs/change-impact.md`](docs/change-impact.md) and verify invariants in [`docs/invariants-and-gotchas.md`](docs/invariants-and-gotchas.md).
2. **Implement Incrementally**: Retain strict TypeScript types without `any`.
3. **Verification**: Run `npm run lint` and `npm run build`. Test generation via `TesterTab` or `curl -s https://.../v1/models`.
4. **After Edits**: Update documentation files and commit clean artifacts.
