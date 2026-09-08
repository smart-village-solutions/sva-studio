import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  createKeycloakProvisioningClientFactory: vi.fn((resolveConfig, createClient) => ({
    resolveConfig,
    createClient,
  })),
  createKeycloakProvisioningAdapters: vi.fn((factory) => ({
    readKeycloakState: vi.fn(async () => ({ factory, kind: 'state' })),
    provisionInstanceAuthArtifacts: vi.fn(async () => ({ factory, kind: 'provision' })),
  })),
  createReadKeycloakState: vi.fn((factory) =>
    vi.fn(async (input) => ({
      client: factory(input.authRealm),
      kind: 'tenant-state',
    }))
  ),
  createReadKeycloakClientSecrets: vi.fn((factory) =>
    vi.fn(async () => ({ factory, keycloakClientSecret: 'secret', tenantAdminClientSecret: null }))
  ),
  createInstanceKeycloakPreflightReader: vi.fn((readState, readError) => ({
    kind: 'preflight',
    readState,
    readError,
  })),
  createInstanceKeycloakPlanReader: vi.fn((readState, preflight) => ({
    kind: 'plan',
    readState,
    preflight,
  })),
  createInstanceKeycloakStatusReader: vi.fn((readState) => ({
    kind: 'status',
    readState,
  })),
  KeycloakAdminClient: vi.fn(function KeycloakAdminClient(this: object, config: unknown) {
    Object.assign(this, { config });
  }),
  KeycloakAdminRequestError: class extends Error {
    constructor(
      public readonly input: {
        message: string;
        statusCode: number;
        code: string;
      }
    ) {
      super(input.message);
      this.statusCode = input.statusCode;
      this.code = input.code;
    }
    statusCode: number;
    code: string;
  },
  KeycloakAdminUnavailableError: class extends Error {},
  getKeycloakAdminClientConfigFromEnv: vi.fn(() => ({ realm: 'admin' })),
  getKeycloakProvisionerClientConfigFromEnv: vi.fn(() => ({ realm: 'provisioner' })),
  getKeycloakTenantAdminClientConfigFromEnv: vi.fn((input) => ({
    ...input,
    adminRealm: input.realm,
  })),
  readInstanceRegistryPluginOidcClientRequirements: vi.fn<
    () => readonly {
      contractVersion: '1.0';
      pluginId: string;
      clientId: string;
      audience: string;
      enabled: false;
    }[]
  >(() => []),
}));

vi.mock('@sva/instance-registry/provisioning-auth-state', () => ({
  createKeycloakProvisioningAdapters: state.createKeycloakProvisioningAdapters,
  createKeycloakProvisioningClientFactory: state.createKeycloakProvisioningClientFactory,
  createReadKeycloakClientSecrets: state.createReadKeycloakClientSecrets,
  createReadKeycloakState: state.createReadKeycloakState,
}));

vi.mock('@sva/instance-registry/provisioning-auth', () => ({
  createInstanceKeycloakPlanReader: state.createInstanceKeycloakPlanReader,
  createInstanceKeycloakPreflightReader: state.createInstanceKeycloakPreflightReader,
  createInstanceKeycloakStatusReader: state.createInstanceKeycloakStatusReader,
}));

vi.mock('../keycloak-admin-client.js', () => ({
  KeycloakAdminClient: state.KeycloakAdminClient,
  KeycloakAdminRequestError: state.KeycloakAdminRequestError,
  KeycloakAdminUnavailableError: state.KeycloakAdminUnavailableError,
  getKeycloakAdminClientConfigFromEnv: state.getKeycloakAdminClientConfigFromEnv,
  getKeycloakProvisionerClientConfigFromEnv: state.getKeycloakProvisionerClientConfigFromEnv,
  getKeycloakTenantAdminClientConfigFromEnv: state.getKeycloakTenantAdminClientConfigFromEnv,
}));

vi.mock('./plugin-activation-policy-snapshot.js', () => ({
  readInstanceRegistryPluginOidcClientRequirements:
    state.readInstanceRegistryPluginOidcClientRequirements,
}));

