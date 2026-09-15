import { describe, expect, it } from 'vitest';

import {
  createWasteManagementPluginExportProfiles,
  createWasteManagementPluginImportProfiles,
  createWasteManagementPluginJobTypes,
} from '../src/job-definitions.js';

describe('waste management contracts job definitions', () => {
  it('isolates privileged tenant provisioning from the shared plugin operations queue', () => {
    const jobTypes = createWasteManagementPluginJobTypes();

    expect(
      jobTypes.find(({ jobTypeId }) => jobTypeId === 'waste-management.provision-tenant-database')
        ?.queue
    ).toBe('waste-provisioning');
    expect(
      jobTypes.find(({ jobTypeId }) => jobTypeId === 'waste-management.tenant-readiness')?.queue
    ).toBe('plugin-operations');
  });

  it('exposes every job type declared by the Waste operations contract', () => {
    expect(createWasteManagementPluginJobTypes().map(({ jobTypeId }) => jobTypeId)).toEqual([
      'waste-management.provision-tenant-database',
      'waste-management.tenant-readiness',
      'waste-management.initialize-data-source',
      'waste-management.apply-migrations',
      'waste-management.import-data',
      'waste-management.export-data',
      'waste-management.seed-data',
      'waste-management.reset-data',
      'waste-management.sync-mainserver',
      'waste-management.sync-waste-types',
      'waste-management.enrich-postal-codes',
      'waste-management.materialize-email-reminders',
      'waste-management.process-email-reminder-outbox',
    ]);
  });

  it('exposes every supported Waste import profile', () => {
    expect(createWasteManagementPluginImportProfiles().map(({ profileId }) => profileId)).toEqual([
      'waste-management.fraktionen',
      'waste-management.geografie-abholorte',
      'waste-management.abstandspresets',
      'waste-management.touren',
      'waste-management.abholort-tour-zuordnungen',
      'waste-management.tour-einsaetze',
      'waste-management.ausweichtermine',
      'waste-management.feiertagsregeln',
      'waste-management.portable-einstellungen',
      'waste-management.datenpaket',
      'waste-management.ortsbezogene-tourtermine',
    ]);
  });

  it('exposes one JSON export for every canonical Waste data profile', () => {
    expect(
      createWasteManagementPluginExportProfiles().map(({ dataProfileId, targetFormats }) => ({
        dataProfileId,
        targetFormats,
      }))
    ).toEqual(
      [
        'waste-management.fraktionen',
        'waste-management.geografie-abholorte',
        'waste-management.abstandspresets',
        'waste-management.touren',
        'waste-management.abholort-tour-zuordnungen',
        'waste-management.tour-einsaetze',
        'waste-management.ausweichtermine',
        'waste-management.feiertagsregeln',
        'waste-management.portable-einstellungen',
      ].map((dataProfileId) => ({ dataProfileId, targetFormats: ['application/json'] }))
    );
  });
});
