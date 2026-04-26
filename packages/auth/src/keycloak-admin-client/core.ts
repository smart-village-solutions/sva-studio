import { createSdkLogger } from '@sva/server-runtime';
import { getKeycloakAdminClientSecret, getKeycloakProvisionerClientSecret } from '../runtime-secrets.server.js';

import type {
  CreateIdentityRoleInput,
  IdentityListedUser,
  IdentityUserAttributes,
  CreateIdentityUserInput,
  IdentityRole,
  IdentityRoleListQuery,
  IdentityProviderPort,
  IdentityUser,
  IdentityUserListQuery,
  UpdateIdentityRoleInput,
  UpdateIdentityUserInput,
} from '../identity-provider-port.js';

type FetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>;

const logger = createSdkLogger({ component: 'keycloak-admin-client', level: 'info' });

const DEFAULT_CONNECT_TIMEOUT_MS = 5_000;
const DEFAULT_READ_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_CIRCUIT_BREAKER_FAILURE_THRESHOLD = 5;
const DEFAULT_CIRCUIT_BREAKER_OPEN_MS = 30_000;
const TOKEN_REFRESH_SKEW_MS = 10_000;

type TimeoutPhase = 'connect' | 'read';

type ReadFallback = {
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

type TokenResponse = {
  readonly access_token: string;
  readonly expires_in: number;
};

type KeycloakErrorResponse = {
  readonly error?: string;
  readonly error_description?: string;
  readonly errorMessage?: string;
  readonly field?: string;
  readonly params?: readonly string[];
};

type KeycloakRoleMapping = {
  readonly id: string;
  readonly name: string;
  readonly composite?: boolean;
  readonly clientRole?: boolean;
  readonly containerId?: string;
};

type KeycloakClientRepresentation = {
  readonly id: string;
  readonly clientId: string;
  readonly name?: string;
  readonly enabled?: boolean;
  readonly protocol?: string;
  readonly publicClient?: boolean;
  readonly standardFlowEnabled?: boolean;
  readonly directAccessGrantsEnabled?: boolean;
  readonly serviceAccountsEnabled?: boolean;
  readonly redirectUris?: readonly string[];
  readonly webOrigins?: readonly string[];
  readonly rootUrl?: string;
  readonly baseUrl?: string;
  readonly adminUrl?: string;
  readonly attributes?: Readonly<Record<string, string>>;
};

type KeycloakProtocolMapperRepresentation = {
  readonly id: string;
  readonly name: string;
  readonly protocol?: string;
  readonly protocolMapper?: string;
  readonly config?: Readonly<Record<string, string>>;
};

type KeycloakUserCreateResponse = {
  readonly location: string | null;
};

export type KeycloakListUsersQuery = IdentityUserListQuery;
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

type CachedToken = {
  readonly value: string;
  readonly expiresAtMs: number;
};

export class KeycloakAdminUnavailableError extends Error {
  readonly statusCode = 503;

  constructor(message: string) {
    super(message);
    this.name = 'KeycloakAdminUnavailableError';
  }
}

export class KeycloakAdminRequestError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly retryable: boolean;

  constructor(input: { message: string; statusCode: number; code: string; retryable: boolean }) {
    super(input.message);
    this.name = 'KeycloakAdminRequestError';
    this.statusCode = input.statusCode;
    this.code = input.code;
    this.retryable = input.retryable;
  }
}

type RequestExecutionOptions = {
  readonly method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  readonly path: string;
  readonly body?: string;
  readonly operation: string;
};

const encodePathSegment = (value: string): string => encodeURIComponent(value);

const normalizeBaseUrl = (baseUrl: string): string => {
  let end = baseUrl.length;
  while (end > 0 && baseUrl[end - 1] === '/') {
    end -= 1;
  }
  return end === baseUrl.length ? baseUrl : baseUrl.slice(0, end);
};

const MAX_LOCATION_HEADER_LENGTH = 2048;

const parseLocationHeader = (location: string | null): string | null => {
  if (!location || location.length > MAX_LOCATION_HEADER_LENGTH) {
    return null;
  }
  const lastSlash = location.lastIndexOf('/');
  if (lastSlash === -1) {
    return location;
  }
  const segment = location.slice(lastSlash + 1);
  return segment || null;
};

const normalizeAttributes = (
  attributes: Readonly<Record<string, string | readonly string[]>> | undefined
): Record<string, readonly string[]> | undefined => {
  if (!attributes) {
    return undefined;
  }

  const normalized: Record<string, readonly string[]> = {};
  for (const [key, value] of Object.entries(attributes)) {
    normalized[key] = Array.isArray(value) ? value : [value];
  }
  return normalized;
};

const normalizeManagedRoleAttributes = (
  attributes: Readonly<Record<string, readonly string[]> | Record<string, string | readonly string[]>>
): Record<string, readonly string[]> => normalizeAttributes(attributes as Readonly<Record<string, string | readonly string[]>>) ?? {};

const BUILTIN_REALM_ROLE_NAMES = new Set(['offline_access', 'uma_authorization']);

const readRoleAttribute = (
  attributes: Readonly<Record<string, readonly string[]>> | undefined,
  key: string
): string | undefined => {
  const values = attributes?.[key];
  return Array.isArray(values) ? values[0] : undefined;
};

const isBuiltInRealmRole = (roleName: string): boolean =>
  BUILTIN_REALM_ROLE_NAMES.has(roleName) || roleName.startsWith('default-roles-');

const isStudioManagedRealmRole = (role: IdentityRole | undefined): boolean =>
  role?.clientRole !== true && readRoleAttribute(role?.attributes, 'managed_by') === 'studio';

const toSortedUniqueStrings = (values: readonly string[] | undefined): string[] =>
  [...new Set((values ?? []).map((value) => value.trim()).filter((value) => value.length > 0))].sort((left, right) =>
    left.localeCompare(right)
  );

const areStringSetsEqual = (left: readonly string[] | undefined, right: readonly string[] | undefined): boolean => {
  const normalizedLeft = toSortedUniqueStrings(left);
  const normalizedRight = toSortedUniqueStrings(right);
  if (normalizedLeft.length !== normalizedRight.length) {
    return false;
  }
  return normalizedLeft.every((value, index) => value === normalizedRight[index]);
};

