import type {
  ExternalInterfaceConnectionCheckRecord,
  ExternalInterfaceRecord,
  ExternalInterfaceRuntimeErrorCode,
  ExternalInterfaceSettingsRecord,
  ResolvedExternalInterface,
} from '@sva/core';

export class ExternalInterfaceRuntimeError extends Error {
  readonly code: ExternalInterfaceRuntimeErrorCode;
  readonly instanceId: string;
  readonly typeKey: string;
  readonly retryable: boolean;

  constructor(input: {
    readonly code: ExternalInterfaceRuntimeErrorCode;
    readonly instanceId: string;
    readonly typeKey: string;
    readonly message: string;
    readonly retryable?: boolean;
  }) {
    super(input.message);
    this.name = 'ExternalInterfaceRuntimeError';
    this.code = input.code;
    this.instanceId = input.instanceId;
    this.typeKey = input.typeKey;
    this.retryable = input.retryable ?? false;
  }
}

export const buildExternalInterfaceSecretConfigAad = (interfaceId: string): string =>
  `iam.instance_external_interfaces.secret_config:${interfaceId}`;

const buildSecretConfigMarkers = (typeKey: string, configured: boolean): Record<string, boolean> => {
  if (!configured) {
    return {};
  }

  switch (typeKey) {
    case 's3':
      return { secretAccessKey: true };
    case 'supabase':
      return { databaseUrl: true, serviceRoleKey: true };
    case 'sva_mainserver':
      return {};
    default:
      return { secret: true };
  }
};

export const sanitizeExternalInterfaceRecord = (
  record: ExternalInterfaceRecord
): ExternalInterfaceSettingsRecord => ({
  id: record.id,
  instanceId: record.instanceId,
  typeKey: record.typeKey,
  ownerKind: record.ownerKind,
  ownerId: record.ownerId,
  displayName: record.displayName,
  alias: record.alias,
  enabled: record.enabled,
  isDefault: record.isDefault,
  category: record.category,
  baseUrl: record.baseUrl,
  authMode: record.authMode,
  statusCheckKind: record.statusCheckKind,
  visibleStatus: record.visibleStatus,
  lastCheckedAt: record.lastCheckedAt,
  lastCheckStatus: record.lastCheckStatus,
  lastCheckErrorCode: record.lastCheckErrorCode,
  lastCheckErrorMessage: record.lastCheckErrorMessage,
  createdAt: record.createdAt,
  updatedAt: record.updatedAt,
  publicConfig: record.publicConfig,
  secretConfigConfigured: buildSecretConfigMarkers(record.typeKey, Boolean(record.secretConfigCiphertext)),
});

const parseSecretConfig = (value: string, typeKey: string, instanceId: string): Record<string, string> => {
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(parsed).flatMap(([key, entryValue]) =>
        typeof entryValue === 'string' && entryValue.length > 0 ? [[key, entryValue]] : []
      )
    );
  } catch {
    throw new ExternalInterfaceRuntimeError({
      code: 'secret_unreadable',
      instanceId,
      typeKey,
      message: 'Die Secret-Konfiguration konnte serverseitig nicht gelesen werden.',
      retryable: true,
    });
  }
};

const resolveRecord = async (input: {
  readonly instanceId: string;
  readonly typeKey: string;
  readonly interfaceId?: string;
  readonly alias?: string;
  readonly loadById?: (instanceId: string, interfaceId: string) => Promise<ExternalInterfaceRecord | null>;
  readonly loadByAlias?: (instanceId: string, typeKey: string, alias: string) => Promise<ExternalInterfaceRecord | null>;
  readonly loadDefault?: (instanceId: string, typeKey: string) => Promise<ExternalInterfaceRecord | null>;
}): Promise<ExternalInterfaceRecord | null> => {
  if (input.interfaceId) {
    return (await input.loadById?.(input.instanceId, input.interfaceId)) ?? null;
  }

  if (input.alias) {
    return (await input.loadByAlias?.(input.instanceId, input.typeKey, input.alias)) ?? null;
  }

  return (await input.loadDefault?.(input.instanceId, input.typeKey)) ?? null;
};

