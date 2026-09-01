import { describe, expect, it, vi } from 'vitest';

const dataRepositoryMocks = vi.hoisted(() => ({
  listExternalInterfaceRecords: vi.fn(),
  loadDefaultExternalInterfaceRecord: vi.fn(),
  loadWasteTenantProvisioningRecord: vi.fn(),
  requestWasteTenantProvisioning: vi.fn(),
  failWasteTenantProvisioningRequest: vi.fn(),
  saveExternalInterfaceConnectionCheck: vi.fn(),
  saveExternalInterfaceRecord: vi.fn(),
}));

const authMocks = vi.hoisted(() => ({
  readConfiguredPluginTenantAccess: vi.fn(),
  withAuthenticatedUser: vi.fn(),
}));

vi.mock('@sva/data-repositories/server', () => ({
  listExternalInterfaceRecords: dataRepositoryMocks.listExternalInterfaceRecords,
  loadDefaultExternalInterfaceRecord: dataRepositoryMocks.loadDefaultExternalInterfaceRecord,
  loadWasteTenantProvisioningRecord: dataRepositoryMocks.loadWasteTenantProvisioningRecord,
  requestWasteTenantProvisioning: dataRepositoryMocks.requestWasteTenantProvisioning,
  failWasteTenantProvisioningRequest: dataRepositoryMocks.failWasteTenantProvisioningRequest,
  saveExternalInterfaceConnectionCheck: dataRepositoryMocks.saveExternalInterfaceConnectionCheck,
  saveExternalInterfaceRecord: dataRepositoryMocks.saveExternalInterfaceRecord,
}));

vi.mock('@sva/server-runtime', () => ({
  createSdkLogger: () => ({
    error: vi.fn(),
  }),
  toSafeLogPath: (value: string) => new URL(value).pathname,
  toJsonErrorResponse: vi.fn(),
  withRequestContext: async (_input: unknown, work: () => Promise<unknown>) => work(),
}));

vi.mock('../iam-account-management/encryption.js', () => ({
  protectField: vi.fn(),
  revealField: vi.fn(),
}));

vi.mock('../log-context.js', () => ({
  buildLogContext: vi.fn(() => ({ request_id: 'req-1' })),
}));

vi.mock('../middleware.js', () => ({
  withAuthenticatedUser: authMocks.withAuthenticatedUser,
}));

vi.mock('../plugin-tenant-lifecycle/access.js', () => ({
  readConfiguredPluginTenantAccess: authMocks.readConfiguredPluginTenantAccess,
}));

import {
  sharedWasteManagementDeps,
  withAuthenticatedWasteManagementHandler,
} from './server-context.js';

describe('sharedWasteManagementDeps', () => {
  it('exposes the default interface loader for waste settings write operations', () => {
    expect(sharedWasteManagementDeps.loadDefaultInterfaceRecord).toBe(
      dataRepositoryMocks.loadDefaultExternalInterfaceRecord
    );
    expect(sharedWasteManagementDeps.listInterfaceRecords).toBe(
      dataRepositoryMocks.listExternalInterfaceRecords
    );
    expect(sharedWasteManagementDeps.loadWasteTenantProvisioning).toBe(
      dataRepositoryMocks.loadWasteTenantProvisioningRecord
    );
    expect(sharedWasteManagementDeps.requestWasteTenantProvisioning).toBe(
      dataRepositoryMocks.requestWasteTenantProvisioning
    );
    expect(sharedWasteManagementDeps.failWasteTenantProvisioningRequest).toBe(
      dataRepositoryMocks.failWasteTenantProvisioningRequest
    );
  });

  it('blocks dedicated waste handlers when tenant lifecycle access is not ready', async () => {
    authMocks.withAuthenticatedUser.mockImplementationOnce(async (_request, work) =>
      work({ user: { id: 'user-1', instanceId: 'tenant-a' } })
    );
    authMocks.readConfiguredPluginTenantAccess.mockResolvedValueOnce({
      allowed: false,
      reason: 'blocked',
    });
    const handler = vi.fn(async () => new Response('handled'));

    const response = await withAuthenticatedWasteManagementHandler(
      new Request('https://studio.example/api/v1/waste-management/settings', {
        headers: { 'accept-language': 'en-GB,en;q=0.9,de;q=0.8' },
      }),
      handler
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: 'plugin_tenant_access_blocked',
        message: 'The plugin is not ready for tenant operations yet.',
      },
    });
    expect(handler).not.toHaveBeenCalled();
    expect(authMocks.readConfiguredPluginTenantAccess).toHaveBeenCalledWith(
      'tenant-a',
      'waste-management'
    );
  });

  it('dispatches dedicated waste handlers when tenant lifecycle access is ready', async () => {
    authMocks.withAuthenticatedUser.mockImplementationOnce(async (_request, work) =>
      work({ user: { id: 'user-1', instanceId: 'tenant-a' } })
    );
    authMocks.readConfiguredPluginTenantAccess.mockResolvedValueOnce({
      allowed: true,
      reason: 'ready',
    });
    const handler = vi.fn(async () => new Response('handled'));

    const response = await withAuthenticatedWasteManagementHandler(
      new Request('https://studio.example/api/v1/waste-management/settings'),
      handler
    );

    expect(await response.text()).toBe('handled');
    expect(handler).toHaveBeenCalledOnce();
  });
});
