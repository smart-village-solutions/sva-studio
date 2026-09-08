export const SSF_TENANT_OIDC_CLIENT_REQUIREMENT_VERSION = '1.0' as const;

export const SSF_TENANT_OIDC_CLIENT_REQUIREMENT = {
  contractVersion: SSF_TENANT_OIDC_CLIENT_REQUIREMENT_VERSION,
  pluginId: 'ssf',
  clientId: 'ssf',
  audience: 'ssf',
  enabled: false,
} as const;
