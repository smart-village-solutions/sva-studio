import {
  definePluginActions,
  definePluginModuleIamContract,
  definePluginPermissions,
  type PluginDescriptor,
} from '@sva/plugin-sdk';

import { SSF_ADMIN_ACTIONS } from './admin-contracts.js';
import {
  SSF_SYSTEM_CONTENT_V2_ADMIN_PATH,
  SSF_TENANT_CONTENT_V2_ADMIN_PATH,
} from './content-v2-admin-contracts.js';
import {
  SSF_RECORDING_PERMISSION_IDS,
  SSF_RUNTIME_ENDPOINT_PATH,
  SSF_RUNTIME_V2_ENDPOINT_PATH,
  SSF_RUNTIME_V2_SERVER_HANDLER_ID,
  SSF_RUNTIME_TENANT_HEADER,
  SSF_RUNTIME_SERVER_HANDLER_ID,
  SSF_RUNTIME_SERVICE_ACTION,
  SSF_RUNTIME_SERVICE_ID,
} from './constants.js';
import { ssfPluginTranslations } from './plugin.translations.js';

export const SSF_RECORDING_DIRECTORY_ENDPOINT_PATH =
  '/internal/plugins/ssf/v2/recording-directory' as const;
export const SSF_RECORDING_DIRECTORY_SERVER_HANDLER_ID = 'ssf.recording-directory-v2' as const;

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
  ...SSF_RECORDING_PERMISSION_IDS.map((id) => ({
    id,
    titleKey: `ssf.permissions.${id.replace('ssf.recording.', 'recording_').replace(/\./gu, '_')}`,
  })),
  { id: SSF_ADMIN_ACTIONS.tenantRead, titleKey: 'ssf.permissions.tenantRead' },
  { id: SSF_ADMIN_ACTIONS.tenantManage, titleKey: 'ssf.permissions.tenantManage' },
]);

const tenantPermissionIds = permissions.map(({ id }) => id);
const moduleIam = definePluginModuleIamContract('ssf', {
  moduleId: 'ssf',
  permissionIds: tenantPermissionIds,
  systemRoles: [{ roleName: 'system_admin', permissionIds: tenantPermissionIds }],
});

export const SSF_AUTHORIZATION_RECONCILE_JOB_TYPE_ID = 'ssf.reconcile-authorization' as const;

const jobTypes = [
  {
    jobTypeId: SSF_AUTHORIZATION_RECONCILE_JOB_TYPE_ID,
    queue: 'plugin-operations',
    displayName: 'SSF authorization reconcile',
  },
] as const;

