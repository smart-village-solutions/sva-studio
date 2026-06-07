import { Pool } from 'pg';
import { loadDefaultExternalInterfaceRecord } from '@sva/data-repositories/server';
import {
  resolveWasteDataSource,
  runWasteConnectionCheck,
  type ResolvedWasteDataSource,
} from '@sva/server-runtime';
import {
  type ExternalInterfaceConnectionCheckRecord,
  type ExternalInterfaceRecord,
  type WasteManagementDataSourceRecord,
  type WasteManagementSettingsInterfaceOption,
  type WasteManagementSettingsRecord,
  findSelectedWasteManagementInterfaceRecord,
  readWasteManagementCalendarWebUrl,
  readWasteManagementHolidayStateCode,
  readWasteManagementHolidaySyncStatus,
  readWasteManagementLastSuccessfulHolidaySyncAt,
  readWasteManagementPdfBrandingAssetUrl,
  readWasteManagementPdfContactBlock,
} from '@sva/core';

import type { WasteManagementHandlerDeps } from './types.js';

const normalizeInterfaceWasteVisibleStatus = (
  status: 'not_configured' | 'unknown' | 'ok' | 'error' | 'disabled'
): WasteManagementDataSourceRecord['visibleStatus'] => (status === 'disabled' ? 'unknown' : status);

const mapExternalInterfaceToWasteSettings = (
  instanceId: string,
  record: ExternalInterfaceRecord | null,
  availableInterfaces: readonly WasteManagementSettingsInterfaceOption[]
): WasteManagementSettingsRecord | null => {
  if (!record) {
    return {
      instanceId,
      provider: 'supabase',
      projectUrl: '',
      schemaName: 'public',
      enabled: false,
      availableInterfaces,
      databaseUrlConfigured: false,
      serviceRoleKeyConfigured: false,
      visibleStatus: 'not_configured',
      customRecurrencePresets: [],
    };
  }

  const isSupabase = record.typeKey === 'supabase';
  return {
    instanceId: record.instanceId,
    provider: 'supabase',
    projectUrl: isSupabase && typeof record.publicConfig.projectUrl === 'string' ? record.publicConfig.projectUrl : '',
    schemaName:
      isSupabase &&
      typeof record.publicConfig.schemaName === 'string' &&
      record.publicConfig.schemaName.trim().length > 0
        ? record.publicConfig.schemaName
        : 'public',
    enabled: record.enabled,
    selectedInterfaceId: record.id,
    selectedInterfaceName: record.displayName,
    selectedInterfaceTypeKey: record.typeKey,
    availableInterfaces,
    calendarWebUrl: readWasteManagementCalendarWebUrl(record.publicConfig),
    pdfBrandingAssetUrl: readWasteManagementPdfBrandingAssetUrl(record.publicConfig),
    pdfContactBlock: readWasteManagementPdfContactBlock(record.publicConfig),
    databaseUrlConfigured: isSupabase ? Boolean(record.secretConfigCiphertext) : false,
    serviceRoleKeyConfigured: isSupabase ? Boolean(record.secretConfigCiphertext) : false,
    visibleStatus: isSupabase ? normalizeInterfaceWasteVisibleStatus(record.visibleStatus) : 'not_configured',
    lastCheckedAt: record.lastCheckedAt,
    lastCheckStatus: record.lastCheckStatus,
    lastCheckErrorCode: record.lastCheckErrorCode,
    lastCheckErrorMessage: record.lastCheckErrorMessage,
    holidayStateCode: readWasteManagementHolidayStateCode(record.publicConfig),
    lastHolidaySyncStatus: readWasteManagementHolidaySyncStatus(record.publicConfig),
    lastSuccessfulHolidaySyncAt: readWasteManagementLastSuccessfulHolidaySyncAt(record.publicConfig),
    updatedAt: record.updatedAt,
    customRecurrencePresets: [],
  };
};

const mapWasteSettingsInterfaceOptions = (
  deps: WasteManagementHandlerDeps,
  records: readonly ExternalInterfaceRecord[],
  selectedInterfaceId?: string
): readonly WasteManagementSettingsInterfaceOption[] =>
  deps.mapWasteSettingsInterfaceOptions?.(records, selectedInterfaceId) ??
  records.map((record) => ({
    id: record.id,
    name: record.displayName,
    typeKey: record.typeKey,
    enabled: record.enabled,
    visibleStatus: record.visibleStatus,
    isSelected: record.id === selectedInterfaceId,
  }));

const loadWasteSettingsInterfaceRecords = async (
  deps: WasteManagementHandlerDeps,
  instanceId: string
): Promise<readonly ExternalInterfaceRecord[]> => {
  if (deps.listInterfaceRecords) {
    return await deps.listInterfaceRecords(instanceId);
  }

  if (deps.loadDefaultInterfaceRecord) {
    const fallbackRecord = await deps.loadDefaultInterfaceRecord(instanceId, 'supabase');
    return fallbackRecord ? [fallbackRecord] : [];
  }

  return [];
};

const loadSelectedWasteSettingsInterface = async (
  deps: WasteManagementHandlerDeps,
  instanceId: string
): Promise<{
  readonly records: readonly ExternalInterfaceRecord[];
  readonly selectedInterface: ExternalInterfaceRecord | null;
}> => {
  const records = await loadWasteSettingsInterfaceRecords(deps, instanceId);
  const selectedInterface = findSelectedWasteManagementInterfaceRecord(records);
  if (selectedInterface) {
    return { records, selectedInterface };
  }

  const fallbackDefault = await (deps.loadDefaultInterfaceRecord ?? loadDefaultExternalInterfaceRecord)(instanceId, 'supabase');
  return {
    records,
    selectedInterface: fallbackDefault,
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
    selectedInterfaceId: record.selectedInterfaceId,
    selectedInterfaceName: record.selectedInterfaceName,
    selectedInterfaceTypeKey: record.selectedInterfaceTypeKey,
    availableInterfaces: record.availableInterfaces,
    calendarWebUrl: record.calendarWebUrl,
    pdfBrandingAssetUrl: record.pdfBrandingAssetUrl,
    pdfContactBlock: record.pdfContactBlock,
    databaseUrlConfigured: record.databaseUrlConfigured,
    serviceRoleKeyConfigured: record.serviceRoleKeyConfigured,
    visibleStatus: record.visibleStatus,
    lastCheckedAt: record.lastCheckedAt,
    lastCheckStatus: record.lastCheckStatus,
    lastCheckErrorCode: record.lastCheckErrorCode,
    lastCheckErrorMessage: record.lastCheckErrorMessage,
    holidayStateCode: record.holidayStateCode,
    lastHolidaySyncStatus: record.lastHolidaySyncStatus,
    lastSuccessfulHolidaySyncAt: record.lastSuccessfulHolidaySyncAt,
    updatedAt: record.updatedAt,
    customRecurrencePresets: record.customRecurrencePresets ?? [],
  };
};

export const loadConfiguredWasteSettings = async (
  deps: WasteManagementHandlerDeps,
  instanceId: string
): Promise<WasteManagementSettingsRecord | null> => {
  const { records, selectedInterface } = await loadSelectedWasteSettingsInterface(deps, instanceId);
  const availableInterfaces = mapWasteSettingsInterfaceOptions(deps, records, selectedInterface?.id);
  const settings = mapExternalInterfaceToWasteSettings(instanceId, selectedInterface, availableInterfaces);
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

  const { selectedInterface: interfaceRecord } = await loadSelectedWasteSettingsInterface(deps, instanceId);
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
    if (interfaceRecord.typeKey !== 'supabase') {
      throw new Error('connection_failed');
    }
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
