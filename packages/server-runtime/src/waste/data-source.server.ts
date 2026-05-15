import type {
  ExternalInterfaceRecord,
  ExternalInterfaceRuntimeErrorCode,
  WasteManagementDataSourceStatus,
} from '@sva/core';
import { ExternalInterfaceRuntimeError, resolveExternalInterface } from '../external-interfaces.server.js';

export type WasteRuntimeErrorCode =
  | 'not_configured'
  | 'disabled'
  | 'database_url_missing'
  | 'service_role_key_missing'
  | 'database_url_unreadable'
  | 'service_role_key_unreadable'
  | 'connection_failed';

export class WasteRuntimeError extends Error {
  readonly code: WasteRuntimeErrorCode;
  readonly instanceId: string;
  readonly retryable: boolean;

  constructor(input: {
    readonly code: WasteRuntimeErrorCode;
    readonly instanceId: string;
    readonly message: string;
    readonly retryable?: boolean;
  }) {
    super(input.message);
    this.name = 'WasteRuntimeError';
    this.code = input.code;
    this.instanceId = input.instanceId;
    this.retryable = input.retryable ?? false;
  }
}

export type ResolvedWasteDataSource = {
  readonly instanceId: string;
  readonly provider: 'supabase';
  readonly projectUrl: string;
  readonly schemaName: string;
  readonly enabled: boolean;
  readonly databaseUrl: string;
  readonly serviceRoleKey: string;
  readonly visibleStatus: WasteManagementDataSourceStatus;
  readonly lastCheckedAt?: string;
  readonly lastCheckStatus?: ExternalInterfaceRecord['lastCheckStatus'];
};

const normalizeInterfaceWasteVisibleStatus = (
  status: ExternalInterfaceRecord['visibleStatus']
): WasteManagementDataSourceStatus => (status === 'disabled' ? 'unknown' : status);

export const resolveWasteDataSource = async (input: {
  readonly instanceId: string;
  readonly loadDefaultInterface?: (instanceId: string, typeKey: string) => Promise<ExternalInterfaceRecord | null>;
  readonly revealSecret: (ciphertext: string | null | undefined, aad: string) => string | undefined;
}): Promise<ResolvedWasteDataSource> => {
  if (!input.loadDefaultInterface) {
    throw new WasteRuntimeError({
      code: 'not_configured',
      instanceId: input.instanceId,
      message: 'Für diese Instanz ist keine Waste-Supabase-Schnittstelle konfiguriert.',
    });
  }

  const mapExternalErrorCode = (code: ExternalInterfaceRuntimeErrorCode): WasteRuntimeErrorCode => {
    switch (code) {
      case 'disabled':
        return 'disabled';
      case 'secret_unreadable':
        return 'database_url_unreadable';
      case 'secret_missing':
        return 'database_url_missing';
      case 'default_missing':
      case 'not_configured':
      default:
        return 'not_configured';
    }
  };

  let resolvedInterface;
  try {
    resolvedInterface = await resolveExternalInterface({
      instanceId: input.instanceId,
      typeKey: 'supabase',
      loadDefault: input.loadDefaultInterface,
      revealSecret: input.revealSecret,
    });
  } catch (error) {
    if (error instanceof ExternalInterfaceRuntimeError) {
      throw new WasteRuntimeError({
        code: mapExternalErrorCode(error.code),
        instanceId: input.instanceId,
        message:
          error.code === 'default_missing' || error.code === 'not_configured'
            ? 'Für diese Instanz ist keine Waste-Supabase-Schnittstelle konfiguriert.'
            : error.message,
        retryable: error.retryable,
      });
    }
    throw error;
  }

  const databaseUrl = resolvedInterface.secretConfig.databaseUrl?.trim();
  if (!databaseUrl) {
    throw new WasteRuntimeError({
      code: 'database_url_missing',
      instanceId: input.instanceId,
      message: 'Für diese Waste-Datenquelle fehlt die Datenbankverbindung.',
    });
  }
  const serviceRoleKey = resolvedInterface.secretConfig.serviceRoleKey?.trim();
  if (!serviceRoleKey) {
    throw new WasteRuntimeError({
      code: 'service_role_key_missing',
      instanceId: input.instanceId,
      message: 'Für diese Waste-Datenquelle fehlt der Service-Role-Schlüssel.',
    });
  }

  return {
    instanceId: resolvedInterface.instanceId,
    provider: 'supabase',
    projectUrl:
      typeof resolvedInterface.publicConfig.projectUrl === 'string' ? resolvedInterface.publicConfig.projectUrl : '',
    schemaName:
      typeof resolvedInterface.publicConfig.schemaName === 'string' &&
      resolvedInterface.publicConfig.schemaName.trim().length > 0
        ? resolvedInterface.publicConfig.schemaName
        : 'public',
    enabled: resolvedInterface.enabled,
    databaseUrl,
    serviceRoleKey,
    visibleStatus: normalizeInterfaceWasteVisibleStatus(resolvedInterface.visibleStatus),
    lastCheckedAt: resolvedInterface.lastCheckedAt,
    lastCheckStatus: resolvedInterface.lastCheckStatus,
  };
};

const asIsoTimestamp = (now: Date | string): string => (typeof now === 'string' ? now : now.toISOString());

export const runWasteConnectionCheck = async (input: {
  readonly dataSource: ResolvedWasteDataSource;
  readonly probe: (dataSource: ResolvedWasteDataSource) => Promise<void>;
  readonly now?: () => Date | string;
  readonly mapError?: (error: unknown) => { readonly code: string; readonly message?: string };
}): Promise<{
  readonly instanceId: string;
  readonly interfaceId?: string;
  readonly checkedAt: string;
  readonly checkStatus: 'succeeded' | 'failed';
  readonly visibleStatus: 'ok' | 'error';
  readonly errorCode?: string;
  readonly errorMessage?: string;
}> => {
  const checkedAt = asIsoTimestamp((input.now ?? (() => new Date()))());

  try {
    await input.probe(input.dataSource);
    return {
      instanceId: input.dataSource.instanceId,
      checkedAt,
      checkStatus: 'succeeded',
      visibleStatus: 'ok',
    };
  } catch (error) {
    const mapped =
      error instanceof WasteRuntimeError
        ? { code: error.code, message: error.message }
        : input.mapError?.(error) ?? {
            code: 'connection_failed',
            message: error instanceof Error ? error.message : 'Connection-Check fehlgeschlagen.',
          };

    return {
      instanceId: input.dataSource.instanceId,
      checkedAt,
      checkStatus: 'failed',
      visibleStatus: 'error',
      errorCode: mapped.code,
      errorMessage: mapped.message,
    };
  }
};
