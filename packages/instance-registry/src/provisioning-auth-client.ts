import type {
  KeycloakClientRepresentation,
  KeycloakReadState,
  KeycloakRoleRepresentation,
} from './provisioning-auth-types.js';
import type { KeycloakRealmBaselineSettings } from './keycloak-realm-baseline.js';

export type KeycloakAdminUser = {
  readonly id: string;
  readonly username?: string;
  readonly email?: string;
  readonly firstName?: string;
  readonly lastName?: string;
  readonly enabled?: boolean;
  readonly attributes?: Readonly<Record<string, readonly string[]>>;
  readonly emailUniqueMatch?: boolean;
};

export type KeycloakProvisioningClient = {
  listRealms(): Promise<readonly { readonly realm: string }[]>;
  hasRealmCreateCapability(): Promise<boolean>;
  ensureRealm(input: {
    displayName?: string;
    settings?: KeycloakRealmBaselineSettings;
  }): Promise<boolean>;
  deleteRealm(): Promise<void>;
  getRealm(): Promise<KeycloakReadState['realm']>;
  getOidcClientByClientId(clientId: string): Promise<KeycloakClientRepresentation>;
  getOidcClientSecretValue(clientId: string): Promise<string | null>;
  ensureOidcClient(input: {
    clientId: string;
    redirectUris: readonly string[];
    postLogoutRedirectUris: readonly string[];
    webOrigins: readonly string[];
    rootUrl: string;
    clientSecret?: string;
    rotateClientSecret?: boolean;
    standardFlowEnabled?: boolean;
    implicitFlowEnabled?: boolean;
    directAccessGrantsEnabled?: boolean;
    serviceAccountsEnabled?: boolean;
    enabled?: boolean;
    uriPolicy?: 'merge' | 'replace';
    publicClient?: boolean;
    pkceCodeChallengeMethod?: 'S256';
    accessTokenLifespan?: 900;
    ownership?: Readonly<{ instanceId: string; artifactKey: string }>;
  }): Promise<void>;
  ensurePersonalMcpAccess(audienceClientId: string): Promise<void>;
  ensureTenantAdminServiceAccess(clientId: string): Promise<void>;
  listClientProtocolMappers(clientId: string): Promise<
    readonly {
      name: string;
      protocol?: string;
      protocolMapper?: string;
      config?: Readonly<Record<string, string>>;
    }[]
  >;
  listEffectiveClientProtocolMappers(clientId: string): Promise<
    readonly {
      name: string;
      protocol?: string;
      protocolMapper?: string;
      config?: Readonly<Record<string, string>>;
    }[]
  >;
  ensureUserAttributeProtocolMapper(input: {
    clientId: string;
    name: string;
    userAttribute: string;
    claimName: string;
  }): Promise<void>;
  ensureAdminOnlyUserProfileAttributes(
    attributes: readonly Readonly<{ name: string; multivalued: boolean }>[]
  ): Promise<void>;
  hasAdminOnlyUserProfileAttributes(
    attributes: readonly Readonly<{ name: string; multivalued: boolean }>[]
  ): Promise<boolean>;
  ensureAudienceProtocolMapper(input: {
    clientId: string;
    name: string;
    audience: string;
  }): Promise<void>;
  ensureRealmRole(
    externalName: string,
    instanceId?: string,
    options?: { readonly allowLegacyRealmRoleMigration?: boolean }
  ): Promise<void>;
  getRoleByName(externalName: string): Promise<KeycloakRoleRepresentation>;
  findUserByUsername(username: string): Promise<KeycloakAdminUser | null>;
  findUserByEmail(email: string): Promise<KeycloakAdminUser | null>;
  findUsersByEmail(email: string): Promise<readonly KeycloakAdminUser[]>;
  createUser(input: {
    username: string;
    email: string;
    firstName?: string;
    lastName?: string;
    enabled: boolean;
    attributes?: Readonly<Record<string, readonly string[]>>;
  }): Promise<{ externalId: string }>;
  updateUser(
    externalId: string,
    input: {
      username: string;
      email?: string;
      firstName?: string;
      lastName?: string;
      enabled: boolean;
      attributes?: Readonly<Record<string, readonly string[]>>;
    }
  ): Promise<unknown>;
  syncRoles(externalId: string, roles: readonly string[]): Promise<void>;
  assignRealmRoles(externalId: string, roles: readonly string[]): Promise<void>;
  setUserPassword(externalId: string, password: string, temporary?: boolean): Promise<void>;
  setUserRequiredActions(externalId: string, requiredActions: readonly string[]): Promise<void>;
  listUserRoleNames(externalId: string): Promise<readonly string[]>;
};

export type KeycloakProvisioningClientFactory = (realm?: string) => KeycloakProvisioningClient;

export type KeycloakProvisioningClientConfigResolver<TConfig> = (realm?: string) => TConfig;

export const createKeycloakProvisioningClientFactory =
  <TConfig>(
    resolveConfig: KeycloakProvisioningClientConfigResolver<TConfig>,
    createClient: (config: TConfig) => KeycloakProvisioningClient
  ): KeycloakProvisioningClientFactory =>
  (realm?: string) =>
    createClient(resolveConfig(realm));
