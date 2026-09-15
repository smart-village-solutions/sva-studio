import { normalizeHost } from '@sva/core';

const KASSEL_PARENT_DOMAIN = 'dialog.kassel.de';
const DEFAULT_KASSEL_PUBLIC_AUTH_ORIGIN = 'https://auth.dialog.kassel.de';

export type ProvisioningAuthIssuerInput = {
  readonly parentDomain: string;
  readonly authRealm: string;
  readonly authIssuerUrl?: string;
};

type KasselProvisioningEnvironment = {
  readonly tenantIngressMode?: string;
  readonly publicAuthOrigin?: string;
  readonly keycloakBaseUrl?: string;
  readonly nodeEnv?: string;
};

const parseHttpsOrigin = (value: string): string => {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('kassel_public_auth_origin_invalid');
  }
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash
  ) {
    throw new Error('kassel_public_auth_origin_invalid');
  }
  return url.origin;
};

const isTrustedHttpHostname = (hostname: string): boolean =>
  hostname === 'localhost' ||
  hostname === '[::1]' ||
  hostname.startsWith('127.') ||
  hostname === 'keycloak';

const parseKeycloakBaseUrl = (value: string, allowHttp: boolean): string => {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('keycloak_admin_base_url_invalid');
  }
  const httpAllowed =
    url.protocol === 'http:' && (allowHttp || isTrustedHttpHostname(url.hostname));
  if (
    (url.protocol !== 'https:' && !httpAllowed) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw new Error('keycloak_admin_base_url_invalid');
  }
  return url.toString().replace(/\/+$/, '');
};

export const resolveProvisioningAuthIssuerUrl = (
  input: ProvisioningAuthIssuerInput,
  environment: KasselProvisioningEnvironment
): string | undefined => {
  if (environment.tenantIngressMode !== 'kassel-traefik-file') {
    if (input.authIssuerUrl) return input.authIssuerUrl;
    const keycloakBaseUrl = environment.keycloakBaseUrl?.trim();
    if (!keycloakBaseUrl) throw new Error('keycloak_admin_base_url_missing');
    const baseUrl = parseKeycloakBaseUrl(keycloakBaseUrl, environment.nodeEnv !== 'production');
    return `${baseUrl}/realms/${encodeURIComponent(input.authRealm)}`;
  }
  if (normalizeHost(input.parentDomain) !== KASSEL_PARENT_DOMAIN) {
    throw new Error('kassel_parent_domain_invalid');
  }

  const authOrigin = parseHttpsOrigin(
    environment.publicAuthOrigin?.trim() || DEFAULT_KASSEL_PUBLIC_AUTH_ORIGIN
  );
  const expectedIssuerUrl = `${authOrigin}/realms/${encodeURIComponent(input.authRealm)}`;
  if (input.authIssuerUrl && input.authIssuerUrl !== expectedIssuerUrl) {
    throw new Error('kassel_auth_issuer_mismatch');
  }
  return expectedIssuerUrl;
};

export const resolveConfiguredProvisioningAuthIssuerUrl = (
  input: ProvisioningAuthIssuerInput
): string | undefined =>
  resolveProvisioningAuthIssuerUrl(input, {
    tenantIngressMode: process.env.SVA_TENANT_INGRESS_MODE,
    publicAuthOrigin: process.env.SVA_KASSEL_PUBLIC_AUTH_ORIGIN,
    keycloakBaseUrl: process.env.KEYCLOAK_ADMIN_BASE_URL,
    nodeEnv: process.env.NODE_ENV,
  });