const readPostLogoutRedirectUris = (attributes: Readonly<Record<string, string>> | undefined): readonly string[] => {
  const raw = attributes?.['post.logout.redirect.uris'];
  if (!raw) {
    return [];
  }
  return raw
    .split('##')
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
};

const mapKeycloakRole = (role: KeycloakRealmRole): IdentityRole => ({
  id: role.id,
  externalName: role.name,
  description: role.description,
  attributes: role.attributes,
  composite: role.composite,
  clientRole: role.clientRole,
  containerId: role.containerId,
});

const mapKeycloakUser = (user: KeycloakAdminUser): IdentityListedUser => ({
  externalId: user.id,
  username: user.username,
  email: user.email,
  firstName: user.firstName,
  lastName: user.lastName,
  enabled: user.enabled,
  attributes: user.attributes,
});

const filterUserAttributes = (
  attributes: Readonly<Record<string, readonly string[]>> | undefined,
  attributeNames?: readonly string[]
): IdentityUserAttributes => {
  if (!attributes) {
    return {};
  }
  if (!attributeNames || attributeNames.length === 0) {
    return { ...attributes };
  }

  const allowedAttributes = new Set(attributeNames);
  return Object.fromEntries(
    Object.entries(attributes).filter(([key]) => allowedAttributes.has(key))
  );
};

const readAttribute = (
  attributes: Readonly<Record<string, readonly string[]>> | undefined,
  key: string
): string | undefined => {
  const values = attributes?.[key];
  return Array.isArray(values) ? values[0] : undefined;
};

const isStudioManagedRoleConflict = (
  role: IdentityRole,
  input: CreateIdentityRoleInput
): boolean =>
  readAttribute(role.attributes, 'managed_by') === 'studio' &&
  readAttribute(role.attributes, 'instance_id') !== undefined &&
  readAttribute(role.attributes, 'instance_id') !== input.attributes.instanceId;

const isRetryableStatus = (statusCode: number): boolean => statusCode === 429 || statusCode >= 500;

const toRetryLogReason = (error: unknown): string => {
  if (error instanceof KeycloakAdminRequestError) {
    return `${error.code}:${error.statusCode}`;
  }
  if (error instanceof KeycloakAdminUnavailableError) {
    return 'keycloak_unavailable';
  }
  if (error instanceof Error) {
    const name = error.name || 'error';
    if (name === 'AbortError') {
      return 'aborted';
    }
    return name;
  }
  return 'unknown_error';
};

const logKeycloakWriteSuccess = (
  event: string,
  meta: Readonly<Record<string, string | number | boolean | undefined>>
): void => {
  logger.info(event, meta);
};

const logKeycloakWriteFailure = (
  event: string,
  meta: Readonly<Record<string, string | number | boolean | undefined>>,
  error: unknown
): void => {
  logger.error(event, {
    ...meta,
    error: error instanceof Error ? error.message : String(error),
  });
};

const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number, phase: TimeoutPhase): Promise<T> => {
  if (timeoutMs <= 0) {
    return promise;
  }

  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(
        new KeycloakAdminRequestError({
          message: `Keycloak ${phase} timeout after ${timeoutMs}ms`,
          statusCode: 503,
          code: `${phase}_timeout`,
          retryable: true,
        })
      );
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
};

export class KeycloakAdminClient implements IdentityProviderPort {
  private readonly baseUrl: string;
  private readonly realm: string;
  private readonly adminRealm: string;
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly connectTimeoutMs: number;
  private readonly readTimeoutMs: number;
  private readonly maxRetries: number;
  private readonly circuitBreakerFailureThreshold: number;
  private readonly circuitBreakerOpenMs: number;
  private readonly fetchImpl: FetchLike;
  private readonly now: () => number;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly readFallback?: ReadFallback;

  private cachedToken?: CachedToken;
  private tokenRefreshPromise?: Promise<string>;
  private consecutiveFailures = 0;
  private circuitOpenUntilMs = 0;

  constructor(config: KeycloakAdminClientConfig) {
    this.baseUrl = normalizeBaseUrl(config.baseUrl);
    this.realm = config.realm;
    this.adminRealm = config.adminRealm ?? config.realm;
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
    this.connectTimeoutMs = config.connectTimeoutMs ?? DEFAULT_CONNECT_TIMEOUT_MS;
    this.readTimeoutMs = config.readTimeoutMs ?? DEFAULT_READ_TIMEOUT_MS;
    this.maxRetries = config.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.circuitBreakerFailureThreshold =
      config.circuitBreakerFailureThreshold ?? DEFAULT_CIRCUIT_BREAKER_FAILURE_THRESHOLD;
    this.circuitBreakerOpenMs = config.circuitBreakerOpenMs ?? DEFAULT_CIRCUIT_BREAKER_OPEN_MS;
    this.fetchImpl = config.fetchImpl ?? fetch;
    this.now = config.now ?? (() => Date.now());
    this.sleep = config.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
    this.readFallback = config.readFallback;
  }

  async createUser(input: CreateIdentityUserInput): Promise<IdentityUser> {
    await this.assertWriteAvailability();
    const payload = {
      username: input.username ?? input.email,
      email: input.email,
      firstName: input.firstName,
      lastName: input.lastName,
      enabled: input.enabled ?? true,
      attributes: normalizeAttributes(input.attributes),
    };

    const response = await this.executeWithResilience<KeycloakUserCreateResponse>({
      method: 'POST',
      path: `/admin/realms/${encodePathSegment(this.realm)}/users`,
      body: JSON.stringify(payload),
      operation: 'create_user',
    });

    const externalId = parseLocationHeader(response.location);
    if (!externalId) {
      throw new KeycloakAdminRequestError({
        message: 'Keycloak user creation succeeded without location header',
        statusCode: 502,
        code: 'missing_location_header',
        retryable: false,
      });
    }

    return { externalId };
  }

  async updateUser(externalId: string, input: UpdateIdentityUserInput): Promise<void> {
    await this.assertWriteAvailability();
    const payload = {
      username: input.username,
      email: input.email,
      firstName: input.firstName,
      lastName: input.lastName,
      enabled: input.enabled,
      attributes: normalizeAttributes(input.attributes),
    };

    await this.executeWithResilience<void>({
      method: 'PUT',
      path: `/admin/realms/${encodePathSegment(this.realm)}/users/${encodePathSegment(externalId)}`,
      body: JSON.stringify(payload),
      operation: 'update_user',
    });
  }

