import type {
  WasteManagementConnectionCheckRecord,
  WasteManagementDataSourceRecord,
  WasteManagementDataSourceStatus,
} from '@sva/core';

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
  readonly provider: WasteManagementDataSourceRecord['provider'];
  readonly projectUrl: string;
  readonly schemaName: string;
  readonly enabled: boolean;
  readonly databaseUrl: string;
  readonly serviceRoleKey: string;
  readonly visibleStatus: WasteManagementDataSourceStatus;
  readonly lastCheckedAt?: string;
  readonly lastCheckStatus?: WasteManagementDataSourceRecord['lastCheckStatus'];
};

export const buildWasteDatabaseUrlAad = (instanceId: string): string =>
  `iam.instance_waste_data_sources.database_url:${instanceId}`;

export const buildWasteServiceRoleKeyAad = (instanceId: string): string =>
  `iam.instance_waste_data_sources.service_role_key:${instanceId}`;

export const resolveWasteDataSource = async (input: {
  readonly instanceId: string;
  readonly loadRecord: (instanceId: string) => Promise<WasteManagementDataSourceRecord | null>;
  readonly revealSecret: (ciphertext: string | null | undefined, aad: string) => string | undefined;
}): Promise<ResolvedWasteDataSource> => {
  const record = await input.loadRecord(input.instanceId);

  if (!record) {
    throw new WasteRuntimeError({
      code: 'not_configured',
      instanceId: input.instanceId,
      message: 'Für diese Instanz ist keine Waste-Datenquelle konfiguriert.',
    });
  }

  if (!record.enabled) {
    throw new WasteRuntimeError({
      code: 'disabled',
      instanceId: input.instanceId,
      message: 'Die Waste-Datenquelle dieser Instanz ist deaktiviert.',
    });
  }

  if (!record.databaseUrlCiphertext) {
    throw new WasteRuntimeError({
      code: 'database_url_missing',
      instanceId: input.instanceId,
      message: 'Für diese Waste-Datenquelle fehlt die Datenbankverbindung.',
    });
  }

  if (!record.serviceRoleKeyCiphertext) {
    throw new WasteRuntimeError({
      code: 'service_role_key_missing',
      instanceId: input.instanceId,
      message: 'Für diese Waste-Datenquelle fehlt der Service-Role-Schlüssel.',
    });
  }

  const databaseUrl = input.revealSecret(record.databaseUrlCiphertext, buildWasteDatabaseUrlAad(input.instanceId));
  if (!databaseUrl) {
    throw new WasteRuntimeError({
      code: 'database_url_unreadable',
      instanceId: input.instanceId,
      message: 'Die Waste-Datenbankverbindung konnte serverseitig nicht entschlüsselt werden.',
      retryable: true,
    });
  }

  const serviceRoleKey = input.revealSecret(
    record.serviceRoleKeyCiphertext,
    buildWasteServiceRoleKeyAad(input.instanceId)
  );
  if (!serviceRoleKey) {
    throw new WasteRuntimeError({
      code: 'service_role_key_unreadable',
      instanceId: input.instanceId,
      message: 'Der Waste-Service-Role-Schlüssel konnte serverseitig nicht entschlüsselt werden.',
      retryable: true,
    });
  }

  return {
    instanceId: record.instanceId,
    provider: record.provider,
    projectUrl: record.projectUrl,
    schemaName: record.schemaName,
    enabled: record.enabled,
    databaseUrl,
    serviceRoleKey,
    visibleStatus: record.visibleStatus,
    lastCheckedAt: record.lastCheckedAt,
    lastCheckStatus: record.lastCheckStatus,
  };
};

const asIsoTimestamp = (now: Date | string): string => (typeof now === 'string' ? now : now.toISOString());

export const runWasteConnectionCheck = async (input: {
  readonly dataSource: ResolvedWasteDataSource;
  readonly probe: (dataSource: ResolvedWasteDataSource) => Promise<void>;
  readonly now?: () => Date | string;
  readonly mapError?: (error: unknown) => { readonly code: string; readonly message?: string };
}): Promise<WasteManagementConnectionCheckRecord> => {
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
