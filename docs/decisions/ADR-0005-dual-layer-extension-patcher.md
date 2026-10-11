# ADR-0005: Dual-Layer Client-Side Extension Patcher

* **Status**: ACCEPTED
* **Context**: Kiro IDE is a compiled VS Code fork whose extension bundle (`kiro.kiro-agent/dist/extension.js`) is hardcoded to connect to AWS Bedrock SSO endpoints (`https://runtime.<region>.kiro.dev`). When users deplete their official AWS credits, Kiro IDE displays monthly limit errors and stops working.
* **Decision**: Implement a surgical, idempotent Node CLI patcher ([`scripts/patch_kiro_extension.js`](file:///d:/sdlc_studio/projects/kiro-integration/tmp_cloud_audit/scripts/patch_kiro_extension.js)) that injects bytecode overrides:
  1. `whgwListModels`: Intercepts model discovery to inject proxy catalog models while gracefully querying `/listAvailableModels` first and `/v1/models` second.
  2. KRS Client & `getTarget()` Override: Rewrites the Bedrock runtime prompt endpoint to the configured gateway domain (`destinationUrl`) whenever a proxy model is selected or when `globalThis.__kiroProxyActive = true`.
  3. Clean Baseline Backup: Always reads from `extension.js.original` before applying regex mutations to guarantee idempotency across repeated executions.
* **Alternatives Considered**:
  - *Full extension recompilation from source*: Rejected; Kiro IDE's backend extension is proprietary and closed-source.
  - *Operating system `/etc/hosts` DNS hijacking*: Rejected; requires local root/administrator privileges and breaks SSL certificate validation.
* **Consequences**:
  - Non-destructive client modification reversible in one second via `--revert`.
  - Enables seamless coexistence of official AWS Bedrock and 24/7 Cloud KiroProxy.
* **Do Not Change Unless**: Kiro IDE transitions to standard VS Code Language Model API extensions where proxy endpoints can be configured natively via GUI settings.
* **Evidence (FACT)**:
  - [`scripts/patch_kiro_extension.js:212`](file:///d:/sdlc_studio/projects/kiro-integration/tmp_cloud_audit/scripts/patch_kiro_extension.js#L212) (`whgwListModels` dual-mode fetch logic).
  - [`scripts/patch_kiro_extension.js:304-335`](file:///d:/sdlc_studio/projects/kiro-integration/tmp_cloud_audit/scripts/patch_kiro_extension.js#L304-L335) (KRS client and `getTarget()` bytecode replacement).
