import type { IdentityRoleListQuery, IdentityUserListQuery } from '../identity-provider-port.js';

export type FetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>;
export type ReadFallback = {
  readonly listUsers?: (query?: KeycloakListUsersQuery) => Promise<readonly KeycloakAdminUser[]>;
  readonly listRoles?: () => Promise<readonly KeycloakRealmRole[]>;
};

export type KeycloakAdminClientConfig = {
  readonly baseUrl: string;
  readonly realm: string;
  readonly adminRealm?: string;
  readonly clientId: string;
  readonly clientSecret: string;
  readonly connectTimeoutMs?: number;
  readonly readTimeoutMs?: number;
  readonly maxRetries?: number;
  readonly circuitBreakerFailureThreshold?: number;
  readonly circuitBreakerOpenMs?: number;
  readonly fetchImpl?: FetchLike;
  readonly now?: () => number;
  readonly sleep?: (ms: number) => Promise<void>;
  readonly readFallback?: ReadFallback;
};
export type TokenResponse = {
  readonly access_token: string;
  readonly expires_in: number;
};

export type KeycloakErrorResponse = {
  readonly error?: string;
  readonly error_description?: string;
  readonly errorMessage?: string;
  readonly field?: string;
  readonly params?: readonly string[];
  readonly errors?: readonly {
    readonly field?: string;
    readonly errorMessage?: string;
  }[];
};
export type KeycloakRoleMapping = {
  readonly id: string;
  readonly name: string;
  readonly composite?: boolean;
  readonly clientRole?: boolean;
  readonly containerId?: string;
};

export type KeycloakProtocolMapperRepresentation = {
  readonly id: string;
  readonly name: string;
  readonly protocol?: string;
  readonly protocolMapper?: string;
  readonly config?: Readonly<Record<string, string>>;
};

export type KeycloakProtocolMapperEvaluationRepresentation = {
  readonly mapperId?: string;
  readonly mapperName?: string;
  readonly containerId?: string;
  readonly containerName?: string;
  readonly containerType?: string;
  readonly protocolMapper?: string;
};

export type KeycloakUserCreateResponse = {
  readonly location: string | null;
};

export type KeycloakUserProfileAttribute = Readonly<{
  name: string;
  multivalued?: boolean;
  permissions?: Readonly<{
    view?: readonly string[];
    edit?: readonly string[];
  }>;
  [key: string]: unknown;
}>;

export type KeycloakUserProfileConfig = Readonly<{
  attributes?: readonly KeycloakUserProfileAttribute[];
  [key: string]: unknown;
}>;

export type KeycloakRealmRepresentation = Readonly<{
  realm: string;
  loginTheme?: string;
  emailTheme?: string;
  internationalizationEnabled?: boolean;
  supportedLocales?: readonly string[];
  defaultLocale?: string;
  eventsEnabled?: boolean;
  eventsListeners?: readonly string[];
  eventsExpiration?: number;
  adminEventsEnabled?: boolean;
  adminEventsDetailsEnabled?: boolean;
  resetPasswordAllowed?: boolean;
  verifyEmail?: boolean;
  attributes?: Readonly<Record<string, string>>;
  smtpServer?: Readonly<Record<string, string>>;
}>;

export type KeycloakRealmSettings = Omit<KeycloakRealmRepresentation, 'realm'>;

export type KeycloakRealmReadRepresentation = KeycloakRealmRepresentation & {
  readonly smtpPasswordConfigured: boolean;
};
export type KeycloakListUsersQuery = IdentityUserListQuery & {
  readonly briefRepresentation?: boolean;
};
export type KeycloakListRolesQuery = IdentityRoleListQuery;

export type KeycloakAdminUser = {
  readonly id: string;
  readonly username?: string;
  readonly email?: string;
  readonly firstName?: string;
  readonly lastName?: string;
  readonly enabled?: boolean;
  readonly attributes?: Readonly<Record<string, readonly string[]>>;
};

export type KeycloakRealmRole = {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly composite?: boolean;
  readonly clientRole?: boolean;
  readonly containerId?: string;
  readonly attributes?: Readonly<Record<string, readonly string[]>>;
};

export type CachedToken = {
  readonly value: string;
  readonly expiresAtMs: number;
};

export type RequestExecutionOptions = {
  readonly method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  readonly path: string;
  readonly body?: string;
  readonly operation: string;
};
