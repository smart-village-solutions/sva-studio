import {
  readWasteManagementEmailReminderConfig,
  readWasteManagementEmailReminderSigningSecret,
  type ExternalInterfaceRecord,
  type WasteManagementEmailReminderConfig,
} from '@sva/core';
import type { WasteOperationRuntimeDeps } from './waste-management-operations.types.js';

const loadSelectedWasteSupabaseRecord = async (
  deps: WasteOperationRuntimeDeps,
  instanceId: string,
): Promise<ExternalInterfaceRecord | null> => {
  if (deps.listInterfaceRecords) {
    const records = await deps.listInterfaceRecords(instanceId);
    return (
      records.find((record) => record.typeKey === 'supabase' && record.publicConfig.wasteManagementSelected === true)
      ?? records.find((record) => record.typeKey === 'supabase' && record.isDefault)
      ?? records.find((record) => record.typeKey === 'supabase')
      ?? null
    );
  }
  return (await deps.loadDefaultInterfaceRecord?.(instanceId, 'supabase')) ?? null;
};

export const loadWasteEmailReminderSettings = async (
  deps: WasteOperationRuntimeDeps,
  instanceId: string,
): Promise<{
  readonly config: WasteManagementEmailReminderConfig;
  readonly unsubscribeSigningSecret?: string;
} | null> => {
  const selectedSupabase = await loadSelectedWasteSupabaseRecord(deps, instanceId);
  const config = selectedSupabase ? readWasteManagementEmailReminderConfig(selectedSupabase.publicConfig) ?? null : null;
  if (!selectedSupabase || !config) {
    return null;
  }
  return {
    config,
    unsubscribeSigningSecret: readWasteManagementEmailReminderSigningSecret(selectedSupabase.publicConfig),
  };
};
