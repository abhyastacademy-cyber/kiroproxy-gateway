# ADR 001: 7-Tier Zero-Cost Waterfall & Cloud Run Ingress

## Context
Kiro IDE connects to AWS Bedrock via binary EventStream protocol. Desktop developers frequently hit rate limits, quotas, or regional downtime when using single-provider proxies. Additionally, running local proxy processes with ngrok tunnels presents operational friction, latency, and frequent tunnel URL churn.

## Decision
1. **Cloud Run Native Ingress**: Host KiroProxy on Cloud Run with native HTTPS ingress (`0.0.0.0:PORT`) instead of relying on local ngrok tunnels.
2. **7-Tier Waterfall Architecture**: Route completions across an authoritative 7-tier order:
   `kilo -> cline -> openrouter -> orcarouter -> gemini -> custom -> canvas`.
3. **Accumulated Free Limits via Specific Model Routing**: When a specific free model is requested (e.g. `deepseek-r1:free`), KiroProxy routes the exact model across all providers supplying it in sequence upon 429 encounters, accumulating their individual free tiers without model degradation.
4. **IEEE 802.3 CRC32 EventStream Streaming**: Transcode upstream OpenAI/SSE responses directly into AWS Bedrock binary EventStream frames in real time with hardware-standard CRC32 calculations.
5. **Read-Only Container Fallback**: Support `/tmp/kiro_ai_config.json` for seamless write persistence in stateless containers.

## Consequences
* **Positive**: Uninterrupted, zero-cost AI code assistance in Kiro IDE; automatic failover; multi-key rotation; no ngrok dependency.
* **Negative**: Requires strict CRC32 byte framing compliance; connection timeouts across dead providers must be strictly bounded (< 3.5s) to avoid Kiro client timeouts.
