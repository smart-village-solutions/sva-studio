import type { IamRoleListItem, IamRoleSyncState } from '@sva/core';
import { redactObject } from '@sva/server-runtime';

type IamRoleRow = {
  id: string;
  role_key: string;
  role_name: string;
  display_name?: string | null;
  external_role_name?: string | null;
  role_level: number;
  is_system_role: boolean;
};

type ManagedBy = 'studio' | 'external' | 'keycloak_builtin';

type RoleSyncErrorCode =
  | 'IDP_UNAVAILABLE'
  | 'IDP_TIMEOUT'
  | 'IDP_FORBIDDEN'
  | 'IDP_CONFLICT'
  | 'IDP_NOT_FOUND'
  | 'IDP_UNKNOWN'
  | 'DB_WRITE_FAILED'
  | 'COMPENSATION_FAILED'
  | 'REQUIRES_MANUAL_ACTION';

const readString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim().length > 0 ? value : undefined;

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object';

const readErrorName = (error: unknown): string | undefined => {
  if (!isRecord(error)) {
    return undefined;
  }

  return readString(error.name) ?? readString(error.constructor.name);
};

const readErrorCode = (error: unknown): string | undefined =>
  isRecord(error) ? readString(error.code) : undefined;

const readStatusCode = (error: unknown): number | undefined =>
  isRecord(error) && typeof error.statusCode === 'number' ? error.statusCode : undefined;

export const getRoleDisplayName = (role: Pick<IamRoleRow, 'display_name' | 'role_name'>): string =>
  readString(role.display_name) ?? role.role_name;

export const getRoleExternalName = (role: Pick<IamRoleRow, 'external_role_name' | 'role_key'>): string =>
  readString(role.external_role_name) ?? role.role_key;

const ROLE_AUDIT_STRING_REDACTIONS: ReadonlyArray<readonly [RegExp, string]> = [
  [/(bearer\s+)[A-Za-z0-9._-]+/gi, '$1[REDACTED]'],
  [/((?:api[_-]?key|token|secret|password|session|cookie|csrf)[^=:\s]{0,20}[=:]\s*)([^,\s]+)/gi, '$1[REDACTED]'],
  [/((?:client[_-]?secret)[^=:\s]{0,20}[=:]\s*)([^,\s]+)/gi, '$1[REDACTED]'],
];
const ROLE_AUDIT_SENSITIVE_KEY_PATTERN =
  /(?:^|[_-])(token|secret|password|authorization|cookie|session|csrf)(?:$|[_-])|^(?:x-api-key|api[_-]?key)$/i;

const isRoleAuditSensitiveKey = (key: string): boolean => ROLE_AUDIT_SENSITIVE_KEY_PATTERN.test(key);

const sanitizeRoleAuditString = (value: string): string => {
  const redacted = redactObject({ value }).value;
  let next = typeof redacted === 'string' ? redacted : value;
  for (const [pattern, replacement] of ROLE_AUDIT_STRING_REDACTIONS) {
    next = next.replace(pattern, replacement);
  }
  return next;
};

const sanitizeRoleAuditValue = (value: unknown): unknown => {
  if (typeof value === 'string') {
    return sanitizeRoleAuditString(value);
  }
  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeRoleAuditValue(entry));
  }
  if (isRecord(value)) {
    const redactedObject = redactObject(value);
    return Object.entries(redactedObject).reduce<Record<string, unknown>>((acc, [key, entry]) => {
      acc[key] = sanitizeRoleAuditValue(isRoleAuditSensitiveKey(key) ? '[REDACTED]' : entry);
      return acc;
    }, {});
  }
  return value;
};

export const sanitizeRoleAuditDetails = (
  details: Readonly<Record<string, unknown>> | undefined
): Record<string, unknown> | undefined => {
  if (!details) {
    return undefined;
  }
  return Object.entries(details).reduce<Record<string, unknown>>((acc, [key, value]) => {
    const redacted = isRoleAuditSensitiveKey(key) ? '[REDACTED]' : redactObject({ [key]: value })[key];
    acc[key] = sanitizeRoleAuditValue(redacted);
    return acc;
  }, {});
};

export const sanitizeRoleErrorMessage = (error: unknown): string =>
  sanitizeRoleAuditString(error instanceof Error ? error.message : String(error));

