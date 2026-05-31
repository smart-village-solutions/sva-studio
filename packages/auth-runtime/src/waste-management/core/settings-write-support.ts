import type { ExternalInterfaceRecord, WasteHolidayStateCode, WasteHolidaySyncStatus, WasteManagementSettingsRecord } from '@sva/core';

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
      readonly interfaceRecord: ExternalInterfaceRecord;
    }
> => {
  const current = await loadConfiguredWasteSettings(deps, instanceId);
  const interfaceRecord = await requireDeps(deps.loadDefaultInterfaceRecord, 'loadDefaultInterfaceRecord')(instanceId, 'supabase');

  return current && interfaceRecord
    ? { current, interfaceRecord }
    : createApiError(503, 'database_unavailable', 'Die Waste-Einstellungen konnten nicht geladen werden.', requestId);
};

export const hasManagedWasteSettingsConflict = (
  current: WasteManagementSettingsRecord,
  input: {
    readonly projectUrl: string;
    readonly schemaName?: string;
    readonly enabled: boolean;
  }
): boolean => {
  const currentSchemaName = current.schemaName ?? 'public';
  const nextSchemaName = input.schemaName?.trim() || 'public';

  return current.projectUrl !== input.projectUrl || currentSchemaName !== nextSchemaName || current.enabled !== input.enabled;
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

export const buildWasteSettingsPublicConfig = (
  interfaceRecord: ExternalInterfaceRecord,
  holidayStateCode: WasteHolidayStateCode | undefined,
  lastHolidaySyncStatus: WasteHolidaySyncStatus | undefined
): Record<string, unknown> => {
  const nextPublicConfig: Record<string, unknown> = {
    ...interfaceRecord.publicConfig,
    holidayStateCode,
  };

  if (lastHolidaySyncStatus) {
    nextPublicConfig.lastHolidaySyncStatus = lastHolidaySyncStatus;
  } else {
    delete nextPublicConfig.lastHolidaySyncStatus;
  }

  return nextPublicConfig;
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
    readonly holidayStateCode?: WasteHolidayStateCode;
    readonly customRecurrencePresets: readonly Omit<NonNullable<Parameters<NonNullable<WasteManagementHandlerDeps['saveWasteCustomRecurrencePresets']>>[1]>['nextItems'][number], never>[];
    readonly deletedPresetFallbacks: NonNullable<Parameters<NonNullable<WasteManagementHandlerDeps['saveWasteCustomRecurrencePresets']>>[1]>['deletedPresetFallbacks'];
  };
}): Promise<Response> => {
  const writeContext = await loadWasteSettingsWriteContext(deps, instanceId, requestId);
  if (writeContext instanceof Response) {
    return writeContext;
  }

  if (hasManagedWasteSettingsConflict(writeContext.current, input)) {
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

  const lastHolidaySyncStatus = await syncWasteHolidayState(deps, instanceId, input.holidayStateCode);
  await requireDeps(deps.saveExternalInterfaceRecord, 'saveExternalInterfaceRecord')({
    ...writeContext.interfaceRecord,
    publicConfig: buildWasteSettingsPublicConfig(writeContext.interfaceRecord, input.holidayStateCode, lastHolidaySyncStatus),
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
  if (!writeContext.current.holidayStateCode) {
    return createApiError(
      400,
      'invalid_request',
      'Für den Feiertagssync muss zuerst ein Bundesland in den Waste-Einstellungen gespeichert werden.',
      requestId
    );
  }

  const lastHolidaySyncStatus = (await syncWasteHolidayState(deps, instanceId, writeContext.current.holidayStateCode)) ?? 'failed';
  await requireDeps(deps.saveExternalInterfaceRecord, 'saveExternalInterfaceRecord')({
    ...writeContext.interfaceRecord,
    publicConfig: buildWasteSettingsPublicConfig(
      writeContext.interfaceRecord,
      writeContext.current.holidayStateCode,
      lastHolidaySyncStatus
    ),
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