  async deactivateUser(externalId: string): Promise<void> {
    await this.assertWriteAvailability();
    await this.executeWithResilience<void>({
      method: 'PUT',
      path: `/admin/realms/${encodePathSegment(this.realm)}/users/${encodePathSegment(externalId)}`,
      body: JSON.stringify({ enabled: false }),
      operation: 'deactivate_user',
    });
  }

  async syncRoles(externalId: string, roles: readonly string[]): Promise<void> {
    await this.assertWriteAvailability();
    const expectedRoleNames = new Set(roles);
    const [currentRoleMappings, availableRoles] = await Promise.all([
      this.readUserRoleMappings(externalId, 'sync_roles_read_current'),
      this.listRoles(),
    ]);

    const currentByName = new Map(currentRoleMappings.map((role) => [role.name, role]));
    const availableByName = new Map(availableRoles.map((role) => [role.externalName, role]));

    const missingRoles = [...expectedRoleNames].filter((roleName) => !availableByName.has(roleName));
    if (missingRoles.length > 0) {
      throw new KeycloakAdminRequestError({
        message: `Unknown Keycloak roles: ${missingRoles.join(', ')}`,
        statusCode: 400,
        code: 'unknown_role',
        retryable: false,
      });
    }

    const toAdd = [...expectedRoleNames]
      .filter((roleName) => !currentByName.has(roleName))
      .map((roleName) => availableByName.get(roleName))
      .filter((role): role is IdentityRole => role !== undefined)
      .map(
        (role): KeycloakRealmRole => ({
          id: role.id ?? role.externalName,
          name: role.externalName,
          description: role.description,
          attributes: role.attributes,
          composite: role.composite,
          clientRole: role.clientRole,
          containerId: role.containerId,
        })
      );

    // Keep Keycloak built-ins and any unmanaged realm roles untouched. Tenant sync only owns
    // Studio-managed realm roles, otherwise tenant-local defaults like offline_access would
    // be removed during ordinary user edits.
    const toRemove = currentRoleMappings.filter((role) => {
      if (expectedRoleNames.has(role.name)) {
        return false;
      }
      if (isBuiltInRealmRole(role.name)) {
        return false;
      }
      return isStudioManagedRealmRole(availableByName.get(role.name));
    });

    if (toAdd.length > 0) {
      await this.executeWithResilience<void>({
        method: 'POST',
        path: `/admin/realms/${encodePathSegment(this.realm)}/users/${encodePathSegment(externalId)}/role-mappings/realm`,
        body: JSON.stringify(toAdd),
        operation: 'sync_roles_add',
      });
    }

    if (toRemove.length > 0) {
      await this.executeWithResilience<void>({
        method: 'DELETE',
        path: `/admin/realms/${encodePathSegment(this.realm)}/users/${encodePathSegment(externalId)}/role-mappings/realm`,
        body: JSON.stringify(toRemove),
        operation: 'sync_roles_remove',
      });
    }
  }

  async assignRealmRoles(externalId: string, roles: readonly string[]): Promise<void> {
    await this.assertWriteAvailability();
    const uniqueRoleNames = [...new Set(roles)];
    if (uniqueRoleNames.length === 0) {
      return;
    }
    const availableRoles = await this.listRoles();
    const availableByName = new Map(availableRoles.map((role) => [role.externalName, role]));
    const roleMappings = uniqueRoleNames.map((roleName) => availableByName.get(roleName));
    const missingRoles = uniqueRoleNames.filter((roleName, index) => !roleMappings[index]);
    if (missingRoles.length > 0) {
      throw new KeycloakAdminRequestError({
        message: `Unknown Keycloak roles: ${missingRoles.join(', ')}`,
        statusCode: 400,
        code: 'unknown_role',
        retryable: false,
      });
    }

    await this.executeWithResilience<void>({
      method: 'POST',
      path: `/admin/realms/${encodePathSegment(this.realm)}/users/${encodePathSegment(externalId)}/role-mappings/realm`,
      body: JSON.stringify(
        roleMappings
          .filter((role): role is IdentityRole => role !== undefined)
          .map((role): KeycloakRealmRole => ({
            id: role.id ?? role.externalName,
            name: role.externalName,
            description: role.description,
            attributes: role.attributes,
            composite: role.composite,
            clientRole: role.clientRole,
            containerId: role.containerId,
          }))
      ),
      operation: 'assign_realm_roles',
    });
  }

  async removeRealmRoles(externalId: string, roles: readonly string[]): Promise<void> {
    await this.assertWriteAvailability();
    const roleNames = new Set(roles);
    if (roleNames.size === 0) {
      return;
    }
    const currentRoleMappings = await this.readUserRoleMappings(externalId, 'remove_realm_roles_read_current');
    const toRemove = currentRoleMappings.filter((role) => roleNames.has(role.name));
    if (toRemove.length === 0) {
      return;
    }

    await this.executeWithResilience<void>({
      method: 'DELETE',
      path: `/admin/realms/${encodePathSegment(this.realm)}/users/${encodePathSegment(externalId)}/role-mappings/realm`,
      body: JSON.stringify(toRemove),
      operation: 'remove_realm_roles',
    });
  }

  async listUserRoleNames(externalId: string): Promise<readonly string[]> {
    const currentRoleMappings = await this.readUserRoleMappings(externalId, 'list_user_roles');
    return currentRoleMappings.map((role) => role.name);
  }

  async getUserAttributes(
    externalId: string,
    attributeNames?: readonly string[]
  ): Promise<IdentityUserAttributes> {
    if (this.isCircuitOpen()) {
      throw new KeycloakAdminUnavailableError('Keycloak unavailable; user list cannot be loaded.');
    }

    const user = await this.executeWithResilience<KeycloakAdminUser>({
      method: 'GET',
      path: `/admin/realms/${encodePathSegment(this.realm)}/users/${encodePathSegment(externalId)}`,
      operation: 'get_user_attributes',
    });

    return filterUserAttributes(user.attributes, attributeNames);
  }

