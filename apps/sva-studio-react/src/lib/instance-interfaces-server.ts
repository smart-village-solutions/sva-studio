import { randomUUID } from 'node:crypto';

import type {
  ExternalInterfaceRecord,
  ExternalInterfaceVisibleStatus,
  MailTransportAuthMode,
  MailTransportSecurityMode,
} from '@sva/core';
import { mailTransportContract } from '@sva/core';
import {
  deleteExternalInterfaceRecord,
  listExternalInterfaceRecords,
  loadDefaultExternalInterfaceRecord,
  loadExternalInterfaceRecordById,
  saveExternalInterfaceRecord,
} from '@sva/data-repositories/server';
import { protectField, revealField } from '@sva/auth-runtime/server';
import { buildExternalInterfaceSecretConfigAad, createSdkLogger } from '@sva/server-runtime';

import type {
  InstanceInterfaceDraft,
  InstanceInterfaceMapGeocoding,
  InstanceInterfaceMailTransport,
  InstanceInterfaceS3,
  InstanceInterfaceSupabase,
} from './instance-interfaces';

export type StoredMapGeocodingRuntimeConfig = Readonly<{
  id: string;
  instanceId: string;
  enabled: boolean;
  provider: 'geoapify' | 'custom';
  styleUrl: string;
  autocompleteEnabled: boolean;
  geocodeEnabled: boolean;
  reverseGeocodeEnabled: boolean;
  suggestEndpoint: string;
  geocodeEndpoint: string;
  reverseGeocodeEndpoint: string;
  requestTimeoutMs: string;
  rateLimitPerMinute: string;
  killSwitchEnabled: boolean;
  apiKey?: string;
}>;

type StoredS3 = Omit<InstanceInterfaceS3, 'status' | 'statusMessage' | 'errorCode' | 'lastCheckedAt'>;
type StoredSupabase = Omit<InstanceInterfaceSupabase, 'status' | 'statusMessage' | 'errorCode' | 'lastCheckedAt'>;
type StoredMailTransport = Omit<
  InstanceInterfaceMailTransport,
  'status' | 'statusMessage' | 'errorCode' | 'lastCheckedAt'
>;
type StoredMapGeocoding = Omit<
  InstanceInterfaceMapGeocoding,
  'status' | 'statusMessage' | 'errorCode' | 'lastCheckedAt'
>;

type StoredEntry = StoredS3 | StoredSupabase | StoredMailTransport | StoredMapGeocoding;
type StoredInterfaceType = StoredEntry['type'];

const logger = createSdkLogger({ component: 'instance-interfaces-server' });

type PersistedStoredEntry = StoredEntry & Readonly<{
  visibleStatus?: ExternalInterfaceVisibleStatus;
  lastCheckedAt?: string;
  lastCheckErrorCode?: string;
  lastCheckErrorMessage?: string;
}>;
const nowIso = (): string => new Date().toISOString();
const coerceText = (value: unknown): string => (typeof value === 'string' ? value : '');
const coerceBoolean = (value: unknown): boolean => value === true;
const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const parseSecretConfig = (ciphertext: string | undefined, interfaceId: string): Record<string, string> => {
  if (ciphertext === undefined) {
    return {};
  }

  const revealed = revealField(ciphertext, buildExternalInterfaceSecretConfigAad(interfaceId));
  if (!revealed) {
    throw new Error('secret_unreadable');
  }

  try {
    const parsed = JSON.parse(revealed) as unknown;
    if (!isPlainObject(parsed)) {
      throw new Error('secret_unreadable');
    }
    return Object.fromEntries(
      Object.entries(parsed).flatMap(([key, value]) =>
        typeof value === 'string' && value.length > 0 ? [[key, value]] : []
      )
    );
  } catch {
    throw new Error('secret_unreadable');
  }
};

const mapStoredTypeToKey = (
  type: StoredInterfaceType
): 's3' | 'supabase' | 'mail_transport' | 'map_geocoding' =>
  type === 'mailTransport' ? 'mail_transport' : type === 'mapGeocoding' ? 'map_geocoding' : type;

const coerceOptionalText = (value: unknown): string =>
  typeof value === 'string' ? value : '';

const coerceOptionalNumberString = (value: unknown): string =>
  typeof value === 'number' && Number.isFinite(value) ? String(value) : '';

const coerceMailSecurityMode = (value: unknown): MailTransportSecurityMode =>
  typeof value === 'string' && mailTransportContract.isSecurityMode(value) ? value : 'starttls';

const coerceMailAuthMode = (value: unknown): MailTransportAuthMode =>
  typeof value === 'string' && mailTransportContract.isAuthMode(value) ? value : 'basic';

