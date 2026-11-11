const ssfSystemAdminRole = {
  roleName: 'system_admin',
  permissionIds: ['ssf.configuration.tenant.manage', 'ssf.configuration.tenant.read',
    'ssf.recording.request', 'ssf.recording.review', 'ssf.recording.review.sworn',
    'ssf.recording.supervise', 'ssf.recording.recovery.custodian'],
} as const;

export const ssfModuleIamContract = {
  moduleId: 'ssf',
  namespace: 'ssf',
  ownerPluginId: 'ssf',
  descriptionKey: 'plugins.ssf.description',
  permissionIds: ['ssf.configuration.tenant.manage', 'ssf.configuration.tenant.read',
    'ssf.recording.request', 'ssf.recording.review', 'ssf.recording.review.sworn',
    'ssf.recording.supervise', 'ssf.recording.recovery.custodian'],
  tenantBootstrapRoles: [ssfSystemAdminRole],
  rootSystemRoles: [],
  systemRoles: [ssfSystemAdminRole],
} as const;
