import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  pluginWasteManagement,
  wasteManagementAuditEventDefinitions,
  wasteManagementPermissionDefinitions,
} from '../src/plugin.js';
import { wasteManagementModuleIam } from '../src/waste-management.module-iam.js';

describe('pluginWasteManagement contract', () => {
  it('keeps the plugin manifest aligned with the browser-only plugin package contents', () => {
    const currentDir = dirname(fileURLToPath(import.meta.url));
    const manifest = JSON.parse(
      readFileSync(resolve(currentDir, '../plugin.manifest.json'), 'utf8')
    ) as {
      readonly entryPoints?: {
        readonly browser?: string;
        readonly jobs?: string;
      };
      readonly runtimeRequirements?: {
        readonly jobs?: string;
      };
    };

    expect(manifest.entryPoints?.browser).toBe('./dist/index.js');
    expect(manifest.entryPoints?.jobs).toBeUndefined();
    expect(manifest.runtimeRequirements?.jobs).toBeUndefined();
  });

  it('declares the canonical free plugin route, module iam and job registrations', () => {
    expect(pluginWasteManagement.navigation).toEqual([
      {
        id: 'waste-management.navigation',
        to: '/plugins/waste-management',
        titleKey: 'wasteManagement.navigation.title',
        section: 'dataManagement',
        requiredAction: 'waste-management.read',
      },
    ]);
    expect(pluginWasteManagement.permissions).toEqual(wasteManagementPermissionDefinitions);
    expect(pluginWasteManagement.permissions).toEqual([
      { id: 'waste-management.read', titleKey: 'wasteManagement.permissions.read.title' },
      {
        id: 'waste-management.master-data.manage',
        titleKey: 'wasteManagement.permissions.masterDataManage.title',
      },
      { id: 'waste-management.tours.manage', titleKey: 'wasteManagement.permissions.toursManage.title' },
      {
        id: 'waste-management.scheduling.manage',
        titleKey: 'wasteManagement.permissions.schedulingManage.title',
      },
      { id: 'waste-management.import.execute', titleKey: 'wasteManagement.permissions.importExecute.title' },
      { id: 'waste-management.seed.execute', titleKey: 'wasteManagement.permissions.seedExecute.title' },
      { id: 'waste-management.reset.execute', titleKey: 'wasteManagement.permissions.resetExecute.title' },
      {
        id: 'waste-management.settings.manage',
        titleKey: 'wasteManagement.permissions.settingsManage.title',
      },
    ]);
    expect(pluginWasteManagement.moduleIam).toEqual({
      moduleId: 'waste-management',
      permissionIds: [
        'waste-management.read',
        'waste-management.master-data.manage',
        'waste-management.tours.manage',
        'waste-management.scheduling.manage',
        'waste-management.import.execute',
        'waste-management.seed.execute',
        'waste-management.reset.execute',
        'waste-management.settings.manage',
      ],
      systemRoles: [
        {
          roleName: 'system_admin',
          permissionIds: [
            'waste-management.read',
            'waste-management.master-data.manage',
            'waste-management.tours.manage',
            'waste-management.scheduling.manage',
            'waste-management.import.execute',
            'waste-management.seed.execute',
            'waste-management.reset.execute',
            'waste-management.settings.manage',
          ],
        },
      ],
    });
    expect(pluginWasteManagement.moduleIam).toEqual(wasteManagementModuleIam);
    expect(pluginWasteManagement.routes).toHaveLength(1);
    expect(pluginWasteManagement.routes[0]).toMatchObject({
      id: 'waste-management.home',
      path: '/plugins/waste-management',
      guard: 'waste-management.read',
    });
    expect(pluginWasteManagement.routes[0]?.validateSearch?.({ tab: 'settings', page: '2' })).toEqual({
      tab: 'settings',
      masterDataTab: 'locations',
      fractionsView: 'list',
      toursView: 'list',
      locationsView: 'list',
      schedulingView: 'list',
      q: '',
      page: 2,
      pageSize: 25,
      fractionsStatus: 'all',
      status: 'all',
      shiftContext: 'all',
      fractionsSortBy: 'name',
      fractionsSortDirection: 'asc',
      regionId: undefined,
      cityId: undefined,
      wasteFractionId: undefined,
      collectionLocationId: undefined,
      tourId: undefined,
      duplicateFromTourId: undefined,
      tourDateShiftId: undefined,
      globalDateShiftId: undefined,
    });
    expect(pluginWasteManagement.routes[0]?.validateSearch?.({})).toEqual({
      tab: 'fractions',
      masterDataTab: 'fractions',
      fractionsView: 'list',
      toursView: 'list',
      locationsView: 'list',
      schedulingView: 'list',
      q: '',
      page: 1,
      pageSize: 25,
      fractionsStatus: 'all',
      status: 'all',
      shiftContext: 'all',
      fractionsSortBy: 'name',
      fractionsSortDirection: 'asc',
      regionId: undefined,
      cityId: undefined,
      wasteFractionId: undefined,
      collectionLocationId: undefined,
      tourId: undefined,
      duplicateFromTourId: undefined,
      tourDateShiftId: undefined,
      globalDateShiftId: undefined,
    });
    expect(pluginWasteManagement.jobTypes?.map((jobType) => jobType.jobTypeId)).toEqual([
      'waste-management.initialize-data-source',
      'waste-management.apply-migrations',
      'waste-management.import-data',
      'waste-management.seed-data',
      'waste-management.reset-data',
      'waste-management.sync-mainserver',
      'waste-management.sync-waste-types',
    ]);
    expect(pluginWasteManagement.importProfiles).toEqual([
      {
        profileId: 'waste-management.geografie-abholorte',
        jobTypeId: 'waste-management.import-data',
        displayName: 'Geografie und Abholorte',
        sourceFormats: ['text/csv', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
        schemaVersion: '1.0.0',
        schemaStrategy: 'waste-management.geografie-abholorte.schema',
        mappingStrategy: 'waste-management.geografie-abholorte.mapping',
        validation: { mode: 'preflight-and-commit' },
      },
      {
        profileId: 'waste-management.touren',
        jobTypeId: 'waste-management.import-data',
        displayName: 'Touren',
        sourceFormats: ['text/csv', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
        schemaVersion: '1.0.0',
        schemaStrategy: 'waste-management.touren.schema',
        mappingStrategy: 'waste-management.touren.mapping',
        validation: { mode: 'preflight-and-commit' },
      },
      {
        profileId: 'waste-management.ausweichtermine',
        jobTypeId: 'waste-management.import-data',
        displayName: 'Ausweichtermine',
        sourceFormats: ['text/csv', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
        schemaVersion: '1.0.0',
        schemaStrategy: 'waste-management.ausweichtermine.schema',
        mappingStrategy: 'waste-management.ausweichtermine.mapping',
        validation: { mode: 'preflight-and-commit' },
      },
      {
        profileId: 'waste-management.ortsbezogene-tourtermine',
        jobTypeId: 'waste-management.import-data',
        displayName: 'Tourzuordnungen nach Fraktionen',
        sourceFormats: ['text/csv'],
        schemaVersion: '1.0.0',
        schemaStrategy: 'waste-management.ortsbezogene-tourtermine.schema',
        mappingStrategy: 'waste-management.ortsbezogene-tourtermine.mapping',
        validation: { mode: 'preflight-and-commit' },
      },
    ]);
  });

  it('registers the canonical waste audit events for settings, master data and technical tools', () => {
    expect(pluginWasteManagement.auditEvents).toEqual(wasteManagementAuditEventDefinitions);
    expect(pluginWasteManagement.auditEvents).toEqual([
      { eventType: 'waste-management.settings.updated', titleKey: 'wasteManagement.audit.settingsUpdated' },
      { eventType: 'waste-management.fraction.created', titleKey: 'wasteManagement.audit.fractionCreated' },
      { eventType: 'waste-management.fraction.updated', titleKey: 'wasteManagement.audit.fractionUpdated' },
      { eventType: 'waste-management.region.created', titleKey: 'wasteManagement.audit.regionCreated' },
      { eventType: 'waste-management.region.updated', titleKey: 'wasteManagement.audit.regionUpdated' },
      { eventType: 'waste-management.city.created', titleKey: 'wasteManagement.audit.cityCreated' },
      { eventType: 'waste-management.city.updated', titleKey: 'wasteManagement.audit.cityUpdated' },
      { eventType: 'waste-management.street.created', titleKey: 'wasteManagement.audit.streetCreated' },
      { eventType: 'waste-management.street.updated', titleKey: 'wasteManagement.audit.streetUpdated' },
      {
        eventType: 'waste-management.house-number.created',
        titleKey: 'wasteManagement.audit.houseNumberCreated',
      },
      {
        eventType: 'waste-management.house-number.updated',
        titleKey: 'wasteManagement.audit.houseNumberUpdated',
      },
      {
        eventType: 'waste-management.collection-location.created',
        titleKey: 'wasteManagement.audit.collectionLocationCreated',
      },
      {
        eventType: 'waste-management.collection-location.updated',
        titleKey: 'wasteManagement.audit.collectionLocationUpdated',
      },
      {
        eventType: 'waste-management.location-tour-link.created',
        titleKey: 'wasteManagement.audit.locationTourLinkCreated',
      },
      {
        eventType: 'waste-management.location-tour-link.updated',
        titleKey: 'wasteManagement.audit.locationTourLinkUpdated',
      },
      {
        eventType: 'waste-management.location-tour-link.deleted',
        titleKey: 'wasteManagement.audit.locationTourLinkDeleted',
      },
      {
        eventType: 'waste-management.location-tour-link.bulk-created',
        titleKey: 'wasteManagement.audit.locationTourLinkBulkCreated',
      },
      { eventType: 'waste-management.tour.created', titleKey: 'wasteManagement.audit.tourCreated' },
      { eventType: 'waste-management.tour.updated', titleKey: 'wasteManagement.audit.tourUpdated' },
      {
        eventType: 'waste-management.tour-date-shift.created',
        titleKey: 'wasteManagement.audit.tourDateShiftCreated',
      },
      {
        eventType: 'waste-management.tour-date-shift.updated',
        titleKey: 'wasteManagement.audit.tourDateShiftUpdated',
      },
      {
        eventType: 'waste-management.tour-date-shift.deleted',
        titleKey: 'wasteManagement.audit.tourDateShiftDeleted',
      },
      {
        eventType: 'waste-management.global-date-shift.created',
        titleKey: 'wasteManagement.audit.globalDateShiftCreated',
      },
      {
        eventType: 'waste-management.global-date-shift.updated',
        titleKey: 'wasteManagement.audit.globalDateShiftUpdated',
      },
      {
        eventType: 'waste-management.global-date-shift.deleted',
        titleKey: 'wasteManagement.audit.globalDateShiftDeleted',
      },
      { eventType: 'waste-management.migrations.started', titleKey: 'wasteManagement.audit.migrationsStarted' },
      { eventType: 'waste-management.import.started', titleKey: 'wasteManagement.audit.importStarted' },
      { eventType: 'waste-management.seed.started', titleKey: 'wasteManagement.audit.seedStarted' },
      { eventType: 'waste-management.reset.started', titleKey: 'wasteManagement.audit.resetStarted' },
      {
        eventType: 'waste-management.mainserver-sync.started',
        titleKey: 'wasteManagement.audit.mainserverSyncStarted',
      },
      {
        eventType: 'waste-management.sync-waste-types.started',
        titleKey: 'wasteManagement.audit.syncWasteTypesStarted',
      },
      {
        eventType: 'waste-management.datasource.reconfigured',
        titleKey: 'wasteManagement.audit.dataSourceInitialized',
      },
    ]);
  });
});
