import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  client: { query: vi.fn() },
  loadDefaultExternalInterfaceRecord: vi.fn(),
  loadInstanceById: vi.fn(),
  loadMappedUsersBySubject: vi.fn(),
  loadOrganizationDetail: vi.fn(),
  reserveOrganizationMainserverProvisioning: vi.fn(),
  updateOrganizationMainserverProvisioningState: vi.fn(),
  writeActiveOrganizationProvisioningCredentials: vi.fn(),
  recordMainserverDataProviderObservation: vi.fn(),
  readEffectiveSvaMainserverCredentialsWithStatus: vi.fn(),
  provisionMainserverUserCredentials: vi.fn(),
  fetchMainserverUpstream: vi.fn(),
  parseMainserverJsonBody: vi.fn(),
  normalizeProvisioningUpstreamUrl: vi.fn(async (value: string) => value),
  persistProvisionedMainserverCredentials: vi.fn(),
  persistCreatedUser: vi.fn(),
  resolveIdentityProviderForInstance: vi.fn(),
  emitActivityLog: vi.fn(),
  logger: { info: vi.fn(), error: vi.fn() },
}));

vi.mock('@sva/data-repositories/server', () => ({
  loadDefaultExternalInterfaceRecord: state.loadDefaultExternalInterfaceRecord,
  loadInstanceById: state.loadInstanceById,
}));
vi.mock('@sva/iam-admin', () => ({
  loadMappedUsersBySubject: state.loadMappedUsersBySubject,
  loadOrganizationDetail: state.loadOrganizationDetail,
  reserveOrganizationMainserverProvisioning: state.reserveOrganizationMainserverProvisioning,
  updateOrganizationMainserverProvisioningState:
    state.updateOrganizationMainserverProvisioningState,
  writeActiveOrganizationProvisioningCredentials:
    state.writeActiveOrganizationProvisioningCredentials,
}));
vi.mock('@sva/server-runtime', () => ({ createSdkLogger: () => state.logger }));
vi.mock('../iam-contents/mainserver-data-provider-bindings.js', () => ({
  recordMainserverDataProviderObservation: state.recordMainserverDataProviderObservation,
}));
vi.mock('../mainserver-effective-credentials.js', () => ({
  readEffectiveSvaMainserverCredentialsWithStatus:
    state.readEffectiveSvaMainserverCredentialsWithStatus,
}));
vi.mock('../iam-account-management/mainserver-user-provisioning.js', () => ({
  provisionMainserverUserCredentials: state.provisionMainserverUserCredentials,
}));
vi.mock('../iam-account-management/mainserver-upstream-http.js', () => ({
  fetchMainserverUpstream: state.fetchMainserverUpstream,
  parseMainserverJsonBody: state.parseMainserverJsonBody,
}));
vi.mock('../iam-account-management/mainserver-upstream-url-validation.js', () => ({
  normalizeProvisioningUpstreamUrl: state.normalizeProvisioningUpstreamUrl,
}));
vi.mock('../iam-account-management/user-create-operation.js', () => ({
  persistProvisionedMainserverCredentials: state.persistProvisionedMainserverCredentials,
}));
vi.mock('../iam-account-management/user-create-persistence.js', () => ({
  persistCreatedUser: state.persistCreatedUser,
}));
vi.mock('../iam-account-management/shared.js', () => ({
  emitActivityLog: state.emitActivityLog,
  resolveIdentityProviderForInstance: state.resolveIdentityProviderForInstance,
  trackKeycloakCall: (_operation: string, work: () => Promise<unknown>) => work(),
  withInstanceScopedDb: (_instanceId: string, work: (client: unknown) => Promise<unknown>) =>
    work(state.client),
}));

