import { describe, expect, it, vi } from 'vitest';

import { createSvaMainserverService } from './service';

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

describe('createSvaMainserverService', () => {
  it('caches credentials for sixty seconds by default', async () => {
    let nowMs = 0;
    const readIdentityUserAttributes = vi
      .fn()
      .mockResolvedValue({
        sva_mainserver_api_key: ['key-1'],
        sva_mainserver_api_secret: ['secret-1'],
      });

    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(createJsonResponse(200, { access_token: 'token-1', expires_in: 120 }))
      .mockImplementation(async () => createJsonResponse(200, { data: { __typename: 'Query' } }));

    const service = createSvaMainserverService({
      loadInstanceConfig: async () => baseConfig,
      readIdentityUserAttributes,
      fetchImpl,
      now: () => nowMs,
    });

    await service.getQueryRootTypename({ instanceId: baseConfig.instanceId, keycloakSubject: 'subject-1' });
    nowMs += 30_000;
    await service.getQueryRootTypename({ instanceId: baseConfig.instanceId, keycloakSubject: 'subject-1' });

    expect(readIdentityUserAttributes).toHaveBeenCalledTimes(1);
  });

  it('caches access tokens until the skew window is reached', async () => {
    let nowMs = 0;
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(createJsonResponse(200, { access_token: 'token-1', expires_in: 120 }))
      .mockImplementation(async () => createJsonResponse(200, { data: { __typename: 'Query' } }));

    const service = createSvaMainserverService({
      loadInstanceConfig: async () => baseConfig,
      readIdentityUserAttributes: async () => ({
        sva_mainserver_api_key: ['key-1'],
        sva_mainserver_api_secret: ['secret-1'],
      }),
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
      readIdentityUserAttributes: async () => ({
        sva_mainserver_api_key: ['key-1'],
        sva_mainserver_api_secret: ['secret-1'],
      }),
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
      readIdentityUserAttributes: async () => ({
        sva_mainserver_api_key: ['key-1'],
        sva_mainserver_api_secret: ['secret-1'],
      }),
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
      readIdentityUserAttributes: async () => ({
        sva_mainserver_api_key: ['key-1'],
      }),
    });

    await expect(
      service.getConnectionStatus({ instanceId: baseConfig.instanceId, keycloakSubject: 'subject-1' })
    ).resolves.toMatchObject({
      status: 'error',
      errorCode: 'missing_credentials',
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
      readIdentityUserAttributes: async () => ({
        sva_mainserver_api_key: ['key-1'],
        sva_mainserver_api_secret: ['secret-1'],
      }),
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
        readIdentityUserAttributes: async () => ({
          sva_mainserver_api_key: ['key-1'],
          sva_mainserver_api_secret: ['secret-1'],
        }),
        fetchImpl: vi
          .fn()
          .mockResolvedValueOnce(createJsonResponse(200, { access_token: 'token-1', expires_in: 120 }))
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
});
