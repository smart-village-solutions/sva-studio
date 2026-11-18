import {
  definePluginActions,
  definePluginModuleIamContract,
  definePluginPermissions,
} from '@sva/plugin-sdk';
import { SSF_ADMIN_ACTIONS } from './admin-contracts.js';
import { SSF_RECORDING_PERMISSION_IDS, SSF_TRANSFER_PERMISSION } from './recording-permissions.js';

export const platformAccess = {
  kind: 'platform',
  roles: { mode: 'allOf', values: ['instance_registry_admin'] },
} as const;
export const tenantReadAccess = {
  kind: 'tenant',
  moduleId: 'ssf',
  actions: { mode: 'allOf', values: [SSF_ADMIN_ACTIONS.tenantRead] },
} as const;
export const tenantManageAccess = {
  kind: 'tenant',
  moduleId: 'ssf',
  actions: { mode: 'allOf', values: [SSF_ADMIN_ACTIONS.tenantManage] },
} as const;

export const transferAccess = {
  kind: 'tenant',
  moduleId: 'ssf',
  actions: { mode: 'allOf', values: [SSF_TRANSFER_PERMISSION] },
} as const;

export const keyReadAccess = {
  kind: 'tenant',
  moduleId: 'ssf',
  actions: { mode: 'anyOf', values: [SSF_ADMIN_ACTIONS.tenantManage, SSF_TRANSFER_PERMISSION] },
} as const;
export const actions = definePluginActions('ssf', [
  {
    id: 'ssf.organisation-keys.inspect',
    titleKey: 'ssf.administration.pages.organisation-keys',
    accessRequirement: keyReadAccess,
  },
  {
    id: SSF_TRANSFER_PERMISSION,
    titleKey: 'ssf.permissions.recording_access_transfer',
    accessRequirement: transferAccess,
  },
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

export const permissions = definePluginPermissions('ssf', [
  ...SSF_RECORDING_PERMISSION_IDS.map((id) => ({
    id,
    titleKey: `ssf.permissions.${id.replace('ssf.recording.', 'recording_').replace(/\./gu, '_')}`,
  })),
  { id: SSF_ADMIN_ACTIONS.tenantRead, titleKey: 'ssf.permissions.tenantRead' },
  { id: SSF_ADMIN_ACTIONS.tenantManage, titleKey: 'ssf.permissions.tenantManage' },
]);

const tenantPermissionIds = permissions.map(({ id }) => id);
export const moduleIam = definePluginModuleIamContract('ssf', {
  moduleId: 'ssf',
  permissionIds: tenantPermissionIds,
  systemRoles: [
    {
      roleName: 'system_admin',
      permissionIds: tenantPermissionIds.filter((id) => id !== SSF_TRANSFER_PERMISSION),
    },
  ],
  systemAdminPermissionExclusions: [SSF_TRANSFER_PERMISSION],
});
