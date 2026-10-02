import { Pool } from 'pg';
import type {
  ExternalInterfaceConnectionCheckRecord,
  ExternalInterfaceRecord,
  ExternalInterfaceRuntimeErrorCode,
  ResolvedExternalInterface,
} from '@sva/core';
import { ExternalInterfaceRuntimeError } from '@sva/server-runtime';

export type PoolLike = Pick<Pool, 'query' | 'end'>;

export const shouldAllowPrivateInterfaceHealthcheckTargets = (): boolean =>
  process.env.SVA_ALLOW_PRIVATE_INTERFACE_HEALTHCHECK_TARGETS === 'true';

export const createPool = (connectionString: string): PoolLike =>
  new Pool({
    connectionString,
    max: 1,
    idleTimeoutMillis: 1_000,
    connectionTimeoutMillis: 5_000,
    allowExitOnIdle: true,
  });

export const normalizeProjectUrl = (value: unknown, instanceId: string): URL => {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new ExternalInterfaceRuntimeError({
      code: 'project_url_invalid',
      instanceId,
      typeKey: 'supabase',
      message: 'Die Projekt-URL ist leer oder ungültig.',
    });
  }

  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || !url.hostname.endsWith('.supabase.co')) {
      throw new Error('invalid_project_url');
    }
    return url;
  } catch {
    throw new ExternalInterfaceRuntimeError({
      code: 'project_url_invalid',
      instanceId,
      typeKey: 'supabase',
      message: 'Die Projekt-URL muss auf https://<projekt>.supabase.co zeigen.',
    });
  }
};

export const createRuntimeError = (
  code: ExternalInterfaceRuntimeErrorCode,
  instanceId: string,
  typeKey: string,
  message: string,
  retryable = false
) =>
  new ExternalInterfaceRuntimeError({
    code,
    instanceId,
    typeKey,
    message,
    retryable,
  });

export const mapDatabaseError = (
  error: unknown,
  instanceId: string,
  typeKey: 'supabase' | 'postgresql'
): ExternalInterfaceRuntimeError => {
  if (error instanceof ExternalInterfaceRuntimeError) {
    return error;
  }

  const code =
    typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : undefined;
  if (code === '28P01') {
    return createRuntimeError(
      'database_auth_failed',
      instanceId,
      typeKey,
      'Die Datenbankverbindung wurde abgelehnt. Benutzername oder Passwort der DB-URL sind falsch.'
    );
  }

  if (
    code === 'ENOTFOUND' ||
    code === 'ECONNREFUSED' ||
    code === 'ETIMEDOUT' ||
    code === 'EAI_AGAIN'
  ) {
    return createRuntimeError(
      'database_host_unreachable',
      instanceId,
      typeKey,
      'Der Datenbank-Host aus der DB-URL ist nicht erreichbar.',
      true
    );
  }

  return createRuntimeError(
    'connection_failed',
    instanceId,
    typeKey,
    error instanceof Error ? error.message : 'Die Datenbankprüfung ist fehlgeschlagen.',
    true
  );
};

export const toConnectionCheckRecord = (
  record: ExternalInterfaceRecord,
  error: ExternalInterfaceRuntimeError,
  checkedAt: string
): ExternalInterfaceConnectionCheckRecord => ({
  instanceId: record.instanceId,
  interfaceId: record.id,
  checkedAt,
  checkStatus: 'failed',
  visibleStatus:
    error.code === 'disabled'
      ? 'disabled'
      : error.code === 'secret_missing' ||
          error.code === 'database_url_missing' ||
          error.code === 'service_role_key_missing'
        ? 'not_configured'
        : 'error',
  errorCode: error.code,
  ...(record.typeKey === 'map_geocoding' ? {} : { errorMessage: error.message }),
});

export const withoutMapGeocodingErrorMessage = (
  record: ExternalInterfaceRecord,
  result: ExternalInterfaceConnectionCheckRecord
): ExternalInterfaceConnectionCheckRecord => {
  if (record.typeKey !== 'map_geocoding' || !result.errorMessage) return result;
  const { errorMessage: _errorMessage, ...stableResult } = result;
  return stableResult;
};

export const readSupabaseSecrets = (
  resolvedInterface: ResolvedExternalInterface,
  instanceId: string
) => {
  const databaseUrl = resolvedInterface.secretConfig.databaseUrl?.trim();
  if (!databaseUrl) {
    throw createRuntimeError(
      'database_url_missing',
      instanceId,
      'supabase',
      'Für diese Supabase-Schnittstelle fehlt die direkte DB-URL.'
    );
  }

  const serviceRoleKey = resolvedInterface.secretConfig.serviceRoleKey?.trim();
  if (!serviceRoleKey) {
    throw createRuntimeError(
      'service_role_key_missing',
      instanceId,
      'supabase',
      'Für diese Supabase-Schnittstelle fehlt der Service-Role-Key.'
    );
  }

  return { databaseUrl, serviceRoleKey };
};

export const resolveCheckedAt = (now?: () => Date | string): string => {
  const value = now?.();
  if (typeof value === 'string') {
    return value;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  return new Date().toISOString();
};
