import {
  getKeycloakAdminClientSecret,
  getKeycloakProvisionerClientSecret,
} from '../runtime-secrets.js';
import type { KeycloakAdminClientConfig } from './internal-models.js';

const requireEnv = (key: string): string => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required env: ${key}`);
  }
  return value;
};

const requireTrimmedEnv = (key: string): string => {
  const value = process.env[key]?.trim();
  if (!value) {
    throw new Error(`Missing required env: ${key}`);
  }
  return value;
};

const requireProvisionerEnvForLocalKeycloak = (
  key: 'BASE_URL' | 'REALM' | 'CLIENT_ID' | 'CLIENT_SECRET'
): string => {
  const envKey = `KEYCLOAK_PROVISIONER_${key}`;
  const value = process.env[envKey];
  if (!value) {
    throw new Error(`Missing required provisioner env for local-keycloak: ${envKey}`);
  }
  return value;
};

export const getKeycloakAdminClientConfigFromEnv = (
  realm = requireEnv('KEYCLOAK_ADMIN_REALM')
): KeycloakAdminClientConfig => ({
  baseUrl: requireTrimmedEnv('KEYCLOAK_ADMIN_BASE_URL'),
  realm,
  adminRealm: requireEnv('KEYCLOAK_ADMIN_REALM'),
  clientId: requireEnv('KEYCLOAK_ADMIN_CLIENT_ID'),
  clientSecret: getKeycloakAdminClientSecret() ?? requireEnv('KEYCLOAK_ADMIN_CLIENT_SECRET'),
});

export const getKeycloakTenantAdminClientConfigFromEnv = (input: {
  readonly realm: string;
  readonly clientId: string;
  readonly clientSecret: string;
}): KeycloakAdminClientConfig => ({
  baseUrl:
    process.env.KEYCLOAK_ADMIN_BASE_URL?.trim() ||
    process.env.KEYCLOAK_PROVISIONER_BASE_URL?.trim() ||
    requireTrimmedEnv('KEYCLOAK_ADMIN_BASE_URL'),
  realm: input.realm,
  adminRealm: input.realm,
  clientId: input.clientId,
  clientSecret: input.clientSecret,
});

const readProvisionerEnv = (key: 'BASE_URL' | 'REALM' | 'CLIENT_ID' | 'CLIENT_SECRET'): string => {
  if (process.env.SVA_RUNTIME_PROFILE?.trim() === 'local-keycloak') {
    return requireProvisionerEnvForLocalKeycloak(key);
  }

  return process.env[`KEYCLOAK_PROVISIONER_${key}`] || requireEnv(`KEYCLOAK_ADMIN_${key}`);
};

export const getKeycloakProvisionerClientConfigFromEnv = (
  realm = readProvisionerEnv('REALM')
): KeycloakAdminClientConfig => ({
  baseUrl: readProvisionerEnv('BASE_URL'),
  realm,
  adminRealm: readProvisionerEnv('REALM'),
  clientId: readProvisionerEnv('CLIENT_ID'),
  clientSecret: getKeycloakProvisionerClientSecret() ?? readProvisionerEnv('CLIENT_SECRET'),
});
