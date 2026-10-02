import type {
  ExternalInterfaceRecord,
  ExternalInterfaceVisibleStatus,
  MailTransportAuthMode,
  MailTransportSecurityMode,
} from '@sva/core';
import type {
  InstanceInterfaceS3,
  InstanceInterfaceSupabase,
  InstanceInterfacePostgresql,
  InstanceInterfaceMailTransport,
  InstanceInterfaceMapGeocoding,
} from './instance-interfaces';
import { mailTransportContract } from '@sva/core';
import { revealField } from '@sva/auth-runtime/server';
import { buildExternalInterfaceSecretConfigAad } from '@sva/server-runtime';

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

export type StoredS3 = Omit<
  InstanceInterfaceS3,
  'status' | 'statusMessage' | 'errorCode' | 'lastCheckedAt'
>;
export type StoredSupabase = Omit<
  InstanceInterfaceSupabase,
  'status' | 'statusMessage' | 'errorCode' | 'lastCheckedAt'
>;
export type StoredPostgresql = Omit<
  InstanceInterfacePostgresql,
  'status' | 'statusMessage' | 'errorCode' | 'lastCheckedAt'
>;
export type StoredMailTransport = Omit<
  InstanceInterfaceMailTransport,
  'status' | 'statusMessage' | 'errorCode' | 'lastCheckedAt'
>;
export type StoredMapGeocoding = Omit<
  InstanceInterfaceMapGeocoding,
  'status' | 'statusMessage' | 'errorCode' | 'lastCheckedAt'
>;

export type StoredEntry =
  StoredS3 | StoredSupabase | StoredPostgresql | StoredMailTransport | StoredMapGeocoding;
export type StoredInterfaceType = StoredEntry['type'];

export type PersistedStoredEntry = StoredEntry &
  Readonly<{
    visibleStatus?: ExternalInterfaceVisibleStatus;
    lastCheckedAt?: string;
    lastCheckErrorCode?: string;
    lastCheckErrorMessage?: string;
  }>;

export const nowIso = (): string => new Date().toISOString();
const coerceText = (value: unknown): string => (typeof value === 'string' ? value : '');
const coerceBoolean = (value: unknown): boolean => value === true;
const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const parseSecretConfig = (
  ciphertext: string | undefined,
  interfaceId: string
): Record<string, string> => {
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

export const mapStoredTypeToKey = (
  type: StoredInterfaceType
): 's3' | 'supabase' | 'postgresql' | 'mail_transport' | 'map_geocoding' =>
  type === 'mailTransport' ? 'mail_transport' : type === 'mapGeocoding' ? 'map_geocoding' : type;

const coerceOptionalText = (value: unknown): string => (typeof value === 'string' ? value : '');

const coerceOptionalNumberString = (value: unknown): string =>
  typeof value === 'number' && Number.isFinite(value) ? String(value) : '';

const coerceMailSecurityMode = (value: unknown): MailTransportSecurityMode =>
  typeof value === 'string' && mailTransportContract.isSecurityMode(value) ? value : 'starttls';

const coerceMailAuthMode = (value: unknown): MailTransportAuthMode =>
  typeof value === 'string' && mailTransportContract.isAuthMode(value) ? value : 'basic';

export const mapRecordToStoredEntry = (
  record: ExternalInterfaceRecord
): PersistedStoredEntry | null => {
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

  if (record.typeKey === 'postgresql') {
    return {
      id: record.id,
      instanceId: record.instanceId,
      type: 'postgresql',
      name: record.displayName,
      enabled: record.enabled,
      config: {
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
        host:
          coerceText(record.publicConfig.host) || coerceOptionalText(record.publicConfig.endpoint),
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
      apiKeyConfigured: Boolean(
        parseSecretConfig(record.secretConfigCiphertext, record.id).apiKey?.trim()
      ),
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
