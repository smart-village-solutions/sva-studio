import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@opentelemetry/api', () => ({
  SpanStatusCode: {
    OK: 1,
    ERROR: 2,
  },
  metrics: {
    getMeter: () => ({
      createHistogram: () => ({ record: vi.fn() }),
      createCounter: () => ({ add: vi.fn() }),
      createObservableGauge: () => ({ addCallback: vi.fn() }),
    }),
  },
  trace: {
    getTracer: () => ({
      startActiveSpan: async (_name: string, callback: (span: { setAttributes: (attrs: Record<string, unknown>) => void; setStatus: (status: Record<string, unknown>) => void; recordException: (error: unknown) => void; end: () => void; }) => Promise<unknown>) =>
        callback({
          setAttributes: () => undefined,
          setStatus: () => undefined,
          recordException: () => undefined,
          end: () => undefined,
        }),
    }),
  },
}));

import { createSvaMainserverService, resetSvaMainserverServiceState } from './service';
import { SvaMainserverError } from './errors';

const baseConfig = {
  instanceId: 'de-musterhausen',
  providerKey: 'sva_mainserver' as const,
  graphqlBaseUrl: 'https://mainserver.example.invalid/graphql',
  oauthTokenUrl: 'https://mainserver.example.invalid/oauth/token',
  enabled: true,
};

const createJsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const createDeferred = <TValue>() => {
  let resolve: ((value: TValue) => void) | undefined;
  let reject: ((reason?: unknown) => void) | undefined;
  const promise = new Promise<TValue>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return {
    promise,
    resolve: (value: TValue) => resolve?.(value),
    reject: (reason?: unknown) => reject?.(reason),
  };
};

