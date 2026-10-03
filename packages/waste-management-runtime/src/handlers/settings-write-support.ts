import type {
  WasteHolidayStateCode,
  WasteManagementEmailReminderConfig,
} from '@sva/waste-management-contracts';
import { withFixedWasteEmailReminderPaths } from '@sva/waste-management-contracts';
import { createApiError } from '@sva/server-runtime';
import type { AuthenticatedRequestContext, WasteManagementHandlerDeps } from './types.js';
import { emitWasteAuditEvent } from './auth.js';
import {
  persistWasteSettingsInterfaceSelection,
  resolveTargetInterfaceRecord,
} from './settings-write-support.interface-selection.js';
import { enqueueWasteTypesSyncAfterMutation } from './fractions-support.js';
import { updateWasteVisibleStatus } from './settings-shared.js';
import { requireDeps } from './utils.js';
import {
  createWasteSettingsSuccessResponse,
  hasManagedWasteSettingsConflict,
  loadWasteSettingsWriteContext,
  normalizeOptionalTrimmedText,
  reloadWasteSettingsOrError,
  syncWasteHolidayState,
} from './settings-write-support.context.js';
export {
  createWasteSettingsSuccessResponse,
  hasManagedWasteSettingsConflict,
  loadWasteSettingsWriteContext,
  syncWasteHolidayState,
} from './settings-write-support.context.js';
export { runWasteManagementHolidaySyncAfterValidation } from './settings-write-support.holiday-sync.js';

type UpdateWasteManagementSettingsAfterValidationInput = {
  readonly deps: WasteManagementHandlerDeps;
  readonly ctx: AuthenticatedRequestContext;
  readonly request?: Request;
  readonly instanceId: string;
  readonly requestId: string | undefined;
  readonly input: {
    readonly schemaName?: string;
    readonly enabled: boolean;
    readonly selectedInterfaceId?: string;
    readonly calendarWebUrl?: string;
    readonly pdfBrandingAssetUrl?: string;
    readonly pdfContactBlock?: string;
    readonly disruptionLocationEnabled?: boolean;
    readonly disruptionAllLocationsEnabled?: boolean;
    readonly emailReminderConfig?: WasteManagementEmailReminderConfig;
    readonly holidayStateCode?: WasteHolidayStateCode;
    readonly customRecurrencePresets: readonly Omit<
      NonNullable<
        Parameters<NonNullable<WasteManagementHandlerDeps['saveWasteCustomRecurrencePresets']>>[1]
      >['nextItems'][number],
      never
    >[];
    readonly deletedPresetFallbacks: NonNullable<
      Parameters<NonNullable<WasteManagementHandlerDeps['saveWasteCustomRecurrencePresets']>>[1]
    >['deletedPresetFallbacks'];
  };
};

export const updateWasteManagementSettingsAfterValidation = async ({
  deps,
  ctx,
  request,
  instanceId,
  requestId,
  input,
}: UpdateWasteManagementSettingsAfterValidationInput): Promise<Response> => {
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
    return createApiError(
      400,
      'invalid_request',
      'Für Waste muss zuerst eine Schnittstelle ausgewählt werden.',
      requestId
    );
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
    return createApiError(
      409,
      'invalid_request',
      'Die Waste-PostgreSQL-Schnittstelle wird ausschließlich über /interfaces verwaltet.',
      requestId
    );
  }

  const shouldRunHolidaySync =
    Boolean(input.holidayStateCode) &&
    input.holidayStateCode !== writeContext.current.holidayStateCode;
  const lastHolidaySyncStatus = shouldRunHolidaySync
    ? await syncWasteHolidayState(deps, instanceId, input.holidayStateCode)
    : writeContext.current.lastHolidaySyncStatus;
  const lastSuccessfulHolidaySyncAt =
    shouldRunHolidaySync && lastHolidaySyncStatus && lastHolidaySyncStatus !== 'failed'
      ? new Date().toISOString()
      : writeContext.current.lastSuccessfulHolidaySyncAt;
  const normalizedEmailReminderConfig = input.emailReminderConfig
    ? withFixedWasteEmailReminderPaths(input.emailReminderConfig)
    : undefined;
  const normalizedPdfStaticSettings = {
    pdfBrandingAssetUrl: normalizeOptionalTrimmedText(input.pdfBrandingAssetUrl),
    pdfContactBlock: normalizeOptionalTrimmedText(input.pdfContactBlock),
  };
  const disruptionLocationEnabled =
    input.disruptionLocationEnabled ?? writeContext.current.disruptionLocationEnabled;
  const disruptionAllLocationsEnabled =
    input.disruptionAllLocationsEnabled ?? writeContext.current.disruptionAllLocationsEnabled;
  const shouldSyncWasteTypes =
    disruptionLocationEnabled !== writeContext.current.disruptionLocationEnabled ||
    disruptionAllLocationsEnabled !== writeContext.current.disruptionAllLocationsEnabled;

  await deps.saveWastePdfStaticSettings?.(instanceId, {
    pdfBrandingAssetUrl: normalizedPdfStaticSettings.pdfBrandingAssetUrl,
    pdfContactBlock: normalizedPdfStaticSettings.pdfContactBlock,
    disruptionLocationEnabled,
    disruptionAllLocationsEnabled,
  });
  await persistWasteSettingsInterfaceSelection({
    deps,
    interfaceRecords: writeContext.interfaceRecords,
    targetInterfaceRecord,
    calendarWebUrl: input.calendarWebUrl?.trim(),
    emailReminderConfig: normalizedEmailReminderConfig,
    holidayStateCode: input.holidayStateCode,
    lastHolidaySyncStatus,
    lastSuccessfulHolidaySyncAt,
  });
  await requireDeps(deps.saveWasteCustomRecurrencePresets, 'saveWasteCustomRecurrencePresets')(
    instanceId,
    {
      nextItems: input.customRecurrencePresets,
      deletedPresetFallbacks: input.deletedPresetFallbacks,
    }
  );

  const saved = await reloadWasteSettingsOrError({ deps, instanceId, requestId });
  if (saved instanceof Response) {
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
    return saved;
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
  const syncMetadata =
    shouldSyncWasteTypes && request
      ? await enqueueWasteTypesSyncAfterMutation(request, ctx, deps, instanceId)
      : shouldSyncWasteTypes
        ? { syncStatus: 'failed' as const }
        : {};

  return createWasteSettingsSuccessResponse(
    saved,
    requestId,
    input.holidayStateCode,
    lastHolidaySyncStatus,
    syncMetadata
  );
};
