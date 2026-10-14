export interface CustomProvider {
  id: string;
  name: string;
  baseUrls: string[];
  apiKeys: string[];
  modelMapping?: Record<string, string>;
  activeModel?: string;
  enabled: boolean;
  notes?: string;
}

export interface GatewayConfig {
  host: string;
  port: number;
  publicDomainUrl: string;
  detectedPublicUrl?: string;
  adminToken: string;
  providerPriorityOrder: string[];
  customProviders: CustomProvider[];
  activeDefaultModel: string;
  temperature: number;
  maxTokens: number;
  enableNgrokTunnel: boolean;
  ngrokAuthToken: string;
  geminiApiKey: string;
  globalAutoMode: boolean;
  otoMode: boolean;
  maxAutoSteps: number;
  autoApproveTools: boolean;
}

export interface RequestMetric {
  timestamp: number;
  provider: string;
  model: string;
  durationMs: number;
  status: 'success' | 'error';
  errorMessage?: string;
  bytesSent: number;
}

export interface HealthData {
  status: string;
  service: string;
  version: string;
  uptimeSeconds: number;
  timestamp: string;
  environment: {
    isCloudRun: boolean;
    kService: string | null;
    publicUrl: string;
    host: string;
    port: number;
    ngrokActive: boolean;
  };
  stats: {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    successRate: string;
  };
  autoMode?: {
    globalAutoMode: boolean;
    otoMode: boolean;
    maxAutoSteps: number;
    autoApproveTools: boolean;
    status: string;
  };
  system: {
    memoryMb: number;
    heapUsedMb: number;
    nodeVersion: string;
    platform: string;
  };
  circuitBreakers?: Record<string, any>;
  recentMetrics: RequestMetric[];
}

export interface CanvasBridgeStatus {
  isWorkerActive: boolean;
  secondsSinceLastHeartbeat: number | null;
  queueDepth: number;
  activeTasksCount: number;
  connectedWorkers: number;
}
