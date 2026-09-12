export const SSF_TENANT_OIDC_CLIENT_REQUIREMENT_VERSION = '1.0' as const;

export const SSF_TENANT_OIDC_CLIENT_REQUIREMENT = {
  contractVersion: SSF_TENANT_OIDC_CLIENT_REQUIREMENT_VERSION,
  pluginId: 'ssf',
  clientId: 'ssf',
  audience: 'ssf',
  enabled: false,
} as const;

export const SSF_LOGIN_CLIENT_ID = 'ssf-frontend' as const;

/** The installation owns the origin; requests and tenant hostnames cannot override it. */
export const readSsfLoginClientRequirement = (environment: NodeJS.ProcessEnv = process.env) => {
  const origin = environment.SVA_STUDIO_SSF_LOGIN_ORIGIN?.trim();
  if (!origin) return null;
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    throw new Error('ssf_login_origin_invalid');
  }
  if (url.protocol !== 'https:' || url.origin !== origin || origin.includes('*')) {
    throw new Error('ssf_login_origin_invalid');
  }
  return {
    contractVersion: '2.0' as const,
    pluginId: 'ssf',
    clientId: SSF_LOGIN_CLIENT_ID,
    audience: SSF_LOGIN_CLIENT_ID,
    enabled: false as const,
    redirectUris: [`${origin}/login/*`],
    webOrigins: [origin],
  };
};
