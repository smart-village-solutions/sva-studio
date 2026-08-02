import {
  readWasteManagementEmailReminderConfig,
  readWasteManagementEmailReminderSigningSecret,
  type ExternalInterfaceRecord,
  type WasteManagementEmailReminderConfig,
} from '@sva/core';
import type { WasteOperationRuntimeDeps } from './waste-management-operations.types.js';

const loadSelectedWastePostgresqlRecord = async (
  deps: WasteOperationRuntimeDeps,
  instanceId: string,
): Promise<ExternalInterfaceRecord | null> => {
  if (deps.listInterfaceRecords) {
    const records = await deps.listInterfaceRecords(instanceId);
    return (
      records.find((record) => record.typeKey === 'postgresql' && record.publicConfig.wasteManagementSelected === true)
      ?? records.find((record) => record.typeKey === 'postgresql' && record.isDefault)
      ?? records.find((record) => record.typeKey === 'postgresql')
      ?? null
    );
  }
  return (await deps.loadDefaultInterfaceRecord?.(instanceId, 'postgresql')) ?? null;
};

export const loadWasteEmailReminderSettings = async (
  deps: WasteOperationRuntimeDeps,
  instanceId: string,
): Promise<{
  readonly config: WasteManagementEmailReminderConfig;
  readonly unsubscribeSigningSecret?: string;
} | null> => {
  const selectedPostgresql = await loadSelectedWastePostgresqlRecord(deps, instanceId);
  const config = selectedPostgresql
    ? readWasteManagementEmailReminderConfig(selectedPostgresql.publicConfig) ?? null
    : null;
  if (!selectedPostgresql || !config) {
    return null;
  }
  return {
    config,
    unsubscribeSigningSecret: readWasteManagementEmailReminderSigningSecret(selectedPostgresql.publicConfig),
  };
};