export const mapRoleSyncErrorCode = (error: unknown): RoleSyncErrorCode => {
  const errorName = readErrorName(error);
  if (errorName?.endsWith('KeycloakAdminUnavailableError')) {
    return 'IDP_UNAVAILABLE';
  }

  const statusCode = readStatusCode(error);
  const errorCode = readErrorCode(error);
  if (errorName?.endsWith('KeycloakAdminRequestError') || typeof statusCode === 'number' || errorCode) {
    if (errorCode === 'connect_timeout' || errorCode === 'read_timeout') {
      return 'IDP_TIMEOUT';
    }
    if (statusCode === 403) {
      return 'IDP_FORBIDDEN';
    }
    if (statusCode === 404) {
      return 'IDP_NOT_FOUND';
    }
    if (statusCode === 409) {
      return 'IDP_CONFLICT';
    }
    if ((typeof statusCode === 'number' && statusCode >= 500) || statusCode === 429) {
      return 'IDP_UNAVAILABLE';
    }
  }

  return 'IDP_UNKNOWN';
};

export const mapRoleListItem = (row: {
  id: string;
  role_key: string;
  role_name: string;
  display_name: string | null;
  external_role_name: string | null;
  managed_by: ManagedBy;
  description: string | null;
  is_system_role: boolean;
  role_level: number;
  member_count: number;
  sync_state: IamRoleSyncState;
  last_synced_at: string | null;
  last_error_code: string | null;
  permission_rows: Array<{ id: string; permission_key: string; description: string | null }> | null;
}): IamRoleListItem => ({
  id: row.id,
  roleKey: row.role_key,
  roleName: row.display_name ?? row.role_name,
  externalRoleName: row.external_role_name ?? row.role_key,
  managedBy: row.managed_by,
  description: row.description ?? undefined,
  isSystemRole: row.is_system_role,
  editability:
    row.is_system_role || row.managed_by !== 'studio'
      ? 'read_only'
      : 'editable',
  diagnostics:
    row.is_system_role
      ? [{ code: 'system_role', objectId: row.id, objectType: 'role' }]
      : row.managed_by === 'keycloak_builtin'
        ? [{ code: 'built_in_role', objectId: row.id, objectType: 'role' }]
        : row.managed_by === 'external'
          ? [{ code: 'external_managed', objectId: row.id, objectType: 'role' }]
          : undefined,
  roleLevel: row.role_level,
  memberCount: row.member_count,
  syncState: row.sync_state,
  lastSyncedAt: row.last_synced_at ?? undefined,
  syncError: row.last_error_code ? { code: row.last_error_code } : undefined,
  permissions:
    row.permission_rows?.map((permission) => ({
      id: permission.id,
      permissionKey: permission.permission_key,
      description: permission.description ?? undefined,
    })) ?? [],
});

const createApiError = (
  status: number,
  code: string,
  message: string,
  requestId?: string,
  details?: Readonly<Record<string, unknown>>
): Response => {
  const syncError = isRecord(details?.syncError) && typeof details.syncError.code === 'string'
    ? details.syncError.code
    : undefined;
  const diagnostics =
    code === 'keycloak_unavailable' && syncError
      ? {
          classification: 'keycloak_reconcile',
          recommendedAction: 'rollenabgleich_pruefen',
          status: 'manuelle_pruefung_erforderlich',
          safeDetails: {
            sync_error_code: syncError,
            sync_state: details?.syncState ?? 'failed',
          },
        }
      : {};

  return new Response(
    JSON.stringify({
      error: { code, message, ...diagnostics, ...(details ? { details } : {}) },
      ...(requestId ? { requestId } : {}),
    }),
    { status, headers: { 'content-type': 'application/json' } }
  );
};

export const buildRoleSyncFailure = (
  input: {
    error: unknown;
    requestId?: string;
    fallbackMessage: string;
    details?: Readonly<Record<string, unknown>>;
  } & (
    | {
        roleId?: undefined;
      }
    | {
        roleId: string;
      }
  )
): Response => {
  const syncErrorCode = mapRoleSyncErrorCode(input.error);
  const details = {
    syncState: 'failed',
    syncError: { code: syncErrorCode },
    ...input.details,
  } satisfies Readonly<Record<string, unknown>>;

  if (syncErrorCode === 'IDP_CONFLICT') {
    return createApiError(409, 'conflict', input.fallbackMessage, input.requestId, details);
  }

  if (syncErrorCode === 'IDP_FORBIDDEN') {
    return createApiError(
      503,
      'keycloak_unavailable',
      'Keycloak-Service-Account hat keine Berechtigung zum Verwalten von Realm-Rollen. Prüfe die realm-management-Rolle manage-realm.',
      input.requestId,
      details
    );
  }

  if (syncErrorCode === 'IDP_UNAVAILABLE' || syncErrorCode === 'IDP_TIMEOUT') {
    return createApiError(503, 'keycloak_unavailable', input.fallbackMessage, input.requestId, details);
  }

  return createApiError(500, 'internal_error', input.fallbackMessage, input.requestId, details);
};
