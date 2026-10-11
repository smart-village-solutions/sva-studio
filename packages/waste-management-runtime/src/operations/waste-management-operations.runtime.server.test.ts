import { describe, expect, it, vi } from 'vitest';

import { createWasteManagementOperationRuntime } from './waste-management-operations.runtime.server.js';
import type { WasteOperationRuntimeDeps } from './waste-management-operations.types.js';

const createProvisionTenantDatabaseOperationMock = vi.hoisted(() =>
  vi.fn((_deps: unknown) => vi.fn())
);
vi.mock('./waste-tenant-database-provisioner.server.js', () => ({
  createProvisionTenantDatabaseOperation: createProvisionTenantDatabaseOperationMock,
}));

describe('waste management operations runtime assembly', () => {
  it('assembles the full operation contract with stable callable handlers', async () => {
    const requestProvisioning = vi.fn(async () => ({ desiredGeneration: 4 }) as never);
    const suspendProvisioning = vi.fn(async () => null);
    const deps: WasteOperationRuntimeDeps = {
      now: vi.fn(() => new Date('2026-06-15T06:00:00.000Z')),
      requestProvisioning,
      suspendProvisioning,
    };

    const runtime = createWasteManagementOperationRuntime(deps);

    expect(runtime).toMatchObject({
      requestTenantDatabaseProvisioning: expect.any(Function),
      suspendTenantDatabaseProvisioning: expect.any(Function),
      readTenantDatabaseReadiness: expect.any(Function),
      provisionTenantDatabase: expect.any(Function),
      initializeDataSource: expect.any(Function),
      applyMigrations: expect.any(Function),
      importData: expect.any(Function),
      exportData: expect.any(Function),
      seedData: expect.any(Function),
      syncMainserver: expect.any(Function),
      syncWasteTypes: expect.any(Function),
      enrichPostalCodes: expect.any(Function),
      materializeEmailReminders: expect.any(Function),
      processEmailReminderOutbox: expect.any(Function),
      resetData: expect.any(Function),
    });

    await expect(runtime.requestTenantDatabaseProvisioning('tenant-a')).resolves.toMatchObject({
      desiredGeneration: 4,
    });
    expect(requestProvisioning).toHaveBeenCalledWith('tenant-a');
    await expect(runtime.suspendTenantDatabaseProvisioning('tenant-a')).resolves.toBeNull();
    expect(suspendProvisioning).toHaveBeenCalledWith('tenant-a');
  });

  it('passes derived provisioning access and managed interface capabilities to the privileged operation', () => {
    createProvisionTenantDatabaseOperationMock.mockClear();
    const loadManagedInterface = vi.fn(async () => null);
    const saveInterfaceRecord = vi.fn(async () => undefined);
    createWasteManagementOperationRuntime({
      withInstanceDb: vi.fn() as WasteOperationRuntimeDeps['withInstanceDb'],
      loadManagedInterface,
      saveInterfaceRecord,
    });

    expect(createProvisionTenantDatabaseOperationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        claimProvisioning: expect.any(Function),
        completeProvisioning: expect.any(Function),
        failProvisioning: expect.any(Function),
        loadManagedInterface,
        saveManagedInterface: saveInterfaceRecord,
      })
    );
  });
});
