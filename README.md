<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# KiroProxy Gateway Cloud (v2.8.0-cloud)

High-performance, zero-cost proxy gateway for **Kiro IDE**. Hosted on Google Cloud Run and Google AI Studio, KiroProxy transparently intercepts AWS Bedrock binary EventStream requests (`/generateAssistantResponse`) and routes them across a 7-tier resilient waterfall (`kilo -> cline -> openrouter -> orcarouter -> gemini -> custom -> canvas`), returning responses encoded in IEEE 802.3 CRC32-framed binary EventStream buffers.

---

## Key Features

- **7-Tier Resilient Waterfall**: Automatic failover across Kilo, Cline, OpenRouter, OrcaRouter, Google Gemini, Custom OpenAI-compatible endpoints, and Gemini Canvas Bridge.
- **Three Non-Stop Access Archetypes**:
  1. `global-automode`: Full cross-provider and cross-model cascade.
  2. Provider-specific otomodes (`openrouter-otomode`, `kilo-otomode`, etc.): Intra-provider model cascade with key rotation.
  3. Specific model targeting: Cascades that exact model across all providers supplying it, **accumulating combined free quota limits**.
- **Smithy & Bedrock Binary EventStream**: Native `assistantResponseEvent`, `toolUseEvent`, and `metadataEvent` binary encoding with IEEE 802.3 CRC32 framing preventing Kiro IDE unmarshaller crashes.
- **Universal AWS Catch-All**: Absorbs auxiliary telemetry (`POST /`), MCP streams (`POST /mcp/stream`), and event requests, returning HTTP 200 OK.
- **Multi-Format Tool Extraction Engine**: Detects and extracts tools across 13+ LLM formats (bare JSON, direct XML tags, Kiro native, Anthropic, Qwen/DeepSeek tags) and auto-extracts code manifests (`package.json`, `tsconfig.json`) into `fs_write`.
- **Dual-Mode Discovery**: Supports both Smithy (`/listAvailableModels`) and OpenAI (`/v1/models`) discovery formats with 100+ zero-cost free models.
- **Optimized Production Bundle**: Rollup code-splitting with dedicated vendor chunks (`vendor-react`, `vendor-icons`, `vendor-motion`) and 1-year immutable caching.
- **Cloud Run Native**: Zero dependency on local tunneling tools; native HTTPS ingress with `/tmp` filesystem write fallbacks.

---

## Quick Start

### 1. Run Locally
```bash
npm install
npm run dev
```
Access the dashboard at `http://localhost:3000`.

### 2. Connect Kiro IDE
1. Open the gateway dashboard and navigate to the **Patcher** tab.
2. Run the provided one-line patch script to redirect Kiro IDE's `extension.js` to your gateway endpoint.
3. Reload Kiro IDE.

### 3. Build & Test
```bash
# Typecheck
npm run lint

# Production bundle
npm run build
```

---

## Documentation Index

Refer to the complete architectural manuals in `/docs`:
- [`docs/system-map.md`](docs/system-map.md): High-level topology and module breakdown.
- [`docs/change-impact.md`](docs/change-impact.md): Blast radius and coupled component matrix.
- [`docs/invariants-and-gotchas.md`](docs/invariants-and-gotchas.md): Unbreakable system laws and traps.
- [`docs/troubleshooting.md`](docs/troubleshooting.md): Operational diagnosis and error resolutions.
- [`docs/data-model.md`](docs/data-model.md): Configuration schema and catalog entities.
- [`docs/api-contracts.md`](docs/api-contracts.md): Wire protocol and endpoint specifications.
- [`docs/config-and-env.md`](docs/config-and-env.md): Environment variables and security rules.
- [`docs/testing.md`](docs/testing.md): Verification procedures and test workflows.
- [`docs/tech-debt.md`](docs/tech-debt.md): Scaling limits and refactoring backlog.
- [`docs/open-questions.md`](docs/open-questions.md): Tracked technical inquiries.

