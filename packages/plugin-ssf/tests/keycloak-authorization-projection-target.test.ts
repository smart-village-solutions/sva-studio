import { describe, expect, it, vi } from 'vitest';

import {
  createConfiguredSsfKeycloakAuthorizationProjectionTarget,
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
  const mappers = new Map<
    string,
    { name: string; protocol: string; protocolMapper: string; config: Record<string, string> }
  >();
  const client = {
    listClientProtocolMappers: vi.fn(async () => [...mappers.values()]),
    listUsers: vi.fn(async ({ first = 0, max = 100 } = {}) =>
      [...attributes.entries()].slice(first, first + max).map(([externalId, userAttributes]) => ({
        externalId,
        attributes: userAttributes,
      }))
    ),
    updateUser: vi.fn(
      async (externalId: string, input: { attributes: Record<string, readonly string[]> }) => {
        attributes.set(externalId, { ...input.attributes });
      }
    ),
    ensureUserAttributeProtocolMapper: vi.fn(async (input) => {
      mappers.set(input.claimName, {
        name: input.name,
        protocol: 'openid-connect',
        protocolMapper: 'oidc-usermodel-attribute-mapper',
        config: {
          'claim.name': input.claimName,
          'user.attribute': input.userAttribute,
          'access.token.claim': 'true',
          'jsonType.label': 'String',
          multivalued: String(input.multivalued ?? false),
        },
      });
    }),
    setOidcClientEnabled: vi.fn(async () => undefined),
  } satisfies SsfKeycloakProjectionClient;
  return { attributes, client };
};

