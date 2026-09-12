import type { createConfiguredSsfKeycloakAuthorizationProjectionTarget } from '@sva/plugin-ssf/runtime';
type TargetConfiguration = Parameters<
  typeof createConfiguredSsfKeycloakAuthorizationProjectionTarget
>[0];

import { beforeEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  rootPool: {},
  runtimePool: {},
  resolveRoot: vi.fn(),
  resolveRuntime: vi.fn(),
  provision: vi.fn(),
  prepareClients: vi.fn(),
  clientsReady: vi.fn(),
  tenant: vi.fn(),
  target: vi.fn((input: TargetConfiguration) => input),
  resolveTenant: vi.fn(),
  readSubjects: vi.fn(),
  store: vi.fn(),
  runtime: vi.fn(),
}));
vi.mock('@sva/auth-runtime/server', () => ({
  prepareInstanceSsfLoginClients: mocks.prepareClients,
  readInstanceSsfLoginClientsReady: mocks.clientsReady,
  readTenantPermissionProjectionSubjects: mocks.readSubjects,
  resolveInstanceKeycloakProjectionTenant: mocks.resolveTenant,
}));
vi.mock('@sva/plugin-ssf/runtime', () => ({
  createConfiguredSsfKeycloakAuthorizationProjectionTarget: mocks.target,
  createPostgresSsfAuthorizationProjectionStore: mocks.store,
  createSsfAuthorizationProjectionRuntime: mocks.runtime,
  provisionSsfTenant: mocks.provision,
  readSsfTenant: mocks.tenant,
  resolveSsfRootDatabasePool: mocks.resolveRoot,
  resolveSsfDatabasePool: mocks.resolveRuntime,
}));
vi.mock('@sva/plugin-ssf/provisioning', () => ({ SSF_LOGIN_CLIENT_ID: 'ssf-frontend' }));
import {
  createStudioSsfAuthorizationProjectionTarget,
  createStudioSsfAuthorizationProjectionRuntime,
  readStudioSsfLoginBaselineReadiness,
} from './ssf-authorization-projection-runtime.server.js';

const configuration = () => {
  createStudioSsfAuthorizationProjectionTarget();
  const value = mocks.target.mock.calls.at(-1)?.[0];
  if (!value) throw new Error('missing_target_configuration');
  return value;
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.resolveRoot.mockReturnValue(mocks.rootPool);
  mocks.resolveRuntime.mockReturnValue(mocks.runtimePool);
  mocks.tenant.mockResolvedValue({ instanceId: 'tenant-a' });
  mocks.clientsReady.mockResolvedValue(true);
  mocks.prepareClients.mockResolvedValue(undefined);
});
it('separates client preparation from the post-projection runtime baseline', async () => {
  const target = configuration();
  await target.prepareLoginClients!('tenant-a');
  expect(mocks.provision).not.toHaveBeenCalled();
  await target.prepareRuntimeBaseline!('tenant-a');
  expect(mocks.provision).toHaveBeenCalledWith(mocks.rootPool, 'tenant-a');
  await target.resolveTenant('tenant-a');
  expect(mocks.resolveTenant).toHaveBeenCalledWith('tenant-a', 'ssf-frontend');
  expect(await target.readLoginReadiness!('tenant-a')).toBe(true);
  expect(await readStudioSsfLoginBaselineReadiness('tenant-a')).toBe(true);
  expect(mocks.tenant).toHaveBeenCalledWith(mocks.runtimePool, 'tenant-a');
});
it('keeps database provisioning separate when client preparation fails', async () => {
  mocks.prepareClients.mockRejectedValue(new Error('missing realm'));
  await expect(
    createStudioSsfAuthorizationProjectionTarget().prepareLoginClients('tenant-a')
  ).rejects.toThrow('missing realm');
  expect(mocks.provision).not.toHaveBeenCalled();
});
it('never reports readiness without the baseline or privileged provisioning configuration', async () => {
  mocks.tenant.mockResolvedValue(null);
  expect(await configuration().readLoginReadiness!('tenant-a')).toBe(false);
  mocks.resolveRoot.mockReturnValue(null);
  await expect(
    createStudioSsfAuthorizationProjectionRuntime().reconcile('tenant-a')
  ).rejects.toThrow('ssf_root_database_not_configured');
});
