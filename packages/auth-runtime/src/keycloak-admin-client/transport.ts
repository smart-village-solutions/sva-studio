import { KeycloakAdminRequestError, KeycloakAdminUnavailableError } from './errors.js';
import {
  encodePathSegment,
  isRetryableStatus,
  logger,
  normalizeBaseUrl,
  toRetryLogReason,
  withTimeout,
} from './helpers.js';
import { buildErrorDetails } from './transport-error.js';
import type {
  CachedToken,
  FetchLike,
  KeycloakAdminClientConfig,
  RequestExecutionOptions,
  TokenResponse,
} from './internal-models.js';

const DEFAULT_CONNECT_TIMEOUT_MS = 5_000;
const DEFAULT_READ_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_CIRCUIT_BREAKER_FAILURE_THRESHOLD = 5;
const DEFAULT_CIRCUIT_BREAKER_OPEN_MS = 30_000;
const TOKEN_REFRESH_SKEW_MS = 10_000;

export class KeycloakTransport {
  protected readonly baseUrl: string;
  protected readonly realm: string;
  protected readonly adminRealm: string;
  protected readonly clientId: string;
  protected readonly clientSecret: string;
  protected readonly connectTimeoutMs: number;
  protected readonly readTimeoutMs: number;
  protected readonly maxRetries: number;
  protected readonly circuitBreakerFailureThreshold: number;
  protected readonly circuitBreakerOpenMs: number;
  protected readonly fetchImpl: FetchLike;
  protected readonly now: () => number;
  protected readonly sleep: (ms: number) => Promise<void>;

  protected cachedToken?: CachedToken;
  protected tokenRefreshPromise?: Promise<string>;
  protected consecutiveFailures = 0;
  protected circuitOpenUntilMs = 0;

  protected invalidateAccessTokenCache() {
    this.cachedToken = undefined;
    this.tokenRefreshPromise = undefined;
  }

  constructor(config: KeycloakAdminClientConfig) {
    this.baseUrl = normalizeBaseUrl(config.baseUrl);
    this.realm = config.realm;
    this.adminRealm = config.adminRealm ?? config.realm;
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
    this.connectTimeoutMs = config.connectTimeoutMs ?? DEFAULT_CONNECT_TIMEOUT_MS;
    this.readTimeoutMs = config.readTimeoutMs ?? DEFAULT_READ_TIMEOUT_MS;
    this.maxRetries = config.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.circuitBreakerFailureThreshold =
      config.circuitBreakerFailureThreshold ?? DEFAULT_CIRCUIT_BREAKER_FAILURE_THRESHOLD;
    this.circuitBreakerOpenMs = config.circuitBreakerOpenMs ?? DEFAULT_CIRCUIT_BREAKER_OPEN_MS;
    this.fetchImpl = config.fetchImpl ?? fetch;
    this.now = config.now ?? (() => Date.now());
    this.sleep = config.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  }

  getCircuitBreakerState(): number {
    return this.isCircuitOpen() ? 2 : 0;
  }

  protected async assertWriteAvailability(): Promise<void> {
    if (this.isCircuitOpen()) {
      throw new KeycloakAdminUnavailableError(
        'Keycloak unavailable. Write operations are temporarily disabled.'
      );
    }
  }

  protected isCircuitOpen(): boolean {
    return this.circuitOpenUntilMs > this.now();
  }

  protected markSuccess(): void {
    this.consecutiveFailures = 0;
    this.circuitOpenUntilMs = 0;
  }

  protected markFailure(): void {
    this.consecutiveFailures += 1;
    if (this.consecutiveFailures >= this.circuitBreakerFailureThreshold) {
      this.circuitOpenUntilMs = this.now() + this.circuitBreakerOpenMs;
      logger.error('Keycloak circuit breaker opened', {
        operation: 'circuit_breaker_open',
        failures: this.consecutiveFailures,
        open_ms: this.circuitBreakerOpenMs,
      });
    }
  }

  protected async executeWithResilience<T>(request: RequestExecutionOptions): Promise<T> {
    if (this.isCircuitOpen()) {
      throw new KeycloakAdminUnavailableError('Keycloak unavailable. Circuit breaker is open.');
    }

    return this.executeWithRetryPolicy<T>(request, true);
  }