export const ssfPlugin = {
  id: 'ssf',
  displayName: 'Smart Speech Flow',
  actions,
  permissions,
  moduleIam,
  jobTypes,
  tenantLifecycle: {
    contractVersion: 1,
    operations: [
      {
        operation: 'provision',
        jobTypeId: SSF_AUTHORIZATION_RECONCILE_JOB_TYPE_ID,
      },
      {
        operation: 'reconcile',
        jobTypeId: SSF_AUTHORIZATION_RECONCILE_JOB_TYPE_ID,
      },
      { operation: 'readiness', jobTypeId: SSF_AUTHORIZATION_RECONCILE_JOB_TYPE_ID },
    ],
    readinessChecks: [
      {
        checkId: 'ssf.loginReady',
        titleKey: 'ssf.readiness.login',
        required: true,
        repairOperation: 'reconcile',
      },
    ],
  },
  translations: ssfPluginTranslations,
  routes: [
    ...(['overview', 'appearance', 'languages', 'recordings', 'feedback'] as const).map((page) => ({
      id: `ssf-tenant-${page}` as const,
      path: `/plugins/ssf/${page}`,
      documentation: {
        kind: 'page' as const,
        id: `ssf.tenant-${page}`,
        pageType: page === 'overview' ? ('overview' as const) : ('setup' as const),
      },
      ...(page === 'overview' ? {} : { editorLeaveGuard: true as const }),
      actionId: SSF_ADMIN_ACTIONS.tenantRead,
      serverHandlerId: 'ssf.tenant-content-v2.read',
      accessRequirement: tenantReadAccess,
    })),
    ...(['overview', 'default-configuration', 'default-content'] as const).map((page) => ({
      id: `ssf-system-${page}` as const,
      path: `/plugins/ssf/system/${page}`,
      documentation: {
        kind: 'page' as const,
        id: `ssf.system-${page}`,
        pageType: page === 'overview' ? ('overview' as const) : ('setup' as const),
      },
      ...(page === 'overview' ? {} : { editorLeaveGuard: true as const }),
      actionId: SSF_ADMIN_ACTIONS.systemRead,
      serverHandlerId: 'ssf.system-content-v2.read',
      accessRequirement: platformAccess,
    })),
  ],
  navigation: [
    ...(['overview', 'appearance', 'languages', 'recordings', 'feedback'] as const).map((page) => ({
      id: `ssf.tenant-navigation-${page}`,
      to: `/plugins/ssf/${page}`,
      titleKey: `ssf.administration.pages.${page}`,
      section: 'applications' as const,
      group: { id: 'ssf.application', titleKey: 'ssf.navigation.tenant' },
      actionId: SSF_ADMIN_ACTIONS.tenantRead,
      accessRequirement: tenantReadAccess,
    })),
    ...(['overview', 'default-configuration', 'default-content'] as const).map((page) => ({
      id: `ssf.system-navigation-${page}`,
      to: `/plugins/ssf/system/${page}`,
      titleKey: `ssf.administration.pages.${page === 'overview' ? 'installation-overview' : page}`,
      section: 'applications' as const,
      group: { id: 'ssf.installation', titleKey: 'ssf.navigation.tenant' },
      actionId: SSF_ADMIN_ACTIONS.systemRead,
      accessRequirement: platformAccess,
    })),
  ],
  serverHandlers: [
    {
      id: SSF_RECORDING_DIRECTORY_SERVER_HANDLER_ID,
      path: SSF_RECORDING_DIRECTORY_ENDPOINT_PATH,
      method: 'GET',
      actionId: SSF_RUNTIME_SERVICE_ACTION,
      accessRequirement: {
        kind: 'service',
        serviceId: SSF_RUNTIME_SERVICE_ID,
        tenantBinding: { kind: 'header', headerName: SSF_RUNTIME_TENANT_HEADER },
      },
    },
    {
      id: SSF_RUNTIME_SERVER_HANDLER_ID,
      path: SSF_RUNTIME_ENDPOINT_PATH,
      method: 'GET',
      actionId: SSF_RUNTIME_SERVICE_ACTION,
      accessRequirement: {
        kind: 'service',
        serviceId: SSF_RUNTIME_SERVICE_ID,
        tenantBinding: { kind: 'header', headerName: SSF_RUNTIME_TENANT_HEADER },
      },
    },
    {
      id: SSF_RUNTIME_V2_SERVER_HANDLER_ID,
      path: SSF_RUNTIME_V2_ENDPOINT_PATH,
      method: 'GET',
      actionId: SSF_RUNTIME_SERVICE_ACTION,
      accessRequirement: {
        kind: 'service',
        serviceId: SSF_RUNTIME_SERVICE_ID,
        tenantBinding: { kind: 'header', headerName: SSF_RUNTIME_TENANT_HEADER },
      },
    },
    {
      id: 'ssf.system-content-v2.read',
      path: SSF_SYSTEM_CONTENT_V2_ADMIN_PATH,
      method: 'GET',
      actionId: SSF_ADMIN_ACTIONS.systemRead,
      accessRequirement: platformAccess,
    },
    {
      id: 'ssf.system-content-v2.write',
      path: SSF_SYSTEM_CONTENT_V2_ADMIN_PATH,
      method: 'PUT',
      actionId: SSF_ADMIN_ACTIONS.systemManage,
      accessRequirement: platformAccess,
    },
    {
      id: 'ssf.tenant-content-v2.read',
      path: SSF_TENANT_CONTENT_V2_ADMIN_PATH,
      method: 'GET',
      actionId: SSF_ADMIN_ACTIONS.tenantRead,
      accessRequirement: tenantReadAccess,
    },
    {
      id: 'ssf.tenant-content-v2.write',
      path: SSF_TENANT_CONTENT_V2_ADMIN_PATH,
      method: 'PUT',
      actionId: SSF_ADMIN_ACTIONS.tenantManage,
      accessRequirement: tenantManageAccess,
    },
  ],
  contentHistory: { mode: 'none', reasonCode: 'infrastructure_only' },
} as const satisfies PluginDescriptor;