  async listUsers(query?: KeycloakListUsersQuery): Promise<readonly IdentityListedUser[]> {
    if (this.isCircuitOpen()) {
      logger.error('Keycloak read blocked because circuit breaker is open', {
        operation: 'list_users',
        mode: 'fail_fast',
      });
      throw new KeycloakAdminUnavailableError('Keycloak unavailable; user list cannot be loaded.');
    }

    const searchParams = new URLSearchParams();
    for (const [key, value] of [
      ['first', query?.first],
      ['max', query?.max],
      ['enabled', query?.enabled],
    ] as const) {
      if (value !== undefined) {
        searchParams.set(key, String(value));
      }
    }
    for (const [key, value] of [
      ['search', query?.search],
      ['email', query?.email],
      ['username', query?.username],
    ] as const) {
      if (value) {
        searchParams.set(key, value);
      }
    }

    const querySuffix = searchParams.size > 0 ? `?${searchParams.toString()}` : '';
    try {
      const users = await this.executeWithResilience<KeycloakAdminUser[]>({
        method: 'GET',
        path: `/admin/realms/${encodePathSegment(this.realm)}/users${querySuffix}`,
        operation: 'list_users',
      });
      return users.map(mapKeycloakUser);
    } catch (error) {
      if (this.isRetryableError(error)) {
        logger.error('Keycloak read failed without fallback', {
          operation: 'list_users',
          mode: 'fail_fast',
          reason: toRetryLogReason(error),
        });
      }
      throw error;
    }
  }

  async countUsers(query?: Omit<KeycloakListUsersQuery, 'first' | 'max'>): Promise<number> {
    if (this.isCircuitOpen()) {
      logger.error('Keycloak read blocked because circuit breaker is open', {
        operation: 'count_users',
        mode: 'fail_fast',
      });
      throw new KeycloakAdminUnavailableError('Keycloak unavailable; user count cannot be loaded.');
    }

    const searchParams = new URLSearchParams();
    if (query?.enabled !== undefined) {
      searchParams.set('enabled', String(query.enabled));
    }
    for (const [key, value] of [
      ['search', query?.search],
      ['email', query?.email],
      ['username', query?.username],
    ] as const) {
      if (value) {
        searchParams.set(key, value);
      }
    }

    const querySuffix = searchParams.size > 0 ? `?${searchParams.toString()}` : '';
    try {
      const count = await this.executeWithResilience<number>({
        method: 'GET',
        path: `/admin/realms/${encodePathSegment(this.realm)}/users/count${querySuffix}`,
        operation: 'count_users',
      });
      return count;
    } catch (error) {
      if (this.isRetryableError(error)) {
        logger.error('Keycloak read failed without fallback', {
          operation: 'count_users',
          mode: 'fail_fast',
          reason: toRetryLogReason(error),
        });
      }
      throw error;
    }
  }

  private async readUserRoleMappings(
    externalId: string,
    operation: string
  ): Promise<readonly KeycloakRoleMapping[]> {
    if (this.isCircuitOpen()) {
      throw new KeycloakAdminUnavailableError('Keycloak unavailable and user role mapping reads are temporarily disabled.');
    }

    return this.executeWithResilience<KeycloakRoleMapping[]>({
      method: 'GET',
      path: `/admin/realms/${encodePathSegment(this.realm)}/users/${encodePathSegment(externalId)}/role-mappings/realm`,
      operation,
    });
  }

  async listRoles(query?: KeycloakListRolesQuery): Promise<readonly IdentityRole[]> {
    if (this.isCircuitOpen()) {
      logger.error('Keycloak read blocked because circuit breaker is open', {
        operation: 'list_roles',
        mode: 'fail_fast',
      });
      throw new KeycloakAdminUnavailableError('Keycloak unavailable; role list cannot be loaded.');
    }

    const searchParams = new URLSearchParams();
    for (const [key, value] of [
      ['first', query?.first],
      ['max', query?.max],
    ] as const) {
      if (value !== undefined) {
        searchParams.set(key, String(value));
      }
    }
    if (query?.search) {
      searchParams.set('search', query.search);
    }
    const querySuffix = searchParams.size > 0 ? `?${searchParams.toString()}` : '';

    try {
      const roles = await this.executeWithResilience<KeycloakRealmRole[]>({
        method: 'GET',
        path: `/admin/realms/${encodePathSegment(this.realm)}/roles${querySuffix}`,
        operation: 'list_roles',
      });
      return roles.map(mapKeycloakRole);
    } catch (error) {
      if (this.isRetryableError(error)) {
        logger.error('Keycloak read failed without fallback', {
          operation: 'list_roles',
          mode: 'fail_fast',
          reason: toRetryLogReason(error),
        });
      }
      throw error;
    }
  }

  async countRoles(query?: Omit<KeycloakListRolesQuery, 'first' | 'max'>): Promise<number> {
    if (this.isCircuitOpen()) {
      logger.error('Keycloak read blocked because circuit breaker is open', {
        operation: 'count_roles',
        mode: 'fail_fast',
      });
      throw new KeycloakAdminUnavailableError('Keycloak unavailable; role count cannot be loaded.');
    }

    const searchParams = new URLSearchParams();
    if (query?.search) {
      searchParams.set('search', query.search);
    }
    const querySuffix = searchParams.size > 0 ? `?${searchParams.toString()}` : '';
    const response = await this.executeWithResilience<number | { count?: number }>({
      method: 'GET',
      path: `/admin/realms/${encodePathSegment(this.realm)}/roles/count${querySuffix}`,
      operation: 'count_roles',
    });

    return typeof response === 'number' ? response : response.count ?? 0;
  }

  async getRoleByName(externalName: string): Promise<IdentityRole | null> {
    if (this.isCircuitOpen()) {
      throw new KeycloakAdminUnavailableError('Keycloak unavailable and role lookup is temporarily disabled.');
    }

    try {
      const role = await this.executeWithResilience<KeycloakRealmRole>({
        method: 'GET',
        path: `/admin/realms/${encodePathSegment(this.realm)}/roles/${encodePathSegment(externalName)}`,
        operation: 'get_role_by_name',
      });
      return {
        id: role.id,
        externalName: role.name,
        description: role.description,
        attributes: role.attributes,
        composite: role.composite,
        clientRole: role.clientRole,
        containerId: role.containerId,
      };
    } catch (error) {
      if (error instanceof KeycloakAdminRequestError && error.statusCode === 404) {
        return null;
      }
      throw error;
    }
  }

