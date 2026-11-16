import { describe, expect, it, vi } from 'vitest';

import {
  createConfiguredSsfKeycloakAuthorizationProjectionTarget,
  createSsfAuthorizationProjectionReconciler,
  createSsfAuthorizationRevision,
  createSsfKeycloakAuthorizationProjectionTarget,
  areSsfAuthorizationProjectionsEqual,
  SSF_AUTHORIZATION_PROJECTION_VERSION,
  SSF_TOKEN_CLAIMS,
  type SsfAuthorizationProjection,
  type SsfKeycloakProjectionClient,
  type SsfAuthorizationProjectionLockedStore,
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
    getOidcClientByClientId: vi.fn(async () => ({ enabled: true })),
    listClientProtocolMappers: vi.fn(async () => [...mappers.values()]),
    listEffectiveClientProtocolMappers: vi.fn(async () => [...mappers.values()]),
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
    ensureAdminOnlyUserProfileAttributes: vi.fn(async () => undefined),
    hasAdminOnlyUserProfileAttributes: vi.fn(async () => true),
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
    setOidcClientEnabled: vi.fn<(clientId: string, enabled: boolean) => Promise<void>>(
      async () => undefined
    ),
  } satisfies SsfKeycloakProjectionClient;
  return { attributes, client };
};

