import { definePluginAuditEvents } from '@sva/plugin-sdk';

export const wasteManagementAuditEventDefinitions = definePluginAuditEvents('waste-management', [
  {
    eventType: 'waste-management.settings.updated',
    titleKey: 'wasteManagement.audit.settingsUpdated',
  },
  {
    eventType: 'waste-management.fraction.created',
    titleKey: 'wasteManagement.audit.fractionCreated',
  },
  {
    eventType: 'waste-management.fraction.updated',
    titleKey: 'wasteManagement.audit.fractionUpdated',
  },
  {
    eventType: 'waste-management.region.created',
    titleKey: 'wasteManagement.audit.regionCreated',
  },
  {
    eventType: 'waste-management.region.updated',
    titleKey: 'wasteManagement.audit.regionUpdated',
  },
  {
    eventType: 'waste-management.city.created',
    titleKey: 'wasteManagement.audit.cityCreated',
  },
  {
    eventType: 'waste-management.city.updated',
    titleKey: 'wasteManagement.audit.cityUpdated',
  },
  {
    eventType: 'waste-management.street.created',
    titleKey: 'wasteManagement.audit.streetCreated',
  },
  {
    eventType: 'waste-management.street.updated',
    titleKey: 'wasteManagement.audit.streetUpdated',
  },
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
  {
    eventType: 'waste-management.tour.created',
    titleKey: 'wasteManagement.audit.tourCreated',
  },
  {
    eventType: 'waste-management.tour.updated',
    titleKey: 'wasteManagement.audit.tourUpdated',
  },
  {
    eventType: 'waste-management.tour.validity-bulk-updated',
    titleKey: 'wasteManagement.audit.tourValidityBulkUpdated',
  },
  {
    eventType: 'waste-management.tour.status-bulk-updated',
    titleKey: 'wasteManagement.audit.tourStatusBulkUpdated',
  },
  {
    eventType: 'waste-management.annual-tour-transfer.created',
    titleKey: 'wasteManagement.audit.annualTourTransferCreated',
  },
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
  {
    eventType: 'waste-management.migrations.started',
    titleKey: 'wasteManagement.audit.migrationsStarted',
  },
  {
    eventType: 'waste-management.import.started',
    titleKey: 'wasteManagement.audit.importStarted',
  },
  {
    eventType: 'waste-management.export.started',
    titleKey: 'wasteManagement.audit.exportStarted',
  },
  {
    eventType: 'waste-management.seed.started',
    titleKey: 'wasteManagement.audit.seedStarted',
  },
  {
    eventType: 'waste-management.reset.started',
    titleKey: 'wasteManagement.audit.resetStarted',
  },
  {
    eventType: 'waste-management.mainserver-sync.started',
    titleKey: 'wasteManagement.audit.mainserverSyncStarted',
  },
  {
    eventType: 'waste-management.sync-waste-types.started',
    titleKey: 'wasteManagement.audit.syncWasteTypesStarted',
  },
  {
    eventType: 'waste-management.postal-code-enrichment.started',
    titleKey: 'wasteManagement.audit.postalCodeEnrichmentStarted',
  },
  {
    eventType: 'waste-management.datasource.reconfigured',
    titleKey: 'wasteManagement.audit.dataSourceInitialized',
  },
]);
