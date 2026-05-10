import { describe, expect, it } from 'vitest';

import {
  createWasteManagementPluginImportProfiles,
  createWasteManagementPluginJobTypes,
} from './waste-management-operations.js';

describe('waste management plugin operations', () => {
  it('creates normalized waste job type definitions on the generic plugin job contract', () => {
    expect(createWasteManagementPluginJobTypes()).toEqual([
      expect.objectContaining({
        jobTypeId: 'waste-management.initialize-data-source',
        queue: 'plugin-operations',
      }),
      expect.objectContaining({
        jobTypeId: 'waste-management.apply-migrations',
        queue: 'plugin-operations',
      }),
      expect.objectContaining({
        jobTypeId: 'waste-management.import-data',
        result: expect.objectContaining({
          summaryKeys: ['processedItems', 'acceptedItems', 'rejectedItems', 'warningCount', 'durationMs'],
        }),
      }),
      expect.objectContaining({
        jobTypeId: 'waste-management.seed-data',
      }),
      expect.objectContaining({
        jobTypeId: 'waste-management.reset-data',
      }),
    ]);
  });

  it('creates the mandatory waste csv import profiles on the shared plugin import contract', () => {
    expect(createWasteManagementPluginImportProfiles()).toEqual([
      expect.objectContaining({
        profileId: 'waste-management.geografie-abholorte',
        jobTypeId: 'waste-management.import-data',
        sourceFormats: ['text/csv'],
      }),
      expect.objectContaining({
        profileId: 'waste-management.touren',
        jobTypeId: 'waste-management.import-data',
        sourceFormats: ['text/csv'],
      }),
      expect.objectContaining({
        profileId: 'waste-management.ausweichtermine',
        jobTypeId: 'waste-management.import-data',
        sourceFormats: ['text/csv'],
      }),
    ]);
  });
});
