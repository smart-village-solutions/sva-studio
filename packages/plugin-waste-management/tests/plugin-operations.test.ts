import { describe, expect, it } from 'vitest';

import {
  createWasteManagementPluginImportProfiles,
  createWasteManagementPluginJobTypes,
} from '../src/plugin-operations.js';

describe('waste management plugin operations', () => {
  it('keeps waste-specific job types inside the waste plugin package', () => {
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
      }),
      expect.objectContaining({
        jobTypeId: 'waste-management.seed-data',
      }),
      expect.objectContaining({
        jobTypeId: 'waste-management.reset-data',
      }),
    ]);
  });

  it('keeps waste-specific import profiles inside the waste plugin package', () => {
    expect(createWasteManagementPluginImportProfiles()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          profileId: 'waste-management.geografie-abholorte',
          jobTypeId: 'waste-management.import-data',
        }),
        expect.objectContaining({
          profileId: 'waste-management.touren',
          jobTypeId: 'waste-management.import-data',
        }),
        expect.objectContaining({
          profileId: 'waste-management.ausweichtermine',
          jobTypeId: 'waste-management.import-data',
        }),
        expect.objectContaining({
          profileId: 'waste-management.ortsbezogene-tourtermine',
          jobTypeId: 'waste-management.import-data',
          sourceFormats: ['text/csv'],
        }),
      ])
    );
  });
});
