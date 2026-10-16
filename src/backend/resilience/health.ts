import os from 'node:os';
import { configManager } from '../config/index.js';
import { circuitBreakers } from './circuit_breaker.js';

interface RequestMetric {
  timestamp: number;
  provider: string;
  model: string;
  durationMs: number;
  status: 'success' | 'error';
  errorMessage?: string;
  bytesSent: number;
}

class HealthAndResilienceManager {
  private startTime: number = Date.now();
  private metrics: RequestMetric[] = [];
  private totalRequests: number = 0;
  private successfulRequests: number = 0;
  private failedRequests: number = 0;
  private ngrokUrl: string | null = null;
  private ngrokRunning: boolean = false;

  constructor() {
    this.detectCloudEnvironment();
  }

  private detectCloudEnvironment() {
    const envUrl = process.env.PUBLIC_DOMAIN_URL || process.env.APP_URL || process.env.SERVICE_URL || 'https://kiroproxy-746899042471.asia-southeast1.run.app';
    if (envUrl) {
      configManager.setPublicDomainUrl(envUrl);
    }
  }

  /**
   * Returns active public URL.
   * In Cloud Run / Google AI Studio, native HTTPS ingress completely replaces ngrok!
   */
  public getTunnelUrl(requestHost?: string, requestProtocol?: string): string {
    if (requestHost && (requestHost.includes('run.app') || requestHost.includes('ai.studio'))) {
      const proto = requestProtocol || 'https';
      return `${proto}://${requestHost}`;
    }
    const config = configManager.getConfig();
    if (config.publicDomainUrl) {
      return config.publicDomainUrl;
    }
    if (requestHost) {
      const proto = requestProtocol || (requestHost.includes('localhost') ? 'http' : 'https');
      return `${proto}://${requestHost}`;
    }
    if (this.ngrokUrl) {
      return this.ngrokUrl;
    }
    return `http://${config.host}:${config.port}`;
  }

  public isCloudRun(): boolean {
    return !!process.env.K_SERVICE || !!process.env.APP_URL || !!process.env.PUBLIC_DOMAIN_URL;
  }

  public setNgrokUrl(url: string | null) {
    this.ngrokUrl = url;
    this.ngrokRunning = !!url;
  }

  public recordMetric(metric: RequestMetric) {
    this.totalRequests++;
    if (metric.status === 'success') {
      this.successfulRequests++;
    } else {
      this.failedRequests++;
    }

    this.metrics.push(metric);
    if (this.metrics.length > 200) {
      this.metrics.shift();
    }
  }

  public getHealthData(requestHost?: string, requestProtocol?: string) {
    const uptimeSec = Math.floor((Date.now() - this.startTime) / 1000);
    const mem = process.memoryUsage();
    const config = configManager.getConfig();
    const publicUrl = this.getTunnelUrl(requestHost, requestProtocol);

    return {
      status: 'healthy',
      service: 'KiroProxy-Gateway-Cloud',
      version: '2.8.0-cloud',
      uptimeSeconds: uptimeSec,
      timestamp: new Date().toISOString(),
      environment: {
        isCloudRun: this.isCloudRun(),
        kService: process.env.K_SERVICE || null,
        publicUrl,
        host: config.host,
        port: config.port,
        ngrokActive: this.ngrokRunning,
        ngrokNeeded: !publicUrl,
        nativeCloudHttps: true,
      },
      autoMode: {
        globalAutoMode: config.globalAutoMode,
        otoMode: config.otoMode,
        maxAutoSteps: config.maxAutoSteps,
        autoApproveTools: config.autoApproveTools,
        status: config.globalAutoMode ? 'ACTIVE' : 'PAUSED',
      },
      stats: {
        totalRequests: this.totalRequests,
        successfulRequests: this.successfulRequests,
        failedRequests: this.failedRequests,
        successRate: this.totalRequests > 0 ? ((this.successfulRequests / this.totalRequests) * 100).toFixed(1) + '%' : '100%',
      },
      system: {
        memoryMb: Math.round(mem.rss / (1024 * 1024)),
        heapUsedMb: Math.round(mem.heapUsed / (1024 * 1024)),
        nodeVersion: process.version,
        platform: os.platform(),
      },
      circuitBreakers: circuitBreakers.getAllStats(),
      recentMetrics: this.metrics.slice(-15).reverse(),
    };
  }

  public getStatusData(requestHost?: string, requestProtocol?: string) {
    const health = this.getHealthData(requestHost, requestProtocol);
    const config = configManager.getConfig();

    return {
      ...health,
      providers: {
        tierOrder: config.providerPriorityOrder,
        customProvidersCount: config.customProviders.length,
        geminiConfigured: !!(config.geminiApiKey || process.env.GEMINI_API_KEY),
        customProviders: config.customProviders.map((cp) => ({
          id: cp.id,
          name: cp.name,
          baseUrlsCount: cp.baseUrls.length,
          enabled: cp.enabled,
          activeModel: cp.activeModel,
        })),
      },
      security: {
        authProtected: !!config.adminToken,
      },
    };
  }
}

export const healthManager = new HealthAndResilienceManager();
