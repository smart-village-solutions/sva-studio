import {
  buildWasteManagementPublicConfig,
  isWasteManagementInterfaceSelected,
  readWasteManagementCalendarWebUrl,
  readWasteManagementHolidayStateCode,
  readWasteManagementHolidaySyncStatus,
  readWasteManagementLastSuccessfulHolidaySyncAt,
  readWasteManagementPdfBrandingAssetUrl,
  readWasteManagementPdfContactBlock,
  type ExternalInterfaceRecord,
  type WasteHolidayStateCode,
  type WasteHolidaySyncStatus,
  type WasteManagementSettingsRecord,
} from '@sva/core';

import type { AuthenticatedRequestContext } from '../../middleware.js';
import { asApiItem, createApiError } from '../../shared/request-helpers.js';
import { emitWasteAuditEvent } from './auth.js';
import { loadConfiguredWasteSettings } from './settings-shared.js';
import { updateWasteVisibleStatus } from './settings-shared.js';
import type { WasteManagementHandlerDeps } from './types.js';
import { requireDeps } from './utils.js';

export const loadWasteSettingsWriteContext = async (
  deps: WasteManagementHandlerDeps,
  instanceId: string,
  requestId: string | undefined
): Promise<
  | Response
  | {
      readonly current: WasteManagementSettingsRecord;
      readonly interfaceRecords: readonly ExternalInterfaceRecord[];
    }
> => {
  const current = await loadConfiguredWasteSettings(deps, instanceId);
  let interfaceRecords: readonly ExternalInterfaceRecord[] = [];
  if (deps.listInterfaceRecords) {
    interfaceRecords = await deps.listInterfaceRecords(instanceId);
  } else if (deps.loadDefaultInterfaceRecord) {
    const fallbackRecord = await deps.loadDefaultInterfaceRecord(instanceId, 'supabase');
    interfaceRecords = fallbackRecord ? [fallbackRecord] : [];
  }

  return current
    ? { current, interfaceRecords }
    : createApiError(503, 'database_unavailable', 'Die Waste-Einstellungen konnten nicht geladen werden.', requestId);
};

export const hasManagedWasteSettingsConflict = (
  interfaceRecord: ExternalInterfaceRecord,
  input: {
    readonly projectUrl: string;
    readonly schemaName?: string;
    readonly enabled: boolean;
  }
): boolean => {
  if (interfaceRecord.typeKey !== 'supabase') {
    return false;
  }

  const currentProjectUrl = typeof interfaceRecord.publicConfig.projectUrl === 'string' ? interfaceRecord.publicConfig.projectUrl : '';
  const currentSchemaName =
    typeof interfaceRecord.publicConfig.schemaName === 'string' && interfaceRecord.publicConfig.schemaName.trim().length > 0
      ? interfaceRecord.publicConfig.schemaName
      : 'public';
  const nextSchemaName = input.schemaName?.trim() || 'public';

  return currentProjectUrl !== input.projectUrl || currentSchemaName !== nextSchemaName || interfaceRecord.enabled !== input.enabled;
};

export const syncWasteHolidayState = async (
  deps: WasteManagementHandlerDeps,
  instanceId: string,
  holidayStateCode?: WasteHolidayStateCode
): Promise<WasteHolidaySyncStatus | undefined> => {
  if (!holidayStateCode) {
    return undefined;
  }

  try {
    return await requireDeps(deps.syncWasteHolidayRules, 'syncWasteHolidayRules')(instanceId, holidayStateCode);
  } catch {
    return 'failed';
  }
};

export const createWasteSettingsSuccessResponse = (
  saved: WasteManagementSettingsRecord,
  requestId: string | undefined,
  holidayStateCode: WasteHolidayStateCode | undefined,
  lastHolidaySyncStatus: WasteHolidaySyncStatus | undefined
): Response =>
  new Response(
    JSON.stringify(
      asApiItem(
        {
          ...saved,
          holidayStateCode,
          lastHolidaySyncStatus,
        },
        requestId
      )
    ),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }
  );

const resolveTargetInterfaceRecord = (
  interfaceRecords: readonly ExternalInterfaceRecord[],
  current: WasteManagementSettingsRecord,
  selectedInterfaceId?: string
): ExternalInterfaceRecord | null => {
  const explicitMatch = selectedInterfaceId
    ? interfaceRecords.find((record) => record.id === selectedInterfaceId) ?? null
    : null;
  if (explicitMatch) {
    return explicitMatch;
  }

  if (current.selectedInterfaceId) {
    const currentMatch = interfaceRecords.find((record) => record.id === current.selectedInterfaceId);
    if (currentMatch) {
      return currentMatch;
    }
  }

  return interfaceRecords.find((record) => isWasteManagementInterfaceSelected(record)) ?? null;
};

