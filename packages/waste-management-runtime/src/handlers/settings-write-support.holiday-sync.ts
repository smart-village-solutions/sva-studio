import { createApiError } from '@sva/server-runtime';
import type { AuthenticatedRequestContext, WasteManagementHandlerDeps } from './types.js';
import { emitWasteAuditEvent } from './auth.js';
import {
  persistWasteSettingsInterfaceSelection,
  resolveTargetInterfaceRecord,
} from './settings-write-support.interface-selection.js';
import {
  createWasteSettingsSuccessResponse,
  loadWasteSettingsWriteContext,
  normalizeOptionalTrimmedText,
  reloadWasteSettingsOrError,
  syncWasteHolidayState,
} from './settings-write-support.context.js';

type HolidaySyncInput = {
  readonly deps: WasteManagementHandlerDeps;
  readonly ctx: AuthenticatedRequestContext;
  readonly instanceId: string;
  readonly requestId: string | undefined;
};

export const runWasteManagementHolidaySyncAfterValidation = async ({
  deps,
  ctx,
  instanceId,
  requestId,
}: HolidaySyncInput): Promise<Response> => {
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
    return createApiError(
      400,
      'invalid_request',
      'Für Waste muss zuerst eine Schnittstelle ausgewählt werden.',
      requestId
    );
  }
  if (!writeContext.current.holidayStateCode) {
    return createApiError(
      400,
      'invalid_request',
      'Für den Feiertagssync muss zuerst ein Bundesland in den Waste-Einstellungen gespeichert werden.',
      requestId
    );
  }

  const lastHolidaySyncStatus =
    (await syncWasteHolidayState(deps, instanceId, writeContext.current.holidayStateCode)) ??
    'failed';
  await deps.saveWastePdfStaticSettings?.(instanceId, {
    pdfBrandingAssetUrl: normalizeOptionalTrimmedText(writeContext.current.pdfBrandingAssetUrl),
    pdfContactBlock: normalizeOptionalTrimmedText(writeContext.current.pdfContactBlock),
    disruptionLocationEnabled: writeContext.current.disruptionLocationEnabled,
    disruptionAllLocationsEnabled: writeContext.current.disruptionAllLocationsEnabled,
  });
  await persistWasteSettingsInterfaceSelection({
    deps,
    interfaceRecords: writeContext.interfaceRecords,
    targetInterfaceRecord,
    calendarWebUrl: writeContext.current.calendarWebUrl,
    emailReminderConfig: writeContext.current.emailReminderConfig,
    holidayStateCode: writeContext.current.holidayStateCode,
    lastHolidaySyncStatus,
    lastSuccessfulHolidaySyncAt:
      lastHolidaySyncStatus !== 'failed'
        ? new Date().toISOString()
        : writeContext.current.lastSuccessfulHolidaySyncAt,
  });

  const saved = await reloadWasteSettingsOrError({ deps, instanceId, requestId });
  if (saved instanceof Response) {
    return saved;
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

  return createWasteSettingsSuccessResponse(
    saved,
    requestId,
    writeContext.current.holidayStateCode,
    lastHolidaySyncStatus
  );
};