  async createRole(input: CreateIdentityRoleInput): Promise<IdentityRole> {
    await this.assertWriteAvailability();
    try {
      await this.executeWithResilience<void>({
        method: 'POST',
        path: `/admin/realms/${encodePathSegment(this.realm)}/roles`,
        body: JSON.stringify({
          name: input.externalName,
          description: input.description,
          attributes: normalizeManagedRoleAttributes({
            managed_by: input.attributes.managedBy,
            instance_id: input.attributes.instanceId,
            role_key: input.attributes.roleKey,
            display_name: input.attributes.displayName,
          }),
        }),
        operation: 'create_role',
      });
    } catch (error) {
      if (!(error instanceof KeycloakAdminRequestError) || error.statusCode !== 409) {
        throw error;
      }

      const existing = await this.getRoleByName(input.externalName);
      if (!existing) {
        throw error;
      }

      if (isStudioManagedRoleConflict(existing, input)) {
        throw error;
      }

      return this.updateRole(input.externalName, {
        description: input.description,
        attributes: input.attributes,
      });
    }

    const created = await this.getRoleByName(input.externalName);
    if (!created) {
      throw new KeycloakAdminRequestError({
        message: 'Keycloak role creation succeeded but role lookup failed afterwards',
        statusCode: 502,
        code: 'role_lookup_failed',
        retryable: false,
      });
    }
    return created;
  }

  async updateRole(externalName: string, input: UpdateIdentityRoleInput): Promise<IdentityRole> {
    await this.assertWriteAvailability();
    await this.executeWithResilience<void>({
      method: 'PUT',
      path: `/admin/realms/${encodePathSegment(this.realm)}/roles/${encodePathSegment(externalName)}`,
      body: JSON.stringify({
        name: externalName,
        description: input.description,
        attributes: normalizeManagedRoleAttributes({
          managed_by: input.attributes.managedBy,
          instance_id: input.attributes.instanceId,
          role_key: input.attributes.roleKey,
          display_name: input.attributes.displayName,
        }),
      }),
      operation: 'update_role',
    });

    const updated = await this.getRoleByName(externalName);
    if (!updated) {
      throw new KeycloakAdminRequestError({
        message: 'Keycloak role update succeeded but role lookup failed afterwards',
        statusCode: 502,
        code: 'role_lookup_failed',
        retryable: false,
      });
    }
    return updated;
  }

  async deleteRole(externalName: string): Promise<void> {
    await this.assertWriteAvailability();
    await this.executeWithResilience<void>({
      method: 'DELETE',
      path: `/admin/realms/${encodePathSegment(this.realm)}/roles/${encodePathSegment(externalName)}`,
      operation: 'delete_role',
    });
  }

  async logoutUser(externalId: string): Promise<void> {
    await this.assertWriteAvailability();
    await this.executeWithResilience<void>({
      method: 'POST',
      path: `/admin/realms/${encodePathSegment(this.realm)}/users/${encodePathSegment(externalId)}/logout`,
      operation: 'logout_user',
    });
  }

  async ensureRealm(input: { displayName?: string }): Promise<void> {
    await this.assertWriteAvailability();
    try {
      await this.executeWithResilience<void>({
        method: 'POST',
        path: '/admin/realms',
        body: JSON.stringify({
          realm: this.realm,
          enabled: true,
          displayName: input.displayName,
        }),
        operation: 'create_realm',
      });
      logKeycloakWriteSuccess('create_realm', {
        operation: 'create_realm',
        realm: this.realm,
      });
    } catch (error) {
      if (!(error instanceof KeycloakAdminRequestError) || error.statusCode !== 409) {
        logKeycloakWriteFailure(
          'create_realm_failed',
          {
            operation: 'create_realm',
            realm: this.realm,
          },
          error
        );
        throw error;
      }
    }
  }

  async getRealm(): Promise<{ realm: string } | null> {
    if (this.isCircuitOpen()) {
      throw new KeycloakAdminUnavailableError('Keycloak unavailable and realm lookup is temporarily disabled.');
    }

    try {
      const realm = await this.executeWithResilience<{ realm: string }>({
        method: 'GET',
        path: `/admin/realms/${encodePathSegment(this.realm)}`,
        operation: 'get_realm',
      });
      return realm;
    } catch (error) {
      if (error instanceof KeycloakAdminRequestError && error.statusCode === 404) {
        return null;
      }
      throw error;
    }
  }

  async getOidcClientByClientId(clientId: string): Promise<KeycloakClientRepresentation | null> {
    if (this.isCircuitOpen()) {
      throw new KeycloakAdminUnavailableError('Keycloak unavailable and client lookup is temporarily disabled.');
    }

    const query = await this.executeWithResilience<KeycloakClientRepresentation[]>({
      method: 'GET',
      path: `/admin/realms/${encodePathSegment(this.realm)}/clients?clientId=${encodeURIComponent(clientId)}`,
      operation: 'find_client',
    });

    return query[0] ?? null;
  }

  async getOidcClientSecretValue(clientId: string): Promise<string | null> {
    const client = await this.getOidcClientByClientId(clientId);
    if (!client) {
      return null;
    }

    const response = await this.executeWithResilience<{ value?: string }>({
      method: 'GET',
      path: `/admin/realms/${encodePathSegment(this.realm)}/clients/${encodePathSegment(client.id)}/client-secret`,
      operation: 'get_client_secret',
    });

    return typeof response.value === 'string' && response.value.length > 0 ? response.value : null;
  }