const organization = {
  id: '11111111-1111-4111-8111-111111111111',
  organizationKey: 'stadt-koeln',
  displayName: 'Städtische Werke Köln',
  organizationType: 'company' as const,
  contentAuthorPolicy: 'org_only' as const,
  isActive: true,
  depth: 0,
  hierarchyPath: [],
  childCount: 0,
  membershipCount: 0,
  metadata: {},
  memberships: [],
  children: [],
  mainserverApplicationSecretSet: false,
  mainserverProvisioning: {
    status: 'not_provisioned' as const,
    attemptCount: 0,
    operationInProgress: false,
  },
};

const actorInput = {
  instanceId: 'de-koeln',
  organizationId: organization.id,
  actorAccountId: '22222222-2222-4222-8222-222222222222',
  actorSubject: 'kc-admin-1',
  trigger: 'explicit_retry' as const,
  operationReference: 'operation-1',
};

const prepareNewProvisioningAccount = () => {
  state.reserveOrganizationMainserverProvisioning.mockResolvedValue({
    acquired: true,
    state: {
      provisioningStatus: 'provisioning',
      attemptCount: 1,
      mainserverApplicationSecretSet: false,
    },
  });
  const provider = {
    listUsers: vi.fn().mockResolvedValue([]),
    createUser: vi.fn().mockResolvedValue({ externalId: 'kc-technical-1' }),
    deactivateUser: vi.fn(),
  };
  state.resolveIdentityProviderForInstance.mockResolvedValue({ provider });
  state.loadMappedUsersBySubject.mockResolvedValue(new Map());
  state.persistCreatedUser.mockResolvedValue({
    responseData: {
      id: '33333333-3333-4333-8333-333333333333',
      keycloakSubject: 'kc-technical-1',
      displayName: organization.displayName,
      email: 'stadtische.werke.koln.stadt.koln@smart-village.app',
      status: 'active',
      isTechnicalAccount: true,
      roles: [],
      mainserverUserApplicationSecretSet: false,
    },
    roleNames: [],
  });
  state.readEffectiveSvaMainserverCredentialsWithStatus.mockResolvedValue({
    status: 'ok',
    source: 'user',
    credentials: { apiKey: 'actor-app', apiSecret: 'actor-secret' },
    credentialFingerprint: 'c'.repeat(64),
  });
  return provider;
};

