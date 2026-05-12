import { randomUUID } from 'node:crypto';

import type {
  ExternalInterfaceRecord,
  ExternalInterfaceVisibleStatus,
} from '@sva/core';
import {
  deleteExternalInterfaceRecord,
  listExternalInterfaceRecords,
  loadDefaultExternalInterfaceRecord,
  loadExternalInterfaceRecordById,
  saveExternalInterfaceRecord,
} from '@sva/data-repositories/server';
import { protectField, revealField } from '@sva/auth-runtime/server';
import { buildExternalInterfaceSecretConfigAad } from '@sva/server-runtime';

import type {
  InstanceInterfaceDraft,
  InstanceInterfaceS3,
  InstanceInterfaceSupabase,
} from './instance-interfaces';

type StoredS3 = Omit<InstanceInterfaceS3, 'status' | 'statusMessage' | 'errorCode' | 'lastCheckedAt'>;
type StoredSupabase = Omit<InstanceInterfaceSupabase, 'status' | 'statusMessage' | 'errorCode' | 'lastCheckedAt'>;

type StoredEntry = StoredS3 | StoredSupabase;
type StoredInterfaceType = StoredEntry['type'];

type PersistedStoredEntry = StoredEntry & Readonly<{
  visibleStatus?: ExternalInterfaceVisibleStatus;
  lastCheckedAt?: string;
  lastCheckErrorCode?: string;
  lastCheckErrorMessage?: string;
}>;

const nowIso = (): string => new Date().toISOString();

const coerceText = (value: unknown): string => (typeof value === 'string' ? value : '');

const coerceBoolean = (value: unknown): boolean => value === true;

const parseSecretConfig = (ciphertext: string | undefined, interfaceId: string): Record<string, string> => {
  const revealed = revealField(ciphertext, buildExternalInterfaceSecretConfigAad(interfaceId));
  if (!revealed) {
    return {};
  }

  try {
    const parsed = JSON.parse(revealed) as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(parsed).flatMap(([key, value]) =>
        typeof value === 'string' && value.length > 0 ? [[key, value]] : []
      )
    );
  } catch {
    throw new Error('secret_unreadable');
  }
};

const mapStoredTypeToKey = (type: StoredInterfaceType): 's3' | 'supabase' => type;

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

const buildRecordFromDraft = async (input: {
  readonly instanceId: string;
  readonly draft: Extract<InstanceInterfaceDraft, { type: 's3' | 'supabase' }>;
  readonly existingId?: string;
}): Promise<ExternalInterfaceRecord> => {
  const existing = input.existingId
    ? await loadExternalInterfaceRecordById(input.instanceId, input.existingId)
    : null;
  const interfaceId = existing?.id ?? randomUUID();
  const previousSecrets = existing ? parseSecretConfig(existing.secretConfigCiphertext, interfaceId) : {};

  if (existing && existing.typeKey !== input.draft.type) {
    throw new Error('interface_type_change_not_supported');
  }

  const defaultRecord =
    existing?.isDefault !== undefined
      ? existing
      : await loadDefaultExternalInterfaceRecord(input.instanceId, mapStoredTypeToKey(input.draft.type));

  if (input.draft.type === 's3') {
    const nextSecretConfig = {
      secretAccessKey: input.draft.config.secretAccessKey || previousSecrets.secretAccessKey || '',
    };

    return {
      id: interfaceId,
      instanceId: input.instanceId,
      typeKey: 's3',
      ownerKind: 'host',
      ownerId: 'host',
      displayName: input.draft.name.trim(),
      alias: existing?.alias ?? interfaceId,
      enabled: input.draft.enabled,
      isDefault: existing?.isDefault ?? !defaultRecord,
      category: 'object_storage',
      baseUrl: input.draft.config.endpoint.trim(),
      authMode: 'access_key',
      publicConfig: {
        endpoint: input.draft.config.endpoint.trim(),
        region: input.draft.config.region.trim(),
        bucket: input.draft.config.bucket.trim(),
        accessKeyId: input.draft.config.accessKeyId.trim(),
        forcePathStyle: input.draft.config.forcePathStyle,
      },
      secretConfigCiphertext: buildSecretCiphertext({
        interfaceId,
        secretConfig: nextSecretConfig.secretAccessKey
          ? { secretAccessKey: nextSecretConfig.secretAccessKey }
          : {},
      }),
      statusCheckKind: 's3',
      visibleStatus: input.draft.enabled ? existing?.visibleStatus ?? 'unknown' : 'disabled',
      lastCheckedAt: existing?.lastCheckedAt,
      lastCheckStatus: existing?.lastCheckStatus,
      lastCheckErrorCode: existing?.lastCheckErrorCode,
      lastCheckErrorMessage: existing?.lastCheckErrorMessage,
      createdAt: existing?.createdAt,
      updatedAt: existing?.updatedAt,
    };
  }

  const nextSecretConfig = {
    databaseUrl: input.draft.config.databaseUrl || previousSecrets.databaseUrl || '',
    serviceRoleKey: input.draft.config.serviceRoleKey || previousSecrets.serviceRoleKey || '',
  };

  return {
    id: interfaceId,
    instanceId: input.instanceId,
    typeKey: 'supabase',
    ownerKind: 'host',
    ownerId: 'host',
    displayName: input.draft.name.trim(),
    alias: existing?.alias ?? interfaceId,
    enabled: input.draft.enabled,
    isDefault: existing?.isDefault ?? !defaultRecord,
    category: 'database',
    baseUrl: input.draft.config.projectUrl.trim(),
    authMode: 'service_role',
    publicConfig: {
      projectUrl: input.draft.config.projectUrl.trim(),
      schemaName: input.draft.config.schemaName.trim() || 'public',
    },
    secretConfigCiphertext: buildSecretCiphertext({
      interfaceId,
      secretConfig: Object.fromEntries(
        Object.entries(nextSecretConfig).flatMap(([key, value]) => (value ? [[key, value]] : []))
      ),
    }),
    statusCheckKind: 'supabase',
    visibleStatus: input.draft.enabled ? existing?.visibleStatus ?? 'unknown' : 'disabled',
    lastCheckedAt: existing?.lastCheckedAt,
    lastCheckStatus: existing?.lastCheckStatus,
    lastCheckErrorCode: existing?.lastCheckErrorCode,
    lastCheckErrorMessage: existing?.lastCheckErrorMessage,
    createdAt: existing?.createdAt,
    updatedAt: existing?.updatedAt,
  };
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

  const record = await buildRecordFromDraft({
    instanceId,
    draft,
    existingId,
  });
  await saveExternalInterfaceRecord(record);
  const stored = await loadExternalInterfaceRecordById(instanceId, record.id);
  const mapped = stored ? mapRecordToStoredEntry(stored) : null;
  if (!mapped) {
    throw new Error('interface_not_found');
  }
  return mapped;
};

export const deleteStoredInterface = async (instanceId: string, id: string): Promise<boolean> =>
  deleteExternalInterfaceRecord(instanceId, id);

export const getStoredInterface = async (instanceId: string, id: string): Promise<StoredEntry | null> => {
  const record = await loadExternalInterfaceRecordById(instanceId, id);
  return record ? mapRecordToStoredEntry(record) : null;
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
      statusMessage: 'Statusprüfung für benutzerdefinierte Schnittstellen ist noch nicht verfügbar.',
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

  return {
    status: 'unknown',
    statusMessage: 'Statusprüfung für benutzerdefinierte Schnittstellen ist noch nicht verfügbar.',
    checkedAt,
  };
};
