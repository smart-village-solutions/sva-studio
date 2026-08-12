import { describe, expect, it } from 'vitest';

import {
  createWasteManagementPluginImportProfiles,
  createWasteManagementPluginJobTypes,
} from '../src/job-definitions.js';

describe('waste management contracts job definitions', () => {
  it('exposes every job type declared by the Waste operations contract', () => {
    expect(createWasteManagementPluginJobTypes().map(({ jobTypeId }) => jobTypeId)).toEqual([
      'waste-management.provision-tenant-database',
      'waste-management.initialize-data-source',
      'waste-management.apply-migrations',
      'waste-management.import-data',
      'waste-management.seed-data',
      'waste-management.reset-data',
      'waste-management.sync-mainserver',
      'waste-management.sync-waste-types',
      'waste-management.materialize-email-reminders',
      'waste-management.process-email-reminder-outbox',
    ]);
  });

  it('exposes every supported Waste import profile', () => {
    expect(
      createWasteManagementPluginImportProfiles().map(({ profileId }) => profileId)
    ).toEqual([
      'waste-management.geografie-abholorte',
      'waste-management.touren',
      'waste-management.ausweichtermine',
      'waste-management.ortsbezogene-tourtermine',
    ]);
  });
});
