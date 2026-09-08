import type { InstanceRealmMode } from '@sva/core';

import {
  buildExpectedClientConfig,
  buildExpectedTenantAdminClientConfig,
} from './provisioning-auth-utils.js';

export type KeycloakClientRepresentation = {
  readonly id?: string;
  readonly clientId?: string;
  readonly enabled?: boolean;
  readonly rootUrl?: string;
  readonly redirectUris?: readonly string[];
  readonly webOrigins?: readonly string[];
  readonly standardFlowEnabled?: boolean;
  readonly implicitFlowEnabled?: boolean;
  readonly directAccessGrantsEnabled?: boolean;
  readonly serviceAccountsEnabled?: boolean;
  readonly attributes?: Readonly<Record<string, string>>;
} | null;

export type PluginOidcClientRequirement = Readonly<{
  contractVersion: '1.0';
  pluginId: string;
  clientId: string;
  audience: string;
  enabled: false;
}>;

export type PluginOidcClientState = Readonly<{
  requirement: PluginOidcClientRequirement;
  clientRepresentation: KeycloakClientRepresentation;
  protocolMappers: readonly {
    readonly name: string;
    readonly protocol?: string;
    readonly protocolMapper?: string;
    readonly config?: Readonly<Record<string, string>>;
  }[];
}>;

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
};

export type KeycloakReadState = {
  readonly client: unknown;
  readonly expectedClient: ReturnType<typeof buildExpectedClientConfig>;
  readonly expectedTenantAdminClient: ReturnType<
    typeof buildExpectedTenantAdminClientConfig
  > | null;
  readonly realm: { realm: string } | null;
  readonly clientRepresentation: KeycloakClientRepresentation;
  readonly tenantAdminClientRepresentation: KeycloakClientRepresentation;
  readonly pluginOidcClients: readonly PluginOidcClientState[];
  readonly protocolMappers: readonly { name: string }[];
  readonly tenantAdminStatus: TenantAdminStatus;
  readonly keycloakClientSecret: string | null;
  readonly tenantAdminClientSecret: string | null;
  readonly systemAdminRole: KeycloakRoleRepresentation;
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
  pluginOidcClients?: readonly PluginOidcClientRequirement[];
};
