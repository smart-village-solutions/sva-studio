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
}));

vi.mock('@sva/instance-registry/provisioning-auth-state', () => ({
  createKeycloakProvisioningAdapters: state.createKeycloakProvisioningAdapters,
  createKeycloakProvisioningClientFactory: state.createKeycloakProvisioningClientFactory,
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
}));

describe('iam-instance-registry provisioning auth wiring', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
    const [adminFactoryCall, provisionerFactoryCall] = state.createKeycloakProvisioningClientFactory.mock.calls;
    expect(adminFactoryCall?.[0]).toBe(state.getKeycloakAdminClientConfigFromEnv);
    expect(provisionerFactoryCall?.[0]).toBe(state.getKeycloakProvisionerClientConfigFromEnv);

    const adminClient = adminFactoryCall?.[1]({ realm: 'admin' });
    expect(adminClient).toBeInstanceOf(state.KeycloakAdminClient);

    expect(state.createKeycloakProvisioningAdapters).toHaveBeenCalledTimes(2);
    expect(subject.readKeycloakState).toBeDefined();
    expect(subject.readKeycloakStateViaProvisioner).toBeDefined();
    expect(subject.provisionInstanceAuthArtifacts).toBeDefined();
    expect(subject.provisionInstanceAuthArtifactsViaProvisioner).toBeDefined();
  });

  it('builds default and provisioner readers from the matching state readers', async () => {
    const subject = await import('./provisioning-auth.js');

    expect(state.createInstanceKeycloakPreflightReader).toHaveBeenCalledTimes(2);
    expect(state.createInstanceKeycloakPlanReader).toHaveBeenCalledTimes(2);
    expect(state.createInstanceKeycloakStatusReader).toHaveBeenCalledTimes(2);

    expect(subject.getInstanceKeycloakPreflight.kind).toBe('preflight');
    expect(subject.getInstanceKeycloakPlan.kind).toBe('plan');
    expect(subject.getInstanceKeycloakStatus.kind).toBe('status');
    expect(subject.getInstanceKeycloakPreflightViaProvisioner.kind).toBe('preflight');
    expect(subject.getInstanceKeycloakPlanViaProvisioner.kind).toBe('plan');
    expect(subject.getInstanceKeycloakStatusViaProvisioner.kind).toBe('status');
    expect(subject.provisionInstanceAuthArtifacts).toBeDefined();
    expect(subject.provisionInstanceAuthArtifactsViaProvisioner).toBeDefined();
  });
});