const mapVisibleStatusToHealth = (
  visibleStatus: ExternalInterfaceVisibleStatus | undefined
): InterfaceHealthResult['status'] => {
  switch (visibleStatus) {
    case 'disabled':
      return 'disabled';
    case 'ok':
      return 'connected';
    case 'error':
    case 'not_configured':
      return 'error';
    default:
      return 'unknown';
  }
};

const mapRecordToStoredEntry = (record: ExternalInterfaceRecord): PersistedStoredEntry | null => {
  const createdAt = record.createdAt ?? nowIso();
  const updatedAt = record.updatedAt ?? createdAt;

  if (record.typeKey === 's3') {
    return {
      id: record.id,
      instanceId: record.instanceId,
      type: 's3',
      name: record.displayName,
      enabled: record.enabled,
      config: {
        endpoint: coerceText(record.publicConfig.endpoint),
        region: coerceText(record.publicConfig.region),
        bucket: coerceText(record.publicConfig.bucket),
        accessKeyId: coerceText(record.publicConfig.accessKeyId),
        forcePathStyle: coerceBoolean(record.publicConfig.forcePathStyle),
      },
      createdAt,
      updatedAt,
      visibleStatus: record.visibleStatus,
      lastCheckedAt: record.lastCheckedAt,
      lastCheckErrorCode: record.lastCheckErrorCode,
      lastCheckErrorMessage: record.lastCheckErrorMessage,
    };
  }

  if (record.typeKey === 'supabase') {
    return {
      id: record.id,
      instanceId: record.instanceId,
      type: 'supabase',
      name: record.displayName,
      enabled: record.enabled,
      config: {
        projectUrl: coerceText(record.publicConfig.projectUrl),
        schemaName: coerceText(record.publicConfig.schemaName) || 'public',
        databaseUrl: '',
      },
      createdAt,
      updatedAt,
      visibleStatus: record.visibleStatus,
      lastCheckedAt: record.lastCheckedAt,
      lastCheckErrorCode: record.lastCheckErrorCode,
      lastCheckErrorMessage: record.lastCheckErrorMessage,
    };
  }

  if (record.typeKey === 'mail_transport') {
    return {
      id: record.id,
      instanceId: record.instanceId,
      type: 'mailTransport',
      name: record.displayName,
      enabled: record.enabled,
      config: {
        transportId: coerceText(record.publicConfig.transportId),
        host: coerceText(record.publicConfig.host) || coerceOptionalText(record.publicConfig.endpoint),
        port:
          typeof record.publicConfig.port === 'string'
            ? record.publicConfig.port
            : coerceOptionalNumberString(record.publicConfig.port),
        securityMode: coerceMailSecurityMode(record.publicConfig.securityMode),
        authMode: coerceMailAuthMode(record.publicConfig.authMode),
        username: coerceOptionalText(record.publicConfig.username),
        defaultFromEmail: coerceOptionalText(record.publicConfig.defaultFromEmail),
        defaultFromName: coerceOptionalText(record.publicConfig.defaultFromName),
        defaultReplyToEmail: coerceOptionalText(record.publicConfig.defaultReplyToEmail),
        maxBatchSize: coerceOptionalNumberString(record.publicConfig.maxBatchSize),
        rateLimitPerMinute: coerceOptionalNumberString(record.publicConfig.rateLimitPerMinute),
      },
      createdAt,
      updatedAt,
      visibleStatus: record.visibleStatus,
      lastCheckedAt: record.lastCheckedAt,
      lastCheckErrorCode: record.lastCheckErrorCode,
      lastCheckErrorMessage: record.lastCheckErrorMessage,
    };
  }

  if (record.typeKey === 'map_geocoding') {
    return {
      id: record.id,
      instanceId: record.instanceId,
      type: 'mapGeocoding',
      name: record.displayName,
      enabled: record.enabled,
      config: {
        provider: coerceText(record.publicConfig.provider) === 'custom' ? 'custom' : 'geoapify',
        styleUrl: coerceText(record.publicConfig.styleUrl),
        autocompleteEnabled: coerceBoolean(record.publicConfig.autocompleteEnabled),
        geocodeEnabled: coerceBoolean(record.publicConfig.geocodeEnabled),
        reverseGeocodeEnabled: coerceBoolean(record.publicConfig.reverseGeocodeEnabled),
        suggestEndpoint: coerceText(record.publicConfig.suggestEndpoint),
        geocodeEndpoint: coerceText(record.publicConfig.geocodeEndpoint),
        reverseGeocodeEndpoint: coerceText(record.publicConfig.reverseGeocodeEndpoint),
        requestTimeoutMs:
          typeof record.publicConfig.requestTimeoutMs === 'string'
            ? record.publicConfig.requestTimeoutMs
            : coerceOptionalNumberString(record.publicConfig.requestTimeoutMs),
        rateLimitPerMinute:
          typeof record.publicConfig.rateLimitPerMinute === 'string'
            ? record.publicConfig.rateLimitPerMinute
            : coerceOptionalNumberString(record.publicConfig.rateLimitPerMinute),
        killSwitchEnabled: coerceBoolean(record.publicConfig.killSwitchEnabled),
      },
      createdAt,
      updatedAt,
      visibleStatus: record.visibleStatus,
      lastCheckedAt: record.lastCheckedAt,
      lastCheckErrorCode: record.lastCheckErrorCode,
      lastCheckErrorMessage: record.lastCheckErrorMessage,
    };
  }

  return null;
};

