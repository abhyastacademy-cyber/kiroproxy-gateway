# Testing & Verification Guide

> **CURRENT TEST STATUS (FACT):**
> There is currently **no automated unit or integration test runner** (such as Vitest, Jest, or Mocha) configured in `package.json` ([`package.json:7-14`](file:///d:/sdlc_studio/projects/kiro-integration/tmp_cloud_audit/package.json#L7-L14)).
> Verification is performed through static type analysis (`tsc --noEmit`), the in-browser interactive test harness ([`src/frontend/components/TesterTab.tsx`](file:///d:/sdlc_studio/projects/kiro-integration/tmp_cloud_audit/src/frontend/components/TesterTab.tsx)), and synthetic HTTP probe commands.

---

## 1. What Is and Isn't Covered

| Area | Current Verification Mechanism | Automated CI Coverage | Risk Level |
| :--- | :--- | :--- | :--- |
| **TypeScript Types & Imports** | `npm run lint` (`tsc --noEmit`) | Yes (Static Analysis) | Low |
| **Frontend Component Compilation**| `npm run build` (`vite build`) | Yes (Static Bundling) | Low |
| **AWS EventStream Framing & CRC32** | Manual prompt in Kiro IDE or synthetic cURL | **None** | **CRITICAL** |
| **7-Tier Waterfall & Fallback** | Interactive harness in `TesterTab.tsx` | **None** | High |
| **Gemini Multi-Key Failover** | Synthetic test with invalid/depleted keys | **None** | Medium |
| **Canvas Bridge Queue Polling** | In-Browser Worker Simulator in `CanvasBridgeTab.tsx` | **None** | Medium |
| **Config Serialization & `/tmp` Fallback** | Manual invocation of `POST /api/config` | **None** | Medium |

---

## 2. Safe Verification Workflow for New Changes

Whenever you modify any backend file, follow this 4-step verification sequence before committing:

### Step 1: Typecheck & Build
```bash
# 1. Verify TypeScript strict mode passes with 0 errors
npm run lint

# 2. Verify Vite production bundling succeeds
npm run build
```

### Step 2: Smoke Test Server Startup
```bash
# Start server in dev mode
npm run dev
```
In another terminal, verify the health and model discovery endpoints:
```bash
# Health check probe
curl -s http://127.0.0.1:3000/health | grep '"status":"healthy"'

# Verify model list returns JSON
curl -s http://127.0.0.1:3000/v1/models
```

### Step 3: Synthetic Stream Generation Test
Submit a test prompt to verify that `providerManager` and upstream LLM execution function properly:
```bash
curl -N -X POST http://127.0.0.1:3000/api/test/generate \
  -H "Content-Type: application/json" \
  -d '{"prompt":"Write a 1-sentence hello world message","model":"gemini-2.5-flash"}'
```
*Expected Output*: Server streams `data: {"chunk":"..."}` SSE chunks followed by `data: {"done":true,"provider":"...","model":"..."}`.

### Step 4: Kiro IDE End-to-End EventStream Verification
1. Launch Kiro IDE.
2. Select model `backend-ai/auto`, `gemini-2.5-flash`, or `global-automode`.
3. Send a prompt (e.g. `What time is it?`).
4. Ensure the response streams incrementally in Kiro IDE's chat window without deserialization errors or aborted streams.

### Step 5: Claude Code CLI Verification
```bash
export ANTHROPIC_BASE_URL="http://127.0.0.1:3000"
export ANTHROPIC_API_KEY="auto-auth"
claude
```
Verify that `POST /v1/messages` streams SSE events (`message_start`, `content_block_start`, `content_block_delta`, `message_delta`, `message_stop`) and tool calls (`Bash`, `FileEdit`) are recognized.

### Step 6: Backend Auto-Auth Verification (Zero User Keys)
```bash
node -e '
const http = require("http");
const postData = JSON.stringify({ modelId: "backend-ai/auto", conversationState: { currentMessage: { content: "PING" } } });
const req = http.request({ hostname: "localhost", port: 3000, path: "/generateAssistantResponse", method: "POST", headers: { "Content-Type": "application/json" } }, (res) => {
  console.log("Status:", res.statusCode, "Type:", res.headers["content-type"]);
});
req.write(postData);
req.end();
'
```
Asserts HTTP 200 with `application/vnd.amazon.eventstream` binary framing.

---

## 3. Recommended Future Automated Test Structure

To eliminate manual verification debt, future development should add Vitest:

```
tests/
├── unit/
│   ├── eventstream.test.ts      # Verifies IEEE 802.3 CRC32 byte calculation against known vectors
│   ├── config.test.ts           # Verifies /tmp fallback when process.cwd() is read-only
│   └── gemini_provider.test.ts  # Verifies sticky activeKeyIndex rotation on mocked 429
└── integration/
    ├── bedrock_handler.test.ts  # Sends mock conversationState and asserts binary frame headers
    └── waterfall.test.ts        # Mocks failed Tier 1 and asserts automatic cascading to Tier 2
```
