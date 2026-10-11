# ADR-0003: 7-Tier Zero-Cost Waterfall Cascade

* **Status**: ACCEPTED
* **Context**: Developers need 100% continuous uptime without incurring unexpected AI inference bills or getting blocked by rate limits (`429 Too Many Requests`). A single provider or free model frequently suffers transient spikes or daily quota exhaustion.
* **Decision**: Implement a structured 7-tier waterfall dispatching mechanism in [`src/backend/providers/provider_manager.ts`](file:///d:/sdlc_studio/projects/kiro-integration/tmp_cloud_audit/src/backend/providers/provider_manager.ts):
  1. `kilo` (Kilo Gateway 177+ free models)
  2. `cline` (Cline bot free rotation)
  3. `openrouter` (OpenRouter free tier models)
  4. `orcarouter` (OrcaRouter free tier)
  5. `gemini` (Google GenAI direct SDK with multi-key rotation)
  6. `custom` (Custom OpenAI-compatible provider endpoints)
  7. `canvas` (Gemini Canvas reverse-polling browser bridge)
  When any tier throws an error, the engine logs the diagnostic metric and seamlessly cascades to the next tier in `providerPriorityOrder`.
* **Alternatives Considered**:
  - *Hard fail on primary provider error*: Rejected; causes broken developer conversations on transient rate limits.
  - *Round-robin load balancing*: Rejected; priority should favor zero-cost, high-speed providers before falling back to manual or limited tiers.
* **Consequences**:
  - Near-100% request success rate even during upstream outages.
  - Transparent failover invisible to Kiro IDE.
* **Do Not Change Unless**: A new provider class is added or a specific enterprise customer mandates strict single-provider compliance with zero fallback.
* **Evidence (FACT)**:
  - [`src/backend/providers/provider_manager.ts:135-241`](file:///d:/sdlc_studio/projects/kiro-integration/tmp_cloud_audit/src/backend/providers/provider_manager.ts#L135-L241) (Priority tier iteration and error capture loop).
  - [`src/backend/config/index.ts:99-102`](file:///d:/sdlc_studio/projects/kiro-integration/tmp_cloud_audit/src/backend/config/index.ts#L99-L102) (Default tier priority order definition).