const createInterfaceSettingsRecord = (
  interfaceRecord: ExternalInterfaceRecord,
  input: {
    readonly selected: boolean;
    readonly calendarWebUrl?: string;
    readonly pdfBrandingAssetUrl?: string;
    readonly pdfContactBlock?: string;
    readonly holidayStateCode?: WasteHolidayStateCode;
    readonly lastHolidaySyncStatus?: WasteHolidaySyncStatus;
    readonly lastSuccessfulHolidaySyncAt?: string;
  }
): ExternalInterfaceRecord => ({
  ...interfaceRecord,
  publicConfig: buildWasteManagementPublicConfig(interfaceRecord.publicConfig, input),
});

const persistWasteSettingsInterfaceSelection = async ({
  deps,
  interfaceRecords,
  targetInterfaceRecord,
  calendarWebUrl,
  pdfBrandingAssetUrl,
  pdfContactBlock,
  holidayStateCode,
  lastHolidaySyncStatus,
  lastSuccessfulHolidaySyncAt,
}: {
  readonly deps: WasteManagementHandlerDeps;
  readonly interfaceRecords: readonly ExternalInterfaceRecord[];
  readonly targetInterfaceRecord: ExternalInterfaceRecord;
  readonly calendarWebUrl?: string;
  readonly pdfBrandingAssetUrl?: string;
  readonly pdfContactBlock?: string;
  readonly holidayStateCode?: WasteHolidayStateCode;
  readonly lastHolidaySyncStatus?: WasteHolidaySyncStatus;
  readonly lastSuccessfulHolidaySyncAt?: string;
}): Promise<void> => {
  const saveExternalInterfaceRecord = requireDeps(deps.saveExternalInterfaceRecord, 'saveExternalInterfaceRecord');

  const recordsToPersist = interfaceRecords.filter(
    (record) => record.id === targetInterfaceRecord.id || isWasteManagementInterfaceSelected(record)
  );

  for (const record of recordsToPersist) {
    const isTarget = record.id === targetInterfaceRecord.id;
    await saveExternalInterfaceRecord(
      createInterfaceSettingsRecord(record, {
        selected: isTarget,
        calendarWebUrl: isTarget ? calendarWebUrl : readWasteManagementCalendarWebUrl(record.publicConfig),
        pdfBrandingAssetUrl: isTarget
          ? pdfBrandingAssetUrl
          : readWasteManagementPdfBrandingAssetUrl(record.publicConfig),
        pdfContactBlock: isTarget ? pdfContactBlock : readWasteManagementPdfContactBlock(record.publicConfig),
        holidayStateCode: isTarget ? holidayStateCode : readWasteManagementHolidayStateCode(record.publicConfig),
        lastHolidaySyncStatus: isTarget ? lastHolidaySyncStatus : readWasteManagementHolidaySyncStatus(record.publicConfig),
        lastSuccessfulHolidaySyncAt: isTarget
          ? lastSuccessfulHolidaySyncAt
          : readWasteManagementLastSuccessfulHolidaySyncAt(record.publicConfig),
      })
    );
  }
};

