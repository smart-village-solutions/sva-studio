import type { InstanceRealmMode } from '@sva/core';

import { buildExpectedClientConfig, buildExpectedTenantAdminClientConfig } from './provisioning-auth-utils.js';

export type KeycloakClientRepresentation = {
  readonly id?: string;
  readonly redirectUris?: readonly string[];
  readonly webOrigins?: readonly string[];
  readonly attributes?: Readonly<Record<string, string>>;
} | null;

export type KeycloakRoleRepresentation = {
  readonly id?: string;
  readonly externalName?: string;
} | null;

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
  readonly client: unknown;
  readonly expectedClient: ReturnType<typeof buildExpectedClientConfig>;
  readonly expectedTenantAdminClient: ReturnType<typeof buildExpectedTenantAdminClientConfig> | null;
  readonly realm: { realm: string } | null;
  readonly clientRepresentation: KeycloakClientRepresentation;
  readonly tenantAdminClientRepresentation: KeycloakClientRepresentation;
  readonly protocolMappers: readonly { name: string }[];
  readonly tenantAdminStatus: TenantAdminStatus;
  readonly keycloakClientSecret: string | null;
  readonly tenantAdminClientSecret: string | null;
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
  tenantAdminClient?: {
    clientId: string;
    secretConfigured?: boolean;
  };
  tenantAdminClientSecret?: string;
  tenantAdminBootstrap?: TenantAdminBootstrap;
};
