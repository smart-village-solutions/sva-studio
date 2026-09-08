import {
  definePluginActions,
  definePluginPermissions,
  type PluginDefinition,
} from '@sva/plugin-sdk';

import {
  SSF_ADMIN_ACTIONS,
  SSF_SYSTEM_CONFIGURATION_PATH,
  SSF_TENANT_CONFIGURATION_PATH,
} from './admin-contracts.js';
import { SsfSystemConfigurationPage, SsfTenantConfigurationPage } from './admin.page.js';
import {
  SSF_RUNTIME_ENDPOINT_PATH,
  SSF_RUNTIME_INSTANCE_HEADER,
  SSF_RUNTIME_SERVER_HANDLER_ID,
  SSF_RUNTIME_SERVICE_ACTION,
  SSF_RUNTIME_SERVICE_ID,
} from './constants.js';
import { ssfPluginTranslations } from './plugin.translations.js';

const platformAccess = {
  kind: 'platform',
  roles: { mode: 'allOf', values: ['instance_registry_admin'] },
} as const;
const tenantReadAccess = {
  kind: 'tenant',
  moduleId: 'ssf',
  actions: { mode: 'allOf', values: [SSF_ADMIN_ACTIONS.tenantRead] },
} as const;
const tenantManageAccess = {
  kind: 'tenant',
  moduleId: 'ssf',
  actions: { mode: 'allOf', values: [SSF_ADMIN_ACTIONS.tenantManage] },
} as const;

const actions = definePluginActions('ssf', [
  {
    id: SSF_ADMIN_ACTIONS.systemRead,
    titleKey: 'ssf.permissions.systemRead',
    accessRequirement: platformAccess,
  },
  {
    id: SSF_ADMIN_ACTIONS.systemManage,
    titleKey: 'ssf.permissions.systemManage',
    accessRequirement: platformAccess,
  },
  {
    id: SSF_ADMIN_ACTIONS.tenantRead,
    titleKey: 'ssf.permissions.tenantRead',
    accessRequirement: tenantReadAccess,
  },
  {
    id: SSF_ADMIN_ACTIONS.tenantManage,
    titleKey: 'ssf.permissions.tenantManage',
    accessRequirement: tenantManageAccess,
  },
]);

const permissions = definePluginPermissions('ssf', [
  { id: SSF_ADMIN_ACTIONS.tenantRead, titleKey: 'ssf.permissions.tenantRead' },
  { id: SSF_ADMIN_ACTIONS.tenantManage, titleKey: 'ssf.permissions.tenantManage' },
]);

export const ssfPlugin = {
  id: 'ssf',
  displayName: 'Smart Speech Flow',
  actions,
  permissions,
  translations: ssfPluginTranslations,
  routes: [
    {
      id: 'ssf-system-configuration',
      path: '/plugins/ssf/system-configuration',
      actionId: SSF_ADMIN_ACTIONS.systemRead,
      serverHandlerId: 'ssf.system-configuration.read',
      accessRequirement: platformAccess,
      component: SsfSystemConfigurationPage,
    },
    {
      id: 'ssf-tenant-configuration',
      path: '/plugins/ssf/configuration',
      actionId: SSF_ADMIN_ACTIONS.tenantRead,
      serverHandlerId: 'ssf.tenant-configuration.read',
      accessRequirement: tenantReadAccess,
      component: SsfTenantConfigurationPage,
    },
  ],
  navigation: [
    {
      id: 'ssf.system-navigation',
      to: '/plugins/ssf/system-configuration',
      titleKey: 'ssf.navigation.system',
      section: 'system',
      actionId: SSF_ADMIN_ACTIONS.systemRead,
      accessRequirement: platformAccess,
    },
    {
      id: 'ssf.tenant-navigation',
      to: '/plugins/ssf/configuration',
      titleKey: 'ssf.navigation.tenant',
      section: 'applications',
      actionId: SSF_ADMIN_ACTIONS.tenantRead,
      accessRequirement: tenantReadAccess,
    },
  ],
  serverHandlers: [
    {
      id: SSF_RUNTIME_SERVER_HANDLER_ID,
      path: SSF_RUNTIME_ENDPOINT_PATH,
      method: 'GET',
      actionId: SSF_RUNTIME_SERVICE_ACTION,
      accessRequirement: {
        kind: 'service',
        serviceId: SSF_RUNTIME_SERVICE_ID,
        tenantBinding: { kind: 'header', headerName: SSF_RUNTIME_INSTANCE_HEADER },
      },
    },
    {
      id: 'ssf.system-configuration.read',
      path: SSF_SYSTEM_CONFIGURATION_PATH,
      method: 'GET',
      actionId: SSF_ADMIN_ACTIONS.systemRead,
      accessRequirement: platformAccess,
    },
    {
      id: 'ssf.system-configuration.write',
      path: SSF_SYSTEM_CONFIGURATION_PATH,
      method: 'PUT',
      actionId: SSF_ADMIN_ACTIONS.systemManage,
      accessRequirement: platformAccess,
    },
    {
      id: 'ssf.tenant-configuration.read',
      path: SSF_TENANT_CONFIGURATION_PATH,
      method: 'GET',
      actionId: SSF_ADMIN_ACTIONS.tenantRead,
      accessRequirement: tenantReadAccess,
    },
    {
      id: 'ssf.tenant-configuration.write',
      path: SSF_TENANT_CONFIGURATION_PATH,
      method: 'PUT',
      actionId: SSF_ADMIN_ACTIONS.tenantManage,
      accessRequirement: tenantManageAccess,
    },
  ],
  contentHistory: { mode: 'none', reasonCode: 'infrastructure_only' },
} as const satisfies PluginDefinition;
