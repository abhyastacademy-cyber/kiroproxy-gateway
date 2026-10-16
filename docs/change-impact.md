# Change Impact & Blast Radius Matrix

> **MANDATORY PRE-EDIT REFERENCE:**
> Every engineer and AI coding assistant must evaluate this impact matrix prior to modifying any file.
> Failure to verify coupled components risks breaking Kiro IDE connectivity, EventStream CRC framing, or Cloud Run persistence.

---

## 1. High-Risk Files & Blast Radius

| File | Upstream Coupling | Downstream Impact | Failure Mode if Broken | Verification Required |
| :--- | :--- | :--- | :--- | :--- |
| `src/backend/handlers/eventstream.ts` | AWS Bedrock Protocol | Kiro IDE Client | IDE hangs, crashes with protocol parse errors, or rejects response | Run synthetic binary frame test; inspect CRC32 calculation |
| `src/backend/handlers/bedrock_handler.ts` | `server.ts`, Kiro extension | `providerManager`, EventStream | Rejection of prompts, 401 unauthenticated drops, memory leaks on streaming | Test `/generateAssistantResponse` with both raw text and ConversationState JSON |
| `src/backend/providers/provider_manager.ts` | Bedrock & OpenAI handlers | All 7 provider tiers | Complete failure of AI generation; waterfall starvation | Test in `TesterTab.tsx`; verify fallback across tiers on forced 429 |
| `src/backend/providers/otomode.ts` | `provider_manager.ts` | Kilo, Cline, OpenRouter, OrcaRouter | High latency timeouts (>20s), 429 rate limit stalls | Test specific model routing (`deepseek-r1:free`) and `global-automode` |
| `src/backend/config/index.ts` | All backend modules | File persistence, `/tmp` storage | Read-only filesystem crashes on Cloud Run; lost API keys | Verify write operation succeeds on read-only mock or container filesystem |
| `src/backend/config/catalog.ts` | `openai_handler.ts`, `server.ts` | `/v1/models`, `/listAvailableModels`, UI | Model list empty; duplicated keys; React render crashes | Verify unique IDs in catalog; test `/v1/models` JSON |
| `server.ts` | Cloud Run environment | All HTTP traffic | App fails to boot; port binding collision; cold start timeouts | Run `npm run lint` && `npm run build` |

---

## 2. Blast Radius Scenarios

### Scenario A: Modifying Provider Priority Order
* **Files Affected**:
  - `src/backend/config/index.ts` (`DEFAULT_CONFIG.providerPriorityOrder`)
  - `src/frontend/types.ts` (`ProviderPriorityOrder` or `tierOrder`)
  - `src/frontend/components/ProvidersTab.tsx`
  - `docs/api-contracts.md`
* **Invariant**: Never remove any of the 7 default tiers (`kilo`, `cline`, `openrouter`, `orcarouter`, `gemini`, `custom`, `canvas`). Changing order must be validated through configuration persistence.

### Scenario B: Adding or Modifying Model IDs in Catalog
* **Files Affected**:
  - `src/backend/config/catalog.ts`
  - `src/frontend/components/ModelsTab.tsx`
  - `src/frontend/components/FreeTierCalculator.tsx`
* **Invariant**: Model IDs must be strictly unique. Never emit duplicate IDs in `getCompleteModelCatalog` as this causes React key collision warnings and breaks extension model picker.

### Scenario C: Modifying EventStream Protocol Wire Logic
* **Files Affected**:
  - `src/backend/handlers/eventstream.ts`
  - `src/backend/handlers/bedrock_handler.ts`
* **Invariant**: Header length + Payload length + 4-byte CRC prelude + 4-byte message CRC must strictly equal Total Message Length. CRC32 polynomial is standard IEEE 802.3 (Ethernet/ZIP). Kiro IDE requires Smithy frames (`assistantResponseEvent`, `toolUseEvent`, `metadataEvent`).

### Scenario D: Modifying Universal AWS Catch-All or Extension Patching Logic
* **Files Affected**:
  - `server.ts` (`handleAwsCatchAll`)
  - `scripts/patch_kiro_extension.js` (Patch 1, Patch 3A+, Patch 3B, Patch 6)
  - `src/frontend/components/PatcherTab.tsx`
* **Invariant**: Never remove `handleAwsCatchAll` on `POST /`, `POST /mcp/stream`, `POST /events`, or `POST /telemetry`. In `patch_kiro_extension.js`, `resolveTarget` must return `void 0` to silence telemetry calls at the client source.

---

## 3. Mandatory Pre-Flight Verification Sequence

Before pushing or completing any changes:
1. `npm run lint`: Verify TypeScript compiles with zero errors under strict mode.
2. `npm run build`: Verify Vite production bundling completes with zero syntax or bundling errors.
3. Test Health: `GET /health` returns status `healthy` and provider counts.
4. Test Model Discovery: `GET /v1/models` returns valid list with unique model IDs.
5. Update Documentation: Record changes in `/docs`.
