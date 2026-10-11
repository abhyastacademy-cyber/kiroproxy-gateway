# ADR-0004: Stateless Multi-Key & Nested Base-URL Failover Loops

* **Status**: ACCEPTED
* **Context**: Free API keys from Google AI Studio and free endpoints (Groq, Together, DeepSeek) encounter aggressive rate-limiting (`15 RPM` on Gemini free tiers). Users frequently manage pools of 5 to 20 free API keys and multiple tunnel/mirror base URLs.
* **Decision**: Implement nested failover algorithms:
  1. **Gemini Multi-Key Failover**: `GeminiProvider` scans candidate keys (`geminiApiKeys: []`) and executes requests with sticky index preservation (`activeKeyIndex = keyIndex`) on 429 quota exhaustion.
  2. **Custom Provider Nested Loop**: `CustomProviderService` iterates across `baseUrls: []` (outer loop) and tries all `apiKeys: []` (inner loop) before declaring failure.
* **Alternatives Considered**:
  - *External Redis Token Bucket Rate Limiter*: Rejected to keep the gateway completely zero-cost and dependency-free without requiring Redis infrastructure.
* **Consequences**:
  - Handles key rotation with zero external database dependencies.
  - Sticky index prevents unnecessary round-trip errors to already exhausted keys.
* **Do Not Change Unless**: A centralized stateful key management cluster or distributed Redis cache is integrated into the architecture.
* **Evidence (FACT)**:
  - [`src/backend/providers/gemini_provider.ts:88-124`](file:///d:/sdlc_studio/projects/kiro-integration/tmp_cloud_audit/src/backend/providers/gemini_provider.ts#L88-L124) (`activeKeyIndex` sticky failover loop).
  - [`src/backend/providers/custom_provider.ts:38-65`](file:///d:/sdlc_studio/projects/kiro-integration/tmp_cloud_audit/src/backend/providers/custom_provider.ts#L38-L65) (`for (baseUrl of urls) { for (apiKey of keys) { ... } }`).