const buildSecretCiphertext = (input: {
  readonly interfaceId: string;
  readonly secretConfig: Record<string, string>;
}): string | undefined => {
  if (Object.keys(input.secretConfig).length === 0) {
    return undefined;
  }

  const ciphertext = protectField(
    JSON.stringify(input.secretConfig),
    buildExternalInterfaceSecretConfigAad(input.interfaceId)
  );
  return ciphertext ?? undefined;
};

const resolveVisibleStatus = (
  enabled: boolean,
  existingVisibleStatus: ExternalInterfaceVisibleStatus | undefined
): ExternalInterfaceVisibleStatus => {
  if (!enabled) {
    return 'disabled';
  }

  if (!existingVisibleStatus || existingVisibleStatus === 'disabled') {
    return 'unknown';
  }

  return existingVisibleStatus;
};

const buildS3Record = (input: {
  readonly instanceId: string;
  readonly draft: Extract<InstanceInterfaceDraft, { type: 's3' }>;
  readonly interfaceId: string;
  readonly existing: ExternalInterfaceRecord | null;
  readonly hasDefaultRecord: boolean;
  readonly previousSecrets: Record<string, string>;
}): ExternalInterfaceRecord => {
  const nextSecretAccessKey = input.draft.config.secretAccessKey || input.previousSecrets.secretAccessKey || '';
  const existingPublicConfig = input.existing?.publicConfig ?? {};

  return {
    id: input.interfaceId,
    instanceId: input.instanceId,
    typeKey: 's3',
    ownerKind: 'host',
    ownerId: 'host',
    displayName: input.draft.name.trim(),
    alias: input.existing?.alias ?? input.interfaceId,
    enabled: input.draft.enabled,
    isDefault: input.existing?.isDefault ?? !input.hasDefaultRecord,
    category: 'object_storage',
    baseUrl: input.draft.config.endpoint.trim(),
    authMode: 'access_key',
    publicConfig: {
      ...existingPublicConfig,
      endpoint: input.draft.config.endpoint.trim(),
      region: input.draft.config.region.trim(),
      bucket: input.draft.config.bucket.trim(),
      accessKeyId: input.draft.config.accessKeyId.trim(),
      forcePathStyle: input.draft.config.forcePathStyle,
    },
    secretConfigCiphertext: buildSecretCiphertext({
      interfaceId: input.interfaceId,
      secretConfig: nextSecretAccessKey ? { secretAccessKey: nextSecretAccessKey } : {},
    }),
    statusCheckKind: 's3',
    visibleStatus: resolveVisibleStatus(input.draft.enabled, input.existing?.visibleStatus),
    lastCheckedAt: input.existing?.lastCheckedAt,
    lastCheckStatus: input.existing?.lastCheckStatus,
    lastCheckErrorCode: input.existing?.lastCheckErrorCode,
    lastCheckErrorMessage: input.existing?.lastCheckErrorMessage,
    createdAt: input.existing?.createdAt,
    updatedAt: input.existing?.updatedAt,
  };
};