describe('createSvaMainserverService', () => {
  afterEach(() => {
    resetSvaMainserverServiceState();
  });

  it('caches credentials for sixty seconds by default', async () => {
    let nowMs = 0;
    const readCredentials = vi
      .fn()
      .mockResolvedValue({
        apiKey: 'key-1',
        apiSecret: 'secret-1',
      });

    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(createJsonResponse(200, { access_token: 'token-1', expires_in: 120 }))
      .mockImplementation(async () => createJsonResponse(200, { data: { __typename: 'Query' } }));

    const service = createSvaMainserverService({
      loadInstanceConfig: async () => baseConfig,
      readCredentials,
      fetchImpl,
      now: () => nowMs,
    });

    await service.getQueryRootTypename({ instanceId: baseConfig.instanceId, keycloakSubject: 'subject-1' });
    nowMs += 30_000;
    await service.getQueryRootTypename({ instanceId: baseConfig.instanceId, keycloakSubject: 'subject-1' });

    expect(readCredentials).toHaveBeenCalledTimes(1);
  });

  it('caches access tokens until the skew window is reached', async () => {
    let nowMs = 0;
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(createJsonResponse(200, { access_token: 'token-1', expires_in: 120 }))
      .mockImplementation(async () => createJsonResponse(200, { data: { __typename: 'Query' } }));

    const service = createSvaMainserverService({
      loadInstanceConfig: async () => baseConfig,
      readCredentials: async () => ({ apiKey: 'key-1', apiSecret: 'secret-1' }),
      fetchImpl,
      now: () => nowMs,
    });

    await service.getQueryRootTypename({ instanceId: baseConfig.instanceId, keycloakSubject: 'subject-1' });
    nowMs += 10_000;
    await service.getQueryRootTypename({ instanceId: baseConfig.instanceId, keycloakSubject: 'subject-1' });

    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it('renews access tokens once the skew window is reached', async () => {
    let nowMs = 0;
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(createJsonResponse(200, { access_token: 'token-1', expires_in: 120 }))
      .mockResolvedValueOnce(createJsonResponse(200, { data: { __typename: 'Query' } }))
      .mockResolvedValueOnce(createJsonResponse(200, { access_token: 'token-2', expires_in: 120 }))
      .mockResolvedValueOnce(createJsonResponse(200, { data: { __typename: 'Query' } }));

    const service = createSvaMainserverService({
      loadInstanceConfig: async () => baseConfig,
      readCredentials: async () => ({ apiKey: 'key-1', apiSecret: 'secret-1' }),
      fetchImpl,
      now: () => nowMs,
    });

    await service.getQueryRootTypename({ instanceId: baseConfig.instanceId, keycloakSubject: 'subject-1' });
    nowMs += 70_000;
    await service.getQueryRootTypename({ instanceId: baseConfig.instanceId, keycloakSubject: 'subject-1' });

    expect(fetchImpl).toHaveBeenCalledTimes(4);
  });

  it('executes query and mutation diagnostics with typed responses', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(createJsonResponse(200, { access_token: 'token-1', expires_in: 120 }))
      .mockResolvedValueOnce(createJsonResponse(200, { data: { __typename: 'Query' } }))
      .mockResolvedValueOnce(createJsonResponse(200, { data: { __typename: 'Mutation' } }));

    const service = createSvaMainserverService({
      loadInstanceConfig: async () => baseConfig,
      readCredentials: async () => ({ apiKey: 'key-1', apiSecret: 'secret-1' }),
      fetchImpl,
    });

    await expect(
      service.getConnectionStatus({ instanceId: baseConfig.instanceId, keycloakSubject: 'subject-1' })
    ).resolves.toMatchObject({
      status: 'connected',
      queryRootTypename: 'Query',
      mutationRootTypename: 'Mutation',
    });
  });

  it('maps missing credentials to a stable error response', async () => {
    const service = createSvaMainserverService({
      loadInstanceConfig: async () => baseConfig,
      readCredentials: async () => null,
    });

    await expect(
      service.getConnectionStatus({ instanceId: baseConfig.instanceId, keycloakSubject: 'subject-1' })
    ).resolves.toMatchObject({
      status: 'error',
      errorCode: 'missing_credentials',
    });
  });

  it('maps identity provider failures to identity_provider_unavailable', async () => {
    const service = createSvaMainserverService({
      loadInstanceConfig: async () => baseConfig,
      readCredentials: async () => {
        throw new Error('keycloak unavailable');
      },
    });

    await expect(
      service.getConnectionStatus({ instanceId: baseConfig.instanceId, keycloakSubject: 'subject-1' })
    ).resolves.toMatchObject({
      status: 'error',
      errorCode: 'identity_provider_unavailable',
    });
  });

  it('preserves typed identity provider errors from credential loading', async () => {
    const service = createSvaMainserverService({
      loadInstanceConfig: async () => baseConfig,
      readCredentials: async () => {
        throw new SvaMainserverError({
          code: 'identity_provider_unavailable',
          message: 'idp down',
          statusCode: 503,
        });
      },
    });

    await expect(
      service.getConnectionStatus({ instanceId: baseConfig.instanceId, keycloakSubject: 'subject-1' })
    ).resolves.toMatchObject({
      status: 'error',
      errorCode: 'identity_provider_unavailable',
      errorMessage: 'idp down',
    });
  });

  it('maps graphql errors from the upstream endpoint', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(createJsonResponse(200, { access_token: 'token-1', expires_in: 120 }))
      .mockResolvedValueOnce(createJsonResponse(200, { errors: [{ message: 'boom' }] }))
      .mockResolvedValueOnce(createJsonResponse(200, { errors: [{ message: 'boom' }] }));

    const service = createSvaMainserverService({
      loadInstanceConfig: async () => baseConfig,
      readCredentials: async () => ({ apiKey: 'key-1', apiSecret: 'secret-1' }),
      fetchImpl,
    });

    await expect(
      service.getConnectionStatus({ instanceId: baseConfig.instanceId, keycloakSubject: 'subject-1' })
    ).resolves.toMatchObject({
      status: 'error',
      errorCode: 'graphql_error',
    });
  });

  it('maps 401 and 403 responses from the upstream endpoint', async () => {
    const createServiceForStatus = (status: number) =>
      createSvaMainserverService({
        loadInstanceConfig: async () => baseConfig,
        readCredentials: async () => ({ apiKey: 'key-1', apiSecret: 'secret-1' }),
        fetchImpl: vi
          .fn()
          .mockResolvedValueOnce(createJsonResponse(200, { access_token: 'token-1', expires_in: 120 }))
          .mockResolvedValueOnce(new Response('forbidden', { status }))
          .mockResolvedValueOnce(new Response('forbidden', { status })),
      });

    await expect(
      createServiceForStatus(401).getConnectionStatus({
        instanceId: baseConfig.instanceId,
        keycloakSubject: 'subject-1',
      })
    ).resolves.toMatchObject({
      status: 'error',
      errorCode: 'unauthorized',
    });

    await expect(
      createServiceForStatus(403).getConnectionStatus({
        instanceId: baseConfig.instanceId,
        keycloakSubject: 'subject-1',
      })
    ).resolves.toMatchObject({
      status: 'error',
      errorCode: 'forbidden',
    });
  });

  it('maps non-auth token endpoint status codes to token_request_failed', async () => {
    const service = createSvaMainserverService({
      loadInstanceConfig: async () => baseConfig,
      readCredentials: async () => ({ apiKey: 'key-1', apiSecret: 'secret-1' }),
      fetchImpl: vi.fn().mockResolvedValueOnce(new Response('upstream down', { status: 500 })),
      retryBaseDelayMs: 0,
      randomIntImpl: () => 0,
    });

    await expect(
      service.getConnectionStatus({ instanceId: baseConfig.instanceId, keycloakSubject: 'subject-1' })
    ).resolves.toMatchObject({
      status: 'error',
      errorCode: 'token_request_failed',
    });
  });

  it('maps non-auth graphql status codes to network_error', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(createJsonResponse(200, { access_token: 'token-1', expires_in: 120 }))
      .mockResolvedValueOnce(new Response('bad gateway', { status: 502 }));

    const service = createSvaMainserverService({
      loadInstanceConfig: async () => baseConfig,
      readCredentials: async () => ({ apiKey: 'key-1', apiSecret: 'secret-1' }),
      fetchImpl,
      retryBaseDelayMs: 0,
      randomIntImpl: () => 0,
    });

    await expect(
      service.getConnectionStatus({ instanceId: baseConfig.instanceId, keycloakSubject: 'subject-1' })
    ).resolves.toMatchObject({
      status: 'error',
      errorCode: 'network_error',
    });

    expect(fetchImpl).toHaveBeenCalledWith(
      baseConfig.graphqlBaseUrl,
      expect.objectContaining({
        redirect: 'manual',
      })
    );
  });

  it('retries once for transient 503 responses before succeeding', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response('temporarily unavailable', { status: 503 }))
      .mockResolvedValueOnce(createJsonResponse(200, { access_token: 'token-1', expires_in: 120 }))
      .mockResolvedValueOnce(createJsonResponse(200, { data: { __typename: 'Query' } }));

    const service = createSvaMainserverService({
      loadInstanceConfig: async () => baseConfig,
      readCredentials: async () => ({ apiKey: 'key-1', apiSecret: 'secret-1' }),
      fetchImpl,
      retryBaseDelayMs: 0,
      randomIntImpl: () => 0,
    });

    await expect(
      service.getQueryRootTypename({ instanceId: baseConfig.instanceId, keycloakSubject: 'subject-1' })
    ).resolves.toMatchObject({ __typename: 'Query' });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it('cancels the first response body before retrying after transient 503', async () => {
    const cancel = vi.fn().mockResolvedValue(undefined);
    const transientResponse = {
      status: 503,
      body: {
        cancel,
      },
    } as unknown as Response;

    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(transientResponse)
      .mockResolvedValueOnce(createJsonResponse(200, { access_token: 'token-1', expires_in: 120 }))
      .mockResolvedValueOnce(createJsonResponse(200, { data: { __typename: 'Query' } }));

    const service = createSvaMainserverService({
      loadInstanceConfig: async () => baseConfig,
      readCredentials: async () => ({ apiKey: 'key-1', apiSecret: 'secret-1' }),
      fetchImpl,
      retryBaseDelayMs: 0,
      randomIntImpl: () => 0,
    });

    await expect(
      service.getQueryRootTypename({ instanceId: baseConfig.instanceId, keycloakSubject: 'subject-1' })
    ).resolves.toMatchObject({ __typename: 'Query' });

    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it('maps timeout failures to a stable network error', async () => {
    const timeoutError = new Error('timeout');
    timeoutError.name = 'TimeoutError';

    const service = createSvaMainserverService({
      loadInstanceConfig: async () => baseConfig,
      readCredentials: async () => ({ apiKey: 'key-1', apiSecret: 'secret-1' }),
      fetchImpl: vi.fn().mockRejectedValue(timeoutError),
      retryBaseDelayMs: 0,
      randomIntImpl: () => 0,
    });

    await expect(
      service.getConnectionStatus({ instanceId: baseConfig.instanceId, keycloakSubject: 'subject-1' })
    ).resolves.toMatchObject({
      status: 'error',
      errorCode: 'network_error',
    });
  });

  it('does not retry non-retryable errors after a transient first failure', async () => {
    const retryable = new TypeError('socket closed');
    const nonRetryable = new Error('fatal downstream error');

    const service = createSvaMainserverService({
      loadInstanceConfig: async () => baseConfig,
      readCredentials: async () => ({ apiKey: 'key-1', apiSecret: 'secret-1' }),
      fetchImpl: vi.fn().mockRejectedValueOnce(retryable).mockRejectedValueOnce(nonRetryable),
      retryBaseDelayMs: 0,
      randomIntImpl: () => 0,
    });

    await expect(
      service.getConnectionStatus({ instanceId: baseConfig.instanceId, keycloakSubject: 'subject-1' })
    ).resolves.toMatchObject({
      status: 'error',
      errorCode: 'network_error',
      errorMessage: 'fatal downstream error',
    });
  });

  it('maps non-json GraphQL responses to invalid_response', async () => {
    const service = createSvaMainserverService({
      loadInstanceConfig: async () => baseConfig,
      readCredentials: async () => ({ apiKey: 'key-1', apiSecret: 'secret-1' }),
      fetchImpl: vi
        .fn()
        .mockResolvedValueOnce(createJsonResponse(200, { access_token: 'token-1', expires_in: 120 }))
        .mockResolvedValueOnce(new Response('not-json', { status: 200, headers: { 'Content-Type': 'text/plain' } })),
      retryBaseDelayMs: 0,
      randomIntImpl: () => 0,
    });

    await expect(
      service.getConnectionStatus({ instanceId: baseConfig.instanceId, keycloakSubject: 'subject-1' })
    ).resolves.toMatchObject({
      status: 'error',
      errorCode: 'invalid_response',
    });
  });

  it('waits for the parallel diagnostic request to settle before returning an error status', async () => {
    const delayedGraphql = createDeferred<Response>();
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(createJsonResponse(200, { access_token: 'token-1', expires_in: 120 }))
      .mockResolvedValueOnce(createJsonResponse(200, { errors: [{ message: 'boom' }] }))
      .mockImplementationOnce(async () => delayedGraphql.promise);

    const service = createSvaMainserverService({
      loadInstanceConfig: async () => baseConfig,
      readCredentials: async () => ({ apiKey: 'key-1', apiSecret: 'secret-1' }),
      fetchImpl,
      retryBaseDelayMs: 0,
      randomIntImpl: () => 0,
    });

    let settled = false;
    const statusPromise = service
      .getConnectionStatus({ instanceId: baseConfig.instanceId, keycloakSubject: 'subject-1' })
      .then((status) => {
        settled = true;
        return status;
      });

    await Promise.resolve();
    await Promise.resolve();
    expect(settled).toBe(false);

    delayedGraphql.resolve(createJsonResponse(200, { data: { __typename: 'Mutation' } }));

    await expect(statusPromise).resolves.toMatchObject({
      status: 'error',
      errorCode: 'graphql_error',
    });
  });
});