describe('SSF Keycloak authorization projection target', () => {
  it('allows projection without SSF control-plane configuration', async () => {
    const { client } = createClient();
    const target = createConfiguredSsfKeycloakAuthorizationProjectionTarget({
      environment: {},
      resolveTenant: vi.fn(async (instanceId) => ({ instanceId, clientId: 'ssf', client })),
    });
    const projection = desiredProjection();
    const revision = createSsfAuthorizationRevision(projection);

    await expect(target.reconcile(projection, revision)).resolves.toBeUndefined();
    await expect(target.readBack('tenant-a')).resolves.toEqual(projection);
    await expect(target.revokeTenantSessions('tenant-a', revision)).rejects.toThrow(
      'ssf_control_plane_configuration_missing'
    );
  });

  it('composes the configured consumer into the tenant projection target', async () => {
    const { client } = createClient();
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ access_token: 'service-token' }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    const target = createConfiguredSsfKeycloakAuthorizationProjectionTarget({
      environment: {
        SVA_STUDIO_SSF_CONTROL_PLANE_BASE_URL: 'https://ssf.example.test',
        SVA_STUDIO_SSF_CONTROL_PLANE_TOKEN_URL:
          'https://keycloak.example.test/realms/ssf/protocol/openid-connect/token',
        SVA_STUDIO_SSF_CONTROL_PLANE_CLIENT_SECRET: 'secret',
      },
      fetchImpl,
      resolveTenant: vi.fn(async (instanceId) => ({ instanceId, clientId: 'ssf', client })),
    });
    const authorizationRevision = createSsfAuthorizationRevision(desiredProjection());

    await target.revokeTenantSessions('tenant-a', authorizationRevision);

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(fetchImpl.mock.calls[1]?.[1]?.headers).toMatchObject({
      'X-Studio-Instance-Id': 'tenant-a',
    });
  });

  it('projects claims onto the existing tenant subject and verifies a complete read-back', async () => {
    const { attributes, client } = createClient();
    const target = createSsfKeycloakAuthorizationProjectionTarget({
      resolveTenant: vi.fn(async (instanceId) => ({ instanceId, clientId: 'ssf', client })),
      revokeSsfTenantSessions: vi.fn(async () => undefined),
    });
    const desired = desiredProjection();
    const revision = createSsfAuthorizationRevision(desired);

    await target.reconcile(desired, revision);

    expect(client.listUsers).toHaveBeenCalledWith({
      first: 0,
      max: 100,
      briefRepresentation: false,
    });

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

    const revision = createSsfAuthorizationRevision(desiredProjection());
    await target.revokeTenantSessions('tenant-a', revision);

    expect(revokeSsfTenantSessions).toHaveBeenCalledExactlyOnceWith(
      'tenant-a',
      revision,
      expect.any(AbortSignal)
    );
  });

  it('bounds SSF session revocation even when the downstream call ignores aborts', async () => {
    vi.useFakeTimers();
    try {
      const { client } = createClient();
      let receivedSignal: AbortSignal | undefined;
      const target = createSsfKeycloakAuthorizationProjectionTarget({
        resolveTenant: vi.fn(async (instanceId) => ({ instanceId, clientId: 'ssf', client })),
        revokeSsfTenantSessions: vi.fn(async (_instanceId, _authorizationRevision, signal) => {
          receivedSignal = signal;
          await new Promise<void>(() => undefined);
        }),
        sessionRevocationTimeoutMs: 25,
      });

      const result = expect(
        target.revokeTenantSessions('tenant-a', createSsfAuthorizationRevision(desiredProjection()))
      ).rejects.toThrow('ssf_session_revocation_timeout');
      await vi.advanceTimersByTimeAsync(25);

      await result;
      expect(receivedSignal?.aborted).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('rejects an invalid SSF session revocation timeout', async () => {
    const { client } = createClient();
    const target = createSsfKeycloakAuthorizationProjectionTarget({
      resolveTenant: vi.fn(async (instanceId) => ({ instanceId, clientId: 'ssf', client })),
      revokeSsfTenantSessions: vi.fn(async () => undefined),
      sessionRevocationTimeoutMs: 0,
    });

    await expect(
      target.revokeTenantSessions('tenant-a', createSsfAuthorizationRevision(desiredProjection()))
    ).rejects.toThrow('ssf_session_revocation_timeout_invalid');
  });

  it('suspends and resumes only the tenant-local SSF client', async () => {
    const { client } = createClient();
    const target = createSsfKeycloakAuthorizationProjectionTarget({
      resolveTenant: vi.fn(async (instanceId) => ({ instanceId, clientId: 'ssf', client })),
      revokeSsfTenantSessions: vi.fn(async () => undefined),
    });

    await target.suspendTokenIssuance('tenant-a');
    await target.resumeTokenIssuance('tenant-a');

    expect(client.setOidcClientEnabled).toHaveBeenNthCalledWith(1, 'ssf', false);
    expect(client.setOidcClientEnabled).toHaveBeenNthCalledWith(2, 'ssf', true);
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

    await target.reconcile(
      desiredProjection(),
      createSsfAuthorizationRevision(desiredProjection())
    );
    const userAttributes = attributes.get('user-1');
    if (!userAttributes) throw new Error('missing_test_subject');
    userAttributes[SSF_TOKEN_CLAIMS.authorizationRevision] = [`sha256:${'b'.repeat(64)}`];
    await expect(target.readBack('tenant-a')).rejects.toThrow(
      'ssf_keycloak_projection_revision_mismatch'
    );
  });
});

it('does not accept manual hardcoded or duplicate claim mappers as verified readiness', async () => {
  const { client } = createClient();
  const target = createSsfKeycloakAuthorizationProjectionTarget({
    resolveTenant: async (instanceId) => ({ instanceId, clientId: 'ssf-frontend', client }),
    readLoginReadiness: async () => true,
    prepareLoginClients: async () => undefined,
    revokeSsfTenantSessions: async () => undefined,
  });
  const desired = desiredProjection();
  const revision = createSsfAuthorizationRevision(desired);
  await target.reconcile(desired, revision);
  expect(await target.isReady('tenant-a', revision)).toBe(true);
  const mappers = await client.listClientProtocolMappers('ssf-frontend');
  client.listClientProtocolMappers.mockResolvedValue([
    ...mappers,
    {
      name: 'manual-revision',
      protocol: 'openid-connect',
      protocolMapper: 'oidc-hardcoded-claim-mapper',
      config: { 'claim.name': 'ssf_authorization_revision', 'claim.value': revision },
    },
  ]);
  expect(await target.isReady('tenant-a', revision)).toBe(false);
});
