# Configuration & Environment Variables Reference

> **OPERATIONAL CONFIGURATION GUIDE:**
> Complete directory of environment variables, defaults, security rules, and feature flags.

---

## 1. Environment Variables Matrix

| Variable | Default Value | Required | Description |
| :--- | :--- | :--- | :--- |
| `PORT` | `3000` | No | HTTP listening port for Express. Set automatically by Cloud Run. |
| `HOST` | `0.0.0.0` | No | Network interface bind address. Must remain `0.0.0.0` in containers. |
| `PUBLIC_DOMAIN_URL` | Auto-detected | No | Public HTTPS URL (e.g. `https://kiroproxy-746899042471.asia-southeast1.run.app`). |
| `PROXY_ADMIN_TOKEN` | `""` (Empty) | No | Optional secret token. When set, all endpoints require authentication. |
| `PROVIDER_PRIORITY_ORDER` | `kilo,cline,openrouter,orcarouter,gemini,custom,canvas` | No | Comma-delimited list of priority tiers. |
| `CUSTOM_PROVIDERS_JSON` | `""` | No | Stringified JSON array of `CustomProvider` objects for stateless deployments. |
| `GEMINI_API_KEY` | `""` | No | Google Gemini API key. Rotated through `@google/genai`. |
| `KILO_API_KEY` | `""` | No | Optional API key for Kilo Gateway. Zero-key mode works without key. |
| `CLINE_API_KEY` | `""` | No | Optional API key for Cline provider. |
| `OPENROUTER_API_KEY` | `""` | No | Free or paid API key for OpenRouter. |
| `ORCAROUTER_API_KEY` | `""` | No | Optional API key for OrcaRouter. |
| `NGROK_AUTHTOKEN` | `""` | No | Optional ngrok token for local developer tunneling (disabled on Cloud Run). |

---

## 2. Hard Security Constraints

1. **Never Commit Secrets**: Never put live API keys or admin tokens into `config/kiro_ai_config.json`, `.env.example`, or git commits.
2. **Read-Only Compatibility**: Never assume disk persistence outside `/tmp` when deployed on containerized environments.
3. **Admin Token Transmission**: When `PROXY_ADMIN_TOKEN` is set, Kiro IDE must connect using path prefix `/k/<token>/generateAssistantResponse` or header `x-admin-token: <token>`.

---

## 3. Exporting & Synchronizing Environment

The gateway UI provides an automated `.env` export feature in the **Backup** tab (`GET /api/export-env`). This converts current in-memory configurations into standard key-value format for container deployment or cloud run environment variable injection.
