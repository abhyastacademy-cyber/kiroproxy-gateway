# ADR-0002: AWS Bedrock EventStream Wire Protocol Emulation

* **Status**: ACCEPTED
* **Context**: Kiro IDE communicates with AWS Bedrock via HTTP POST to `/generateAssistantResponse` expecting binary data with `Content-Type: application/vnd.amazon.eventstream`. Each stream frame requires an 8-byte prelude, 4-byte prelude CRC, variable-length headers, variable-length payload, and a 4-byte message CRC calculated using IEEE 802.3 CRC32.
* **Decision**: Implement a native TypeScript binary encoder in [`src/backend/handlers/eventstream.ts`](file:///d:/sdlc_studio/projects/kiro-integration/tmp_cloud_audit/src/backend/handlers/eventstream.ts) utilizing a precomputed 256-element lookup table for IEEE 802.3 CRC32 and Node `Buffer` manipulation. Text deltas are wrapped inside base64 JSON payload chunks matching Kiro IDE's internal deserializer expectations.
* **Alternatives Considered**:
  - *Using official AWS SDK `@aws-sdk/eventstream-codec`*: Rejected because it introduced large dependency trees, ESM/CJS bundling issues, and lacks direct low-level control over custom header injection and mock stop reasons.
* **Consequences**:
  - Zero external dependencies for binary framing.
  - Sub-millisecond chunk encoding latency.
  - Exact wire compatibility with Kiro IDE desktop releases.
* **Do Not Change Unless**: Kiro IDE deprecates AWS Bedrock EventStream wire format in favor of plain OpenAI Server-Sent Events (SSE).
* **Evidence (FACT)**:
  - [`src/backend/handlers/eventstream.ts:7-96`](file:///d:/sdlc_studio/projects/kiro-integration/tmp_cloud_audit/src/backend/handlers/eventstream.ts#L7-L96) (Precomputed CRC table and `buildEventStreamFrame`).
  - [`src/backend/handlers/bedrock_handler.ts:121-140`](file:///d:/sdlc_studio/projects/kiro-integration/tmp_cloud_audit/src/backend/handlers/bedrock_handler.ts#L121-L140) (Binary headers and frame streaming).
