import { describe, expect, it, vi } from 'vitest';

import {
  createSsfAuthorizationRevision,
  createSsfKeycloakAuthorizationProjectionTarget,
  SSF_AUTHORIZATION_PROJECTION_VERSION,
  SSF_TOKEN_CLAIMS,
  type SsfAuthorizationProjection,
  type SsfKeycloakProjectionClient,
} from '../src/runtime.js';

const desiredProjection = (instanceId = 'tenant-a'): SsfAuthorizationProjection => ({
  contractVersion: SSF_AUTHORIZATION_PROJECTION_VERSION,
  instanceId,
  subjects: [
    {
      subject: 'user-1',
      roles: ['tenant_admin'],
      permissions: ['ssf.configuration.tenant.manage', 'ssf.configuration.tenant.read'],
    },
  ],
});

const createClient = () => {
  const attributes = new Map<string, Record<string, readonly string[]>>([
    ['user-1', { locale: ['de'] }],
    [
      'stale-user',
      {
        locale: ['en'],
        [SSF_TOKEN_CLAIMS.instanceId]: ['tenant-a'],
        [SSF_TOKEN_CLAIMS.roles]: ['user'],
        [SSF_TOKEN_CLAIMS.permissions]: ['ssf.configuration.tenant.read'],
        [SSF_TOKEN_CLAIMS.authorizationRevision]: [`sha256:${'b'.repeat(64)}`],
      },
    ],
  ]);
  const client = {
    listUsers: vi.fn(async ({ first = 0, max = 100 } = {}) =>
      [...attributes.keys()].slice(first, first + max).map((externalId) => ({ externalId }))
    ),
    getUserAttributes: vi.fn(async (externalId: string) => attributes.get(externalId) ?? {}),
    updateUser: vi.fn(
      async (externalId: string, input: { attributes: Record<string, readonly string[]> }) => {
        attributes.set(externalId, { ...input.attributes });
      }
    ),
    ensureUserAttributeProtocolMapper: vi.fn(async () => undefined),
  } satisfies SsfKeycloakProjectionClient;
  return { attributes, client };
};

describe('SSF Keycloak authorization projection target', () => {
  it('projects claims onto the existing tenant subject and verifies a complete read-back', async () => {
    const { attributes, client } = createClient();
    const target = createSsfKeycloakAuthorizationProjectionTarget({
      resolveTenant: vi.fn(async (instanceId) => ({ instanceId, clientId: 'ssf', client })),
      revokeSsfTenantSessions: vi.fn(async () => undefined),
    });
    const desired = desiredProjection();
    const revision = createSsfAuthorizationRevision(desired);

    await target.reconcile(desired, revision);

    expect(attributes.get('user-1')).toEqual({
      locale: ['de'],
      [SSF_TOKEN_CLAIMS.instanceId]: ['tenant-a'],
      [SSF_TOKEN_CLAIMS.roles]: ['tenant_admin'],
      [SSF_TOKEN_CLAIMS.permissions]: [
        'ssf.configuration.tenant.manage',
        'ssf.configuration.tenant.read',
      ],
      [SSF_TOKEN_CLAIMS.authorizationRevision]: [revision],
    });
    expect(attributes.get('stale-user')).toEqual({ locale: ['en'] });
    expect(client.ensureUserAttributeProtocolMapper).toHaveBeenCalledTimes(4);
    expect(client.ensureUserAttributeProtocolMapper).toHaveBeenCalledWith(
      expect.objectContaining({
        clientId: 'ssf',
        claimName: SSF_TOKEN_CLAIMS.permissions,
        multivalued: true,
      })
    );
    await expect(target.readBack('tenant-a')).resolves.toEqual(desired);
  });

  it('fails before writes when the desired subject does not exist in the tenant realm', async () => {
    const { client } = createClient();
    const target = createSsfKeycloakAuthorizationProjectionTarget({
      resolveTenant: vi.fn(async (instanceId) => ({ instanceId, clientId: 'ssf', client })),
      revokeSsfTenantSessions: vi.fn(async () => undefined),
    });
    const desired = {
      ...desiredProjection(),
      subjects: [
        {
          subject: 'missing-user',
          roles: ['user'] as const,
          permissions: ['ssf.configuration.tenant.read'] as const,
        },
      ],
    };

    await expect(
      target.reconcile(desired, createSsfAuthorizationRevision(desired))
    ).rejects.toThrow('ssf_keycloak_projection_subject_missing');
    expect(client.ensureUserAttributeProtocolMapper).not.toHaveBeenCalled();
    expect(client.updateUser).not.toHaveBeenCalled();
  });

  it('revokes only SSF sessions after resolving the tenant realm', async () => {
    const tenantA = createClient();
    const tenantB = createClient();
    const revokeSsfTenantSessions = vi.fn(async () => undefined);
    const target = createSsfKeycloakAuthorizationProjectionTarget({
      resolveTenant: vi.fn(async (instanceId) => ({
        instanceId,
        clientId: 'ssf',
        client: instanceId === 'tenant-a' ? tenantA.client : tenantB.client,
      })),
      revokeSsfTenantSessions,
    });

    await target.revokeTenantSessions('tenant-a');

    expect(revokeSsfTenantSessions).toHaveBeenCalledExactlyOnceWith('tenant-a');
  });

  it('rejects a read-back whose stored revision does not match projected claims', async () => {
    const { client, attributes } = createClient();
    attributes.set('user-1', {
      [SSF_TOKEN_CLAIMS.instanceId]: ['tenant-a'],
      [SSF_TOKEN_CLAIMS.roles]: ['user'],
      [SSF_TOKEN_CLAIMS.permissions]: ['ssf.configuration.tenant.read'],
      [SSF_TOKEN_CLAIMS.authorizationRevision]: [`sha256:${'b'.repeat(64)}`],
    });
    attributes.set('stale-user', {});
    const target = createSsfKeycloakAuthorizationProjectionTarget({
      resolveTenant: vi.fn(async (instanceId) => ({ instanceId, clientId: 'ssf', client })),
      revokeSsfTenantSessions: vi.fn(async () => undefined),
    });

    await expect(target.readBack('tenant-a')).rejects.toThrow(
      'ssf_keycloak_projection_revision_mismatch'
    );
  });
});