const buildSupabaseRecord = (input: {
  readonly instanceId: string;
  readonly draft: Extract<InstanceInterfaceDraft, { type: 'supabase' }>;
  readonly interfaceId: string;
  readonly existing: ExternalInterfaceRecord | null;
  readonly hasDefaultRecord: boolean;
  readonly previousSecrets: Record<string, string>;
}): ExternalInterfaceRecord => {
  const nextSecretConfig = {
    databaseUrl: input.draft.config.databaseUrl || input.previousSecrets.databaseUrl || '',
    serviceRoleKey: input.draft.config.serviceRoleKey || input.previousSecrets.serviceRoleKey || '',
  };
  const existingPublicConfig = input.existing?.publicConfig ?? {};

  return {
    id: input.interfaceId,
    instanceId: input.instanceId,
    typeKey: 'supabase',
    ownerKind: 'host',
    ownerId: 'host',
    displayName: input.draft.name.trim(),
    alias: input.existing?.alias ?? input.interfaceId,
    enabled: input.draft.enabled,
    isDefault: input.existing?.isDefault ?? !input.hasDefaultRecord,
    category: 'database',
    baseUrl: input.draft.config.projectUrl.trim(),
    authMode: 'service_role',
    publicConfig: {
      ...existingPublicConfig,
      projectUrl: input.draft.config.projectUrl.trim(),
      schemaName: input.draft.config.schemaName.trim() || 'public',
    },
    secretConfigCiphertext: buildSecretCiphertext({
      interfaceId: input.interfaceId,
      secretConfig: Object.fromEntries(
        Object.entries(nextSecretConfig).flatMap(([key, value]) => (value ? [[key, value]] : []))
      ),
    }),
    statusCheckKind: 'supabase',
    visibleStatus: resolveVisibleStatus(input.draft.enabled, input.existing?.visibleStatus),
    lastCheckedAt: input.existing?.lastCheckedAt,
    lastCheckStatus: input.existing?.lastCheckStatus,
    lastCheckErrorCode: input.existing?.lastCheckErrorCode,
    lastCheckErrorMessage: input.existing?.lastCheckErrorMessage,
    createdAt: input.existing?.createdAt,
    updatedAt: input.existing?.updatedAt,
  };
};

const parseOptionalPositiveInteger = (value: string): number | undefined => {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }
  const parsed = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error('invalid_config');
  }
  return parsed;
};

const parseRequiredPort = (value: string): number => {
  const parsed = parseOptionalPositiveInteger(value);
  if (parsed === undefined) {
    throw new Error('invalid_config');
  }
  return parsed;
};

const trimToUndefined = (value: string): string | undefined => {
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
};

const isValidAbsoluteHttpUrl = (value: string): boolean => {
  const trimmed = value.trim();
  if (!trimmed) {
    return false;
  }

  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
};

const isObviouslyUrlLikeMailHost = (value: string): boolean => {
  const trimmed = value.trim();
  return trimmed.includes('://') || trimmed.includes('/') || trimmed.includes('?') || trimmed.includes('#');
};

const assertValidMailTransportDraft = (
  draft: Extract<InstanceInterfaceDraft, { type: 'mailTransport' }>,
  input: { readonly displayName: string; readonly transportId: string; readonly nextPassword: string }
): void => {
  const validationRules = [
    !input.transportId || !input.displayName,
    !mailTransportContract.isSecurityMode(draft.config.securityMode),
    !mailTransportContract.isAuthMode(draft.config.authMode),
    draft.config.authMode === 'basic' && !input.nextPassword.trim(),
    draft.config.authMode === 'basic' && !draft.config.username.trim(),
    !draft.config.host.trim(),
    isObviouslyUrlLikeMailHost(draft.config.host),
  ];

  if (validationRules.some(Boolean)) {
    throw new Error('invalid_config');
  }
};

const buildMailTransportPublicConfig = (input: {
  readonly draft: Extract<InstanceInterfaceDraft, { type: 'mailTransport' }>;
  readonly existingPublicConfig: ExternalInterfaceRecord['publicConfig'];
  readonly transportId: string;
  readonly port: number | undefined;
  readonly maxBatchSize: number | undefined;
  readonly rateLimitPerMinute: number | undefined;
}): ExternalInterfaceRecord['publicConfig'] => {
  const nextPublicConfig = { ...input.existingPublicConfig };
  for (const key of [
    'username',
    'defaultFromEmail',
    'defaultFromName',
    'defaultReplyToEmail',
    'maxBatchSize',
    'rateLimitPerMinute',
    'host',
    'port',
    'endpoint',
    'mode',
    'transportType',
  ] as const) {
    delete nextPublicConfig[key];
  }

  const optionalFields = {
    username: trimToUndefined(input.draft.config.username),
    defaultFromEmail: trimToUndefined(input.draft.config.defaultFromEmail),
    defaultFromName: trimToUndefined(input.draft.config.defaultFromName),
    defaultReplyToEmail: trimToUndefined(input.draft.config.defaultReplyToEmail),
    maxBatchSize: input.maxBatchSize,
    rateLimitPerMinute: input.rateLimitPerMinute,
  };

  return {
    ...nextPublicConfig,
    transportId: input.transportId,
    transportType: 'smtp',
    securityMode: input.draft.config.securityMode,
    authMode: input.draft.config.authMode,
    ...Object.fromEntries(Object.entries(optionalFields).flatMap(([key, value]) => (value !== undefined ? [[key, value]] : []))),
    host: input.draft.config.host.trim(),
    port: input.port,
  };
};

