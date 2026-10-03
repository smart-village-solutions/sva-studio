import {
  definePluginActions,
  definePluginPermissions,
  type PluginDefinition,
} from '@sva/plugin-sdk';

import {
  createWasteManagementPluginExportProfiles,
  createWasteManagementPluginImportProfiles,
  createWasteManagementPluginJobTypes,
} from './waste-management.job-definitions.js';
import { wasteManagementPluginTranslations } from './plugin.translations.js';
import { wasteManagementAuditEventDefinitions } from './plugin.audit-events.js';
import { wasteManagementTenantLifecycle } from './plugin.tenant-lifecycle.js';
import { normalizeWasteManagementSearchParams } from './search-params.js';
import { wasteManagementServerRoutes } from './server-routes.js';
import { wasteManagementModuleIam } from './waste-management.module-iam.js';
import { WasteManagementPage } from './waste-management.page.js';

export { wasteManagementAuditEventDefinitions } from './plugin.audit-events.js';

export const wasteManagementPermissionDefinitions = definePluginPermissions('waste-management', [
  { id: 'waste-management.read', titleKey: 'wasteManagement.permissions.read.title' },
  {
    id: 'waste-management.master-data.manage',
    titleKey: 'wasteManagement.permissions.masterDataManage.title',
  },
  {
    id: 'waste-management.tours.manage',
    titleKey: 'wasteManagement.permissions.toursManage.title',
  },
  {
    id: 'waste-management.scheduling.manage',
    titleKey: 'wasteManagement.permissions.schedulingManage.title',
  },
  {
    id: 'waste-management.import.execute',
    titleKey: 'wasteManagement.permissions.importExecute.title',
  },
  {
    id: 'waste-management.export.execute',
    titleKey: 'wasteManagement.permissions.exportExecute.title',
  },
  {
    id: 'waste-management.seed.execute',
    titleKey: 'wasteManagement.permissions.seedExecute.title',
  },
  {
    id: 'waste-management.reset.execute',
    titleKey: 'wasteManagement.permissions.resetExecute.title',
  },
  {
    id: 'waste-management.settings.manage',
    titleKey: 'wasteManagement.permissions.settingsManage.title',
  },
]);

export const wasteManagementActionDefinitions = definePluginActions('waste-management', [
  ...wasteManagementPermissionDefinitions.map(({ id, titleKey }) => ({
    id,
    titleKey,
    requiredAction: id,
    accessRequirement: {
      kind: 'tenant' as const,
      moduleId: 'waste-management',
      actions: { mode: 'allOf' as const, values: [id] },
    },
  })),
  {
    id: 'waste-management.annual-transfer.execute',
    titleKey: 'wasteManagement.actions.annualTransfer',
    accessRequirement: {
      kind: 'tenant',
      moduleId: 'waste-management',
      actions: {
        mode: 'allOf',
        values: ['waste-management.tours.manage', 'waste-management.scheduling.manage'],
      },
    },
  },
]);

const wasteManagementServerHandlerDefinitions = wasteManagementServerRoutes.map(
  ([path, method, handlerName, actionId]) => {
    const action = wasteManagementActionDefinitions.find((candidate) => candidate.id === actionId);
    if (!action?.accessRequirement) throw new Error(`missing_waste_server_action:${actionId}`);
    return {
      id: `waste-management.${handlerName}.${method.toLowerCase()}`,
      path,
      method,
      actionId,
      accessRequirement: action.accessRequirement,
    };
  }
);

export const pluginWasteManagement: PluginDefinition = {
  id: 'waste-management',
  displayName: 'Waste Management',
  routes: [
    {
      id: 'waste-management.home',
      path: '/plugins/waste-management',
      documentation: {
        kind: 'page',
        id: 'waste-management.overview',
        pageType: 'overview',
      },
      guard: 'waste-management.read',
      accessRequirement: {
        kind: 'tenant',
        moduleId: 'waste-management',
        actions: { mode: 'allOf', values: ['waste-management.read'] },
      },
      validateSearch: (search: Record<string, unknown>) =>
        normalizeWasteManagementSearchParams(search),
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
      accessRequirement: {
        kind: 'tenant',
        moduleId: 'waste-management',
        actions: { mode: 'allOf', values: ['waste-management.read'] },
      },
    },
  ],
  permissions: wasteManagementPermissionDefinitions,
  actions: wasteManagementActionDefinitions,
  serverHandlers: wasteManagementServerHandlerDefinitions,
  moduleIam: wasteManagementModuleIam,
  auditEvents: wasteManagementAuditEventDefinitions,
  contentHistory: { mode: 'domain', reasonCode: 'domain_history' },
  jobTypes: createWasteManagementPluginJobTypes(),
  tenantLifecycle: wasteManagementTenantLifecycle,
  importProfiles: createWasteManagementPluginImportProfiles(),
  exportProfiles: createWasteManagementPluginExportProfiles(),
  translations: wasteManagementPluginTranslations,
};