  async ensureOidcClient(input: {
    clientId: string;
    redirectUris: readonly string[];
    postLogoutRedirectUris: readonly string[];
    webOrigins: readonly string[];
    rootUrl: string;
    clientSecret?: string;
    rotateClientSecret?: boolean;
    standardFlowEnabled?: boolean;
    directAccessGrantsEnabled?: boolean;
    serviceAccountsEnabled?: boolean;
  }): Promise<void> {
    await this.assertWriteAvailability();
    const existing = await this.getOidcClientByClientId(input.clientId);
    const payload = {
      clientId: input.clientId,
      name: input.clientId,
      enabled: true,
      protocol: 'openid-connect',
      publicClient: false,
      standardFlowEnabled: input.standardFlowEnabled ?? true,
      directAccessGrantsEnabled: input.directAccessGrantsEnabled ?? false,
      serviceAccountsEnabled: input.serviceAccountsEnabled ?? false,
      redirectUris: [...toSortedUniqueStrings(input.redirectUris)],
      webOrigins: [...toSortedUniqueStrings(input.webOrigins)],
      attributes: {
        'post.logout.redirect.uris': toSortedUniqueStrings(input.postLogoutRedirectUris).join('##'),
      },
      rootUrl: input.rootUrl,
      baseUrl: '/',
      adminUrl: input.rootUrl,
    };

    await this.upsertOidcClient(existing, payload, input.clientId, input.postLogoutRedirectUris);
    await this.syncOidcClientSecret(existing, input);
  }

  private async upsertOidcClient(
    existing: KeycloakClientRepresentation | null,
    payload: {
      clientId: string;
      name: string;
      enabled: boolean;
      protocol: string;
      publicClient: boolean;
      standardFlowEnabled: boolean;
      directAccessGrantsEnabled: boolean;
      serviceAccountsEnabled: boolean;
      redirectUris: string[];
      webOrigins: string[];
      attributes: { 'post.logout.redirect.uris': string };
      rootUrl: string;
      baseUrl: string;
      adminUrl: string;
    },
    clientId: string,
    postLogoutRedirectUris: readonly string[]
  ): Promise<void> {
    if (!existing) {
      await this.createOidcClient(payload, clientId);
      return;
    }
    const requiresUpdate =
      existing.rootUrl !== payload.rootUrl ||
      !areStringSetsEqual(existing.redirectUris, payload.redirectUris) ||
      !areStringSetsEqual(existing.webOrigins, payload.webOrigins) ||
      !areStringSetsEqual(readPostLogoutRedirectUris(existing.attributes), postLogoutRedirectUris);
    if (requiresUpdate) {
      await this.updateOidcClient(existing, payload, clientId);
    }
  }

  private async createOidcClient(payload: object, clientId: string): Promise<void> {
    try {
      await this.executeWithResilience<void>({
        method: 'POST',
        path: `/admin/realms/${encodePathSegment(this.realm)}/clients`,
        operation: 'create_client',
        body: JSON.stringify(payload),
      });
      logKeycloakWriteSuccess('create_client', { operation: 'create_client', realm: this.realm, client_id: clientId });
    } catch (error) {
      logKeycloakWriteFailure('create_client_failed', { operation: 'create_client', realm: this.realm, client_id: clientId }, error);
      throw error;
    }
  }

  private async updateOidcClient(
    existing: KeycloakClientRepresentation,
    payload: object,
    clientId: string
  ): Promise<void> {
    try {
      await this.executeWithResilience<void>({
        method: 'PUT',
        path: `/admin/realms/${encodePathSegment(this.realm)}/clients/${encodePathSegment(existing.id)}`,
        operation: 'update_client',
        body: JSON.stringify({
          ...existing,
          ...payload,
        }),
      });
      logKeycloakWriteSuccess('update_client', { operation: 'update_client', realm: this.realm, client_id: clientId });
    } catch (error) {
      logKeycloakWriteFailure('update_client_failed', { operation: 'update_client', realm: this.realm, client_id: clientId }, error);
      throw error;
    }
  }

  private async syncOidcClientSecret(
    existing: KeycloakClientRepresentation | null,
    input: {
      clientId: string;
      clientSecret?: string;
      rotateClientSecret?: boolean;
    }
  ): Promise<void> {
    // If no clientSecret is provided, skip secret sync/rotation entirely.
    // rotateClientSecret without clientSecret is not a valid operation.
    if (!input.clientSecret) {
      return;
    }
    const resolvedClient = existing ?? (await this.getOidcClientByClientId(input.clientId));
    if (!resolvedClient) {
      throw new KeycloakAdminRequestError({
        message: 'Keycloak client secret could not be updated because the client is missing.',
        statusCode: 404,
        code: 'client_not_found',
        retryable: false,
      });
    }
    const currentSecret = await this.getOidcClientSecretValue(input.clientId);
    const shouldUpdateSecret = input.rotateClientSecret || currentSecret !== input.clientSecret;
    if (!shouldUpdateSecret) {
      return;
    }
    const logEvent = input.rotateClientSecret ? 'rotate_client_secret' : 'sync_client_secret';
    const logFailureEvent = input.rotateClientSecret ? 'rotate_client_secret_failed' : 'sync_client_secret_failed';
    try {
      await this.executeWithResilience<void>({
        method: 'POST',
        path: `/admin/realms/${encodePathSegment(this.realm)}/clients/${encodePathSegment(resolvedClient.id)}/client-secret`,
        operation: 'rotate_client_secret',
        body: JSON.stringify({ type: 'secret', value: input.clientSecret }),
      });
      logKeycloakWriteSuccess(logEvent, { operation: 'rotate_client_secret', realm: this.realm, client_id: input.clientId });
    } catch (error) {
      logKeycloakWriteFailure(logFailureEvent, { operation: 'rotate_client_secret', realm: this.realm, client_id: input.clientId }, error);
      throw error;
    }
  }

  async listClientProtocolMappers(clientId: string): Promise<readonly KeycloakProtocolMapperRepresentation[]> {
    const client = await this.getOidcClientByClientId(clientId);
    if (!client) {
      return [];
    }

    return this.executeWithResilience<KeycloakProtocolMapperRepresentation[]>({
      method: 'GET',
      path: `/admin/realms/${encodePathSegment(this.realm)}/clients/${encodePathSegment(client.id)}/protocol-mappers/models`,
      operation: 'list_protocol_mappers',
    });
  }

