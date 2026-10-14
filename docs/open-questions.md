# Open Questions & Architectural Investigations

> **UNRESOLVED QUESTIONS & TRACKED INQUIRIES:**
> Items requiring empirical verification, upstream API validation, or user confirmation.

---

## 1. Tracked Technical Inquiries

### Question 1: Upstream Kilo Gateway Public Availability
* **Status**: Mitigated with fallback.
* **Detail**: `https://api.kilo.ai/api/gateway/chat/completions` intermittently throttles or experiences regional latency for unauthenticated requests.
* **Mitigation**: KiroProxy applies a 3,500ms timeout on unauthenticated Kilo requests and immediately cascades to OpenRouter/Cline tiers.

### Question 2: Cloud Run Session Affinity for Canvas Bridge
* **Status**: Open investigation.
* **Detail**: When Canvas Bridge is used in high-concurrency environments, will enabling Google Cloud Run session affinity cookies (`--session-affinity`) suffice to keep polling workers routed to the correct instance?
* **Next Steps**: Conduct stress testing under simulated multi-instance traffic.

### Question 3: Dynamic Context Window Negotiation
* **Status**: Resolved.
* **Detail**: Models exhibit diverse context windows (e.g. 8k to 128k). KiroProxy clamps `maxTokens` safely according to catalog specifications (`catalog.ts`) and trims conversation history to preserve headroom.