  protected async executeWithRetryPolicy<T>(
    request: RequestExecutionOptions,
    trackCircuitState: boolean
  ): Promise<T> {
    let lastError: unknown;
    const retryDelays = [1_000, 2_000, 4_000];

    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      try {
        const result = await this.executeRequest<T>(request);
        if (trackCircuitState) this.markSuccess();
        return result;
      } catch (error) {
        lastError = error;
        const retryable = this.isRetryableError(error);
        const isLastAttempt = attempt >= this.maxRetries;
        if (!retryable || isLastAttempt) {
          if (trackCircuitState && (retryable || !(error instanceof KeycloakAdminRequestError))) {
            this.markFailure();
          }
          throw error;
        }

        const delay = retryDelays[Math.min(attempt, retryDelays.length - 1)];
        logger.warn('Retrying Keycloak request', {
          operation: request.operation,
          attempt: attempt + 1,
          max_retries: this.maxRetries,
          retry_delay_ms: delay,
          reason: toRetryLogReason(error),
        });
        await this.sleep(delay);
      }
    }

    if (trackCircuitState) this.markFailure();
    throw lastError;
  }

  protected isRetryableError(error: unknown): boolean {
    if (error instanceof KeycloakAdminRequestError) {
      return error.retryable;
    }
    if (error instanceof KeycloakAdminUnavailableError) {
      return true;
    }
    return false;
  }

  protected async executeFetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
    if (this.connectTimeoutMs <= 0) {
      return this.fetchImpl(url, init);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.connectTimeoutMs);
    try {
      return await this.fetchImpl(url, {
        ...init,
        signal: controller.signal,
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new KeycloakAdminRequestError({
          message: `Keycloak connect timeout after ${this.connectTimeoutMs}ms`,
          statusCode: 503,
          code: 'connect_timeout',
          retryable: true,
        });
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  protected async executeRequest<T>(request: RequestExecutionOptions): Promise<T> {
    const token = await this.getAccessToken();
    const url = `${this.baseUrl}${request.path}`;
    const init: RequestInit = {
      method: request.method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(request.body ? { 'Content-Type': 'application/json' } : {}),
      },
    };
    if (request.body !== undefined) {
      init.body = request.body;
    }
    const response = await this.executeFetchWithTimeout(url, init);

    if (!response.ok) {
      const details = await buildErrorDetails(response, request.operation, this.readTimeoutMs);
      throw new KeycloakAdminRequestError({
        ...details,
        statusCode: response.status,
        code: `http_${response.status}`,
        retryable: isRetryableStatus(response.status),
      });
    }

    if (response.status === 204) {
      return undefined as T;
    }

    if (request.operation === 'create_user' || request.operation === 'create_client') {
      return { location: response.headers.get('location') } as T;
    }

    const text = await withTimeout(response.text(), this.readTimeoutMs, 'read');
    if (!text) {
      return undefined as T;
    }
    return JSON.parse(text) as T;
  }

  protected async getAccessToken(): Promise<string> {
    const now = this.now();
    if (this.cachedToken && now < this.cachedToken.expiresAtMs - TOKEN_REFRESH_SKEW_MS) {
      return this.cachedToken.value;
    }

    if (this.tokenRefreshPromise) {
      return this.tokenRefreshPromise;
    }

    this.tokenRefreshPromise = this.fetchAccessToken().finally(() => {
      this.tokenRefreshPromise = undefined;
    });
    return this.tokenRefreshPromise;
  }

  protected async fetchAccessToken(): Promise<string> {
    const tokenEndpoint = `${this.baseUrl}/realms/${encodePathSegment(this.adminRealm)}/protocol/openid-connect/token`;
    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: this.clientId,
      client_secret: this.clientSecret,
    });

    const response = await this.executeFetchWithTimeout(tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    if (!response.ok) {
      const details = await buildErrorDetails(response, 'fetch_token', this.readTimeoutMs);
      throw new KeycloakAdminRequestError({
        ...details,
        statusCode: response.status,
        code: `token_http_${response.status}`,
        retryable: isRetryableStatus(response.status),
      });
    }

    const text = await withTimeout(response.text(), this.readTimeoutMs, 'read');
    const parsed = JSON.parse(text) as TokenResponse;
    const token = parsed.access_token;
    if (!token) {
      throw new KeycloakAdminRequestError({
        message: 'Keycloak token response did not include access_token',
        statusCode: 502,
        code: 'token_missing',
        retryable: true,
      });
    }

    const expiresInSeconds = Number.isFinite(parsed.expires_in) ? parsed.expires_in : 60;
    this.cachedToken = {
      value: token,
      expiresAtMs: this.now() + expiresInSeconds * 1_000,
    };
    return token;
  }
}