  async ensureUserAttributeProtocolMapper(input: {
    clientId: string;
    name: string;
    userAttribute: string;
    claimName: string;
  }): Promise<void> {
    await this.assertWriteAvailability();
    const client = await this.getOidcClientByClientId(input.clientId);
    if (!client) {
      throw new KeycloakAdminRequestError({
        message: `Keycloak client ${input.clientId} is missing.`,
        statusCode: 404,
        code: 'client_not_found',
        retryable: false,
      });
    }

    const existingMappers = await this.listClientProtocolMappers(input.clientId);
    const existingMapper = existingMappers.find((mapper) => mapper.name === input.name);
    const payload = {
      name: input.name,
      protocol: 'openid-connect',
      protocolMapper: 'oidc-usermodel-attribute-mapper',
      config: {
        'user.attribute': input.userAttribute,
        'claim.name': input.claimName,
        'jsonType.label': 'String',
        'id.token.claim': 'true',
        'access.token.claim': 'true',
        'userinfo.token.claim': 'true',
      },
    };

    if (!existingMapper) {
      await this.executeWithResilience<void>({
        method: 'POST',
        path: `/admin/realms/${encodePathSegment(this.realm)}/clients/${encodePathSegment(client.id)}/protocol-mappers/models`,
        operation: 'create_protocol_mapper',
        body: JSON.stringify(payload),
      });
      return;
    }

    const existingConfig = existingMapper.config ?? {};
    const needsUpdate =
      existingMapper.protocol !== payload.protocol ||
      existingMapper.protocolMapper !== payload.protocolMapper ||
      Object.entries(payload.config).some(([key, value]) => existingConfig[key] !== value);

    if (!needsUpdate) {
      return;
    }

    await this.executeWithResilience<void>({
      method: 'PUT',
      path: `/admin/realms/${encodePathSegment(this.realm)}/clients/${encodePathSegment(client.id)}/protocol-mappers/models/${encodePathSegment(existingMapper.id)}`,
      operation: 'update_protocol_mapper',
      body: JSON.stringify({
        ...existingMapper,
        ...payload,
      }),
    });
  }

  async ensureRealmRole(externalName: string): Promise<void> {
    const existing = await this.getRoleByName(externalName);
    if (existing) {
      return;
    }
    await this.createRole({
      externalName,
      attributes: {
        managedBy: 'studio',
        instanceId: this.realm,
        roleKey: externalName,
        displayName: externalName,
      },
    });
  }

  async findUserByUsername(username: string): Promise<KeycloakAdminUser | null> {
    if (this.isCircuitOpen()) {
      throw new KeycloakAdminUnavailableError('Keycloak unavailable and user lookup is temporarily disabled.');
    }

    const users = await this.executeWithResilience<KeycloakAdminUser[]>({
      method: 'GET',
      path: `/admin/realms/${encodePathSegment(this.realm)}/users?exact=true&username=${encodeURIComponent(username)}`,
      operation: 'find_user_by_username',
    });

    return users.find((user) => user.username === username) ?? null;
  }

  async findUserByEmail(email: string): Promise<KeycloakAdminUser | null> {
    if (this.isCircuitOpen()) {
      throw new KeycloakAdminUnavailableError('Keycloak unavailable and user lookup is temporarily disabled.');
    }

    const users = await this.executeWithResilience<KeycloakAdminUser[]>({
      method: 'GET',
      path: `/admin/realms/${encodePathSegment(this.realm)}/users?exact=true&email=${encodeURIComponent(email)}`,
      operation: 'find_user_by_email',
    });

    return users.find((user) => user.email?.toLowerCase() === email.toLowerCase()) ?? null;
  }

  async setUserPassword(externalId: string, password: string, temporary = true): Promise<void> {
    await this.assertWriteAvailability();
    try {
      await this.executeWithResilience<void>({
        method: 'PUT',
        path: `/admin/realms/${encodePathSegment(this.realm)}/users/${encodePathSegment(externalId)}/reset-password`,
        operation: 'reset_user_password',
        body: JSON.stringify({
          type: 'password',
          value: password,
          temporary,
        }),
      });
      logKeycloakWriteSuccess('reset_user_password', {
        operation: 'reset_user_password',
        realm: this.realm,
        temporary,
      });
    } catch (error) {
      logKeycloakWriteFailure(
        'reset_user_password_failed',
        {
          operation: 'reset_user_password',
          realm: this.realm,
          temporary,
        },
        error
      );
      throw error;
    }
  }

  async setUserRequiredActions(externalId: string, requiredActions: readonly string[]): Promise<void> {
    await this.assertWriteAvailability();
    await this.executeWithResilience<void>({
      method: 'PUT',
      path: `/admin/realms/${encodePathSegment(this.realm)}/users/${encodePathSegment(externalId)}`,
      operation: 'set_user_required_actions',
      body: JSON.stringify({
        requiredActions: [...requiredActions],
      }),
    });
  }

  getCircuitBreakerState(): number {
    return this.isCircuitOpen() ? 2 : 0;
  }

  private async assertWriteAvailability(): Promise<void> {
    if (this.isCircuitOpen()) {
      throw new KeycloakAdminUnavailableError('Keycloak unavailable. Write operations are temporarily disabled.');
    }
  }

  private isCircuitOpen(): boolean {
    return this.circuitOpenUntilMs > this.now();
  }

  private markSuccess(): void {
    this.consecutiveFailures = 0;
    this.circuitOpenUntilMs = 0;
  }

  private markFailure(): void {
    this.consecutiveFailures += 1;
    if (this.consecutiveFailures >= this.circuitBreakerFailureThreshold) {
      this.circuitOpenUntilMs = this.now() + this.circuitBreakerOpenMs;
      logger.error('Keycloak circuit breaker opened', {
        operation: 'circuit_breaker_open',
        failures: this.consecutiveFailures,
        open_ms: this.circuitBreakerOpenMs,
      });
    }
  }

  private async executeWithResilience<T>(request: RequestExecutionOptions): Promise<T> {
    if (this.isCircuitOpen()) {
      throw new KeycloakAdminUnavailableError('Keycloak unavailable. Circuit breaker is open.');
    }

    let lastError: unknown;
    const retryDelays = [1_000, 2_000, 4_000];

    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      try {
        const result = await this.executeRequest<T>(request);
        this.markSuccess();
        return result;
      } catch (error) {
        lastError = error;
        const retryable = this.isRetryableError(error);
        const isLastAttempt = attempt >= this.maxRetries;
        if (!retryable || isLastAttempt) {
          this.markFailure();
          throw error;
        }

        const delay = retryDelays[Math.min(attempt, retryDelays.length - 1)];
        logger.warn('Retrying Keycloak request', {
          operation: request.operation,
          attempt: attempt + 1,
          max_retries: this.maxRetries,
          retry_delay_ms: delay,
          reason: toRetryLogReason(error),
        });
        await this.sleep(delay);
      }
    }

