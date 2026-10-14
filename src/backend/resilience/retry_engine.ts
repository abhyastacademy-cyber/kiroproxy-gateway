/**
 * Exponential Backoff Retry Engine with Full Jitter for KiroProxy Cloud Gateway.
 * Retries transient network interruptions, HTTP 502/503/504 errors, and temporary socket drops.
 */

export interface RetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  jitterFactor?: number;
  retryOnStatusCodes?: number[];
  onRetry?: (attempt: number, delayMs: number, error: any) => void;
}

const DEFAULT_RETRY_OPTIONS: Required<Omit<RetryOptions, 'onRetry'>> = {
  maxRetries: 3,
  baseDelayMs: 400,
  maxDelayMs: 5000,
  jitterFactor: 0.5,
  retryOnStatusCodes: [408, 429, 500, 502, 503, 504],
};

/**
 * Checks if an error is considered transient and safe to retry.
 */
export function isRetryableError(err: any, retryStatuses: number[] = [408, 429, 500, 502, 503, 504]): boolean {
  if (!err) return false;

  // 1. Check HTTP status code
  const status = err.status || err.statusCode || err.response?.status;
  if (status && retryStatuses.includes(status)) {
    return true;
  }

  // 2. Check Node.js network error codes
  const code = err.code || err.cause?.code;
  const transientNetworkCodes = [
    'ECONNRESET',
    'ECONNREFUSED',
    'ETIMEDOUT',
    'EPIPE',
    'ENOTFOUND',
    'EAI_AGAIN',
    'UND_ERR_CONNECT_TIMEOUT',
    'UND_ERR_SOCKET',
  ];
  if (code && transientNetworkCodes.includes(code)) {
    return true;
  }

  // 3. Check error message signatures
  const msg = (err.message || '').toLowerCase();
  if (
    msg.includes('fetch failed') ||
    msg.includes('network error') ||
    msg.includes('socket hang up') ||
    msg.includes('timeout') ||
    msg.includes('econnreset') ||
    msg.includes('resource_exhausted') ||
    msg.includes('rate limit')
  ) {
    return true;
  }

  return false;
}

/**
 * Calculates exponential delay with full jitter:
 * delay = min(maxDelay, baseDelay * 2^attempt) + random(0, jitter)
 */
export function calculateJitterDelay(
  attempt: number,
  baseDelayMs: number,
  maxDelayMs: number,
  jitterFactor: number
): number {
  const exponential = Math.min(maxDelayMs, baseDelayMs * Math.pow(2, attempt));
  const jitter = exponential * jitterFactor * Math.random();
  return Math.floor(exponential + jitter);
}

/**
 * Executes an async operation with automatic exponential backoff and jitter.
 */
export async function executeWithRetry<T>(
  operation: (attempt: number) => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const maxRetries = options.maxRetries ?? DEFAULT_RETRY_OPTIONS.maxRetries;
  const baseDelayMs = options.baseDelayMs ?? DEFAULT_RETRY_OPTIONS.baseDelayMs;
  const maxDelayMs = options.maxDelayMs ?? DEFAULT_RETRY_OPTIONS.maxDelayMs;
  const jitterFactor = options.jitterFactor ?? DEFAULT_RETRY_OPTIONS.jitterFactor;
  const retryStatuses = options.retryOnStatusCodes ?? DEFAULT_RETRY_OPTIONS.retryOnStatusCodes;

  let lastError: any;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation(attempt);
    } catch (err: any) {
      lastError = err;

      if (attempt >= maxRetries || !isRetryableError(err, retryStatuses)) {
        throw err;
      }

      const delayMs = calculateJitterDelay(attempt, baseDelayMs, maxDelayMs, jitterFactor);
      if (options.onRetry) {
        options.onRetry(attempt + 1, delayMs, err);
      } else {
        console.warn(
          `[RetryEngine] Attempt ${attempt + 1}/${maxRetries} failed (${err.message}). Retrying in ${delayMs}ms...`
        );
      }

      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw lastError;
}
