# Troubleshooting & Incident Diagnosis Guide

> **INCIDENT DIAGNOSTICS:**
> Step-by-step resolution procedures for common operational issues, connection rejections, quota limits, and timeouts.

---

## 1. Quick Diagnostic Flowchart

```text
Problem Encountered
  ├── Kiro IDE displays "Connecting..." or hangs
  │     ├── Check 1: Is the gateway accessible via HTTPS? (Run: curl -s https://<gateway-domain>/health)
  │     ├── Check 2: Was extension.js patched with the current URL? (Re-run Patcher script from UI)
  │     └── Check 3: Check admin token — if PROXY_ADMIN_TOKEN is set, URL must be /k/<token>/generateAssistantResponse
  │
  ├── 429 Too Many Requests
  │     ├── In Global Automode: Circuit breaker trips after 3 failures; next provider takes over automatically.
  │     └── For Specific Model: Add API keys in "API Keys" tab or add secondary custom providers to accumulate limits.
  │
  ├── 502 / Upstream Timeout (> 20s)
  │     ├── Check 1: In "Providers" tab, verify order — move responsive providers (Gemini or OpenRouter) to top.
  │     └── Check 2: Reset circuit breakers via POST /api/circuit/reset or the UI toggle.
  │
  └── Read-Only File System Error (EROFS)
        └── Verify configManager is writing to /tmp/kiro_ai_config.json on containerized environments.
```

---

## 2. Common Issues & Solutions

### 1. Kiro IDE Fails to Stream Responses
* **Symptoms**: Kiro IDE shows an error dialog: `Unexpected token in EventStream` or hangs indefinitely without generating text.
* **Root Cause**: Corrupted CRC32 checksum or malformed message framing in `src/backend/handlers/eventstream.ts`.
* **Verification**:
  ```bash
  curl -X POST http://localhost:3000/generateAssistantResponse \
    -H "Content-Type: application/json" \
    -d '{"conversationState":{"currentMessage":{"content":"hi"}}}' | xxd | head -n 5
  ```
  Check that the first 4 bytes indicate a valid Big-Endian total length and the subsequent 4 bytes represent the header length.

### 2. 401 Unauthorized / Rejection on Bedrock Endpoint
* **Symptoms**: Kiro IDE receives HTTP 401 on `/generateAssistantResponse`.
* **Root Cause**: `PROXY_ADMIN_TOKEN` is configured on the gateway, but Kiro IDE's patched `extension.js` is sending requests without the token.
* **Resolution**:
  1. Open the **Patcher** tab in the gateway dashboard.
  2. Copy the updated one-liner patch command (which contains `/k/<token>/...`).
  3. Execute the patch in the terminal and reload Kiro IDE.

### 3. Upstream Provider 429 Quota Exhaustion
* **Symptoms**: Models return `Rate limit reached for free tier` or `429 Too Many Requests`.
* **Resolution**:
  1. KiroProxy automatically fails over to the next provider in the 7-tier waterfall.
  2. In the **API Keys** tab, add multiple keys for OpenRouter, Cline, or Gemini. KiroProxy rotates keys automatically.
  3. In the **Providers** tab, enable or reorder custom providers offering the same model.

### 4. Cloud Run Cold Starts & Health Check Failures
* **Symptoms**: First request after inactivity takes 4–8 seconds.
* **Resolution**:
  1. Ensure HTTP keep-alive timeouts are set to 65s in `server.ts` to prevent premature socket resets.
  2. Use Cloud Run minimum instances (`--min-instances=1`) in production for zero cold starts.
  3. In-memory model catalog caching ensures `/listAvailableModels` responds in < 1ms even during cold boots.

### 5. Kiro IDE Reports "Error sending prompt: Internal error"
* **Symptoms**: Kiro IDE shows `Error sending prompt: Internal error (Conversation ID: sess_...)` immediately after submitting a prompt.
* **Root Cause**: The gateway previously emitted standard AWS Bedrock Converse `:event-type: chunk` frames with base64 `bytes` payload. Kiro IDE's internal extension (`extension.js`) unmarshaller strictly expects Smithy binary frames (`assistantResponseEvent`, `toolUseEvent`, `metadataEvent`). Receiving `:event-type: chunk` threw an unhandled unmarshaller exception.
* **Resolution**:
  1. Updated `src/backend/handlers/eventstream.ts`, `bedrock_handler.ts`, and `tool_translator.ts` to stream native Smithy frames:
     - `assistantResponseEvent`: Direct UTF-8 JSON `{"content":"...","modelId":"...","messageId":"..."}`
     - `toolUseEvent`: Direct UTF-8 JSON `{"toolUseId":"...","name":"...","input":"...","stop":true}`
     - `metadataEvent`: Direct UTF-8 JSON `{"tokenUsage":{...},"stopReason":"END_TURN"|"TOOL_USE"}`
  2. Added Kiro IDE session headers (`x-amzn-kiro-conversation-id`, `x-amzn-kiro-profile-arn`, `x-amzn-requestid`, `x-amzn-session-id`).
  3. Verified with live regression probe tests identical to `kpgateway.space-z.ai`.
