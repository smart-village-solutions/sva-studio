import { Pool } from 'pg';
import { HeadBucketCommand, S3Client } from '@aws-sdk/client-s3';

import type {
  ExternalInterfaceConnectionCheckRecord,
  ExternalInterfaceRecord,
  ExternalInterfaceRuntimeErrorCode,
  ResolvedExternalInterface,
} from '@sva/core';
import {
  loadExternalInterfaceRecordById,
  saveExternalInterfaceConnectionCheck,
} from '@sva/data-repositories/server';
import { revealField } from '@sva/auth-runtime/server';
import {
  ExternalInterfaceRuntimeError,
  resolveExternalInterface,
  runExternalInterfaceConnectionCheck,
} from '@sva/server-runtime';

type PoolLike = Pick<Pool, 'query' | 'end'>;

const createPool = (connectionString: string): PoolLike =>
  new Pool({
    connectionString,
    max: 1,
    idleTimeoutMillis: 1_000,
    connectionTimeoutMillis: 5_000,
    allowExitOnIdle: true,
  });

const normalizeProjectUrl = (value: unknown, instanceId: string): URL => {
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

const createRuntimeError = (
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

const mapDatabaseError = (error: unknown, instanceId: string): ExternalInterfaceRuntimeError => {
  if (error instanceof ExternalInterfaceRuntimeError) {
    return error;
  }

  const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : undefined;
  if (code === '28P01') {
    return createRuntimeError(
      'database_auth_failed',
      instanceId,
      'supabase',
      'Die Datenbankverbindung wurde abgelehnt. Benutzername oder Passwort der DB-URL sind falsch.'
    );
  }

  if (code === 'ENOTFOUND' || code === 'ECONNREFUSED' || code === 'ETIMEDOUT' || code === 'EAI_AGAIN') {
    return createRuntimeError(
      'database_host_unreachable',
      instanceId,
      'supabase',
      'Der Datenbank-Host aus der DB-URL ist nicht erreichbar.',
      true
    );
  }

  return createRuntimeError(
    'connection_failed',
    instanceId,
    'supabase',
    error instanceof Error ? error.message : 'Die Datenbankprüfung ist fehlgeschlagen.',
    true
  );
};

const toConnectionCheckRecord = (
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
      : error.code === 'secret_missing' || error.code === 'database_url_missing' || error.code === 'service_role_key_missing'
        ? 'not_configured'
        : 'error',
  errorCode: error.code,
  errorMessage: error.message,
});

const readSupabaseSecrets = (resolvedInterface: ResolvedExternalInterface, instanceId: string) => {
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

const verifySupabaseDatabase = async (
  resolvedInterface: ResolvedExternalInterface,
  deps: {
    readonly createPool?: (connectionString: string) => PoolLike;
  }
): Promise<void> => {
  const { databaseUrl } = readSupabaseSecrets(resolvedInterface, resolvedInterface.instanceId);
  const pool = (deps.createPool ?? createPool)(databaseUrl);

  try {
    const schemaName =
      typeof resolvedInterface.publicConfig.schemaName === 'string' && resolvedInterface.publicConfig.schemaName.trim().length > 0
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
    throw mapDatabaseError(error, resolvedInterface.instanceId);
  } finally {
    await pool.end();
  }
};

const verifySupabaseApi = async (
  resolvedInterface: ResolvedExternalInterface,
  deps: {
    readonly fetchImpl?: typeof fetch;
  }
): Promise<void> => {
  const projectUrl = normalizeProjectUrl(resolvedInterface.publicConfig.projectUrl, resolvedInterface.instanceId);
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

const readS3Config = (resolvedInterface: ResolvedExternalInterface) => {
  const endpoint = typeof resolvedInterface.publicConfig.endpoint === 'string' ? resolvedInterface.publicConfig.endpoint.trim() : '';
  if (!endpoint) {
    throw createRuntimeError(
      'connection_failed',
      resolvedInterface.instanceId,
      's3',
      'Für diese S3-Schnittstelle fehlt die Endpoint-URL.'
    );
  }

  const bucket = typeof resolvedInterface.publicConfig.bucket === 'string' ? resolvedInterface.publicConfig.bucket.trim() : '';
  if (!bucket) {
    throw createRuntimeError(
      'bucket_missing',
      resolvedInterface.instanceId,
      's3',
      'Für diese S3-Schnittstelle fehlt der Bucket.'
    );
  }

  const accessKeyId =
    typeof resolvedInterface.publicConfig.accessKeyId === 'string' ? resolvedInterface.publicConfig.accessKeyId.trim() : '';
  if (!accessKeyId) {
    throw createRuntimeError(
      'connection_failed',
      resolvedInterface.instanceId,
      's3',
      'Für diese S3-Schnittstelle fehlt die Access-Key-ID.'
    );
  }

  const secretAccessKey = resolvedInterface.secretConfig.secretAccessKey?.trim();
  if (!secretAccessKey) {
    throw createRuntimeError(
      'secret_missing',
      resolvedInterface.instanceId,
      's3',
      'Für diese S3-Schnittstelle fehlt der Secret Access Key.'
    );
  }

  const region =
    typeof resolvedInterface.publicConfig.region === 'string' && resolvedInterface.publicConfig.region.trim().length > 0
      ? resolvedInterface.publicConfig.region.trim()
      : 'us-east-1';
  const forcePathStyle = resolvedInterface.publicConfig.forcePathStyle === true;

  return {
    endpoint,
    bucket,
    accessKeyId,
    secretAccessKey,
    region,
    forcePathStyle,
  };
};

const mapS3Error = (error: unknown, instanceId: string): ExternalInterfaceRuntimeError => {
  if (error instanceof ExternalInterfaceRuntimeError) {
    return error;
  }

  const name = typeof error === 'object' && error !== null && 'name' in error ? String(error.name) : undefined;
  const metadata =
    typeof error === 'object' && error !== null && '$metadata' in error ? Reflect.get(error, '$metadata') : undefined;
  const httpStatusCode =
    typeof metadata === 'object' && metadata !== null && 'httpStatusCode' in metadata
      ? Number(Reflect.get(metadata, 'httpStatusCode'))
      : undefined;
  const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : undefined;

  if (name === 'NotFound' || httpStatusCode === 404) {
    return createRuntimeError(
      'bucket_missing',
      instanceId,
      's3',
      'Der konfigurierte S3-Bucket wurde am Endpoint nicht gefunden.'
    );
  }

  if (name === 'InvalidAccessKeyId' || name === 'SignatureDoesNotMatch' || name === 'AccessDenied' || httpStatusCode === 401 || httpStatusCode === 403) {
    return createRuntimeError(
      's3_auth_failed',
      instanceId,
      's3',
      'Die S3-Zugangsdaten wurden vom Endpoint abgelehnt.'
    );
  }

  if (code === 'ENOTFOUND' || code === 'ECONNREFUSED' || code === 'ETIMEDOUT' || code === 'EAI_AGAIN') {
    return createRuntimeError(
      's3_endpoint_unreachable',
      instanceId,
      's3',
      'Der konfigurierte S3-Endpoint ist nicht erreichbar.',
      true
    );
  }

  return createRuntimeError(
    'connection_failed',
    instanceId,
    's3',
    error instanceof Error ? error.message : 'Die S3-Prüfung ist fehlgeschlagen.',
    true
  );
};

const verifyS3Connection = async (resolvedInterface: ResolvedExternalInterface): Promise<void> => {
  const config = readS3Config(resolvedInterface);
  const client = new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    forcePathStyle: config.forcePathStyle,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });

  try {
    await client.send(
      new HeadBucketCommand({
        Bucket: config.bucket,
      })
    );
  } catch (error) {
    throw mapS3Error(error, resolvedInterface.instanceId);
  }
};

export const runStoredInterfaceHealthcheck = async (
  input: {
    readonly instanceId: string;
    readonly interfaceId: string;
    readonly now?: () => Date | string;
  } & {
    readonly createPool?: (connectionString: string) => PoolLike;
    readonly fetchImpl?: typeof fetch;
  }
): Promise<ExternalInterfaceConnectionCheckRecord | null> => {
  const record = await loadExternalInterfaceRecordById(input.instanceId, input.interfaceId);
  if (!record || (record.typeKey !== 'supabase' && record.typeKey !== 's3')) {
    return null;
  }

  const checkedAt = typeof input.now?.() === 'string' ? (input.now?.() as string) : new Date().toISOString();

  try {
    const resolvedInterface = await resolveExternalInterface({
      instanceId: input.instanceId,
      typeKey: 'supabase',
      interfaceId: input.interfaceId,
      loadById: async () => record,
      revealSecret: (ciphertext, aad) => revealField(ciphertext, aad) ?? undefined,
    });

    const result = await runExternalInterfaceConnectionCheck({
      resolvedInterface,
      now: input.now,
      probe: async (entry) => {
        if (entry.typeKey === 'supabase') {
          await verifySupabaseDatabase(entry, input);
          await verifySupabaseApi(entry, input);
          return;
        }

        await verifyS3Connection(entry);
      },
    });

    await saveExternalInterfaceConnectionCheck(result);
    return result;
  } catch (error) {
    const runtimeError =
      error instanceof ExternalInterfaceRuntimeError
        ? error
        : createRuntimeError(
            'connection_failed',
            input.instanceId,
            record.typeKey,
            error instanceof Error ? error.message : 'Die Schnittstellenprüfung ist fehlgeschlagen.',
            true
          );
    const result = toConnectionCheckRecord(record, runtimeError, checkedAt);
    await saveExternalInterfaceConnectionCheck(result);
    return result;
  }
};
