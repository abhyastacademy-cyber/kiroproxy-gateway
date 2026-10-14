/**
 * Circuit Breaker Pattern Implementation for KiroProxy Provider Tiers.
 * Prevents hammering failing, rate-limited (429), or down upstream providers
 * by tracking failure rates and introducing an automatic cooldown period.
 */

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerOptions {
  failureThreshold?: number;     // Number of consecutive failures before tripping
  cooldownPeriodMs?: number;     // Time in ms before transitioning from OPEN to HALF_OPEN
  halfOpenSuccessThreshold?: number; // Successes in HALF_OPEN before resetting to CLOSED
}

export interface CircuitStats {
  state: CircuitState;
  consecutiveFailures: number;
  lastFailureTime: number | null;
  cooldownRemainingMs: number;
  totalTrips: number;
}

export class CircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private consecutiveFailures: number = 0;
  private consecutiveSuccessesInHalfOpen: number = 0;
  private lastFailureTime: number | null = null;
  private totalTrips: number = 0;

  private readonly failureThreshold: number;
  private readonly cooldownPeriodMs: number;
  private readonly halfOpenSuccessThreshold: number;

  constructor(public readonly name: string, options: CircuitBreakerOptions = {}) {
    this.failureThreshold = options.failureThreshold || 3;
    this.cooldownPeriodMs = options.cooldownPeriodMs || 30000; // 30s default
    this.halfOpenSuccessThreshold = options.halfOpenSuccessThreshold || 1;
  }

  /**
   * Checks whether requests should be allowed through to this provider.
   */
  public canExecute(): boolean {
    if (this.state === 'CLOSED') {
      return true;
    }

    if (this.state === 'OPEN') {
      const now = Date.now();
      if (this.lastFailureTime && now - this.lastFailureTime >= this.cooldownPeriodMs) {
        this.state = 'HALF_OPEN';
        this.consecutiveSuccessesInHalfOpen = 0;
        console.info(`[CircuitBreaker:${this.name}] Cooldown elapsed. Entering HALF_OPEN state.`);
        return true;
      }
      return false;
    }

    if (this.state === 'HALF_OPEN') {
      // Allow a probe request through
      return true;
    }

    return true;
  }

  /**
   * Records a successful execution.
   */
  public recordSuccess(): void {
    if (this.state === 'HALF_OPEN') {
      this.consecutiveSuccessesInHalfOpen++;
      if (this.consecutiveSuccessesInHalfOpen >= this.halfOpenSuccessThreshold) {
        this.state = 'CLOSED';
        this.consecutiveFailures = 0;
        console.info(`[CircuitBreaker:${this.name}] Probe succeeded. Circuit is now CLOSED.`);
      }
    } else if (this.state === 'CLOSED') {
      this.consecutiveFailures = 0;
    }
  }

  /**
   * Records a failed execution.
   */
  public recordFailure(err?: any): void {
    this.lastFailureTime = Date.now();
    this.consecutiveFailures++;

    if (this.state === 'HALF_OPEN') {
      this.state = 'OPEN';
      this.totalTrips++;
      console.warn(`[CircuitBreaker:${this.name}] Probe failed in HALF_OPEN. Tripping back to OPEN.`);
    } else if (this.state === 'CLOSED' && this.consecutiveFailures >= this.failureThreshold) {
      this.state = 'OPEN';
      this.totalTrips++;
      console.warn(
        `[CircuitBreaker:${this.name}] Failure threshold reached (${this.consecutiveFailures}/${this.failureThreshold}). Circuit TRIPPED to OPEN for ${this.cooldownPeriodMs / 1000}s.`
      );
    }
  }

  public getStats(): CircuitStats {
    let cooldownRemainingMs = 0;
    if (this.state === 'OPEN' && this.lastFailureTime) {
      const elapsed = Date.now() - this.lastFailureTime;
      cooldownRemainingMs = Math.max(0, this.cooldownPeriodMs - elapsed);
    }

    return {
      state: this.state,
      consecutiveFailures: this.consecutiveFailures,
      lastFailureTime: this.lastFailureTime,
      cooldownRemainingMs,
      totalTrips: this.totalTrips,
    };
  }

  public reset(): void {
    this.state = 'CLOSED';
    this.consecutiveFailures = 0;
    this.consecutiveSuccessesInHalfOpen = 0;
    this.lastFailureTime = null;
  }
}

/**
 * Registry of circuit breakers across providers and endpoints.
 */
export class CircuitBreakerRegistry {
  private breakers: Map<string, CircuitBreaker> = new Map();

  public getBreaker(name: string, options?: CircuitBreakerOptions): CircuitBreaker {
    let breaker = this.breakers.get(name);
    if (!breaker) {
      breaker = new CircuitBreaker(name, options);
      this.breakers.set(name, breaker);
    }
    return breaker;
  }

  public getAllStats(): Record<string, CircuitStats> {
    const stats: Record<string, CircuitStats> = {};
    for (const [name, breaker] of this.breakers.entries()) {
      stats[name] = breaker.getStats();
    }
    return stats;
  }

  public resetAll(): void {
    for (const breaker of this.breakers.values()) {
      breaker.reset();
    }
  }
}

export const circuitBreakers = new CircuitBreakerRegistry();