    this.markFailure();
    throw lastError;
  }

  private isRetryableError(error: unknown): boolean {
    if (error instanceof KeycloakAdminRequestError) {
      return error.retryable;
    }
    if (error instanceof KeycloakAdminUnavailableError) {
      return true;
    }
    return false;
  }

  private async executeFetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
    if (this.connectTimeoutMs <= 0) {
      return this.fetchImpl(url, init);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.connectTimeoutMs);
    try {
      return await this.fetchImpl(url, {
        ...init,
        signal: controller.signal,
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new KeycloakAdminRequestError({
          message: `Keycloak connect timeout after ${this.connectTimeoutMs}ms`,
          statusCode: 503,
          code: 'connect_timeout',
          retryable: true,
        });
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private async executeRequest<T>(request: RequestExecutionOptions): Promise<T> {
    const token = await this.getAccessToken();
    const url = `${this.baseUrl}${request.path}`;
    const init: RequestInit = {
      method: request.method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(request.body ? { 'Content-Type': 'application/json' } : {}),
      },
    };
    if (request.body !== undefined) {
      init.body = request.body;
    }
    const response = await this.executeFetchWithTimeout(url, init);

    if (!response.ok) {
      const message = await this.buildErrorMessage(response, request.operation);
      throw new KeycloakAdminRequestError({
        message,
        statusCode: response.status,
        code: `http_${response.status}`,
        retryable: isRetryableStatus(response.status),
      });
    }

    if (response.status === 204) {
      return undefined as T;
    }

    if (request.operation === 'create_user') {
      return { location: response.headers.get('location') } as T;
    }

    const text = await withTimeout(response.text(), this.readTimeoutMs, 'read');
    if (!text) {
      return undefined as T;
    }
    return JSON.parse(text) as T;
  }

  private async buildErrorMessage(response: Response, operation: string): Promise<string> {
    try {
      const text = await withTimeout(response.text(), this.readTimeoutMs, 'read');
      if (!text) {
        return `Keycloak ${operation} failed with HTTP ${response.status}`;
      }
      const parsed = JSON.parse(text) as KeycloakErrorResponse;
      if (parsed.error_description) {
        return `Keycloak ${operation} failed: ${parsed.error_description}`;
      }
      if (parsed.errorMessage) {
        if (parsed.field) {
          return `Keycloak ${operation} failed: ${parsed.errorMessage} (${parsed.field})`;
        }
        if (parsed.params && parsed.params.length > 0) {
          return `Keycloak ${operation} failed: ${parsed.errorMessage} (${parsed.params.join(', ')})`;
        }
        return `Keycloak ${operation} failed: ${parsed.errorMessage}`;
      }
      if (parsed.error) {
        return `Keycloak ${operation} failed: ${parsed.error}`;
      }
      return `Keycloak ${operation} failed with HTTP ${response.status}`;
    } catch {
      return `Keycloak ${operation} failed with HTTP ${response.status}`;
    }
  }

  private async getAccessToken(): Promise<string> {
    const now = this.now();
    if (this.cachedToken && now < this.cachedToken.expiresAtMs - TOKEN_REFRESH_SKEW_MS) {
      return this.cachedToken.value;
    }

    if (this.tokenRefreshPromise) {
      return this.tokenRefreshPromise;
    }

    this.tokenRefreshPromise = this.fetchAccessToken()
      .finally(() => {
        this.tokenRefreshPromise = undefined;
      });
    return this.tokenRefreshPromise;
  }

  private async fetchAccessToken(): Promise<string> {
    const tokenEndpoint = `${this.baseUrl}/realms/${encodePathSegment(this.adminRealm)}/protocol/openid-connect/token`;
    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: this.clientId,
      client_secret: this.clientSecret,
    });

    const response = await this.executeFetchWithTimeout(tokenEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      });

    if (!response.ok) {
      const message = await this.buildErrorMessage(response, 'fetch_token');
      throw new KeycloakAdminRequestError({
        message,
        statusCode: response.status,
        code: `token_http_${response.status}`,
        retryable: isRetryableStatus(response.status),
      });
    }

    const text = await withTimeout(response.text(), this.readTimeoutMs, 'read');
    const parsed = JSON.parse(text) as TokenResponse;
    const token = parsed.access_token;
    if (!token) {
      throw new KeycloakAdminRequestError({
        message: 'Keycloak token response did not include access_token',
        statusCode: 502,
        code: 'token_missing',
        retryable: true,
      });
    }

    const expiresInSeconds = Number.isFinite(parsed.expires_in) ? parsed.expires_in : 60;
    this.cachedToken = {
      value: token,
      expiresAtMs: this.now() + expiresInSeconds * 1_000,
    };
    return token;
  }
}

const requireEnv = (key: string): string => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required env: ${key}`);
  }
  return value;
};

export const getKeycloakAdminClientConfigFromEnv = (realm = requireEnv('KEYCLOAK_ADMIN_REALM')): KeycloakAdminClientConfig => ({
  baseUrl: requireEnv('KEYCLOAK_ADMIN_BASE_URL'),
  realm,
  adminRealm: requireEnv('KEYCLOAK_ADMIN_REALM'),
  clientId: requireEnv('KEYCLOAK_ADMIN_CLIENT_ID'),
  clientSecret: getKeycloakAdminClientSecret() ?? requireEnv('KEYCLOAK_ADMIN_CLIENT_SECRET'),
});

const readProvisionerEnv = (key: 'BASE_URL' | 'REALM' | 'CLIENT_ID' | 'CLIENT_SECRET'): string =>
  process.env[`KEYCLOAK_PROVISIONER_${key}`] || requireEnv(`KEYCLOAK_ADMIN_${key}`);

export const getKeycloakProvisionerClientConfigFromEnv = (
  realm = readProvisionerEnv('REALM')
): KeycloakAdminClientConfig => ({
  baseUrl: readProvisionerEnv('BASE_URL'),
  realm,
  adminRealm: readProvisionerEnv('REALM'),
  clientId: readProvisionerEnv('CLIENT_ID'),
  clientSecret: getKeycloakProvisionerClientSecret() ?? readProvisionerEnv('CLIENT_SECRET'),
});
