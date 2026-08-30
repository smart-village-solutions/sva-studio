import { describe, expect, it, vi } from 'vitest';

vi.mock('@sva/auth-runtime/server', () => ({
  readPluginOperationInput: vi.fn(),
  revealField: vi.fn(),
  storePluginOperationArtifact: vi.fn(),
}));

import { createWasteManagementOperationRuntime } from './waste-management-operations.runtime.server.js';
import type { WasteOperationRuntimeDeps } from './waste-management-operations.types.js';

describe('waste management operations runtime assembly', () => {
  it('assembles the full operation contract with stable callable handlers', async () => {
    const requestProvisioning = vi.fn(async () => ({ desiredGeneration: 4 }) as never);
    const deps: WasteOperationRuntimeDeps = {
      now: vi.fn(() => new Date('2026-06-15T06:00:00.000Z')),
      requestProvisioning,
    };

    const runtime = createWasteManagementOperationRuntime(deps);

    expect(runtime).toMatchObject({
      requestTenantDatabaseProvisioning: expect.any(Function),
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
  });
});
