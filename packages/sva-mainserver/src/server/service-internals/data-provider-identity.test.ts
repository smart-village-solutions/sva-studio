import { describe, expect, it, vi } from 'vitest';

import { SvaMainserverError } from '../errors.js';
import { createDataProviderIdentityOperation } from './data-provider-identity.js';

const connection = {
  instanceId: 'de-musterhausen',
  keycloakSubject: 'subject-1',
  actingPrincipalType: 'user' as const,
  credentialFingerprint: 'a'.repeat(64),
};

const config = {
  instanceId: 'de-musterhausen',
  providerKey: 'sva_mainserver' as const,
  graphqlBaseUrl: 'https://mainserver.example/graphql',
  oauthTokenUrl: 'https://mainserver.example/oauth/token',
  enabled: true,
};

describe('DataProvider identity operation', () => {
  it('uses the GraphQL bearer token and returns only normalized identity fields', async () => {
    const fetchWithRetry = vi.fn(async () =>
      Response.json({
        data_provider: {
          id: 42,
          name: ' Redaktion ',
          contact: { email: 'secret@example.org' },
          address: { city: 'Musterhausen' },
        },
      })
    );
    const operation = createDataProviderIdentityOperation({
      fetchWithRetry,
      loadAccessToken: vi.fn(async () => 'same-graphql-token'),
    });

    await expect(operation(connection, config)).resolves.toEqual({
      dataProvider: { id: '42', name: 'Redaktion' },
    });
    expect(fetchWithRetry).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://mainserver.example/data_provider.json',
        hop: 'identity',
        init: expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({ Authorization: 'Bearer same-graphql-token' }),
        }),
      })
    );
  });

  it.each([
    { data_provider: { name: 'Redaktion', description: 'Nicht übernehmen' } },
    { data_provider: { id: null, name: 'Redaktion' } },
    { data_provider: { id: '   ', name: 'Redaktion' } },
  ])('rejects an identity response without a stable id', async (body) => {
    const operation = createDataProviderIdentityOperation({
      fetchWithRetry: vi.fn(async () => Response.json(body)),
      loadAccessToken: vi.fn(async () => 'token'),
    });

    await expect(operation(connection, config)).rejects.toMatchObject({
      code: 'invalid_response',
      statusCode: 502,
    } satisfies Partial<SvaMainserverError>);
  });

  it('rejects a structurally invalid body without exposing it', async () => {
    const operation = createDataProviderIdentityOperation({
      fetchWithRetry: vi.fn(async () =>
        Response.json({ contact: { email: 'secret@example.org' } })
      ),
      loadAccessToken: vi.fn(async () => 'token'),
    });

    await expect(operation(connection, config)).rejects.toMatchObject({
      code: 'invalid_response',
      statusCode: 502,
    } satisfies Partial<SvaMainserverError>);
  });

  it('does not reinterpret an upstream authorization failure', async () => {
    const operation = createDataProviderIdentityOperation({
      fetchWithRetry: vi.fn(async () => new Response(null, { status: 403 })),
      loadAccessToken: vi.fn(async () => 'token'),
    });

    await expect(operation(connection, config)).rejects.toMatchObject({
      code: 'forbidden',
      statusCode: 403,
    } satisfies Partial<SvaMainserverError>);
  });
});
