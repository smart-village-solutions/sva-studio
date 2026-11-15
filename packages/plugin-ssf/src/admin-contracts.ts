/** Existing configuration action IDs shared by SSF routes and current content administration. */
export const SSF_ADMIN_ACTIONS = {
  systemRead: 'ssf.configuration.system.read',
  systemManage: 'ssf.configuration.system.manage',
  tenantRead: 'ssf.configuration.tenant.read',
  tenantManage: 'ssf.configuration.tenant.manage',
} as const;