export const updateWasteManagementSettingsAfterValidation = async ({
  deps,
  ctx,
  instanceId,
  requestId,
  input,
}: {
  readonly deps: WasteManagementHandlerDeps;
  readonly ctx: AuthenticatedRequestContext;
  readonly instanceId: string;
  readonly requestId: string | undefined;
  readonly input: {
    readonly projectUrl: string;
    readonly schemaName?: string;
    readonly enabled: boolean;
    readonly selectedInterfaceId?: string;
    readonly calendarWebUrl?: string;
    readonly pdfBrandingAssetUrl?: string;
    readonly pdfContactBlock?: string;
    readonly holidayStateCode?: WasteHolidayStateCode;
    readonly customRecurrencePresets: readonly Omit<NonNullable<Parameters<NonNullable<WasteManagementHandlerDeps['saveWasteCustomRecurrencePresets']>>[1]>['nextItems'][number], never>[];
    readonly deletedPresetFallbacks: NonNullable<Parameters<NonNullable<WasteManagementHandlerDeps['saveWasteCustomRecurrencePresets']>>[1]>['deletedPresetFallbacks'];
  };
}): Promise<Response> => {
  const writeContext = await loadWasteSettingsWriteContext(deps, instanceId, requestId);
  if (writeContext instanceof Response) {
    return writeContext;
  }

  const targetInterfaceRecord = resolveTargetInterfaceRecord(
    writeContext.interfaceRecords,
    writeContext.current,
    input.selectedInterfaceId
  );
  if (!targetInterfaceRecord) {
    return createApiError(400, 'invalid_request', 'Für Waste muss zuerst eine Schnittstelle ausgewählt werden.', requestId);
  }

  if (hasManagedWasteSettingsConflict(targetInterfaceRecord, input)) {
    await emitWasteAuditEvent({
      deps,
      ctx,
      instanceId,
      actionId: 'waste-management.settings.updated',
      result: 'failure',
      reasonCode: 'managed_via_interfaces',
      resourceType: 'waste_data_source',
      resourceId: instanceId,
    });
    return createApiError(409, 'invalid_request', 'Die Waste-Supabase wird ausschließlich über /interfaces verwaltet.', requestId);
  }

  const shouldRunHolidaySync =
    Boolean(input.holidayStateCode) && input.holidayStateCode !== writeContext.current.holidayStateCode;
  const lastHolidaySyncStatus = shouldRunHolidaySync
    ? await syncWasteHolidayState(deps, instanceId, input.holidayStateCode)
    : writeContext.current.lastHolidaySyncStatus;
  const lastSuccessfulHolidaySyncAt =
    shouldRunHolidaySync && lastHolidaySyncStatus && lastHolidaySyncStatus !== 'failed'
      ? new Date().toISOString()
      : writeContext.current.lastSuccessfulHolidaySyncAt;

  await persistWasteSettingsInterfaceSelection({
    deps,
    interfaceRecords: writeContext.interfaceRecords,
    targetInterfaceRecord,
    calendarWebUrl: input.calendarWebUrl?.trim(),
    pdfBrandingAssetUrl: input.pdfBrandingAssetUrl?.trim(),
    pdfContactBlock: input.pdfContactBlock?.trim(),
    holidayStateCode: input.holidayStateCode,
    lastHolidaySyncStatus,
    lastSuccessfulHolidaySyncAt,
  });
  await requireDeps(deps.saveWasteCustomRecurrencePresets, 'saveWasteCustomRecurrencePresets')(instanceId, {
    nextItems: input.customRecurrencePresets,
    deletedPresetFallbacks: input.deletedPresetFallbacks,
  });

  const saved = await loadConfiguredWasteSettings(deps, instanceId);
  if (!saved) {
    await emitWasteAuditEvent({
      deps,
      ctx,
      instanceId,
      actionId: 'waste-management.settings.updated',
      result: 'failure',
      reasonCode: 'verification_failed',
      resourceType: 'waste_data_source',
      resourceId: instanceId,
    });
    return createApiError(503, 'database_unavailable', 'Die Waste-Einstellungen konnten nicht verifiziert werden.', requestId);
  }

  await emitWasteAuditEvent({
    deps,
    ctx,
    instanceId,
    actionId: 'waste-management.settings.updated',
    result: 'success',
    resourceType: 'waste_data_source',
    resourceId: instanceId,
  });
  await updateWasteVisibleStatus(deps, instanceId, 'success');

  return createWasteSettingsSuccessResponse(saved, requestId, input.holidayStateCode, lastHolidaySyncStatus);
};

export const runWasteManagementHolidaySyncAfterValidation = async ({
  deps,
  ctx,
  instanceId,
  requestId,
}: {
  readonly deps: WasteManagementHandlerDeps;
  readonly ctx: AuthenticatedRequestContext;
  readonly instanceId: string;
  readonly requestId: string | undefined;
}): Promise<Response> => {
  const writeContext = await loadWasteSettingsWriteContext(deps, instanceId, requestId);
  if (writeContext instanceof Response) {
    return writeContext;
  }
  const targetInterfaceRecord = resolveTargetInterfaceRecord(
    writeContext.interfaceRecords,
    writeContext.current,
    writeContext.current.selectedInterfaceId
  );
  if (!targetInterfaceRecord) {
    return createApiError(400, 'invalid_request', 'Für Waste muss zuerst eine Schnittstelle ausgewählt werden.', requestId);
  }
  if (!writeContext.current.holidayStateCode) {
    return createApiError(
      400,
      'invalid_request',
      'Für den Feiertagssync muss zuerst ein Bundesland in den Waste-Einstellungen gespeichert werden.',
      requestId
    );
  }

  const lastHolidaySyncStatus = (await syncWasteHolidayState(deps, instanceId, writeContext.current.holidayStateCode)) ?? 'failed';
  await persistWasteSettingsInterfaceSelection({
    deps,
    interfaceRecords: writeContext.interfaceRecords,
    targetInterfaceRecord,
    calendarWebUrl: writeContext.current.calendarWebUrl,
    pdfBrandingAssetUrl: writeContext.current.pdfBrandingAssetUrl,
    pdfContactBlock: writeContext.current.pdfContactBlock,
    holidayStateCode: writeContext.current.holidayStateCode,
    lastHolidaySyncStatus,
    lastSuccessfulHolidaySyncAt:
      lastHolidaySyncStatus !== 'failed' ? new Date().toISOString() : writeContext.current.lastSuccessfulHolidaySyncAt,
  });

  const saved = await loadConfiguredWasteSettings(deps, instanceId);
  if (!saved) {
    return createApiError(503, 'database_unavailable', 'Die Waste-Einstellungen konnten nicht verifiziert werden.', requestId);
  }

  await emitWasteAuditEvent({
    deps,
    ctx,
    instanceId,
    actionId: 'waste-management.settings.holiday-sync.triggered',
    result: 'success',
    resourceType: 'waste_data_source',
    resourceId: instanceId,
  });

  return createWasteSettingsSuccessResponse(saved, requestId, writeContext.current.holidayStateCode, lastHolidaySyncStatus);
};