const buildMailTransportRecord = (input: {
  readonly instanceId: string;
  readonly draft: Extract<InstanceInterfaceDraft, { type: 'mailTransport' }>;
  readonly interfaceId: string;
  readonly existing: ExternalInterfaceRecord | null;
  readonly hasDefaultRecord: boolean;
  readonly previousSecrets: Record<string, string>;
}): ExternalInterfaceRecord => {
  const transportId = input.draft.config.transportId.trim();
  const displayName = input.draft.name.trim();
  const nextPassword = input.draft.config.password || input.previousSecrets.password || '';
  assertValidMailTransportDraft(input.draft, { displayName, transportId, nextPassword });

  const port = parseRequiredPort(input.draft.config.port);
  const maxBatchSize = parseOptionalPositiveInteger(input.draft.config.maxBatchSize);
  const rateLimitPerMinute = parseOptionalPositiveInteger(input.draft.config.rateLimitPerMinute);
  const existingPublicConfig = input.existing?.publicConfig ?? {};

  return {
    id: input.interfaceId,
    instanceId: input.instanceId,
    typeKey: 'mail_transport',
    ownerKind: 'host',
    ownerId: 'host',
    displayName,
    alias: transportId,
    enabled: input.draft.enabled,
    isDefault: input.existing?.isDefault ?? !input.hasDefaultRecord,
    category: 'api',
    baseUrl: input.draft.config.host.trim(),
    authMode: input.draft.config.authMode,
    publicConfig: buildMailTransportPublicConfig({
      draft: input.draft,
      existingPublicConfig,
      transportId,
      port,
      maxBatchSize,
      rateLimitPerMinute,
    }),
    secretConfigCiphertext: buildSecretCiphertext({
      interfaceId: input.interfaceId,
      secretConfig: nextPassword.trim() ? { password: nextPassword.trim() } : {},
    }),
    statusCheckKind: 'mail_transport',
    visibleStatus: resolveVisibleStatus(input.draft.enabled, input.existing?.visibleStatus),
    lastCheckedAt: input.existing?.lastCheckedAt,
    lastCheckStatus: input.existing?.lastCheckStatus,
    lastCheckErrorCode: input.existing?.lastCheckErrorCode,
    lastCheckErrorMessage: input.existing?.lastCheckErrorMessage,
    createdAt: input.existing?.createdAt,
    updatedAt: input.existing?.updatedAt,
  };
};

