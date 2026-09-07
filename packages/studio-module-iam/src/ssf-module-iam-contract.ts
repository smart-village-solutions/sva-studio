const ssfSystemAdminRole = {
  roleName: 'system_admin',
  permissionIds: ['ssf.configuration.tenant.manage', 'ssf.configuration.tenant.read'],
} as const;

export const ssfModuleIamContract = {
  moduleId: 'ssf',
  namespace: 'ssf',
  ownerPluginId: 'ssf',
  descriptionKey: 'plugins.ssf.description',
  permissionIds: ['ssf.configuration.tenant.manage', 'ssf.configuration.tenant.read'],
  tenantBootstrapRoles: [ssfSystemAdminRole],
  rootSystemRoles: [],
  systemRoles: [ssfSystemAdminRole],
  systemAdminPermissionExclusions: undefined,
} as const;
