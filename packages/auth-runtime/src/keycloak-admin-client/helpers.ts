import { createSdkLogger } from '@sva/server-runtime';
import type {
  CreateIdentityRoleInput,
  IdentityListedUser,
  IdentityRole,
  IdentityUserAttributes,
} from '../identity-provider-port.js';
import { KeycloakAdminRequestError, KeycloakAdminUnavailableError } from './errors.js';
import type { KeycloakAdminUser, KeycloakRealmRole } from './internal-models.js';

export const logger = createSdkLogger({ component: 'keycloak-admin-client', level: 'info' });
type TimeoutPhase = 'connect' | 'read';
const isJsonRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isNormalizationOnlyValue = (value: unknown): boolean =>
  value === null ||
  value === undefined ||
  (Array.isArray(value) && value.length === 0) ||
  (isJsonRecord(value) && Object.keys(value).length === 0);

export const isPreservedJson = (expected: unknown, actual: unknown): boolean => {
  if (Array.isArray(expected)) {
    if (!Array.isArray(actual)) return expected.length === 0 && actual === undefined;
    const unmatched = [...actual];
    return expected.every((expectedItem) => {
      const matchIndex = unmatched.findIndex((actualItem) =>
        isPreservedJson(expectedItem, actualItem)
      );
      if (matchIndex < 0) return false;
      unmatched.splice(matchIndex, 1);
      return true;
    });
  }
  if (isJsonRecord(expected)) {
    if (!isJsonRecord(actual)) return Object.keys(expected).length === 0 && actual === undefined;
    return Object.entries(expected).every(([key, value]) => {
      if (!(key in actual) && isNormalizationOnlyValue(value)) return true;
      return isPreservedJson(value, actual[key]);
    });
  }
  return Object.is(expected, actual);
};

export const isSemanticallyEqualJson = (left: unknown, right: unknown): boolean =>
  isPreservedJson(left, right) && isPreservedJson(right, left);

export const encodePathSegment = (value: string): string => encodeURIComponent(value);

export const normalizeBaseUrl = (baseUrl: string): string => {
  let end = baseUrl.length;
  while (end > 0 && baseUrl[end - 1] === '/') {
    end -= 1;
  }
  return end === baseUrl.length ? baseUrl : baseUrl.slice(0, end);
};

const MAX_LOCATION_HEADER_LENGTH = 2048;

export const parseLocationHeader = (location: string | null): string | null => {
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

export const normalizeAttributes = (
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

export const normalizeManagedRoleAttributes = (
  attributes: Readonly<
    Record<string, readonly string[]> | Record<string, string | readonly string[]>
  >
): Record<string, readonly string[]> =>
  normalizeAttributes(attributes as Readonly<Record<string, string | readonly string[]>>) ?? {};

const BUILTIN_REALM_ROLE_NAMES = new Set(['offline_access', 'uma_authorization']);

export const readRoleAttribute = (
  attributes: Readonly<Record<string, readonly string[]>> | undefined,
  key: string
): string | undefined => {
  const values = attributes?.[key];
  return Array.isArray(values) && values.length === 1 ? values[0] : undefined;
};

export const isBuiltInRealmRole = (roleName: string): boolean =>
  BUILTIN_REALM_ROLE_NAMES.has(roleName) || roleName.startsWith('default-roles-');

export const isStudioManagedRealmRole = (role: IdentityRole | undefined): boolean =>
  role?.clientRole !== true && readRoleAttribute(role?.attributes, 'managed_by') === 'studio';

export const mapKeycloakRole = (role: KeycloakRealmRole): IdentityRole => ({
  id: role.id,
  externalName: role.name,
  description: role.description,
  attributes: role.attributes,
  composite: role.composite,
  clientRole: role.clientRole,
  containerId: role.containerId,
});

export const mapKeycloakUser = (user: KeycloakAdminUser): IdentityListedUser => ({
  externalId: user.id,
  username: user.username,
  email: user.email,
  firstName: user.firstName,
  lastName: user.lastName,
  enabled: user.enabled,
  attributes: user.attributes,
});

export const filterUserAttributes = (
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
  return Array.isArray(values) && values.length === 1 ? values[0] : undefined;
};

export const canReconcileStudioManagedRole = (
  role: IdentityRole,
  input: CreateIdentityRoleInput,
  realm: string,
  allowLegacyRealmRoleMigration: boolean
): boolean => {
  const managedBy = readAttribute(role.attributes, 'managed_by');
  const instanceId = readAttribute(role.attributes, 'instance_id');
  const roleKey = readAttribute(role.attributes, 'role_key');
  return (
    managedBy === 'studio' &&
    roleKey === input.attributes.roleKey &&
    (instanceId === input.attributes.instanceId ||
      (allowLegacyRealmRoleMigration && instanceId === realm))
  );
};

export const isRetryableStatus = (statusCode: number): boolean =>
  statusCode === 429 || statusCode >= 500;

export const toRetryLogReason = (error: unknown): string => {
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

export const logKeycloakWriteSuccess = (
  event: string,
  meta: Readonly<Record<string, string | number | boolean | undefined>>
): void => {
  logger.info(event, meta);
};

export const logKeycloakWriteFailure = (
  event: string,
  meta: Readonly<Record<string, string | number | boolean | undefined>>,
  error: unknown
): void => {
  logger.error(event, {
    ...meta,
    error: error instanceof Error ? error.message : String(error),
  });
};

export const withTimeout = async <T>(
  promise: Promise<T>,
  timeoutMs: number,
  phase: TimeoutPhase
): Promise<T> => {
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
