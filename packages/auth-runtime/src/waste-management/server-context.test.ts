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

const hostCapabilityMocks = vi.hoisted(() => ({
  emitAuthAuditEvent: vi.fn(),
  resolveEffectivePermissions: vi.fn(),
  resolveActorInfo: vi.fn(),
  startPluginOperationJobFromFacade: vi.fn(),
  storePluginOperationInput: vi.fn(),
  revealField: vi.fn(),
  resolveWasteDataSource: vi.fn(),
  runWasteConnectionCheck: vi.fn(),
  poolConnect: vi.fn(),
  poolEnd: vi.fn(async () => undefined),
}));

vi.mock('pg', () => ({
  Pool: vi.fn(function MockPool() {
    return { connect: hostCapabilityMocks.poolConnect, end: hostCapabilityMocks.poolEnd };
  }),
}));

vi.mock('./operations-support.js', () => ({
  startPluginOperationJobFromFacade: hostCapabilityMocks.startPluginOperationJobFromFacade,
}));

vi.mock('../plugin-operation-artifacts.server.js', () => ({
  storePluginOperationInput: hostCapabilityMocks.storePluginOperationInput,
}));

vi.mock('../iam-account-management/shared.js', () => ({
  resolveActorInfo: hostCapabilityMocks.resolveActorInfo,
}));

vi.mock('../audit-events.js', () => ({
  emitAuthAuditEvent: hostCapabilityMocks.emitAuthAuditEvent,
}));

vi.mock('../iam-authorization/permission-store.js', () => ({
  resolveEffectivePermissions: hostCapabilityMocks.resolveEffectivePermissions,
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

vi.mock('@sva/waste-management-runtime/repositories', () => ({
  resolveWasteDataSource: hostCapabilityMocks.resolveWasteDataSource,
  runWasteConnectionCheck: hostCapabilityMocks.runWasteConnectionCheck,
}));

vi.mock('../iam-account-management/encryption.js', () => ({
  protectField: vi.fn(),
  revealField: hostCapabilityMocks.revealField,
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
  it('resolves secrets and probes the connection within the host', async () => {
    vi.clearAllMocks();
    const dataSource = {
      instanceId: 'tenant-a',
      schemaName: 'wm',
      databaseUrl: 'postgres://db',
      provider: 'postgresql',
      enabled: true,
    };
    hostCapabilityMocks.resolveWasteDataSource.mockResolvedValueOnce(dataSource);
    const query = vi.fn(async () => ({ rows: [{ '?column?': 1 }] }));
    const release = vi.fn();
    hostCapabilityMocks.poolConnect.mockResolvedValueOnce({ query, release });
    hostCapabilityMocks.runWasteConnectionCheck.mockImplementationOnce(async ({ probe }) => {
      await probe(dataSource);
      return {
        instanceId: 'tenant-a',
        checkedAt: '2026-05-10T12:00:00.000Z',
        checkStatus: 'succeeded',
        visibleStatus: 'ok',
      };
    });
    const interfaceRecord = { id: 'interface-1', instanceId: 'tenant-a' };
    dataRepositoryMocks.listExternalInterfaceRecords.mockResolvedValueOnce([interfaceRecord]);

    const result = await sharedWasteManagementDeps.checkWasteConnection(
      'tenant-a',
      'interface-1'
    );

    expect(result).toMatchObject({ checkStatus: 'succeeded' });
    expect(hostCapabilityMocks.resolveWasteDataSource).toHaveBeenCalledWith({
      instanceId: 'tenant-a',
      loadDefaultInterface: expect.any(Function),
      loadProvisioning: dataRepositoryMocks.loadWasteTenantProvisioningRecord,
      revealSecret: hostCapabilityMocks.revealField,
    });
    expect(query).toHaveBeenCalledWith('SELECT 1;');
    expect(release).toHaveBeenCalledTimes(1);
    expect(hostCapabilityMocks.poolEnd).toHaveBeenCalledTimes(1);
  });

  it('rejects an interface outside the authenticated instance before secret resolution', async () => {
    vi.clearAllMocks();
    dataRepositoryMocks.listExternalInterfaceRecords.mockResolvedValueOnce([]);
    dataRepositoryMocks.loadDefaultExternalInterfaceRecord.mockResolvedValueOnce({
      id: 'interface-1',
      instanceId: 'tenant-b',
    });

    await expect(
      sharedWasteManagementDeps.checkWasteConnection('tenant-a', 'interface-1')
    ).rejects.toThrow('waste_interface_not_found');
    expect(hostCapabilityMocks.resolveWasteDataSource).not.toHaveBeenCalled();
    expect(hostCapabilityMocks.revealField).not.toHaveBeenCalled();
  });

  it('binds the host services for waste settings and handler actions', async () => {
    expect(sharedWasteManagementDeps.emitAuditEvent).toBe(hostCapabilityMocks.emitAuthAuditEvent);
    expect(sharedWasteManagementDeps.resolvePermissions).toBe(
      hostCapabilityMocks.resolveEffectivePermissions
    );
    expect(sharedWasteManagementDeps.startPluginOperationJob).toBe(
      hostCapabilityMocks.startPluginOperationJobFromFacade
    );
    expect(sharedWasteManagementDeps.storeWasteImportSource).toBe(
      hostCapabilityMocks.storePluginOperationInput
    );
    const request = new Request('https://studio.example/api/v1/waste-management/settings');
    const context = { sessionId: 'session-1', user: { id: 'user-1', roles: [] } };
    await sharedWasteManagementDeps.resolveActorInfo(request, context);
    expect(hostCapabilityMocks.resolveActorInfo).toHaveBeenCalledWith(request, context, {
      requireActorMembership: true,
    });
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
