import { beforeEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  instance: vi.fn(),
  requirements: vi.fn(),
  resolveTenant: vi.fn(),
  reconcile: vi.fn(),
  validate: vi.fn(),
  alignment: vi.fn(),
  readClient: vi.fn(),
  readMappers: vi.fn(),
}));
vi.mock('@sva/data-repositories/server', () => ({ loadInstanceById: mocks.instance }));
vi.mock('@sva/instance-registry/provisioning-auth-state', () => ({
  readPluginOidcClientRequirements: mocks.validate,
  reconcilePluginOidcClients: mocks.reconcile,
  readPluginOidcClientAlignment: mocks.alignment,
}));
vi.mock('./iam-instance-registry/plugin-activation-policy-snapshot.js', () => ({
  readInstanceRegistryPluginOidcClientRequirements: mocks.requirements,
}));
vi.mock('./ssf-authorization-projection-tenant.js', () => ({
  resolveInstanceKeycloakProjectionTenant: mocks.resolveTenant,
}));
import {
  prepareInstanceSsfLoginClients,
  readInstanceSsfLoginClientsReady,
} from './ssf-login-clients.js';

beforeEach(() => {
  vi.resetAllMocks();
  mocks.instance.mockResolvedValue({
    instanceId: 'tenant-a',
    status: 'active',
    authClientId: 'studio',
    authRealm: 'realm-a',
  });
  mocks.requirements.mockReturnValue([
    { pluginId: 'ssf', contractVersion: '1.0', clientId: 'ssf' },
    { pluginId: 'ssf', contractVersion: '2.0', clientId: 'ssf-frontend' },
  ]);
  mocks.resolveTenant.mockResolvedValue({
    instanceId: 'tenant-a',
    clientId: 'ssf-frontend',
    client: {
      getOidcClientByClientId: mocks.readClient,
      listClientProtocolMappers: mocks.readMappers,
    },
  });
  mocks.readClient.mockImplementation(async (clientId) => ({
    clientId,
    enabled: clientId === 'ssf-frontend',
  }));
  mocks.readMappers.mockResolvedValue([]);
  mocks.alignment.mockReturnValue({ aligned: true });
});
it('repairs the browser client first and disables an enabled legacy resource client', async () => {
  await prepareInstanceSsfLoginClients('tenant-a');
  expect(mocks.resolveTenant).toHaveBeenCalledWith('tenant-a', 'ssf-frontend');
  expect(mocks.reconcile).toHaveBeenCalledWith(
    expect.any(Object),
    expect.objectContaining({
      authClientId: 'studio',
      pluginOidcClients: [mocks.requirements()[1], mocks.requirements()[0]],
    })
  );
  expect(await readInstanceSsfLoginClientsReady('tenant-a')).toBe(true);
});
it('creates an absent resource baseline through the Core adapter on initial provisioning', async () => {
  mocks.readClient.mockResolvedValue(null);
  await prepareInstanceSsfLoginClients('tenant-a');
  expect(mocks.reconcile).toHaveBeenCalledWith(
    expect.any(Object),
    expect.objectContaining({
      pluginOidcClients: [mocks.requirements()[1], mocks.requirements()[0]],
    })
  );
});
it('does not publish disabled browser clients or drifted resource clients', async () => {
  mocks.readClient.mockResolvedValue({ enabled: false });
  expect(await readInstanceSsfLoginClientsReady('tenant-a')).toBe(false);
  mocks.alignment.mockReturnValue({ aligned: false });
  expect(await readInstanceSsfLoginClientsReady('tenant-a')).toBe(false);
});
it('fails closed without a configured browser contract or for a suspended tenant', async () => {
  mocks.requirements.mockReturnValue([]);
  await expect(prepareInstanceSsfLoginClients('tenant-a')).rejects.toThrow(
    'ssf_login_contract_unavailable'
  );
  expect(await readInstanceSsfLoginClientsReady('tenant-a')).toBe(false);
  mocks.instance.mockResolvedValue({ status: 'suspended' });
  expect(await readInstanceSsfLoginClientsReady('tenant-a')).toBe(false);
  expect(mocks.reconcile).not.toHaveBeenCalled();
});
