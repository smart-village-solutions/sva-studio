import {
  definePluginAuditEvents,
  definePluginPermissions,
  type PluginDefinition,
} from '@sva/plugin-sdk';
import { studioModuleIamRegistry } from '@sva/studio-module-iam';

import {
  createWasteManagementPluginImportProfiles,
  createWasteManagementPluginJobTypes,
} from './plugin-operations.js';
import { wasteManagementPluginTranslations } from './plugin.translations.js';
import { normalizeWasteManagementSearchParams } from './search-params.js';
import { WasteManagementPage } from './waste-management.page.js';

const wasteManagementModuleIam = studioModuleIamRegistry.get('waste-management');

if (!wasteManagementModuleIam) {
  throw new Error('missing_studio_module_iam_contract:waste-management');
}

export const wasteManagementPermissionDefinitions = definePluginPermissions('waste-management', [
  { id: 'waste-management.read', titleKey: 'wasteManagement.permissions.read.title' },
  { id: 'waste-management.master-data.manage', titleKey: 'wasteManagement.permissions.masterDataManage.title' },
  { id: 'waste-management.tours.manage', titleKey: 'wasteManagement.permissions.toursManage.title' },
  { id: 'waste-management.scheduling.manage', titleKey: 'wasteManagement.permissions.schedulingManage.title' },
  { id: 'waste-management.import.execute', titleKey: 'wasteManagement.permissions.importExecute.title' },
  { id: 'waste-management.seed.execute', titleKey: 'wasteManagement.permissions.seedExecute.title' },
  { id: 'waste-management.reset.execute', titleKey: 'wasteManagement.permissions.resetExecute.title' },
  { id: 'waste-management.settings.manage', titleKey: 'wasteManagement.permissions.settingsManage.title' },
]);

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
  {
    eventType: 'waste-management.migrations.started',
    titleKey: 'wasteManagement.audit.migrationsStarted',
  },
  {
    eventType: 'waste-management.import.started',
    titleKey: 'wasteManagement.audit.importStarted',
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
    eventType: 'waste-management.data-source.initialized',
    titleKey: 'wasteManagement.audit.dataSourceInitialized',
  },
]);

export const pluginWasteManagement: PluginDefinition = {
  id: 'waste-management',
  displayName: 'Waste Management',
  routes: [
    {
      id: 'waste-management.home',
      path: '/plugins/waste-management',
      guard: 'waste-management.read',
      validateSearch: (search: Record<string, unknown>) => normalizeWasteManagementSearchParams(search),
      component: WasteManagementPage as never,
    },
  ],
  navigation: [
    {
      id: 'waste-management.navigation',
      to: '/plugins/waste-management',
      titleKey: 'wasteManagement.navigation.title',
      section: 'dataManagement',
      requiredAction: 'waste-management.read',
    },
  ],
  permissions: wasteManagementPermissionDefinitions,
  moduleIam: {
    moduleId: wasteManagementModuleIam.moduleId,
    permissionIds: wasteManagementModuleIam.permissionIds,
    systemRoles: wasteManagementModuleIam.systemRoles,
  },
  auditEvents: wasteManagementAuditEventDefinitions,
  jobTypes: createWasteManagementPluginJobTypes(),
  importProfiles: createWasteManagementPluginImportProfiles(),
  translations: wasteManagementPluginTranslations,
};
