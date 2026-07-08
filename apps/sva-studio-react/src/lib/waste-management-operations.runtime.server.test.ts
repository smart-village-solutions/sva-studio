import { describe, expect, it, vi } from 'vitest';

import { createWasteManagementOperationRuntime } from './waste-management-operations.runtime.server.js';
import type { WasteOperationRuntimeDeps } from './waste-management-operations.types.js';

describe('waste management operations runtime assembly', () => {
  it('assembles the full operation contract with stable callable handlers', () => {
    const deps: WasteOperationRuntimeDeps = {
      now: vi.fn(() => new Date('2026-06-15T06:00:00.000Z')),
    };

    const runtime = createWasteManagementOperationRuntime(deps);

    expect(runtime).toMatchObject({
      initializeDataSource: expect.any(Function),
      applyMigrations: expect.any(Function),
      importData: expect.any(Function),
      seedData: expect.any(Function),
      syncMainserver: expect.any(Function),
      syncWasteTypes: expect.any(Function),
      materializeEmailReminders: expect.any(Function),
      processEmailReminderOutbox: expect.any(Function),
      resetData: expect.any(Function),
    });
  });
});
