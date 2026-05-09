import { describe, expect, it } from 'vitest';

import { wasteManagementDataSourceContract } from './waste-management-contract.js';

describe('waste-management-contract', () => {
  it('defines stable data source providers and visible status values', () => {
    expect(wasteManagementDataSourceContract.providers).toEqual(['supabase']);
    expect(wasteManagementDataSourceContract.statuses).toEqual(['not_configured', 'unknown', 'ok', 'error']);
    expect(wasteManagementDataSourceContract.isProvider('supabase')).toBe(true);
    expect(wasteManagementDataSourceContract.isProvider('postgres')).toBe(false);
    expect(wasteManagementDataSourceContract.isStatus('ok')).toBe(true);
    expect(wasteManagementDataSourceContract.isStatus('degraded')).toBe(false);
  });

  it('defines explicit connection-check outcomes', () => {
    expect(wasteManagementDataSourceContract.checkStatuses).toEqual(['succeeded', 'failed']);
    expect(wasteManagementDataSourceContract.isCheckStatus('failed')).toBe(true);
    expect(wasteManagementDataSourceContract.isCheckStatus('retrying')).toBe(false);
  });

  it('keeps the first technical history event set stable', () => {
    expect(wasteManagementDataSourceContract.technicalEventTypes).toEqual([
      'datasource.reconfigured',
      'connection-check.succeeded',
      'connection-check.failed',
      'migration.started',
      'migration.succeeded',
      'migration.failed',
      'import.started',
      'import.succeeded',
      'import.failed',
      'seed.started',
      'seed.succeeded',
      'seed.failed',
      'reset.started',
      'reset.succeeded',
      'reset.failed',
    ]);
    expect(wasteManagementDataSourceContract.isTechnicalEventType('seed.failed')).toBe(true);
    expect(wasteManagementDataSourceContract.isTechnicalEventType('connection-check.pending')).toBe(false);
  });
});
