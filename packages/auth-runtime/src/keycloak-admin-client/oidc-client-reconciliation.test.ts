import { describe, expect, it, vi } from 'vitest';

import {
  reconcileOidcClient,
  type EnsureOidcClientInput,
  type KeycloakOidcClientOperations,
} from './oidc-client-reconciliation.js';

const input: EnsureOidcClientInput = {
  clientId: 'web-app',
  redirectUris: ['https://web.example/callback'],
  postLogoutRedirectUris: ['https://web.example/logout'],
  webOrigins: ['https://web.example'],
  rootUrl: 'https://web.example',
};

const existingClient = {
  id: 'client-1',
  clientId: 'web-app',
  enabled: true,
  protocol: 'openid-connect',
  publicClient: false,
  standardFlowEnabled: true,
  implicitFlowEnabled: false,
  directAccessGrantsEnabled: false,
  serviceAccountsEnabled: false,
  redirectUris: ['https://web.example/callback'],
  webOrigins: ['https://web.example'],
  rootUrl: 'https://web.example',
  attributes: { 'post.logout.redirect.uris': 'https://web.example/logout' },
};

const createOperations = (
  overrides: Partial<KeycloakOidcClientOperations> = {}
): KeycloakOidcClientOperations => ({
  assertWriteAvailability: vi.fn(async () => undefined),
  findClient: vi.fn(async () => existingClient),
  createClient: vi.fn(async () => 'client-1'),
  updateClient: vi.fn(async () => undefined),
  deleteClientForCompensation: vi.fn(async () => undefined),
  getClientSecretValue: vi.fn(async () => 'stored-secret'),
  rotateClientSecret: vi.fn(async () => undefined),
  ...overrides,
});

describe('OIDC client reconciliation', () => {
  it('fails closed for conflicting or incomplete Studio ownership', async () => {
    const operations = createOperations();

    await expect(
      reconcileOidcClient(operations, {
        ...input,
        ownership: { instanceId: 'tenant-1', artifactKey: 'studio-web' },
      })
    ).rejects.toMatchObject({ statusCode: 409, code: 'client_ownership_conflict' });

    expect(operations.updateClient).not.toHaveBeenCalled();
  });

  it('merges callback and origin allowlists without replacing existing values', async () => {
    const operations = createOperations({
      findClient: vi.fn(async () => ({
        ...existingClient,
        redirectUris: ['https://existing.example/callback'],
        webOrigins: ['https://existing.example'],
        attributes: { 'post.logout.redirect.uris': 'https://existing.example/logout' },
      })),
    });

    await reconcileOidcClient(operations, input);

    expect(operations.updateClient).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        redirectUris: ['https://existing.example/callback', 'https://web.example/callback'],
        webOrigins: ['https://existing.example', 'https://web.example'],
        attributes: expect.objectContaining({
          'post.logout.redirect.uris':
            'https://existing.example/logout##https://web.example/logout',
        }),
      }),
      'web-app'
    );
  });

  it('repairs Keycloak wildcard defaults after strict empty-allowlist creation', async () => {
    const operations = createOperations({
      findClient: vi
        .fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          ...existingClient,
          redirectUris: ['*'],
          webOrigins: ['+'],
          attributes: { 'post.logout.redirect.uris': '+' },
        }),
    });

    await reconcileOidcClient(operations, {
      ...input,
      redirectUris: [],
      postLogoutRedirectUris: [],
      webOrigins: [],
      uriPolicy: 'replace',
    });

    expect(operations.updateClient).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        redirectUris: [],
        webOrigins: [],
        attributes: expect.objectContaining({ 'post.logout.redirect.uris': '' }),
      }),
      'web-app'
    );
  });

  it('does not read or rotate a secret without explicit rotation', async () => {
    const operations = createOperations();

    await reconcileOidcClient(operations, { ...input, clientSecret: 'new-secret' });

    expect(operations.getClientSecretValue).not.toHaveBeenCalled();
    expect(operations.rotateClientSecret).not.toHaveBeenCalled();
  });

  it('preserves the original repair failure after successful cleanup and requires manual action when cleanup fails', async () => {
    const readbackFailure = new Error('readback failed');
    const operations = createOperations({
      findClient: vi
        .fn()
        .mockResolvedValueOnce(null)
        .mockRejectedValueOnce(readbackFailure),
    });

    await expect(
      reconcileOidcClient(operations, { ...input, uriPolicy: 'replace', redirectUris: [] })
    ).rejects.toBe(readbackFailure);
    expect(operations.deleteClientForCompensation).toHaveBeenCalledWith('client-1', 'web-app');

    const cleanupFailure = new Error('cleanup failed');
    const failingOperations = createOperations({
      findClient: vi
        .fn()
        .mockResolvedValueOnce(null)
        .mockRejectedValueOnce(readbackFailure),
      deleteClientForCompensation: vi.fn(async () => {
        throw cleanupFailure;
      }),
    });

    await expect(
      reconcileOidcClient(failingOperations, { ...input, uriPolicy: 'replace', redirectUris: [] })
    ).rejects.toMatchObject({
      message: 'strict_oidc_client_reconciliation_failed_cleanup_failed_requires_manual_action',
      cause: cleanupFailure,
    });
  });
});
