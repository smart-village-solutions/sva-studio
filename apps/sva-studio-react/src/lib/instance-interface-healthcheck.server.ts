import type { ExternalInterfaceConnectionCheckRecord, ResolvedExternalInterface } from '@sva/core';
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
import type { PoolLike } from './instance-interface-healthcheck-common.server.js';
import {
  createRuntimeError,
  resolveCheckedAt,
  toConnectionCheckRecord,
  withoutMapGeocodingErrorMessage,
} from './instance-interface-healthcheck-common.server.js';
import {
  verifySupabaseDatabase,
  verifyPostgresqlDatabase,
  verifySupabaseApi,
} from './instance-interface-healthcheck-database.server.js';
import { verifyS3Connection } from './instance-interface-healthcheck-s3.server.js';

const verifyMapGeocodingConnection = async (
  resolvedInterface: ResolvedExternalInterface,
  deps: { readonly fetchImpl?: typeof fetch }
): Promise<void> => {
  const provider = resolvedInterface.publicConfig.provider;
  if (provider !== 'geoapify') {
    throw createRuntimeError(
      'map_geocoding_provider_unsupported',
      resolvedInterface.instanceId,
      'map_geocoding',
      'Automatische Verbindungsprüfungen werden derzeit nur für Geoapify unterstützt.'
    );
  }

  const apiKey = resolvedInterface.secretConfig.apiKey?.trim();
  if (!apiKey) {
    throw createRuntimeError(
      'secret_missing',
      resolvedInterface.instanceId,
      'map_geocoding',
      'Für diese Karten-/Geocoding-Schnittstelle fehlt der API-Key.'
    );
  }

  const url = new URL('https://api.geoapify.com/v1/geocode/search');
  url.searchParams.set('text', 'Berlin');
  url.searchParams.set('type', 'city');
  url.searchParams.set('filter', 'countrycode:de');
  url.searchParams.set('limit', '1');
  url.searchParams.set('format', 'json');
  url.searchParams.set('apiKey', apiKey);

  const timeoutMs = Number(resolvedInterface.publicConfig.requestTimeoutMs) || 10_000;
  let response: Response;
  try {
    response = await (deps.fetchImpl ?? fetch)(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch {
    throw createRuntimeError(
      'map_geocoding_unreachable',
      resolvedInterface.instanceId,
      'map_geocoding',
      'Geoapify ist für die Verbindungsprüfung nicht erreichbar.',
      true
    );
  }

  if (!response.ok) {
    throw createRuntimeError(
      response.status === 401 || response.status === 403
        ? 'map_geocoding_auth_failed'
        : response.status === 429
          ? 'map_geocoding_rate_limited'
          : 'map_geocoding_provider_error',
      resolvedInterface.instanceId,
      'map_geocoding',
      response.status === 401 || response.status === 403
        ? 'Der Geoapify-API-Key wurde abgelehnt.'
        : `Geoapify antwortete bei der Verbindungsprüfung mit Status ${response.status}.`,
      response.status === 429 || response.status >= 500
    );
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
  if (
    !record ||
    (record.typeKey !== 'supabase' &&
      record.typeKey !== 'postgresql' &&
      record.typeKey !== 's3' &&
      record.typeKey !== 'map_geocoding')
  ) {
    return null;
  }

  const checkedAt = resolveCheckedAt(input.now);

  if (record.typeKey === 'map_geocoding' && record.publicConfig.killSwitchEnabled === true) {
    const result = toConnectionCheckRecord(
      record,
      createRuntimeError(
        'disabled',
        input.instanceId,
        record.typeKey,
        'Die Karten-/Geocoding-Schnittstelle ist per Kill-Switch deaktiviert.'
      ),
      checkedAt
    );
    const stableResult = withoutMapGeocodingErrorMessage(record, result);
    await saveExternalInterfaceConnectionCheck(stableResult);
    return stableResult;
  }

  try {
    const resolvedInterface = await resolveExternalInterface({
      instanceId: input.instanceId,
      typeKey: record.typeKey,
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

        if (entry.typeKey === 'postgresql') {
          await verifyPostgresqlDatabase(entry, input);
          return;
        }

        if (entry.typeKey === 'map_geocoding') {
          await verifyMapGeocodingConnection(entry, input);
          return;
        }

        await verifyS3Connection(entry);
      },
    });

    const stableResult = withoutMapGeocodingErrorMessage(record, result);
    await saveExternalInterfaceConnectionCheck(stableResult);
    return stableResult;
  } catch (error) {
    const runtimeError =
      error instanceof ExternalInterfaceRuntimeError
        ? error
        : createRuntimeError(
            'connection_failed',
            input.instanceId,
            record.typeKey,
            error instanceof Error
              ? error.message
              : 'Die Schnittstellenprüfung ist fehlgeschlagen.',
            true
          );
    const result = toConnectionCheckRecord(record, runtimeError, checkedAt);
    await saveExternalInterfaceConnectionCheck(result);
    return result;
  }
};