describe('organization Mainserver provisioning', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.loadOrganizationDetail.mockResolvedValue(organization);
    state.loadInstanceById.mockResolvedValue({ displayName: 'Stadt Köln' });
    state.updateOrganizationMainserverProvisioningState.mockResolvedValue({});
    state.writeActiveOrganizationProvisioningCredentials.mockResolvedValue(true);
    state.recordMainserverDataProviderObservation.mockResolvedValue({ outcome: 'created' });
    state.loadDefaultExternalInterfaceRecord.mockResolvedValue({
      enabled: true,
      publicConfig: {
        graphqlBaseUrl: 'https://mainserver.example/graphql',
        oauthTokenUrl: 'https://mainserver.example/oauth/token',
      },
    });
  });

  it('derives deterministic ASCII-safe identities and adds a stable collision suffix', async () => {
    const { deriveOrganizationTechnicalIdentity } =
      await import('./organization-mainserver-provisioning.js');
    expect(
      deriveOrganizationTechnicalIdentity({
        organizationId: organization.id,
        organizationDisplayName: organization.displayName,
        tenantDisplayName: 'Stadt Köln',
      })
    ).toEqual({
      email: 'stadtische.werke.koln.stadt.koln@smart-village.app',
      username: 'stadtische.werke.koln.stadt.koln@smart-village.app',
      firstName: 'Städtische Werke Köln',
      lastName: 'Stadt Köln',
    });
    expect(
      deriveOrganizationTechnicalIdentity({
        organizationId: organization.id,
        organizationDisplayName: organization.displayName,
        tenantDisplayName: 'Stadt Köln',
        collisionSafe: true,
      }).email
    ).toBe('stadtische.werke.koln.stadt.koln.11111111@smart-village.app');
  });

  it.each([
    {
      label: 'normalizes umlauts, sharp s and combining marks',
      organizationDisplayName: 'ÄÖÜ ß Café',
      tenantDisplayName: 'Crème Brûlée',
      expectedEmail: 'aou.ss.cafe.creme.brulee@smart-village.app',
    },
    {
      label: 'uses both fallbacks for empty values',
      organizationDisplayName: '',
      tenantDisplayName: '',
      expectedEmail: 'organization.tenant@smart-village.app',
    },
    {
      label: 'uses both fallbacks for separator-only values',
      organizationDisplayName: ' ._- / ',
      tenantDisplayName: '---___...',
      expectedEmail: 'organization.tenant@smart-village.app',
    },
    {
      label: 'collapses internal separators and removes edge separators',
      organizationDisplayName: '...Alpha___Beta---',
      tenantDisplayName: '__North / East..',
      expectedEmail: 'alpha.beta.north.east@smart-village.app',
    },
    {
      label: 'truncates each normalized segment without leaving a trailing separator',
      organizationDisplayName: 'abcdefghijklmnopqrstuvw-xyz',
      tenantDisplayName: '12345678901234567890123-tenant',
      expectedEmail: 'abcdefghijklmnopqrstuvw.12345678901234567890123@smart-village.app',
    },
  ])('$label', async ({ organizationDisplayName, tenantDisplayName, expectedEmail }) => {
    const { deriveOrganizationTechnicalIdentity } =
      await import('./organization-mainserver-provisioning.js');

    expect(
      deriveOrganizationTechnicalIdentity({
        organizationId: organization.id,
        organizationDisplayName,
        tenantDisplayName,
      })
    ).toEqual({
      email: expectedEmail,
      username: expectedEmail,
      firstName: organizationDisplayName,
      lastName: tenantDisplayName,
    });
  });

  it('normalizes very long homogeneous and mixed-separator inputs within a bounded budget', async () => {
    const { deriveOrganizationTechnicalIdentity } =
      await import('./organization-mainserver-provisioning.js');
    const startedAt = performance.now();
    const identity = deriveOrganizationTechnicalIdentity({
      organizationId: organization.id,
      organizationDisplayName: 'a'.repeat(100_000),
      tenantDisplayName: `${'._- '.repeat(25_000)}Tenant${' -_.'.repeat(25_000)}`,
      collisionSafe: true,
    });

    expect(identity.email).toBe('aaaaaaaaaaaaaaaaaaaaaaaa.tenant.11111111@smart-village.app');
    expect(performance.now() - startedAt).toBeLessThan(2_000);
  });

  it('returns an already-ready reservation without creating or provisioning another account', async () => {
    state.reserveOrganizationMainserverProvisioning.mockResolvedValue({
      acquired: false,
      state: {
        provisioningStatus: 'ready',
        attemptCount: 1,
        mainserverApplicationSecretSet: true,
      },
    });
    const { provisionOrganizationMainserver } =
      await import('./organization-mainserver-provisioning.js');
    await expect(provisionOrganizationMainserver(actorInput)).resolves.toMatchObject({
      outcome: 'ready',
    });
    expect(state.resolveIdentityProviderForInstance).not.toHaveBeenCalled();
    expect(state.provisionMainserverUserCredentials).not.toHaveBeenCalled();
  });

  it('skips before creating a technical account when the integration is not configured', async () => {
    state.reserveOrganizationMainserverProvisioning.mockResolvedValue({
      acquired: true,
      state: {
        provisioningStatus: 'provisioning',
        attemptCount: 1,
        mainserverApplicationSecretSet: false,
      },
    });
    state.loadDefaultExternalInterfaceRecord.mockResolvedValue(null);

    const { provisionOrganizationMainserver } =
      await import('./organization-mainserver-provisioning.js');
    await expect(provisionOrganizationMainserver(actorInput)).resolves.toMatchObject({
      outcome: 'skipped',
    });
    expect(state.resolveIdentityProviderForInstance).not.toHaveBeenCalled();
    expect(state.updateOrganizationMainserverProvisioningState).toHaveBeenCalledWith(
      state.client,
      expect.objectContaining({
        provisioningStatus: 'not_provisioned',
        provisioningPhase: 'integration_not_configured',
        releaseLease: true,
      })
    );
  });

  it('keeps automatic organization creation neutral when personal bootstrap credentials are missing', async () => {
    prepareNewProvisioningAccount();
    state.readEffectiveSvaMainserverCredentialsWithStatus.mockResolvedValue({
      status: 'missing_credentials',
    });

    const { provisionOrganizationMainserver } =
      await import('./organization-mainserver-provisioning.js');
    await expect(
      provisionOrganizationMainserver({ ...actorInput, trigger: 'organization_create' })
    ).resolves.toMatchObject({ outcome: 'skipped', errorCode: 'missing_credentials' });
    expect(state.resolveIdentityProviderForInstance).not.toHaveBeenCalled();
    expect(state.updateOrganizationMainserverProvisioningState).toHaveBeenCalledWith(
      state.client,
      expect.objectContaining({
        provisioningStatus: 'not_provisioned',
        provisioningPhase: 'personal_credentials_missing',
      })
    );
  });

  it('marks a lost Mainserver response for reconciliation without compensating the account', async () => {
    const provider = prepareNewProvisioningAccount();
    const { MainserverUserProvisioningError } =
      await import('../iam-account-management/mainserver-user-provisioning-error.js');
    state.provisionMainserverUserCredentials.mockRejectedValue(
      new MainserverUserProvisioningError({
        code: 'network_error',
        message: 'lost response',
        statusCode: 503,
        retryable: true,
        outcomeUnknown: true,
      })
    );

    const { provisionOrganizationMainserver } =
      await import('./organization-mainserver-provisioning.js');
    await expect(provisionOrganizationMainserver(actorInput)).resolves.toMatchObject({
      outcome: 'reconciliation_required',
      errorCode: 'network_error',
    });
    expect(provider.deactivateUser).not.toHaveBeenCalled();
    expect(state.updateOrganizationMainserverProvisioningState).toHaveBeenLastCalledWith(
      state.client,
      expect.objectContaining({
        provisioningStatus: 'reconciliation_required',
        provisioningPhase: 'mainserver_request',
        releaseLease: true,
      })
    );
  });

  it('compensates a newly created Keycloak account when local attachment fails before upstream', async () => {
    const provider = prepareNewProvisioningAccount();
    state.persistCreatedUser.mockRejectedValue(new Error('database unavailable'));

    const { provisionOrganizationMainserver } =
      await import('./organization-mainserver-provisioning.js');
    await expect(provisionOrganizationMainserver(actorInput)).resolves.toMatchObject({
      outcome: 'failed',
    });
    expect(provider.deactivateUser).toHaveBeenCalledWith('kc-technical-1');
    expect(state.provisionMainserverUserCredentials).not.toHaveBeenCalled();
  });

  it('keeps a conflicting create-response binding for reconciliation without overwriting it', async () => {
    prepareNewProvisioningAccount();
    state.provisionMainserverUserCredentials.mockResolvedValue({
      dataProviderId: '4711',
      mainserverUserApplicationId: 'org-app',
      mainserverUserApplicationSecret: 'org-secret',
    });
    state.readEffectiveSvaMainserverCredentialsWithStatus
      .mockReset()
      .mockResolvedValueOnce({
        status: 'ok',
        source: 'user',
        credentials: { apiKey: 'actor-app', apiSecret: 'actor-secret' },
        credentialFingerprint: 'c'.repeat(64),
      })
      .mockResolvedValueOnce({
        status: 'ok',
        source: 'organization',
        credentials: { apiKey: 'org-app', apiSecret: 'org-secret' },
        credentialFingerprint: 'a'.repeat(64),
      });
    state.recordMainserverDataProviderObservation.mockResolvedValue({ outcome: 'conflict' });

    const { provisionOrganizationMainserver } =
      await import('./organization-mainserver-provisioning.js');
    await expect(provisionOrganizationMainserver(actorInput)).resolves.toMatchObject({
      outcome: 'reconciliation_required',
      errorCode: 'data_provider_binding_conflict',
    });
    expect(state.updateOrganizationMainserverProvisioningState).toHaveBeenLastCalledWith(
      state.client,
      expect.objectContaining({
        provisioningStatus: 'reconciliation_required',
        provisioningPhase: 'binding_conflict',
      })
    );
  });

  it('creates one purpose-bound technical account and persists credentials plus create-response binding', async () => {
    state.reserveOrganizationMainserverProvisioning.mockResolvedValue({
      acquired: true,
      state: {
        provisioningStatus: 'provisioning',
        attemptCount: 1,
        mainserverApplicationSecretSet: false,
      },
    });
    const provider = {
      listUsers: vi.fn().mockResolvedValue([]),
      createUser: vi.fn().mockResolvedValue({ externalId: 'kc-technical-1' }),
      deactivateUser: vi.fn(),
    };
    state.resolveIdentityProviderForInstance.mockResolvedValue({ provider });
    state.loadMappedUsersBySubject.mockResolvedValue(new Map());
    state.persistCreatedUser.mockResolvedValue({
      responseData: {
        id: '33333333-3333-4333-8333-333333333333',
        keycloakSubject: 'kc-technical-1',
        displayName: organization.displayName,
        email: 'stadtische.werke.koln.stadt.koln@smart-village.app',
        status: 'active',
        isTechnicalAccount: true,
        roles: [],
        mainserverUserApplicationSecretSet: false,
      },
      roleNames: [],
    });
    state.provisionMainserverUserCredentials.mockResolvedValue({
      dataProviderId: '4711',
      mainserverUserApplicationId: 'org-app',
      mainserverUserApplicationSecret: 'org-secret',
    });
    state.readEffectiveSvaMainserverCredentialsWithStatus
      .mockResolvedValueOnce({
        status: 'ok',
        source: 'user',
        credentials: { apiKey: 'actor-app', apiSecret: 'actor-secret' },
        credentialFingerprint: 'c'.repeat(64),
      })
      .mockResolvedValueOnce({
        status: 'ok',
        source: 'organization',
        credentials: { apiKey: 'org-app', apiSecret: 'org-secret' },
        credentialFingerprint: 'a'.repeat(64),
      });

    const { provisionOrganizationMainserver } =
      await import('./organization-mainserver-provisioning.js');
    await expect(provisionOrganizationMainserver(actorInput)).resolves.toMatchObject({
      outcome: 'ready',
    });
    expect(provider.createUser).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'stadtische.werke.koln.stadt.koln@smart-village.app',
        attributes: {
          instanceId: 'de-koeln',
          organizationId: organization.id,
          accountPurpose: 'organization_mainserver',
        },
      })
    );
    expect(state.persistCreatedUser).toHaveBeenCalledWith(
      state.client,
      expect.objectContaining({
        payload: expect.objectContaining({
          isTechnicalAccount: true,
          roleIds: [],
          groupIds: [],
        }),
      })
    );
    expect(state.provisionMainserverUserCredentials).toHaveBeenCalledWith(
      expect.objectContaining({
        actorSubject: 'kc-admin-1',
        keycloakSubject: 'kc-technical-1',
      })
    );
    expect(state.writeActiveOrganizationProvisioningCredentials).toHaveBeenCalledWith(
      state.client,
      expect.objectContaining({
        operationReference: 'operation-1',
        mainserverApplicationId: 'org-app',
        mainserverApplicationSecret: 'org-secret',
      })
    );
    expect(state.recordMainserverDataProviderObservation).toHaveBeenCalledWith({
      instanceId: 'de-koeln',
      principalType: 'organization',
      principalId: organization.id,
      credentialFingerprint: 'a'.repeat(64),
      dataProviderId: '4711',
      evidenceKind: 'create_response',
    });
  });

  it('does not mutate Keycloak credentials after the provisioning lease was lost', async () => {
    prepareNewProvisioningAccount();
    state.provisionMainserverUserCredentials.mockResolvedValue({
      dataProviderId: '4711',
      mainserverUserApplicationId: 'org-app',
      mainserverUserApplicationSecret: 'org-secret',
    });
    state.writeActiveOrganizationProvisioningCredentials.mockResolvedValue(false);

    const { provisionOrganizationMainserver } =
      await import('./organization-mainserver-provisioning.js');
    await expect(provisionOrganizationMainserver(actorInput)).resolves.toMatchObject({
      outcome: 'reconciliation_required',
      errorCode: 'organization_provisioning_lease_lost',
    });
    expect(state.persistProvisionedMainserverCredentials).not.toHaveBeenCalled();
  });

  it('verifies existing credentials before attempting a new upstream provisioning', async () => {
    state.reserveOrganizationMainserverProvisioning.mockResolvedValue({
      acquired: true,
      state: {
        provisioningStatus: 'provisioning',
        attemptCount: 2,
        mainserverApplicationId: 'existing-app',
        mainserverApplicationSecretSet: true,
        technicalAccountId: '33333333-3333-4333-8333-333333333333',
      },
    });
    state.readEffectiveSvaMainserverCredentialsWithStatus.mockResolvedValue({
      status: 'ok',
      source: 'organization',
      credentials: { apiKey: 'existing-app', apiSecret: 'existing-secret' },
      credentialFingerprint: 'b'.repeat(64),
    });
    const provider = {
      getUserAttributes: vi.fn().mockResolvedValue({ accountPurpose: ['organization_mainserver'] }),
      updateUser: vi.fn().mockResolvedValue(undefined),
    };
    state.resolveIdentityProviderForInstance.mockResolvedValue({ provider });
    state.client.query.mockResolvedValue({ rows: [{ keycloak_subject: 'kc-technical-1' }] });
    state.loadMappedUsersBySubject.mockResolvedValue(
      new Map([
        [
          'kc-technical-1',
          {
            id: '33333333-3333-4333-8333-333333333333',
            keycloakSubject: 'kc-technical-1',
            displayName: organization.displayName,
            status: 'active',
            isTechnicalAccount: true,
            roles: [],
            mainserverUserApplicationSecretSet: false,
          },
        ],
      ])
    );
    state.loadDefaultExternalInterfaceRecord.mockResolvedValue({
      enabled: true,
      publicConfig: {
        graphqlBaseUrl: 'https://mainserver.example/graphql',
        oauthTokenUrl: 'https://mainserver.example/oauth/token',
      },
    });
    state.fetchMainserverUpstream
      .mockResolvedValueOnce(new Response('{}', { status: 200 }))
      .mockResolvedValueOnce(new Response('{}', { status: 200 }));
    state.parseMainserverJsonBody
      .mockResolvedValueOnce({ access_token: 'org-token' })
      .mockResolvedValueOnce({ data_provider: { id: 4711, name: 'Organisation' } });

    const { provisionOrganizationMainserver } =
      await import('./organization-mainserver-provisioning.js');
    await expect(provisionOrganizationMainserver(actorInput)).resolves.toMatchObject({
      outcome: 'ready',
    });
    expect(state.provisionMainserverUserCredentials).not.toHaveBeenCalled();
    expect(state.persistProvisionedMainserverCredentials).toHaveBeenCalledWith({
      identityProvider: { provider },
      keycloakSubject: 'kc-technical-1',
      credentials: {
        dataProviderId: '4711',
        mainserverUserApplicationId: 'existing-app',
        mainserverUserApplicationSecret: 'existing-secret',
      },
    });
    expect(state.persistProvisionedMainserverCredentials.mock.invocationCallOrder[0]).toBeLessThan(
      state.recordMainserverDataProviderObservation.mock.invocationCallOrder[0] ?? 0
    );
    expect(state.recordMainserverDataProviderObservation).toHaveBeenCalledWith(
      expect.objectContaining({
        dataProviderId: '4711',
        dataProviderName: 'Organisation',
        evidenceKind: 'identity_endpoint',
      })
    );
  });
});
