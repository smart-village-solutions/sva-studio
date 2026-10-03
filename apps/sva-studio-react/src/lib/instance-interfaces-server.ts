import {
  deleteExternalInterfaceRecord,
  listExternalInterfaceRecords,
  loadDefaultExternalInterfaceRecord,
  loadExternalInterfaceRecordById,
  saveExternalInterfaceRecord,
} from '@sva/data-repositories/server';
import { createSdkLogger } from '@sva/server-runtime';
import type { InstanceInterfaceDraft } from './instance-interfaces';
import type { StoredEntry } from './instance-interface-record-mapping.server.js';
import {
  mapRecordToStoredEntry,
  parseSecretConfig,
} from './instance-interface-record-mapping.server.js';
import { buildRecordFromDraft } from './instance-interface-draft-record.server.js';
export type { StoredMapGeocodingRuntimeConfig } from './instance-interface-record-mapping.server.js';
export { checkStoredInterfaceHealth } from './instance-interface-status.server.js';
export type { InterfaceHealthResult } from './instance-interface-status.server.js';
import type { StoredMapGeocodingRuntimeConfig } from './instance-interface-record-mapping.server.js';
const logger = createSdkLogger({ component: 'instance-interfaces-server' });
const isMissingInterfaceTypeRegistration = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  'code' in error &&
  error.code === '23503' &&
  'constraint' in error &&
  error.constraint === 'instance_external_interfaces_type_key_fkey';

export const isCustomInterfaceStorageAvailable = (): boolean => true;

export const listStoredInterfaces = async (instanceId: string): Promise<readonly StoredEntry[]> => {
  const records = await listExternalInterfaceRecords(instanceId);
  return records
    .filter((record) => record.ownerKind !== 'plugin')
    .flatMap((record) => {
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
    if (isMissingInterfaceTypeRegistration(error)) {
      throw new Error('interface_type_not_registered');
    }
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

  const record = await loadExternalInterfaceRecordById(instanceId, id);
  if (!record) {
    return false;
  }
  if (record.ownerKind === 'plugin') {
    throw new Error('plugin_managed_interface_read_only');
  }

  return deleteExternalInterfaceRecord(instanceId, id);
};

export const getStoredInterface = async (
  instanceId: string,
  id: string
): Promise<StoredEntry | null> => {
  const record = await loadExternalInterfaceRecordById(instanceId, id);
  return record?.ownerKind === 'plugin' ? null : record ? mapRecordToStoredEntry(record) : null;
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
