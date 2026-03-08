import type { IamRoleListItem, IamRoleSyncState } from '@sva/core';
import { redactObject } from '@sva/sdk/server';
import {
  KeycloakAdminRequestError,
  KeycloakAdminUnavailableError,
} from '../keycloak-admin-client';
import { readString } from '../shared/input-readers';
import { createApiError } from './api-helpers';
import type { IamRoleRow, ManagedBy, RoleSyncErrorCode } from './types';

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
  if (value && typeof value === 'object') {
    const redactedObject = redactObject(value as Record<string, unknown>);
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
  if (error instanceof KeycloakAdminUnavailableError) {
    return 'IDP_UNAVAILABLE';
  }
  if (error instanceof KeycloakAdminRequestError) {
    if (error.code === 'connect_timeout' || error.code === 'read_timeout') {
      return 'IDP_TIMEOUT';
    }
    if (error.statusCode === 403) {
      return 'IDP_FORBIDDEN';
    }
    if (error.statusCode === 404) {
      return 'IDP_NOT_FOUND';
    }
    if (error.statusCode === 409) {
      return 'IDP_CONFLICT';
    }
    if (error.statusCode >= 500 || error.statusCode === 429) {
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
