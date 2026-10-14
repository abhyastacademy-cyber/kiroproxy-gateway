import ngrok from '@ngrok/ngrok';
import { configManager } from '../config/index.js';
import { healthManager } from './health.js';

export class NgrokService {
  private listener: any = null;
  private tunnelUrl: string | null = null;

  public async startTunnel(): Promise<string | null> {
    const config = configManager.getConfig();
    const token = config.ngrokAuthToken || process.env.NGROK_AUTHTOKEN;

    if (!token || token.trim().length === 0) {
      console.log('[NgrokService] No NGROK_AUTHTOKEN configured; running on native Cloud HTTPS ingress.');
      return null;
    }

    try {
      console.log('[NgrokService] Initializing ngrok tunnel with provided auth token...');
      this.listener = await ngrok.forward({
        addr: config.port || 3000,
        authtoken: token.trim(),
      });

      this.tunnelUrl = this.listener.url();
      console.log(`[NgrokService] Ngrok tunnel active at: ${this.tunnelUrl}`);

      if (this.tunnelUrl) {
        healthManager.setNgrokUrl(this.tunnelUrl);
      }

      return this.tunnelUrl;
    } catch (err: any) {
      console.warn(
        `[NgrokService] Failed to start ngrok tunnel (${err?.message || err}). Running on Cloud Run HTTPS ingress.`
      );
      return null;
    }
  }

  public async stopTunnel() {
    if (this.listener) {
      try {
        await this.listener.close();
        console.log('[NgrokService] Ngrok tunnel closed.');
      } catch {
        // Ignore shutdown errors
      }
      this.listener = null;
      this.tunnelUrl = null;
      healthManager.setNgrokUrl(null);
    }
  }

  public getTunnelUrl(): string | null {
    return this.tunnelUrl;
  }
}

export const ngrokService = new NgrokService();
