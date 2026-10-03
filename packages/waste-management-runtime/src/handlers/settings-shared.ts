import type { ExternalInterfaceConnectionCheckRecord } from '@sva/core';
import type {
  WasteManagementDataSourceRecord,
  WasteManagementSettingsRecord,
  WastePdfStaticSettingsRecord,
} from '@sva/waste-management-contracts';
import type { WasteManagementHandlerDeps } from './types.js';
import {
  loadSelectedWasteSettingsInterface,
  mapExternalInterfaceToWasteSettings,
  mapWasteSettingsInterfaceOptions,
} from './settings-shared.interface-records.js';

const hasWastePdfStaticSettingsValue = (
  wastePdfStaticSettings: WastePdfStaticSettingsRecord | null | undefined
): wastePdfStaticSettings is WastePdfStaticSettingsRecord =>
  Boolean(wastePdfStaticSettings?.pdfBrandingAssetUrl || wastePdfStaticSettings?.pdfContactBlock);

const isMissingWasteSettingsTableError = (error: unknown): boolean =>
  error instanceof Error &&
  (('code' in error ? error.code : undefined) === '42P01' ||
    /relation "?waste_settings"? does not exist/i.test(error.message));

const canLoadWastePdfStaticSettings = (settings: WasteManagementSettingsRecord): boolean =>
  settings.selectedInterfaceTypeKey === 'postgresql' && settings.databaseUrlConfigured;

const applyWastePdfStaticSettings = (
  settings: WasteManagementSettingsRecord,
  wastePdfStaticSettings: WastePdfStaticSettingsRecord | null | undefined
): WasteManagementSettingsRecord => ({
  ...settings,
  disruptionLocationEnabled:
    wastePdfStaticSettings?.disruptionLocationEnabled ?? settings.disruptionLocationEnabled,
  disruptionAllLocationsEnabled:
    wastePdfStaticSettings?.disruptionAllLocationsEnabled ?? settings.disruptionAllLocationsEnabled,
  ...(hasWastePdfStaticSettingsValue(wastePdfStaticSettings)
    ? {
        pdfBrandingAssetUrl:
          wastePdfStaticSettings.pdfBrandingAssetUrl ?? settings.pdfBrandingAssetUrl,
        pdfContactBlock: wastePdfStaticSettings.pdfContactBlock ?? settings.pdfContactBlock,
      }
    : {}),
});

export const sanitizeWasteSettings = (
  record: WasteManagementDataSourceRecord | null | undefined
): WasteManagementSettingsRecord | null => {
  if (!record) {
    return null;
  }

  return {
    instanceId: record.instanceId,
    provider: record.provider,
    schemaName: record.schemaName,
    enabled: record.enabled,
    selectedInterfaceId: record.selectedInterfaceId,
    selectedInterfaceName: record.selectedInterfaceName,
    selectedInterfaceTypeKey: record.selectedInterfaceTypeKey,
    availableInterfaces: record.availableInterfaces,
    calendarWebUrl: record.calendarWebUrl,
    pdfBrandingAssetUrl: record.pdfBrandingAssetUrl,
    pdfContactBlock: record.pdfContactBlock,
    disruptionLocationEnabled: record.disruptionLocationEnabled,
    disruptionAllLocationsEnabled: record.disruptionAllLocationsEnabled,
    databaseUrlConfigured: record.databaseUrlConfigured,
    visibleStatus: record.visibleStatus,
    provisioningStatus: record.provisioningStatus,
    provisioningErrorCode: record.provisioningErrorCode,
    provisioningUpdatedAt: record.provisioningUpdatedAt,
    lastCheckedAt: record.lastCheckedAt,
    lastCheckStatus: record.lastCheckStatus,
    lastCheckErrorCode: record.lastCheckErrorCode,
    lastCheckErrorMessage: record.lastCheckErrorMessage,
    holidayStateCode: record.holidayStateCode,
    lastHolidaySyncStatus: record.lastHolidaySyncStatus,
    lastSuccessfulHolidaySyncAt: record.lastSuccessfulHolidaySyncAt,
    updatedAt: record.updatedAt,
    customRecurrencePresets: record.customRecurrencePresets ?? [],
    ...(record.emailReminderConfig ? { emailReminderConfig: record.emailReminderConfig } : {}),
  };
};

export const loadConfiguredWasteSettings = async (
  deps: WasteManagementHandlerDeps,
  instanceId: string
): Promise<WasteManagementSettingsRecord | null> => {
  const { records, selectedInterface } = await loadSelectedWasteSettingsInterface(deps, instanceId);
  const availableInterfaces = mapWasteSettingsInterfaceOptions(
    deps,
    records,
    selectedInterface?.id
  );
  const settings = mapExternalInterfaceToWasteSettings(
    instanceId,
    selectedInterface,
    availableInterfaces
  );
  if (!settings) {
    return null;
  }

  const provisioning = deps.loadWasteTenantProvisioning
    ? await deps.loadWasteTenantProvisioning(instanceId)
    : null;

  const customRecurrencePresets = deps.loadWasteCustomRecurrencePresets
    ? await deps.loadWasteCustomRecurrencePresets(instanceId)
    : [];
  let wastePdfStaticSettings: WastePdfStaticSettingsRecord | null = null;
  if (deps.loadWastePdfStaticSettings && canLoadWastePdfStaticSettings(settings)) {
    try {
      wastePdfStaticSettings = await deps.loadWastePdfStaticSettings(instanceId);
    } catch (error) {
      if (!isMissingWasteSettingsTableError(error)) {
        throw error;
      }
    }
  }

  return applyWastePdfStaticSettings(
    {
      ...settings,
      customRecurrencePresets,
      ...(provisioning
        ? {
            provisioningStatus: provisioning.status,
            provisioningErrorCode: provisioning.errorCode,
            provisioningUpdatedAt: provisioning.updatedAt,
          }
        : {}),
    },
    wastePdfStaticSettings
  );
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

  const { selectedInterface: interfaceRecord } = await loadSelectedWasteSettingsInterface(
    deps,
    instanceId
  );
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

  if (!deps.checkWasteConnection) {
    return;
  }

  try {
    if (interfaceRecord.typeKey !== 'postgresql') {
      throw new Error('connection_failed');
    }
    const connectionCheck = await deps.checkWasteConnection(instanceId, interfaceRecord.id);
    await persistWasteConnectionState(deps, {
      ...connectionCheck,
      interfaceId: interfaceRecord.id,
    });
  } catch (error) {
    const errorCode =
      error instanceof Error && 'code' in error && typeof error.code === 'string'
        ? error.code
        : 'connection_failed';
    const errorMessage =
      error instanceof Error ? error.message : 'Connection-Check fehlgeschlagen.';
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
