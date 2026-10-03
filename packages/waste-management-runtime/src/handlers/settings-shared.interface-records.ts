import type { ExternalInterfaceRecord } from '@sva/core';
import {
  type WasteManagementDataSourceRecord,
  type WasteManagementSettingsInterfaceOption,
  type WasteManagementSettingsRecord,
  findSelectedWasteManagementInterfaceRecord,
  readWasteManagementCalendarWebUrl,
  readWasteManagementEmailReminderConfig,
  readWasteManagementHolidayStateCode,
  readWasteManagementHolidaySyncStatus,
  readWasteManagementLastSuccessfulHolidaySyncAt,
  readWasteManagementPdfBrandingAssetUrl,
  readWasteManagementPdfContactBlock,
} from '@sva/waste-management-contracts';
import type { WasteManagementHandlerDeps } from './types.js';
import { requireDeps } from './utils.js';

const normalizeInterfaceWasteVisibleStatus = (
  status: 'not_configured' | 'unknown' | 'ok' | 'error' | 'disabled'
): WasteManagementDataSourceRecord['visibleStatus'] => (status === 'disabled' ? 'unknown' : status);

export const mapExternalInterfaceToWasteSettings = (
  instanceId: string,
  record: ExternalInterfaceRecord | null,
  availableInterfaces: readonly WasteManagementSettingsInterfaceOption[]
): WasteManagementSettingsRecord | null => {
  if (!record) {
    return {
      instanceId,
      provider: 'postgresql',
      schemaName: 'public',
      enabled: false,
      disruptionLocationEnabled: false,
      disruptionAllLocationsEnabled: false,
      availableInterfaces,
      databaseUrlConfigured: false,
      visibleStatus: 'not_configured',
      customRecurrencePresets: [],
    };
  }

  const isPostgresql = record.typeKey === 'postgresql';
  const emailReminderConfig = readWasteManagementEmailReminderConfig(record.publicConfig);
  return {
    instanceId: record.instanceId,
    provider: 'postgresql',
    schemaName:
      isPostgresql &&
      typeof record.publicConfig.schemaName === 'string' &&
      record.publicConfig.schemaName.trim().length > 0
        ? record.publicConfig.schemaName
        : 'public',
    enabled: record.enabled,
    disruptionLocationEnabled: false,
    disruptionAllLocationsEnabled: false,
    selectedInterfaceId: record.id,
    selectedInterfaceName: record.displayName,
    selectedInterfaceTypeKey: record.typeKey,
    availableInterfaces,
    calendarWebUrl: readWasteManagementCalendarWebUrl(record.publicConfig),
    pdfBrandingAssetUrl: readWasteManagementPdfBrandingAssetUrl(record.publicConfig),
    pdfContactBlock: readWasteManagementPdfContactBlock(record.publicConfig),
    databaseUrlConfigured: isPostgresql ? Boolean(record.secretConfigCiphertext) : false,
    visibleStatus: isPostgresql
      ? normalizeInterfaceWasteVisibleStatus(record.visibleStatus)
      : 'not_configured',
    lastCheckedAt: record.lastCheckedAt,
    lastCheckStatus: record.lastCheckStatus,
    lastCheckErrorCode: record.lastCheckErrorCode,
    lastCheckErrorMessage: record.lastCheckErrorMessage,
    holidayStateCode: readWasteManagementHolidayStateCode(record.publicConfig),
    lastHolidaySyncStatus: readWasteManagementHolidaySyncStatus(record.publicConfig),
    lastSuccessfulHolidaySyncAt: readWasteManagementLastSuccessfulHolidaySyncAt(
      record.publicConfig
    ),
    updatedAt: record.updatedAt,
    customRecurrencePresets: [],
    ...(emailReminderConfig ? { emailReminderConfig } : {}),
  };
};

export const mapWasteSettingsInterfaceOptions = (
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
    const fallbackRecord = await deps.loadDefaultInterfaceRecord(instanceId, 'postgresql');
    return fallbackRecord ? [fallbackRecord] : [];
  }

  return [];
};

export const loadSelectedWasteSettingsInterface = async (
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

  const fallbackDefault = await requireDeps(
    deps.loadDefaultInterfaceRecord,
    'loadDefaultInterfaceRecord'
  )(instanceId, 'postgresql');
  return {
    records,
    selectedInterface: fallbackDefault,
  };
};