describe('iam-instance-registry provisioning auth wiring', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.readInstanceRegistryPluginOidcClientRequirements.mockReturnValue([]);
    vi.resetModules();
  });

  it('maps keycloak access errors by unavailable/request/unknown error kind', async () => {
    const { readKeycloakAccessError } = await import('./provisioning-auth-state.js');
    const unavailable = new state.KeycloakAdminUnavailableError('keycloak offline');
    const requestError = new state.KeycloakAdminRequestError({
      message: 'bad request',
      statusCode: 403,
      code: 'http_403',
    });

    expect(readKeycloakAccessError(unavailable)).toBe('keycloak offline');
    expect(readKeycloakAccessError(requestError)).toBe('HTTP 403 http_403');
    expect(readKeycloakAccessError(new Error('boom'))).toBe('boom');
    expect(readKeycloakAccessError('raw')).toBe('raw');
  });

  it('creates separate admin and provisioner adapters backed by KeycloakAdminClient factories', async () => {
    const subject = await import('./provisioning-auth-state.js');

    expect(state.createKeycloakProvisioningClientFactory).toHaveBeenCalledTimes(2);
    const [adminFactoryCall, provisionerFactoryCall] =
      state.createKeycloakProvisioningClientFactory.mock.calls;
    expect(adminFactoryCall?.[0]).toBe(state.getKeycloakAdminClientConfigFromEnv);
    expect(provisionerFactoryCall?.[0]).toBe(state.getKeycloakProvisionerClientConfigFromEnv);

    const adminClient = adminFactoryCall?.[1]({ realm: 'admin' });
    expect(adminClient).toBeInstanceOf(state.KeycloakAdminClient);

    expect(state.createKeycloakProvisioningAdapters).toHaveBeenCalledTimes(2);
    expect(subject.readKeycloakState).toBeDefined();
    expect(subject.readKeycloakStateViaProvisioner).toBeDefined();
    expect(subject.readKeycloakClientSecretsViaProvisioner).toBeDefined();
    expect(subject.readKeycloakStateViaTenantAdmin).toBeDefined();
    expect(subject.provisionInstanceAuthArtifacts).toBeDefined();
    expect(subject.provisionInstanceAuthArtifactsViaProvisioner).toBeDefined();
  });

  it('injects the installed SSF client declaration at the auth-runtime composition boundary', async () => {
    state.readInstanceRegistryPluginOidcClientRequirements.mockReturnValue([
      {
        contractVersion: '1.0',
        pluginId: 'ssf',
        clientId: 'ssf',
        audience: 'ssf',
        enabled: false,
      },
    ]);
    const subject = await import('./provisioning-auth-state.js');
    const input = {
      instanceId: 'demo',
      primaryHostname: 'demo.studio.example',
      realmMode: 'existing' as const,
      authRealm: 'demo',
      authClientId: 'sva-studio',
      authClientSecretConfigured: true,
    };

    await subject.readKeycloakState(input);
    await subject.provisionInstanceAuthArtifacts(input);

    const adminAdapters = state.createKeycloakProvisioningAdapters.mock.results[0]?.value;
    expect(adminAdapters.readKeycloakState).toHaveBeenCalledWith({
      ...input,
      pluginOidcClients: [
        {
          contractVersion: '1.0',
          pluginId: 'ssf',
          clientId: 'ssf',
          audience: 'ssf',
          enabled: false,
        },
      ],
    });
    expect(adminAdapters.provisionInstanceAuthArtifacts).toHaveBeenCalledWith(
      expect.objectContaining({ pluginOidcClients: [expect.objectContaining({ pluginId: 'ssf' })] })
    );
  });

  it('keeps provisioning neutral when the host snapshot has no plugin OIDC requirements', async () => {
    const subject = await import('./provisioning-auth-state.js');
    const input = {
      instanceId: 'demo',
      primaryHostname: 'demo.studio.example',
      realmMode: 'existing' as const,
      authRealm: 'demo',
      authClientId: 'sva-studio',
      authClientSecretConfigured: true,
    };

    await subject.provisionInstanceAuthArtifacts(input);

    const adminAdapters = state.createKeycloakProvisioningAdapters.mock.results[0]?.value;
    expect(adminAdapters.provisionInstanceAuthArtifacts).toHaveBeenCalledWith({
      ...input,
      pluginOidcClients: [],
    });
  });

  it('preserves caller plugin declarations while keeping the installed SSF declaration authoritative', async () => {
    state.readInstanceRegistryPluginOidcClientRequirements.mockReturnValue([
      {
        contractVersion: '1.0',
        pluginId: 'ssf',
        clientId: 'ssf',
        audience: 'ssf',
        enabled: false,
      },
    ]);
    const subject = await import('./provisioning-auth-state.js');
    const input = {
      instanceId: 'demo',
      primaryHostname: 'demo.studio.example',
      realmMode: 'existing' as const,
      authRealm: 'demo',
      authClientId: 'sva-studio',
      authClientSecretConfigured: true,
      pluginOidcClients: [
        {
          contractVersion: '1.0' as const,
          pluginId: 'example',
          clientId: 'example',
          audience: 'example',
          enabled: false as const,
        },
        {
          contractVersion: '1.0' as const,
          pluginId: 'ssf',
          clientId: 'ssf',
          audience: 'ssf',
          enabled: false as const,
        },
      ],
    };

    await subject.readKeycloakState(input);

    const adminAdapters = state.createKeycloakProvisioningAdapters.mock.results[0]?.value;
    expect(adminAdapters.readKeycloakState).toHaveBeenCalledWith({
      ...input,
      pluginOidcClients: [
        expect.objectContaining({ pluginId: 'example' }),
        expect.objectContaining({ pluginId: 'ssf' }),
      ],
    });
  });

  it('reads audit state with the tenant-local admin credentials from the registry input', async () => {
    const subject = await import('./provisioning-auth-state.js');

    await subject.readKeycloakStateViaTenantAdmin({
      instanceId: 'demo',
      primaryHostname: 'demo.studio.example',
      realmMode: 'existing',
      authRealm: 'demo',
      authClientId: 'sva-studio',
      authClientSecretConfigured: true,
      tenantAdminClient: { clientId: 'sva-studio-admin', secretConfigured: true },
      tenantAdminClientSecret: 'tenant-secret',
    });

    expect(state.getKeycloakTenantAdminClientConfigFromEnv).toHaveBeenCalledWith({
      realm: 'demo',
      clientId: 'sva-studio-admin',
      clientSecret: 'tenant-secret',
    });
    expect(state.createReadKeycloakState).toHaveBeenCalledOnce();
  });

  it('fails closed when tenant-admin credentials are incomplete', async () => {
    const subject = await import('./provisioning-auth-state.js');

    await expect(
      subject.readKeycloakStateViaTenantAdmin({
        instanceId: 'demo',
        primaryHostname: 'demo.studio.example',
        realmMode: 'existing',
        authRealm: 'demo',
        authClientId: 'sva-studio',
        authClientSecretConfigured: true,
        tenantAdminClient: { clientId: 'sva-studio-admin', secretConfigured: false },
        tenantAdminClientSecret: 'stale-tenant-secret',
      })
    ).rejects.toThrow('Tenant admin client credentials are not configured');

    expect(state.getKeycloakTenantAdminClientConfigFromEnv).not.toHaveBeenCalled();
    expect(state.createReadKeycloakState).not.toHaveBeenCalled();
  });

  it('builds default, tenant-admin, and provisioner readers from the matching state readers', async () => {
    const subject = await import('./provisioning-auth.js');

    expect(state.createInstanceKeycloakPreflightReader).toHaveBeenCalledTimes(3);
    expect(state.createInstanceKeycloakPlanReader).toHaveBeenCalledTimes(3);
    expect(state.createInstanceKeycloakStatusReader).toHaveBeenCalledTimes(3);

    expect(subject.getInstanceKeycloakPreflight.kind).toBe('preflight');
    expect(subject.getInstanceKeycloakPlan.kind).toBe('plan');
    expect(subject.getInstanceKeycloakStatus.kind).toBe('status');
    expect(subject.getInstanceKeycloakStatusViaTenantAdmin.kind).toBe('status');
    expect(subject.getInstanceKeycloakPreflightViaProvisioner.kind).toBe('preflight');
    expect(subject.getInstanceKeycloakPlanViaProvisioner.kind).toBe('plan');
    expect(subject.getInstanceKeycloakStatusViaProvisioner.kind).toBe('status');
    expect(subject.provisionInstanceAuthArtifacts).toBeDefined();
    expect(subject.provisionInstanceAuthArtifactsViaProvisioner).toBeDefined();
  });
});
