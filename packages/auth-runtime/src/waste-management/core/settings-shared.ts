import { Pool } from 'pg';
import { loadDefaultExternalInterfaceRecord } from '@sva/data-repositories/server';
import {
  resolveWasteDataSource,
  runWasteConnectionCheck,
  type ResolvedWasteDataSource,
} from '@sva/server-runtime';
import {
  wasteManagementDataSourceContract,
  wasteManagementMasterDataContract,
  type ExternalInterfaceConnectionCheckRecord,
  type WasteManagementDataSourceRecord,
  type WasteManagementSettingsRecord,
} from '@sva/core';

import type { WasteManagementHandlerDeps } from './types.js';

const normalizeInterfaceWasteVisibleStatus = (
  status: 'not_configured' | 'unknown' | 'ok' | 'error' | 'disabled'
): WasteManagementDataSourceRecord['visibleStatus'] => (status === 'disabled' ? 'unknown' : status);

const readHolidayStateCode = (publicConfig: Readonly<Record<string, unknown>>): WasteManagementSettingsRecord['holidayStateCode'] => {
  const value = publicConfig.holidayStateCode;
  return typeof value === 'string' && wasteManagementMasterDataContract.isWasteHolidayStateCode(value) ? value : undefined;
};

const readHolidaySyncStatus = (
  publicConfig: Readonly<Record<string, unknown>>
): WasteManagementSettingsRecord['lastHolidaySyncStatus'] => {
  const value = publicConfig.lastHolidaySyncStatus;
  return typeof value === 'string' && wasteManagementDataSourceContract.isHolidaySyncStatus(value) ? value : undefined;
};

const mapExternalInterfaceToWasteSettings = (
  record: Awaited<ReturnType<typeof loadDefaultExternalInterfaceRecord>>
): WasteManagementSettingsRecord | null => {
  if (!record || record.typeKey !== 'supabase') {
    return null;
  }

  return {
    instanceId: record.instanceId,
    provider: 'supabase',
    projectUrl: typeof record.publicConfig.projectUrl === 'string' ? record.publicConfig.projectUrl : '',
    schemaName:
      typeof record.publicConfig.schemaName === 'string' && record.publicConfig.schemaName.trim().length > 0
        ? record.publicConfig.schemaName
        : 'public',
    enabled: record.enabled,
    databaseUrlConfigured: Boolean(record.secretConfigCiphertext),
    serviceRoleKeyConfigured: Boolean(record.secretConfigCiphertext),
    visibleStatus: normalizeInterfaceWasteVisibleStatus(record.visibleStatus),
    lastCheckedAt: record.lastCheckedAt,
    lastCheckStatus: record.lastCheckStatus,
    lastCheckErrorCode: record.lastCheckErrorCode,
    lastCheckErrorMessage: record.lastCheckErrorMessage,
    holidayStateCode: readHolidayStateCode(record.publicConfig),
    lastHolidaySyncStatus: readHolidaySyncStatus(record.publicConfig),
    updatedAt: record.updatedAt,
    customRecurrencePresets: [],
  };
};

export const sanitizeWasteSettings = (
  record: WasteManagementDataSourceRecord | null | undefined
): WasteManagementSettingsRecord | null => {
  if (!record) {
    return null;
  }

  return {
    instanceId: record.instanceId,
    provider: record.provider,
    projectUrl: record.projectUrl,
    schemaName: record.schemaName,
    enabled: record.enabled,
    databaseUrlConfigured: record.databaseUrlConfigured,
    serviceRoleKeyConfigured: record.serviceRoleKeyConfigured,
    visibleStatus: record.visibleStatus,
    lastCheckedAt: record.lastCheckedAt,
    lastCheckStatus: record.lastCheckStatus,
    lastCheckErrorCode: record.lastCheckErrorCode,
    lastCheckErrorMessage: record.lastCheckErrorMessage,
    holidayStateCode: record.holidayStateCode,
    lastHolidaySyncStatus: record.lastHolidaySyncStatus,
    updatedAt: record.updatedAt,
    customRecurrencePresets: record.customRecurrencePresets ?? [],
  };
};

export const loadConfiguredWasteSettings = async (
  deps: WasteManagementHandlerDeps,
  instanceId: string
): Promise<WasteManagementSettingsRecord | null> => {
  const interfaceRecord = await (deps.loadDefaultInterfaceRecord ?? loadDefaultExternalInterfaceRecord)(instanceId, 'supabase');
  const settings = mapExternalInterfaceToWasteSettings(interfaceRecord);
  if (!settings) {
    return null;
  }

  const customRecurrencePresets = deps.loadWasteCustomRecurrencePresets
    ? await deps.loadWasteCustomRecurrencePresets(instanceId)
    : [];

  return {
    ...settings,
    customRecurrencePresets,
  };
};

export const defaultRunConnectionProbe = async (dataSource: ResolvedWasteDataSource): Promise<void> => {
  const pool = new Pool({
    connectionString: dataSource.databaseUrl,
    max: 1,
    idleTimeoutMillis: 5_000,
    connectionTimeoutMillis: 5_000,
  });

  try {
    const client = await pool.connect();
    try {
      await client.query('SELECT 1;');
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
};

const persistWasteConnectionState = async (
  deps: WasteManagementHandlerDeps,
  record: ExternalInterfaceConnectionCheckRecord
): Promise<void> => {
  if (!deps.saveExternalInterfaceConnectionCheck) {
    return;
  }

  await deps.saveExternalInterfaceConnectionCheck(record);
};

export const updateWasteVisibleStatus = async (
  deps: WasteManagementHandlerDeps,
  instanceId: string,
  outcome: 'success' | 'revalidate'
): Promise<void> => {
  if (!deps.saveExternalInterfaceConnectionCheck) {
    return;
  }

  const interfaceRecord = await (deps.loadDefaultInterfaceRecord ?? loadDefaultExternalInterfaceRecord)(instanceId, 'supabase');
  if (!interfaceRecord) {
    return;
  }

  if (outcome === 'success') {
    await persistWasteConnectionState(deps, {
      instanceId,
      interfaceId: interfaceRecord.id,
      checkedAt: new Date().toISOString(),
      checkStatus: 'succeeded',
      visibleStatus: 'ok',
    });
    return;
  }

  if (!deps.revealSecret) {
    return;
  }

  try {
    const dataSource = await resolveWasteDataSource({
      instanceId,
      loadDefaultInterface: async () => interfaceRecord,
      revealSecret: (ciphertext, aad) => deps.revealSecret?.(ciphertext, aad) ?? undefined,
    });
    const connectionCheck = await runWasteConnectionCheck({
      dataSource,
      probe: deps.runConnectionProbe ?? defaultRunConnectionProbe,
      now: () => new Date(),
    });
    await persistWasteConnectionState(deps, {
      ...connectionCheck,
      interfaceId: interfaceRecord.id,
    });
  } catch (error) {
    const errorCode =
      error instanceof Error && 'code' in error && typeof error.code === 'string' ? error.code : 'connection_failed';
    const errorMessage = error instanceof Error ? error.message : 'Connection-Check fehlgeschlagen.';
    await persistWasteConnectionState(deps, {
      instanceId,
      interfaceId: interfaceRecord.id,
      checkedAt: new Date().toISOString(),
      checkStatus: 'failed',
      visibleStatus: 'error',
      errorCode,
      errorMessage,
    });
  }
};
