# Configuration & Environment Variables Reference

> **OPERATIONAL SECURITY MANDATE:**
> Never commit actual API keys, credentials, or production tokens into version control or documentation files.

---

## 1. Environment Variables Inventory

| Variable Name | Purpose | Where Used (Code Citation) | Required? | Default Value | What Breaks If Missing or Incorrect |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `PORT` | HTTP port on which the Express server listens. | [`server.ts:315`](file:///d:/sdlc_studio/projects/kiro-integration/tmp_cloud_audit/server.ts#L315), [`src/backend/config/index.ts:96`](file:///d:/sdlc_studio/projects/kiro-integration/tmp_cloud_audit/src/backend/config/index.ts#L96) | No | `3000` | Cloud Run injects `PORT=8080`; if overridden or bound incorrectly, Cloud Run container fails health checks and terminates. |
| `HOST` | Network interface to bind. | [`server.ts:314`](file:///d:/sdlc_studio/projects/kiro-integration/tmp_cloud_audit/server.ts#L314), [`src/backend/config/index.ts:95`](file:///d:/sdlc_studio/projects/kiro-integration/tmp_cloud_audit/src/backend/config/index.ts#L95) | No | `0.0.0.0` | Binding to `127.0.0.1` inside Docker prevents external HTTP traffic from reaching the container. |
| `PUBLIC_DOMAIN_URL` | Canonical public HTTPS domain for the gateway. | [`src/backend/config/index.ts:97`](file:///d:/sdlc_studio/projects/kiro-integration/tmp_cloud_audit/src/backend/config/index.ts#L97), [`src/backend/resilience/health.ts:28`](file:///d:/sdlc_studio/projects/kiro-integration/tmp_cloud_audit/src/backend/resilience/health.ts#L28) | No | `https://kiroproxy-746899042471.asia-southeast1.run.app` | If incorrect, generated patcher commands and Canvas worker scripts link to wrong URLs. |
| `PROXY_ADMIN_TOKEN` | Master secret key protecting administrative & streaming endpoints. | [`src/backend/config/index.ts:98`](file:///d:/sdlc_studio/projects/kiro-integration/tmp_cloud_audit/src/backend/config/index.ts#L98), [`src/backend/handlers/bedrock_handler.ts:11`](file:///d:/sdlc_studio/projects/kiro-integration/tmp_cloud_audit/src/backend/handlers/bedrock_handler.ts#L11) | **Recommended in Production** | `""` (Empty string) | If omitted, gateway is fully open to unauthenticated public requests on the internet. |
| `PROVIDER_PRIORITY_ORDER` | Comma-delimited list of priority tiers for the fallback waterfall. | [`src/backend/config/index.ts:99-102`](file:///d:/sdlc_studio/projects/kiro-integration/tmp_cloud_audit/src/backend/config/index.ts#L99-L102), [`src/backend/providers/provider_manager.ts:132`](file:///d:/sdlc_studio/projects/kiro-integration/tmp_cloud_audit/src/backend/providers/provider_manager.ts#L132) | No | `kilo,cline,openrouter,orcarouter,gemini,custom,canvas` | If malformed or missing required tiers, requests cascade to non-existent providers. |
| `GEMINI_API_KEY` | Primary API key for Google AI Studio / Gemini Developer API. | [`src/backend/config/index.ts:109`](file:///d:/sdlc_studio/projects/kiro-integration/tmp_cloud_audit/src/backend/config/index.ts#L109), [`src/backend/providers/gemini_provider.ts:43`](file:///d:/sdlc_studio/projects/kiro-integration/tmp_cloud_audit/src/backend/providers/gemini_provider.ts#L43) | Conditionally | `""` | If unset and no custom providers exist, Gemini tier throws `GEMINI_API_KEY is not configured`. |
| `KILO_API_KEY` | Optional API key for Kilo Gateway paid quotas. | [`src/backend/config/index.ts:111`](file:///d:/sdlc_studio/projects/kiro-integration/tmp_cloud_audit/src/backend/config/index.ts#L111), [`src/backend/providers/otomode.ts:80`](file:///d:/sdlc_studio/projects/kiro-integration/tmp_cloud_audit/src/backend/providers/otomode.ts#L80) | No | `""` | Kilo tier operates in Zero-Key free mode when this is blank. |
| `OPENROUTER_API_KEY` | API key for OpenRouter completions and free rotation. | [`src/backend/config/index.ts:115`](file:///d:/sdlc_studio/projects/kiro-integration/tmp_cloud_audit/src/backend/config/index.ts#L115), [`src/backend/providers/otomode.ts:90`](file:///d:/sdlc_studio/projects/kiro-integration/tmp_cloud_audit/src/backend/providers/otomode.ts#L90) | No | `""` | OpenRouter tier attempts anonymous free-tier completion. |
| `CLINE_API_KEY` | API key for Cline provider rotation. | [`src/backend/config/index.ts:113`](file:///d:/sdlc_studio/projects/kiro-integration/tmp_cloud_audit/src/backend/config/index.ts#L113), [`src/backend/providers/otomode.ts:100`](file:///d:/sdlc_studio/projects/kiro-integration/tmp_cloud_audit/src/backend/providers/otomode.ts#L100) | No | `""` | Falls back to OpenRouter free models if blank. |
| `ORCAROUTER_API_KEY` | API key for OrcaRouter provider rotation. | [`src/backend/config/index.ts:117`](file:///d:/sdlc_studio/projects/kiro-integration/tmp_cloud_audit/src/backend/config/index.ts#L117), [`src/backend/providers/otomode.ts:110`](file:///d:/sdlc_studio/projects/kiro-integration/tmp_cloud_audit/src/backend/providers/otomode.ts#L110) | No | `""` | Falls back to OpenRouter free models if blank. |
| `CUSTOM_PROVIDERS_JSON` | Serialized JSON array of custom OpenAI-compatible providers. | [`src/backend/config/index.ts:159-168`](file:///d:/sdlc_studio/projects/kiro-integration/tmp_cloud_audit/src/backend/config/index.ts#L159-L168) | No | `[]` | Allows defining persistent custom upstream providers across stateless Cloud Run cold starts. |
| `K_SERVICE` | Google Cloud Run service name (automatically injected by GCP). | [`src/backend/resilience/health.ts:53`](file:///d:/sdlc_studio/projects/kiro-integration/tmp_cloud_audit/src/backend/resilience/health.ts#L53) | Managed by GCP | `null` | Used by health manager to detect whether the application is running in Cloud Run. |

---

## 2. Feature Flags & Operational Toggles

| Feature Flag | Type | Config Property | Default | Behavior When Enabled (`true`) | Behavior When Disabled (`false`) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Global AutoMode** | Boolean | `globalAutoMode` | `true` | Injects autonomous agent guidance into system prompt; enables unconstrained tool chaining. | Regular conversational mode without autonomous execution prompting. |
| **OtoMode** | Boolean | `otoMode` | `true` | Allows intra-provider model and key rotation on rate limits. | Strictly uses the single active default model without rotating. |
| **Auto Approve Tools** | Boolean | `autoApproveTools` | `true` | Instructs Kiro client and LLM that tool calls should proceed without manual confirmation. | Requires manual step confirmation in client UI. |
| **Enable Ngrok Tunnel** | Boolean | `enableNgrokTunnel` | `false` | Legacy local toggle. (Deliberately disabled in cloud release). | Native HTTPS ingress handles all requests. No Ngrok daemon spawned. |
