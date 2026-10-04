import type { ExternalInterfaceRecord } from '@sva/core';
import type {
  WasteHolidayStateCode,
  WasteHolidaySyncStatus,
  WasteManagementSettingsRecord,
} from '@sva/waste-management-contracts';
import { asApiItem, createApiError } from '@sva/server-runtime';
import type { WasteManagementHandlerDeps } from './types.js';
import { loadConfiguredWasteSettings } from './settings-shared.js';
import { requireDeps } from './utils.js';
import type { WasteTypesSyncMetadata } from './fractions-support.js';

export const normalizeOptionalTrimmedText = (value: string | undefined): string | undefined => {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
};

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
    const fallbackRecord = await deps.loadDefaultInterfaceRecord(instanceId, 'postgresql');
    interfaceRecords = fallbackRecord ? [fallbackRecord] : [];
  }

  return current
    ? { current, interfaceRecords }
    : createApiError(
        503,
        'database_unavailable',
        'Die Waste-Einstellungen konnten nicht geladen werden.',
        requestId
      );
};

export const hasManagedWasteSettingsConflict = (
  interfaceRecord: ExternalInterfaceRecord,
  input: {
    readonly schemaName?: string;
    readonly enabled: boolean;
  }
): boolean => {
  if (interfaceRecord.typeKey !== 'postgresql') {
    return false;
  }

  const currentSchemaName =
    typeof interfaceRecord.publicConfig.schemaName === 'string' &&
    interfaceRecord.publicConfig.schemaName.trim().length > 0
      ? interfaceRecord.publicConfig.schemaName
      : 'public';
  const nextSchemaName = input.schemaName?.trim() || 'public';

  return currentSchemaName !== nextSchemaName || interfaceRecord.enabled !== input.enabled;
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
    return await requireDeps(deps.syncWasteHolidayRules, 'syncWasteHolidayRules')(
      instanceId,
      holidayStateCode
    );
  } catch {
    return 'failed';
  }
};

export const createWasteSettingsSuccessResponse = (
  saved: WasteManagementSettingsRecord,
  requestId: string | undefined,
  holidayStateCode: WasteHolidayStateCode | undefined,
  lastHolidaySyncStatus: WasteHolidaySyncStatus | undefined,
  syncMetadata: WasteTypesSyncMetadata = {}
): Response =>
  new Response(
    JSON.stringify({
      ...asApiItem(
        {
          ...saved,
          holidayStateCode,
          lastHolidaySyncStatus,
        },
        requestId
      ),
      ...(syncMetadata.syncStatus ? { syncStatus: syncMetadata.syncStatus } : {}),
      ...(syncMetadata.syncJob ? { syncJob: syncMetadata.syncJob } : {}),
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }
  );

export const reloadWasteSettingsOrError = async (input: {
  readonly deps: WasteManagementHandlerDeps;
  readonly instanceId: string;
  readonly requestId: string | undefined;
}): Promise<WasteManagementSettingsRecord | Response> => {
  const saved = await loadConfiguredWasteSettings(input.deps, input.instanceId);
  return (
    saved ??
    createApiError(
      503,
      'database_unavailable',
      'Die Waste-Einstellungen konnten nicht verifiziert werden.',
      input.requestId
    )
  );
};