describe('SSF Keycloak authorization projection target', () => {
  const reconcileFixture = () => {
    const { attributes, client } = createClient();
    let enabled = true;
    client.setOidcClientEnabled.mockImplementation(async (_clientId, value) => {
      enabled = value;
    });
    const onMissingSubjects = vi.fn();
    const target = createSsfKeycloakAuthorizationProjectionTarget({
      resolveTenant: async (instanceId) => ({ instanceId, clientId: 'ssf', client }),
      prepareLoginClients: async () => undefined,
      prepareRuntimeBaseline: async () => undefined,
      readLoginReadiness: async () => enabled,
      revokeSsfTenantSessions: async () => undefined,
      onMissingSubjects,
    });
    let confirmed: SsfAuthorizationProjection | undefined;
    const store = {
      stage: vi.fn(async (desired: SsfAuthorizationProjection) => ({
        instanceId: desired.instanceId,
        generation: 1,
        status: 'pending' as const,
        desiredRevision: createSsfAuthorizationRevision(desired),
        desiredProjection: desired,
        confirmedRevision: null,
        confirmedProjection: null,
        sessionsRevokedRevision: null,
        lastErrorCode: null,
      })),
      claim: async () => true,
      confirmReadBack: async ({ desired, readBack }) => {
        if (!areSsfAuthorizationProjectionsEqual(desired, readBack)) return false;
        confirmed = readBack;
        return true;
      },
      markReady: async () => true,
      markBlocked: vi.fn(async () => true),
    } satisfies SsfAuthorizationProjectionLockedStore;
    const reconcile = createSsfAuthorizationProjectionReconciler({
      target,
      store: { withTenantLock: async (_instanceId, work) => work(store) },
    });
    return {
      attributes,
      client,
      target,
      store,
      reconcile,
      onMissingSubjects,
      enabled: () => enabled,
      confirmed: () => confirmed,
    };
  };

  it('keeps the tenant ready when IAM still grants permissions to a deleted Keycloak administrator', async () => {
    const fixture = reconcileFixture();
    const desired = desiredProjection();
    desired.subjects.push({
      subject: 'deleted-admin',
      roles: ['tenant_admin'],
      permissions: ['ssf.configuration.tenant.manage'],
    });

    await expect(fixture.reconcile(desired)).resolves.toMatchObject({ status: 'ready' });

    expect(fixture.confirmed()).toEqual(desiredProjection());
    expect(fixture.enabled()).toBe(true);
    expect(fixture.attributes.has('deleted-admin')).toBe(false);
    expect(desired.subjects).toHaveLength(2);
    expect(fixture.onMissingSubjects).toHaveBeenCalledWith('tenant-a', ['deleted-admin']);
    expect(fixture.store.markBlocked).not.toHaveBeenCalled();
  });

  it('does not treat a failed later Keycloak page as proof that accounts were deleted', async () => {
    const fixture = reconcileFixture();
    fixture.client.listUsers
      .mockResolvedValueOnce(
        Array.from({ length: 100 }, (_, index) => ({
          externalId: `page-user-${index}`,
          attributes: {},
        }))
      )
      .mockRejectedValueOnce(new Error('keycloak_unavailable'));

    await expect(fixture.reconcile(desiredProjection())).rejects.toThrow('keycloak_unavailable');

    expect(fixture.enabled()).toBe(true);
    expect(fixture.store.stage).not.toHaveBeenCalled();
    expect(fixture.onMissingSubjects).not.toHaveBeenCalled();
  });

  it('publishes an empty verified projection when every entitled account was deleted', async () => {
    const fixture = reconcileFixture();
    fixture.attributes.delete('user-1');

    await expect(fixture.reconcile(desiredProjection())).resolves.toMatchObject({
      status: 'ready',
    });

    expect(fixture.confirmed()).toEqual({ ...desiredProjection(), subjects: [] });
    expect(fixture.enabled()).toBe(true);
  });

  it.each(['before-write', 'during-write', 'before-readback'] as const)(
    'reconciles the remaining accounts after a concurrent deletion %s',
    async (phase) => {
      const fixture = reconcileFixture();
      fixture.attributes.set('user-2', { locale: ['de'] });
      const desired = desiredProjection();
      desired.subjects.push({
        subject: 'user-2',
        roles: ['user'],
        permissions: ['ssf.configuration.tenant.read'],
      });
      const originalList = fixture.client.listUsers.getMockImplementation();
      if (!originalList) throw new Error('missing_list_fixture');
      let reads = 0;
      fixture.client.listUsers.mockImplementation(async (query) => {
        reads++;
        if (
          (phase === 'before-write' && reads === 2) ||
          (phase === 'before-readback' && reads === 3)
        )
          fixture.attributes.delete('user-1');
        return originalList(query);
      });
      const originalUpdate = fixture.client.updateUser.getMockImplementation();
      if (!originalUpdate) throw new Error('missing_update_fixture');
      fixture.client.updateUser.mockImplementation(async (id, input) => {
        if (phase === 'during-write' && id === 'user-1') {
          fixture.attributes.delete(id);
          throw Object.assign(new Error('not_found'), { statusCode: 404 });
        }
        return originalUpdate(id, input);
      });

      await expect(fixture.reconcile(desired)).resolves.toMatchObject({ status: 'ready' });

      expect(fixture.confirmed()?.subjects).toEqual([
        {
          subject: 'user-2',
          roles: ['user'],
          permissions: ['ssf.configuration.tenant.read'],
        },
      ]);
      expect(fixture.enabled()).toBe(true);
      expect(fixture.store.markBlocked).not.toHaveBeenCalled();
    }
  );

  it('keeps a genuine Keycloak write denial blocked instead of treating it as a deletion', async () => {
    const fixture = reconcileFixture();
    fixture.client.updateUser.mockRejectedValue(
      Object.assign(new Error('forbidden'), { statusCode: 403 })
    );

    await expect(fixture.reconcile(desiredProjection())).resolves.toMatchObject({
      status: 'blocked',
      reason: 'target_write_failed',
    });

    expect(fixture.enabled()).toBe(false);
    expect(fixture.confirmed()).toBeUndefined();
    expect(fixture.onMissingSubjects).not.toHaveBeenCalled();
  });

  it('keeps a corrupted read-back blocked even when an unrelated account was deleted', async () => {
    const fixture = reconcileFixture();
    const originalUpdate = fixture.client.updateUser.getMockImplementation();
    if (!originalUpdate) throw new Error('missing_update_fixture');
    fixture.client.updateUser.mockImplementation(async (id, input) =>
      originalUpdate(id, {
        attributes:
          id === 'user-1'
            ? { ...input.attributes, [SSF_TOKEN_CLAIMS.permissions]: [] }
            : input.attributes,
      })
    );
    const desired = desiredProjection();
    desired.subjects.push({
      subject: 'deleted-admin',
      roles: ['tenant_admin'],
      permissions: ['ssf.configuration.tenant.manage'],
    });

    await expect(fixture.reconcile(desired)).resolves.toMatchObject({
      status: 'blocked',
      reason: 'target_readback_mismatch',
    });

    expect(fixture.enabled()).toBe(false);
    expect(fixture.confirmed()).toBeUndefined();
  });

  it('bounds retries when Keycloak keeps reporting not-found writes for a listed user', async () => {
    const fixture = reconcileFixture();
    fixture.client.updateUser.mockRejectedValue(
      Object.assign(new Error('not_found'), { statusCode: 404 })
    );

    await expect(fixture.reconcile(desiredProjection())).resolves.toMatchObject({
      status: 'blocked',
      reason: 'target_write_failed',
    });

    expect(fixture.store.stage).toHaveBeenCalledTimes(3);
    expect(fixture.enabled()).toBe(false);
  });

  it('does not conceal corrupted surviving claims behind a simultaneous account deletion', async () => {
    const fixture = reconcileFixture();
    fixture.attributes.set('user-2', { locale: ['de'] });
    const desired = desiredProjection();
    desired.subjects.push({
      subject: 'user-2',
      roles: ['user'],
      permissions: ['ssf.configuration.tenant.read'],
    });
    const originalList = fixture.client.listUsers.getMockImplementation();
    if (!originalList) throw new Error('missing_list_fixture');
    let reads = 0;
    fixture.client.listUsers.mockImplementation(async (query) => {
      if (++reads === 3) {
        fixture.attributes.delete('user-1');
        const survivor = fixture.attributes.get('user-2');
        if (!survivor) throw new Error('missing_survivor_fixture');
        survivor[SSF_TOKEN_CLAIMS.permissions] = [];
      }
      return originalList(query);
    });

    await expect(fixture.reconcile(desired)).resolves.toMatchObject({
      status: 'blocked',
      reason: 'target_readback_mismatch',
    });

    expect(fixture.enabled()).toBe(false);
    expect(fixture.confirmed()).toBeUndefined();
  });

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
      [SSF_TOKEN_CLAIMS.languages]: [],
      [SSF_TOKEN_CLAIMS.instanceId]: ['tenant-a'],
      [SSF_TOKEN_CLAIMS.roles]: ['tenant_admin'],
      [SSF_TOKEN_CLAIMS.permissions]: [
        'ssf.configuration.tenant.manage',
        'ssf.configuration.tenant.read',
      ],
      [SSF_TOKEN_CLAIMS.authorizationRevision]: [revision],
    });
    expect(attributes.get('stale-user')).toEqual({ locale: ['en'] });
    expect(client.ensureUserAttributeProtocolMapper).toHaveBeenCalledTimes(5);
    expect(client.ensureAdminOnlyUserProfileAttributes).toHaveBeenCalledWith([
      { name: SSF_TOKEN_CLAIMS.instanceId, multivalued: false },
      { name: SSF_TOKEN_CLAIMS.roles, multivalued: true },
      { name: SSF_TOKEN_CLAIMS.permissions, multivalued: true },
      { name: SSF_TOKEN_CLAIMS.languages, multivalued: true },
      { name: SSF_TOKEN_CLAIMS.authorizationRevision, multivalued: false },
    ]);
    expect(client.ensureUserAttributeProtocolMapper).toHaveBeenCalledWith(
      expect.objectContaining({
        clientId: 'ssf',
        claimName: SSF_TOKEN_CLAIMS.permissions,
        multivalued: true,
      })
    );
    await expect(target.readBack('tenant-a')).resolves.toEqual(desired);
  });

  it('accepts a converged empty projection as technical readiness across grant transitions', async () => {
    const { client } = createClient();
    const target = createSsfKeycloakAuthorizationProjectionTarget({
      resolveTenant: vi.fn(async (instanceId) => ({ instanceId, clientId: 'ssf', client })),
      readLoginReadiness: vi.fn(async () => true),
      revokeSsfTenantSessions: vi.fn(async () => undefined),
    });
    const empty = { ...desiredProjection(), subjects: [] };
    const populated = desiredProjection();
    const emptyRevision = createSsfAuthorizationRevision(empty);
    const populatedRevision = createSsfAuthorizationRevision(populated);

    await target.reconcile(empty, emptyRevision);
    await expect(target.isReady('tenant-a', emptyRevision)).resolves.toBe(true);

    await target.reconcile(populated, populatedRevision);
    await expect(target.isReady('tenant-a', populatedRevision)).resolves.toBe(true);

    await target.reconcile(empty, emptyRevision);
    await expect(target.isReady('tenant-a', emptyRevision)).resolves.toBe(true);
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
    expect(client.ensureAdminOnlyUserProfileAttributes).not.toHaveBeenCalled();
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

  it('treats an absent browser client as already unable to issue tokens', async () => {
    const { client } = createClient();
    client.getOidcClientByClientId.mockResolvedValueOnce(null);
    const target = createSsfKeycloakAuthorizationProjectionTarget({
      resolveTenant: vi.fn(async (instanceId) => ({
        instanceId,
        clientId: 'ssf-frontend',
        client,
      })),
      revokeSsfTenantSessions: vi.fn(async () => undefined),
    });

    await target.suspendTokenIssuance('tenant-a');

    expect(client.setOidcClientEnabled).not.toHaveBeenCalled();
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

  it.each([
    [
      'missing tenant claim',
      (attributes: Record<string, readonly string[]>) => {
        delete attributes[SSF_TOKEN_CLAIMS.instanceId];
      },
    ],
    [
      'foreign tenant claim',
      (attributes: Record<string, readonly string[]>) => {
        attributes[SSF_TOKEN_CLAIMS.instanceId] = ['tenant-b'];
      },
    ],
    [
      'stale authorization revision',
      (attributes: Record<string, readonly string[]>) => {
        attributes[SSF_TOKEN_CLAIMS.authorizationRevision] = [`sha256:${'c'.repeat(64)}`];
      },
    ],
  ])('fails readiness closed for a %s without affecting another realm', async (_caseName, corrupt) => {
    const tenantA = createClient();
    const tenantB = createClient();
    const target = createSsfKeycloakAuthorizationProjectionTarget({
      resolveTenant: async (instanceId) => ({
        instanceId,
        clientId: 'ssf-frontend',
        client: instanceId === 'tenant-a' ? tenantA.client : tenantB.client,
      }),
      readLoginReadiness: async () => true,
      revokeSsfTenantSessions: async () => undefined,
    });
    const projectionA = desiredProjection('tenant-a');
    const projectionB = desiredProjection('tenant-b');
    const revisionA = createSsfAuthorizationRevision(projectionA);
    const revisionB = createSsfAuthorizationRevision(projectionB);

    await target.reconcile(projectionA, revisionA);
    await target.reconcile(projectionB, revisionB);
    const attributesA = tenantA.attributes.get('user-1');
    if (!attributesA) throw new Error('missing_test_subject');
    corrupt(attributesA);

    await expect(target.isReady('tenant-a', revisionA)).resolves.toBe(false);
    await expect(target.isReady('tenant-b', revisionB)).resolves.toBe(true);
  });
});

it('does not accept hardcoded or duplicate claims from effective client-scope mappers', async () => {
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
  const mappers = await client.listEffectiveClientProtocolMappers('ssf-frontend');
  client.listEffectiveClientProtocolMappers.mockResolvedValue([
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

it('fails readiness closed when an SSF profile attribute becomes user-editable', async () => {
  const { client } = createClient();
  const target = createSsfKeycloakAuthorizationProjectionTarget({
    resolveTenant: async (instanceId) => ({ instanceId, clientId: 'ssf-frontend', client }),
    readLoginReadiness: async () => true,
    revokeSsfTenantSessions: async () => undefined,
  });
  const desired = desiredProjection();
  const revision = createSsfAuthorizationRevision(desired);
  await target.reconcile(desired, revision);

  client.hasAdminOnlyUserProfileAttributes.mockResolvedValue(false);

  await expect(target.isReady('tenant-a', revision)).resolves.toBe(false);
  await expect(target.readBack('tenant-a')).rejects.toThrow(
    'ssf_keycloak_projection_user_profile_mismatch'
  );
});

it('reconciles language-only changes into the staff-client mapper and read-back without changing contract revision', async () => {
  const { client, attributes } = createClient();
  const target = createSsfKeycloakAuthorizationProjectionTarget({
    resolveTenant: async instanceId => ({ instanceId, clientId: 'ssf', client }),
    revokeSsfTenantSessions: vi.fn(),
  });
  const base = desiredProjection();
  const first = { ...base, subjects: base.subjects.map(subject => ({ ...subject, languages: ['de'] })) };
  const second = { ...base, subjects: base.subjects.map(subject => ({ ...subject, languages: ['en-US'] })) };
  const revision = createSsfAuthorizationRevision(first);
  await target.reconcile(first, revision);
  expect(attributes.get('user-1')?.ssf_languages).toEqual(['de']);
  await target.reconcile(second, revision);
  expect(createSsfAuthorizationRevision(second)).toBe(revision);
  expect(await target.readBack('tenant-a')).toEqual(second);
  expect(client.ensureUserAttributeProtocolMapper).toHaveBeenCalledWith(expect.objectContaining({ clientId: 'ssf', claimName: 'ssf_languages', userAttribute: 'ssf_languages', multivalued: true, exclusiveClaim: true }));
  // A newly minted access token uses the current managed user attribute.
  const languageMapper = (await client.listEffectiveClientProtocolMappers('ssf')).find(mapper => mapper.config['claim.name'] === 'ssf_languages');
  const userAttribute = languageMapper?.config['user.attribute'];
  if (!userAttribute) throw new Error('language mapper missing');
  expect(attributes.get('user-1')?.[userAttribute]).toEqual(['en-US']);
});
