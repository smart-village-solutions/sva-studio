import type { InstanceRealmMode } from '@sva/core';

import {
  buildExpectedClientConfig,
  buildExpectedTenantAdminClientConfig,
} from './provisioning-auth-utils.js';

export type KeycloakClientRepresentation = {
  readonly id?: string;
  readonly clientId?: string;
  readonly enabled?: boolean;
  readonly protocol?: string;
  readonly publicClient?: boolean;
  readonly rootUrl?: string;
  readonly redirectUris?: readonly string[];
  readonly webOrigins?: readonly string[];
  readonly standardFlowEnabled?: boolean;
  readonly implicitFlowEnabled?: boolean;
  readonly directAccessGrantsEnabled?: boolean;
  readonly serviceAccountsEnabled?: boolean;
  readonly attributes?: Readonly<Record<string, string>>;
} | null;

export type PluginOidcClientRequirement = Readonly<
  {
    pluginId: string;
    clientId: string;
    audience: string;
    enabled: false;
  } & (
    | { contractVersion: '1.0' }
    | {
        contractVersion: '2.0';
        redirectUris: readonly string[];
        webOrigins: readonly string[];
      }
  )
>;

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
  readonly attributes?: Readonly<Record<string, readonly string[]>>;
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

export type TenantAdminRepresentation = Readonly<{
  id: string;
  username?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  enabled?: boolean;
  attributes?: Readonly<Record<string, readonly string[]>>;
}>;

export type KeycloakReadState = {
  readonly client: unknown;
  readonly expectedClient: ReturnType<typeof buildExpectedClientConfig>;
  readonly expectedTenantAdminClient: ReturnType<
    typeof buildExpectedTenantAdminClientConfig
  > | null;
  readonly realm: {
    readonly realm: string;
    readonly loginTheme?: string;
    readonly internationalizationEnabled?: boolean;
    readonly supportedLocales?: readonly string[];
    readonly defaultLocale?: string;
    readonly eventsEnabled?: boolean;
    readonly eventsListeners?: readonly string[];
    readonly eventsExpiration?: number;
    readonly adminEventsEnabled?: boolean;
    readonly adminEventsDetailsEnabled?: boolean;
    readonly resetPasswordAllowed?: boolean;
    readonly verifyEmail?: boolean;
    readonly attributes?: Readonly<Record<string, string>>;
    readonly smtpServer?: Readonly<Record<string, string>>;
    readonly smtpPasswordConfigured?: boolean;
  } | null;
  readonly clientRepresentation: KeycloakClientRepresentation;
  readonly tenantAdminClientRepresentation: KeycloakClientRepresentation;
  readonly pluginOidcClients: readonly PluginOidcClientState[];
  readonly protocolMappers: readonly {
    readonly name: string;
    readonly protocol?: string;
    readonly protocolMapper?: string;
    readonly config?: Readonly<Record<string, string>>;
  }[];
  readonly tenantAdminStatus: TenantAdminStatus;
  readonly tenantAdminRepresentation?: TenantAdminRepresentation | null;
  readonly keycloakClientSecret: string | null;
  readonly tenantAdminClientSecret: string | null;
  readonly systemAdminRole: KeycloakRoleRepresentation;
  readonly realmBaselineAligned?: boolean;
  readonly userProfileBaselineAligned?: boolean;
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
  allowLegacyRealmRoleMigration?: boolean;
  pluginOidcClients?: readonly PluginOidcClientRequirement[];
};