const buildMapGeocodingRecord = (input: {
  readonly instanceId: string;
  readonly draft: Extract<InstanceInterfaceDraft, { type: 'mapGeocoding' }>;
  readonly interfaceId: string;
  readonly existing: ExternalInterfaceRecord | null;
  readonly hasDefaultRecord: boolean;
  readonly previousSecrets: Record<string, string>;
}): ExternalInterfaceRecord => {
  const existingPublicConfig = { ...(input.existing?.publicConfig ?? {}) };
  const styleUrl = input.draft.config.styleUrl.trim();
  const suggestEndpoint = input.draft.config.suggestEndpoint.trim();
  const geocodeEndpoint = input.draft.config.geocodeEndpoint.trim();
  const reverseGeocodeEndpoint = input.draft.config.reverseGeocodeEndpoint.trim();
  const timeoutMs = parseOptionalPositiveInteger(input.draft.config.requestTimeoutMs);
  const rateLimitPerMinute = parseOptionalPositiveInteger(input.draft.config.rateLimitPerMinute);
  const nextApiKey = input.draft.config.apiKey.trim() || input.previousSecrets.apiKey || '';

  for (const key of [
    'provider',
    'styleUrl',
    'autocompleteEnabled',
    'geocodeEnabled',
    'reverseGeocodeEnabled',
    'suggestEndpoint',
    'geocodeEndpoint',
    'reverseGeocodeEndpoint',
    'requestTimeoutMs',
    'rateLimitPerMinute',
    'killSwitchEnabled',
  ] as const) {
    delete existingPublicConfig[key];
  }

  if (!input.draft.name.trim() || !styleUrl) {
    throw new Error('invalid_config');
  }

  if (!input.existing && input.hasDefaultRecord) {
    throw new Error('invalid_config');
  }

  const hasEnabledOperation =
    input.draft.config.autocompleteEnabled ||
    input.draft.config.geocodeEnabled ||
    input.draft.config.reverseGeocodeEnabled;

  if (
    input.draft.config.provider === 'custom' &&
    ((input.draft.config.autocompleteEnabled && !isValidAbsoluteHttpUrl(suggestEndpoint)) ||
      (input.draft.config.geocodeEnabled && !isValidAbsoluteHttpUrl(geocodeEndpoint)) ||
      (input.draft.config.reverseGeocodeEnabled && !isValidAbsoluteHttpUrl(reverseGeocodeEndpoint)))
  ) {
    throw new Error('invalid_config');
  }

  if (input.draft.config.provider === 'geoapify' && hasEnabledOperation && !nextApiKey.trim()) {
    throw new Error('invalid_config');
  }

  return {
    id: input.interfaceId,
    instanceId: input.instanceId,
    typeKey: 'map_geocoding',
    ownerKind: 'host',
    ownerId: 'host',
    displayName: input.draft.name.trim(),
    alias: input.existing?.alias ?? input.interfaceId,
    enabled: input.draft.enabled,
    isDefault: input.existing?.isDefault ?? !input.hasDefaultRecord,
    category: 'api',
    baseUrl: suggestEndpoint || geocodeEndpoint || reverseGeocodeEndpoint || styleUrl,
    authMode: 'api_key',
    publicConfig: {
      ...existingPublicConfig,
      provider: input.draft.config.provider,
      styleUrl,
      autocompleteEnabled: input.draft.config.autocompleteEnabled,
      geocodeEnabled: input.draft.config.geocodeEnabled,
      reverseGeocodeEnabled: input.draft.config.reverseGeocodeEnabled,
      suggestEndpoint,
      geocodeEndpoint,
      reverseGeocodeEndpoint,
      ...(timeoutMs !== undefined ? { requestTimeoutMs: timeoutMs } : {}),
      ...(rateLimitPerMinute !== undefined ? { rateLimitPerMinute } : {}),
      killSwitchEnabled: input.draft.config.killSwitchEnabled,
    },
    secretConfigCiphertext: buildSecretCiphertext({
      interfaceId: input.interfaceId,
      secretConfig: nextApiKey.trim() ? { apiKey: nextApiKey.trim() } : {},
    }),
    statusCheckKind: 'map_geocoding',
    visibleStatus: resolveVisibleStatus(input.draft.enabled, input.existing?.visibleStatus),
    lastCheckedAt: input.existing?.lastCheckedAt,
    lastCheckStatus: input.existing?.lastCheckStatus,
    lastCheckErrorCode: input.existing?.lastCheckErrorCode,
    lastCheckErrorMessage: input.existing?.lastCheckErrorMessage,
    createdAt: input.existing?.createdAt,
    updatedAt: input.existing?.updatedAt,
  };
};

