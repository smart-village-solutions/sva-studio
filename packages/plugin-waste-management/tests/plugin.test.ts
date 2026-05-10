import { describe, expect, it } from 'vitest';

import {
  pluginWasteManagement,
  wasteManagementAuditEventDefinitions,
  wasteManagementPermissionDefinitions,
} from '../src/plugin.js';

describe('pluginWasteManagement contract', () => {
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
    expect(pluginWasteManagement.moduleIam).toMatchObject({
      moduleId: 'waste-management',
      permissionIds: expect.arrayContaining(['waste-management.read', 'waste-management.settings.manage']),
    });
    expect(pluginWasteManagement.routes).toHaveLength(1);
    expect(pluginWasteManagement.routes[0]).toMatchObject({
      id: 'waste-management.home',
      path: '/plugins/waste-management',
      guard: 'waste-management.read',
    });
    expect(pluginWasteManagement.routes[0]?.validateSearch?.({ tab: 'settings', page: '2' })).toEqual({
      tab: 'settings',
      q: '',
      page: 2,
      pageSize: 25,
      status: 'all',
      shiftContext: 'all',
      regionId: undefined,
      cityId: undefined,
      wasteFractionId: undefined,
      tourId: undefined,
    });
    expect(pluginWasteManagement.jobTypes?.map((jobType) => jobType.jobTypeId)).toEqual([
      'waste-management.initialize-data-source',
      'waste-management.apply-migrations',
      'waste-management.import-data',
      'waste-management.seed-data',
      'waste-management.reset-data',
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
        eventType: 'waste-management.global-date-shift.created',
        titleKey: 'wasteManagement.audit.globalDateShiftCreated',
      },
      {
        eventType: 'waste-management.global-date-shift.updated',
        titleKey: 'wasteManagement.audit.globalDateShiftUpdated',
      },
      { eventType: 'waste-management.migrations.started', titleKey: 'wasteManagement.audit.migrationsStarted' },
      { eventType: 'waste-management.import.started', titleKey: 'wasteManagement.audit.importStarted' },
      { eventType: 'waste-management.seed.started', titleKey: 'wasteManagement.audit.seedStarted' },
      { eventType: 'waste-management.reset.started', titleKey: 'wasteManagement.audit.resetStarted' },
      {
        eventType: 'waste-management.data-source.initialized',
        titleKey: 'wasteManagement.audit.dataSourceInitialized',
      },
    ]);
  });
});
