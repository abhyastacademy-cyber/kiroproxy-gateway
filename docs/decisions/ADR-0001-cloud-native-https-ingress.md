# ADR-0001: Cloud-Native HTTPS Ingress Replaces Ngrok Daemon

* **Status**: ACCEPTED
* **Context**: In the local version of KiroProxy, an `@ngrok/ngrok` daemon process was spawned on startup to expose port `8084` to the internet for remote webhooks and the Gemini Canvas bridge. In a serverless container environment like Google Cloud Run, running background daemons with persistent local tunnels is anti-pattern, adds heavy binaries, causes ephemeral reconnection issues, and introduces external third-party rate limits.
* **Decision**: Completely remove the `@ngrok/ngrok` npm dependency from the cloud release package. Rely entirely on Google Cloud Run's native managed HTTPS ingress (`asia-southeast1.run.app`) and Google AI Studio custom domains (`kiroproxy.ai.studio`) for public SSL termination.
* **Alternatives Considered**:
  - *Keep Ngrok with container credentials*: Rejected due to container startup latency, memory overhead, and Ngrok session limits.
  - *Cloudflare Tunnel (`cloudflared`)*: Rejected because Cloud Run already provides public HTTPS termination by default.
* **Consequences**:
  - Eliminated the `@ngrok/ngrok` package and binary dependencies.
  - Zero tunnel disconnects; unlimited native HTTPS ingress bandwidth.
  - The Gemini Canvas web worker connects directly to `/poll` on the Cloud Run domain.
* **Do Not Change Unless**: The application is transitioned to an air-gapped private intranet environment where outbound public DNS/HTTPS is completely blocked and a private reverse tunneling solution is explicitly required.
* **Evidence (FACT)**:
  - [`package.json:15-27`](file:///d:/sdlc_studio/projects/kiro-integration/tmp_cloud_audit/package.json#L15-L27) (No `@ngrok/ngrok` in dependencies).
  - [`src/backend/resilience/health.ts:94-96`](file:///d:/sdlc_studio/projects/kiro-integration/tmp_cloud_audit/src/backend/resilience/health.ts#L94-L96) (`ngrokActive: false`, `nativeCloudHttps: true`).
