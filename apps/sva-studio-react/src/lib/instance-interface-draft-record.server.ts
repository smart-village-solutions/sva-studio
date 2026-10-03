import { randomUUID } from 'node:crypto';
import type { ExternalInterfaceRecord } from '@sva/core';
import {
  loadDefaultExternalInterfaceRecord,
  loadExternalInterfaceRecordById,
} from '@sva/data-repositories/server';
import { createSdkLogger } from '@sva/server-runtime';
import type { InstanceInterfaceDraft } from './instance-interfaces';
import {
  parseSecretConfig,
  mapStoredTypeToKey,
} from './instance-interface-record-mapping.server.js';
import {
  buildSecretCiphertext,
  resolveVisibleStatus,
} from './instance-interface-record-helpers.server.js';
import { buildMailTransportRecord } from './instance-interface-mail-record.server.js';
import { buildMapGeocodingRecord } from './instance-interface-map-record.server.js';
const logger = createSdkLogger({ component: 'instance-interfaces-server' });

export const buildS3Record = (input: {
  readonly instanceId: string;
  readonly draft: Extract<InstanceInterfaceDraft, { type: 's3' }>;
  readonly interfaceId: string;
  readonly existing: ExternalInterfaceRecord | null;
  readonly hasDefaultRecord: boolean;
  readonly previousSecrets: Record<string, string>;
}): ExternalInterfaceRecord => {
  const nextSecretAccessKey =
    input.draft.config.secretAccessKey || input.previousSecrets.secretAccessKey || '';
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

export const buildSupabaseRecord = (input: {
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

export const buildPostgresqlRecord = (input: {
  readonly instanceId: string;
  readonly draft: Extract<InstanceInterfaceDraft, { type: 'postgresql' }>;
  readonly interfaceId: string;
  readonly existing: ExternalInterfaceRecord | null;
  readonly hasDefaultRecord: boolean;
  readonly previousSecrets: Record<string, string>;
}): ExternalInterfaceRecord => {
  const databaseUrl = input.draft.config.databaseUrl || input.previousSecrets.databaseUrl || '';
  const existingPublicConfig = input.existing?.publicConfig ?? {};

  return {
    id: input.interfaceId,
    instanceId: input.instanceId,
    typeKey: 'postgresql',
    ownerKind: 'host',
    ownerId: 'host',
    displayName: input.draft.name.trim(),
    alias: input.existing?.alias ?? input.interfaceId,
    enabled: input.draft.enabled,
    isDefault: input.existing?.isDefault ?? !input.hasDefaultRecord,
    category: 'database',
    authMode: 'database_credentials',
    publicConfig: {
      ...existingPublicConfig,
      schemaName: input.draft.config.schemaName.trim() || 'public',
    },
    secretConfigCiphertext: buildSecretCiphertext({
      interfaceId: input.interfaceId,
      secretConfig: databaseUrl ? { databaseUrl } : {},
    }),
    statusCheckKind: 'postgresql',
    visibleStatus: resolveVisibleStatus(input.draft.enabled, input.existing?.visibleStatus),
    lastCheckedAt: input.existing?.lastCheckedAt,
    lastCheckStatus: input.existing?.lastCheckStatus,
    lastCheckErrorCode: input.existing?.lastCheckErrorCode,
    lastCheckErrorMessage: input.existing?.lastCheckErrorMessage,
    createdAt: input.existing?.createdAt,
    updatedAt: input.existing?.updatedAt,
  };
};

export const buildRecordFromDraft = async (input: {
  readonly instanceId: string;
  readonly draft: Extract<
    InstanceInterfaceDraft,
    { type: 's3' | 'supabase' | 'postgresql' | 'mailTransport' | 'mapGeocoding' }
  >;
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
          ? input.draft.config.databaseUrl.length > 0 ||
            input.draft.config.serviceRoleKey.length > 0
          : input.draft.type === 'postgresql'
            ? input.draft.config.databaseUrl.length > 0
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
  if (existing?.ownerKind === 'plugin') {
    logger.warn('Rejected mutation of plugin-managed external interface', {
      operation: 'build_interface_record',
      workspace_id: input.instanceId,
      interface_id: existing.id,
      interface_owner_id: existing.ownerId,
    });
    throw new Error('plugin_managed_interface_read_only');
  }

  const interfaceId = existing?.id ?? randomUUID();
  let previousSecrets: Record<string, string>;
  try {
    previousSecrets = existing
      ? parseSecretConfig(existing.secretConfigCiphertext, interfaceId)
      : {};
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
      : await loadDefaultExternalInterfaceRecord(
          input.instanceId,
          mapStoredTypeToKey(input.draft.type)
        );
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
      : input.draft.type === 'postgresql'
        ? buildPostgresqlRecord({ ...sharedInput, draft: input.draft })
        : input.draft.type === 'mailTransport'
          ? buildMailTransportRecord({ ...sharedInput, draft: input.draft })
          : buildMapGeocodingRecord({ ...sharedInput, draft: input.draft });
};
