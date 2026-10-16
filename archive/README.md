# Archive Registry & Deprecated Component Index

This directory archives obsolete, unreferenced, and superseded legacy components from earlier revisions of `kiroproxy-gateway-cloud`.

---

## Archived Components

| Archived Path | Original Path | Retirement Reason | Active Replacement |
| :--- | :--- | :--- | :--- |
| `archive/config/kiro_ai_config.template.json` | `config/kiro_ai_config.template.json` | Outdated schema lacking preloaded custom providers (Groq, Cerebras, Mistral, GitHub, etc.). Redundant with `example.json`. | `config/kiro_ai_config.example.json` & `src/backend/config/index.ts` |
| `archive/handlers/workflow_handler.ts` | `src/backend/handlers/workflow_handler.ts` | Unreferenced in-memory experimental workflow tracker from local IDE prototype. Never mounted in cloud server. | Native Smithy session tracking in `src/backend/handlers/bedrock_handler.ts` |
| `archive/resilience/retry_engine.ts` | `src/backend/resilience/retry_engine.ts` | Unreferenced standalone exponential backoff loop. Replaced by the 7-tier zero-cost waterfall failover. | `src/backend/providers/otomode.ts` & `provider_manager.ts` |
| `archive/bun.lock` | `bun.lock` | Legacy package lockfile from Bun experimentation. Node 22 + npm is the standard runtime environment. | `package.json` |

---

## Retention Policy
- These files are kept for historical reference and architectural auditing.
- No active runtime imports exist to any files within `/archive`.