const buildRecordFromDraft = async (input: {
  readonly instanceId: string;
  readonly draft: Extract<InstanceInterfaceDraft, { type: 's3' | 'supabase' | 'mailTransport' | 'mapGeocoding' }>;
  readonly existingId?: string;
}): Promise<ExternalInterfaceRecord> => {
  logger.info('Building external interface record from draft', {
    operation: 'build_interface_record',
    workspace_id: input.instanceId,
    interface_type: input.draft.type,
    existing_interface_id: input.existingId,
    has_secret_input:
      input.draft.type === 's3'
        ? input.draft.config.secretAccessKey.length > 0
        : input.draft.type === 'supabase'
          ? input.draft.config.databaseUrl.length > 0 || input.draft.config.serviceRoleKey.length > 0
          : input.draft.type === 'mailTransport'
            ? input.draft.config.password.length > 0
            : input.draft.config.apiKey.length > 0,
  });
  const existing = input.existingId
    ? await loadExternalInterfaceRecordById(input.instanceId, input.existingId)
    : null;
  if (input.existingId && !existing) {
    logger.warn('Requested external interface for update was not found', {
      operation: 'build_interface_record',
      workspace_id: input.instanceId,
      interface_type: input.draft.type,
      existing_interface_id: input.existingId,
    });
    throw new Error('interface_not_found');
  }

  const interfaceId = existing?.id ?? randomUUID();
  let previousSecrets: Record<string, string>;
  try {
    previousSecrets = existing ? parseSecretConfig(existing.secretConfigCiphertext, interfaceId) : {};
  } catch (error) {
    logger.error('Failed to read stored external interface secrets', {
      operation: 'build_interface_record',
      workspace_id: input.instanceId,
      interface_type: input.draft.type,
      existing_interface_id: input.existingId,
      interface_id: interfaceId,
      error_message: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }

  if (existing && existing.typeKey !== mapStoredTypeToKey(input.draft.type)) {
    logger.warn('Rejected external interface type change', {
      operation: 'build_interface_record',
      workspace_id: input.instanceId,
      existing_interface_id: input.existingId,
      previous_type: existing.typeKey,
      requested_type: input.draft.type,
    });
    throw new Error('interface_type_change_not_supported');
  }

  const defaultRecord =
    existing?.isDefault !== undefined
      ? existing
      : await loadDefaultExternalInterfaceRecord(input.instanceId, mapStoredTypeToKey(input.draft.type));
  const sharedInput = {
    instanceId: input.instanceId,
    interfaceId,
    existing,
    hasDefaultRecord: Boolean(defaultRecord),
    previousSecrets,
  } as const;

  return input.draft.type === 's3'
    ? buildS3Record({ ...sharedInput, draft: input.draft })
    : input.draft.type === 'supabase'
      ? buildSupabaseRecord({ ...sharedInput, draft: input.draft })
      : input.draft.type === 'mailTransport'
        ? buildMailTransportRecord({ ...sharedInput, draft: input.draft })
        : buildMapGeocodingRecord({ ...sharedInput, draft: input.draft });
};

export const isCustomInterfaceStorageAvailable = (): boolean => true;

export const listStoredInterfaces = async (instanceId: string): Promise<readonly StoredEntry[]> => {
  const records = await listExternalInterfaceRecords(instanceId);
  return records.flatMap((record) => {
    const entry = mapRecordToStoredEntry(record);
    return entry ? [entry] : [];
  });
};

export const upsertStoredInterface = async (
  instanceId: string,
  draft: InstanceInterfaceDraft,
  existingId?: string
): Promise<StoredEntry> => {
  if (draft.type === 'mainserver') {
    throw new Error('mainserver_interfaces_use_dedicated_endpoint');
  }

  logger.info('Persisting external interface draft', {
    operation: 'upsert_stored_interface',
    workspace_id: instanceId,
    interface_type: draft.type,
    existing_interface_id: existingId,
    enabled: draft.enabled,
  });

  const record = await buildRecordFromDraft({
    instanceId,
    draft,
    existingId,
  });

  try {
    await saveExternalInterfaceRecord(record);
  } catch (error) {
    logger.error('Failed to persist external interface record', {
      operation: 'upsert_stored_interface',
      workspace_id: instanceId,
      interface_id: record.id,
      interface_type: draft.type,
      error_message: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }

  const stored = await loadExternalInterfaceRecordById(instanceId, record.id);
  const mapped = stored ? mapRecordToStoredEntry(stored) : null;
  if (!mapped) {
    logger.error('Persisted external interface record could not be reloaded', {
      operation: 'upsert_stored_interface',
      workspace_id: instanceId,
      interface_id: record.id,
      interface_type: draft.type,
    });
    throw new Error('interface_not_found');
  }

  logger.info('External interface draft persisted successfully', {
    operation: 'upsert_stored_interface',
    workspace_id: instanceId,
    interface_id: mapped.id,
    interface_type: mapped.type,
    visible_status: 'visibleStatus' in mapped ? mapped.visibleStatus : undefined,
  });
  return mapped;
};

export const deleteStoredInterface = async (instanceId: string, id: string): Promise<boolean> => {
  if (id === `sva-mainserver:${instanceId}`) {
    throw new Error('mainserver_interfaces_use_dedicated_endpoint');
  }

  return deleteExternalInterfaceRecord(instanceId, id);
};

export const getStoredInterface = async (instanceId: string, id: string): Promise<StoredEntry | null> => {
  const record = await loadExternalInterfaceRecordById(instanceId, id);
  return record ? mapRecordToStoredEntry(record) : null;
};

export const loadStoredMapGeocodingRuntimeConfig = async (
  instanceId: string
): Promise<StoredMapGeocodingRuntimeConfig | null> => {
  const record = await loadDefaultExternalInterfaceRecord(instanceId, 'map_geocoding');
  if (!record || record.typeKey !== 'map_geocoding') {
    return null;
  }

  const entry = mapRecordToStoredEntry(record);
  if (!entry || entry.type !== 'mapGeocoding') {
    return null;
  }

  const secrets = parseSecretConfig(record.secretConfigCiphertext, record.id);

  return {
    id: entry.id,
    instanceId: entry.instanceId,
    enabled: entry.enabled,
    provider: entry.config.provider,
    styleUrl: entry.config.styleUrl,
    autocompleteEnabled: entry.config.autocompleteEnabled,
    geocodeEnabled: entry.config.geocodeEnabled,
    reverseGeocodeEnabled: entry.config.reverseGeocodeEnabled,
    suggestEndpoint: entry.config.suggestEndpoint,
    geocodeEndpoint: entry.config.geocodeEndpoint,
    reverseGeocodeEndpoint: entry.config.reverseGeocodeEndpoint,
    requestTimeoutMs: entry.config.requestTimeoutMs,
    rateLimitPerMinute: entry.config.rateLimitPerMinute,
    killSwitchEnabled: entry.config.killSwitchEnabled,
    ...(secrets.apiKey ? { apiKey: secrets.apiKey } : {}),
  };
};

export type InterfaceHealthResult = Readonly<{
  status: 'connected' | 'error' | 'disabled' | 'unknown';
  statusMessage?: string;
  errorCode?: string;
  checkedAt: string;
}>;

export const checkStoredInterfaceHealth = (entry: StoredEntry): InterfaceHealthResult => {
  const persistedEntry = entry as PersistedStoredEntry;
  const checkedAt = persistedEntry.lastCheckedAt ?? nowIso();

  if (!entry.enabled) {
    return {
      status: 'disabled',
      checkedAt,
      ...(persistedEntry.lastCheckErrorMessage ? { statusMessage: persistedEntry.lastCheckErrorMessage } : {}),
      ...(persistedEntry.lastCheckErrorCode ? { errorCode: persistedEntry.lastCheckErrorCode } : {}),
    };
  }

  if (persistedEntry.visibleStatus) {
    return {
      status: mapVisibleStatusToHealth(persistedEntry.visibleStatus),
      checkedAt,
      ...(persistedEntry.lastCheckErrorMessage ? { statusMessage: persistedEntry.lastCheckErrorMessage } : {}),
      ...(persistedEntry.lastCheckErrorCode ? { errorCode: persistedEntry.lastCheckErrorCode } : {}),
    };
  }

  if (entry.type === 's3') {
    if (!entry.config.endpoint || !entry.config.bucket || !entry.config.accessKeyId) {
      return {
        status: 'error',
        statusMessage: 'S3-Konfiguration unvollständig (Endpoint, Bucket, Access Key erforderlich).',
        checkedAt,
      };
    }
    return {
      status: 'unknown',
      statusMessage: 'S3-Verbindungsprüfung ausstehend.',
      checkedAt,
    };
  }

  if (entry.type === 'mailTransport') {
    if (!entry.config.transportId) {
      return {
        status: 'error',
        statusMessage: 'Mail-Transport unvollständig (Transport-ID erforderlich).',
        checkedAt,
      };
    }
    if (!entry.config.host || !entry.config.port) {
      return {
        status: 'error',
        statusMessage: 'Mail-Transport unvollständig (SMTP-Host und Port erforderlich).',
        checkedAt,
      };
    }
    return {
      status: 'unknown',
      statusMessage: 'Statusprüfung für Mail-Transporte ist noch nicht verfügbar.',
      checkedAt,
    };
  }

  if (entry.type === 'mapGeocoding') {
    if (!entry.config.styleUrl) {
      return {
        status: 'error',
        statusMessage: 'Karten-/Geocoding-Konfiguration unvollständig (Style-URL erforderlich).',
        checkedAt,
      };
    }
    if (entry.config.killSwitchEnabled) {
      return {
        status: 'disabled',
        statusMessage: 'Karten-/Geocoding-Schnittstelle wurde per Kill-Switch deaktiviert.',
        checkedAt,
      };
    }
    return {
      status: 'unknown',
      statusMessage: 'Statusprüfung für Karten-/Geocoding-Schnittstellen ist noch nicht verfügbar.',
      checkedAt,
    };
  }

  if (!entry.config.projectUrl) {
    return {
      status: 'error',
      statusMessage: 'Supabase-Konfiguration unvollständig (Project URL erforderlich).',
      checkedAt,
    };
  }

  if (!entry.config.databaseUrl && !('serviceRoleKey' in entry.config)) {
    return {
      status: 'error',
      statusMessage: 'Supabase-Konfiguration unvollständig (Direkte DB-URL und Service-Role-Key erforderlich).',
      checkedAt,
    };
  }

  if (!entry.config.databaseUrl) {
    return {
      status: 'error',
      statusMessage: 'Supabase-Konfiguration unvollständig (Direkte DB-URL erforderlich).',
      checkedAt,
    };
  }

  return {
    status: 'unknown',
    statusMessage: 'Statusprüfung für benutzerdefinierte Schnittstellen ist noch nicht verfügbar.',
    checkedAt,
  };
};
