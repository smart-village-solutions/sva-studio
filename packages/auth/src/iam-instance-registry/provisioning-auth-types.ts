import type { InstanceRealmMode } from '@sva/core';

import type { KeycloakAdminClient } from '../keycloak-admin-client.js';
import { buildExpectedClientConfig } from './provisioning-auth-utils.js';

export type KeycloakClientRepresentation = Awaited<ReturnType<KeycloakAdminClient['getOidcClientByClientId']>>;
export type KeycloakRoleRepresentation = Awaited<ReturnType<KeycloakAdminClient['getRoleByName']>>;

export type TenantAdminBootstrap = {
  username: string;
  email?: string;
  firstName?: string;
  lastName?: string;
};

export type TenantAdminStatus = {
  readonly tenantAdminExists: boolean;
  readonly tenantAdminHasSystemAdmin: boolean;
  readonly tenantAdminHasInstanceRegistryAdmin: boolean;
  readonly tenantAdminInstanceIdMatches: boolean;
};

export type KeycloakReadState = {
  readonly client: KeycloakAdminClient;
  readonly expectedClient: ReturnType<typeof buildExpectedClientConfig>;
  readonly realm: { realm: string } | null;
  readonly clientRepresentation: KeycloakClientRepresentation;
  readonly protocolMappers: readonly { name: string }[];
  readonly tenantAdminStatus: TenantAdminStatus;
  readonly keycloakClientSecret: string | null;
  readonly systemAdminRole: KeycloakRoleRepresentation;
  readonly instanceRegistryAdminRole: KeycloakRoleRepresentation;
};

export type KeycloakProvisioningInput = {
  instanceId: string;
  primaryHostname: string;
  realmMode: InstanceRealmMode;
  authRealm: string;
  authClientId: string;
  authIssuerUrl?: string;
  authClientSecretConfigured: boolean;
  authClientSecret?: string;
  tenantAdminBootstrap?: TenantAdminBootstrap;
};
