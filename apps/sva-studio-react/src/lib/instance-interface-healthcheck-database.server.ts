import type { ResolvedExternalInterface } from '@sva/core';
import { normalizeDatabaseConnectionUrl } from '@sva/auth-runtime/server';
import {
  createPool,
  createRuntimeError,
  mapDatabaseError,
  normalizeProjectUrl,
  readSupabaseSecrets,
  shouldAllowPrivateInterfaceHealthcheckTargets,
} from './instance-interface-healthcheck-common.server.js';
import type { PoolLike } from './instance-interface-healthcheck-common.server.js';

export const verifySupabaseDatabase = async (
  resolvedInterface: ResolvedExternalInterface,
  deps: {
    readonly createPool?: (connectionString: string) => PoolLike;
  }
): Promise<void> => {
  const { databaseUrl } = readSupabaseSecrets(resolvedInterface, resolvedInterface.instanceId);
  const normalizedDatabaseUrl = await normalizeDatabaseConnectionUrl(databaseUrl, {
    allowPrivateHosts: shouldAllowPrivateInterfaceHealthcheckTargets(),
  });
  if (!normalizedDatabaseUrl) {
    throw createRuntimeError(
      'connection_failed',
      resolvedInterface.instanceId,
      'supabase',
      'Die DB-URL zeigt auf einen privaten oder lokalen Host. Setze SVA_ALLOW_PRIVATE_INTERFACE_HEALTHCHECK_TARGETS=true nur für bewusst interne Admin-Ziele.'
    );
  }
  const pool = (deps.createPool ?? createPool)(normalizedDatabaseUrl);

  try {
    const schemaName =
      typeof resolvedInterface.publicConfig.schemaName === 'string' &&
      resolvedInterface.publicConfig.schemaName.trim().length > 0
        ? resolvedInterface.publicConfig.schemaName.trim()
        : 'public';

    const result = await pool.query(
      'select exists(select 1 from information_schema.schemata where schema_name = $1) as schema_exists',
      [schemaName]
    );
    if (result.rows[0]?.schema_exists !== true) {
      throw createRuntimeError(
        'schema_missing',
        resolvedInterface.instanceId,
        'supabase',
        `Das konfigurierte Schema "${schemaName}" existiert in der Datenbank nicht.`
      );
    }
  } catch (error) {
    throw mapDatabaseError(error, resolvedInterface.instanceId, 'supabase');
  } finally {
    await pool.end();
  }
};

export const verifyPostgresqlDatabase = async (
  resolvedInterface: ResolvedExternalInterface,
  deps: {
    readonly createPool?: (connectionString: string) => PoolLike;
  }
): Promise<void> => {
  const databaseUrl = resolvedInterface.secretConfig.databaseUrl?.trim();
  if (!databaseUrl) {
    throw createRuntimeError(
      'database_url_missing',
      resolvedInterface.instanceId,
      'postgresql',
      'Für diese PostgreSQL-Schnittstelle fehlt die Datenbank-URL.'
    );
  }

  const normalizedDatabaseUrl = await normalizeDatabaseConnectionUrl(databaseUrl, {
    allowPrivateHosts: shouldAllowPrivateInterfaceHealthcheckTargets(),
  });
  if (!normalizedDatabaseUrl) {
    throw createRuntimeError(
      'connection_failed',
      resolvedInterface.instanceId,
      'postgresql',
      'Die Datenbank-URL zeigt auf einen privaten oder lokalen Host. Setze SVA_ALLOW_PRIVATE_INTERFACE_HEALTHCHECK_TARGETS=true nur für bewusst interne Admin-Ziele.'
    );
  }

  const pool = (deps.createPool ?? createPool)(normalizedDatabaseUrl);
  try {
    const schemaName =
      typeof resolvedInterface.publicConfig.schemaName === 'string' &&
      resolvedInterface.publicConfig.schemaName.trim().length > 0
        ? resolvedInterface.publicConfig.schemaName.trim()
        : 'public';
    const result = await pool.query(
      'select exists(select 1 from information_schema.schemata where schema_name = $1) as schema_exists',
      [schemaName]
    );
    if (result.rows[0]?.schema_exists !== true) {
      throw createRuntimeError(
        'schema_missing',
        resolvedInterface.instanceId,
        'postgresql',
        `Das konfigurierte Schema "${schemaName}" existiert in der Datenbank nicht.`
      );
    }
  } catch (error) {
    throw mapDatabaseError(error, resolvedInterface.instanceId, 'postgresql');
  } finally {
    await pool.end();
  }
};

export const verifySupabaseApi = async (
  resolvedInterface: ResolvedExternalInterface,
  deps: {
    readonly fetchImpl?: typeof fetch;
  }
): Promise<void> => {
  const projectUrl = normalizeProjectUrl(
    resolvedInterface.publicConfig.projectUrl,
    resolvedInterface.instanceId
  );
  const { serviceRoleKey } = readSupabaseSecrets(resolvedInterface, resolvedInterface.instanceId);

  let response: Response;
  try {
    response = await (deps.fetchImpl ?? fetch)(new URL('/storage/v1/bucket', projectUrl), {
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
    });
  } catch (error) {
    throw createRuntimeError(
      'rest_api_unreachable',
      resolvedInterface.instanceId,
      'supabase',
      error instanceof Error ? error.message : 'Die Supabase-HTTP-API ist nicht erreichbar.',
      true
    );
  }

  if (response.status === 401 || response.status === 403) {
    throw createRuntimeError(
      'service_role_key_invalid',
      resolvedInterface.instanceId,
      'supabase',
      'Der Service-Role-Key wurde von Supabase abgelehnt.'
    );
  }

  if (!response.ok) {
    throw createRuntimeError(
      'connection_failed',
      resolvedInterface.instanceId,
      'supabase',
      `Die Supabase-HTTP-API antwortete mit Status ${response.status}.`,
      true
    );
  }
};