export const resolveExternalInterface = async (input: {
  readonly instanceId: string;
  readonly typeKey: string;
  readonly interfaceId?: string;
  readonly alias?: string;
  readonly loadById?: (instanceId: string, interfaceId: string) => Promise<ExternalInterfaceRecord | null>;
  readonly loadByAlias?: (instanceId: string, typeKey: string, alias: string) => Promise<ExternalInterfaceRecord | null>;
  readonly loadDefault?: (instanceId: string, typeKey: string) => Promise<ExternalInterfaceRecord | null>;
  readonly revealSecret: (ciphertext: string | null | undefined, aad: string) => string | undefined;
}): Promise<ResolvedExternalInterface> => {
  const record = await resolveRecord(input);

  if (!record) {
    throw new ExternalInterfaceRuntimeError({
      code: input.interfaceId || input.alias ? 'not_configured' : 'default_missing',
      instanceId: input.instanceId,
      typeKey: input.typeKey,
      message: 'Für diese Instanz ist keine passende Schnittstelle konfiguriert.',
    });
  }

  if (!record.enabled) {
    throw new ExternalInterfaceRuntimeError({
      code: 'disabled',
      instanceId: input.instanceId,
      typeKey: input.typeKey,
      message: 'Die gewählte Schnittstelle ist deaktiviert.',
    });
  }

  if (!record.secretConfigCiphertext) {
    throw new ExternalInterfaceRuntimeError({
      code: 'secret_missing',
      instanceId: input.instanceId,
      typeKey: input.typeKey,
      message: 'Für diese Schnittstelle fehlen erforderliche Secrets.',
    });
  }

  const revealed = input.revealSecret(
    record.secretConfigCiphertext,
    buildExternalInterfaceSecretConfigAad(record.id)
  );

  if (!revealed) {
    throw new ExternalInterfaceRuntimeError({
      code: 'secret_unreadable',
      instanceId: input.instanceId,
      typeKey: input.typeKey,
      message: 'Die Secret-Konfiguration konnte serverseitig nicht entschlüsselt werden.',
      retryable: true,
    });
  }

  return {
    ...record,
    secretConfig: parseSecretConfig(revealed, input.typeKey, input.instanceId),
  };
};

const asIsoTimestamp = (now: Date | string): string => (typeof now === 'string' ? now : now.toISOString());

export const runExternalInterfaceConnectionCheck = async (input: {
  readonly resolvedInterface: ResolvedExternalInterface;
  readonly probe: (resolvedInterface: ResolvedExternalInterface) => Promise<void>;
  readonly now?: () => Date | string;
  readonly mapError?: (error: unknown) => { readonly code: string; readonly message?: string };
}): Promise<ExternalInterfaceConnectionCheckRecord> => {
  const checkedAt = asIsoTimestamp((input.now ?? (() => new Date()))());

  try {
    await input.probe(input.resolvedInterface);
    return {
      instanceId: input.resolvedInterface.instanceId,
      interfaceId: input.resolvedInterface.id,
      checkedAt,
      checkStatus: 'succeeded',
      visibleStatus: 'ok',
    };
  } catch (error) {
    const mapped =
      error instanceof ExternalInterfaceRuntimeError
        ? { code: error.code, message: error.message }
        : input.mapError?.(error) ?? {
            code: 'connection_failed',
            message: error instanceof Error ? error.message : 'Connection-Check fehlgeschlagen.',
          };

    return {
      instanceId: input.resolvedInterface.instanceId,
      interfaceId: input.resolvedInterface.id,
      checkedAt,
      checkStatus: 'failed',
      visibleStatus: 'error',
      errorCode: mapped.code,
      errorMessage: mapped.message,
    };
  }
};
