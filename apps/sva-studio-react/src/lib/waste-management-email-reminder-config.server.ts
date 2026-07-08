import {
  readWasteManagementEmailReminderConfig,
  readWasteManagementEmailReminderSigningSecret,
  type ExternalInterfaceRecord,
  type MailTransportConfig,
  type WasteManagementEmailReminderConfig,
} from '@sva/core';
import { buildExternalInterfaceSecretConfigAad } from '@sva/server-runtime';
import { revealField } from '@sva/auth-runtime/server';

import { normalizeOptionalText } from './waste-management-operations.shared.js';
import type { WasteOperationRuntimeDeps } from './waste-management-operations.types.js';

const toOptionalMailTransportNumber = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : undefined;

const parseInterfaceSecretConfig = (record: ExternalInterfaceRecord): Record<string, string> => {
  if (!record.secretConfigCiphertext) {
    return {};
  }
  const revealed = revealField(record.secretConfigCiphertext, buildExternalInterfaceSecretConfigAad(record.id));
  if (!revealed) {
    throw new Error('secret_unreadable');
  }
  const parsed = JSON.parse(revealed) as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('secret_unreadable');
  }
  return Object.fromEntries(
    Object.entries(parsed).flatMap(([key, value]) => (typeof value === 'string' && value.length > 0 ? [[key, value]] : []))
  );
};

const readMailTransportConfigFromRecord = (record: ExternalInterfaceRecord): MailTransportConfig | null => {
  if (record.typeKey !== 'mail_transport') {
    return null;
  }
  const transportId = normalizeOptionalText(typeof record.publicConfig.transportId === 'string' ? record.publicConfig.transportId : undefined);
  const transportType = normalizeOptionalText(typeof record.publicConfig.transportType === 'string' ? record.publicConfig.transportType : undefined);
  const securityMode = normalizeOptionalText(typeof record.publicConfig.securityMode === 'string' ? record.publicConfig.securityMode : undefined);
  const authMode = normalizeOptionalText(typeof record.publicConfig.authMode === 'string' ? record.publicConfig.authMode : undefined);
  const password = normalizeOptionalText(parseInterfaceSecretConfig(record).password);
  if (!transportId || !transportType || !securityMode || !authMode) {
    return null;
  }
  if (authMode === 'basic' && !password) {
    return null;
  }
  const shared = {
    transportId,
    displayName: record.displayName,
    securityMode: securityMode as MailTransportConfig['securityMode'],
    authMode: authMode as MailTransportConfig['authMode'],
    enabled: record.enabled,
    ...(password ? { password } : {}),
    ...(normalizeOptionalText(typeof record.publicConfig.username === 'string' ? record.publicConfig.username : undefined)
      ? { username: normalizeOptionalText(typeof record.publicConfig.username === 'string' ? record.publicConfig.username : undefined)! }
      : {}),
    ...(normalizeOptionalText(typeof record.publicConfig.defaultFromEmail === 'string' ? record.publicConfig.defaultFromEmail : undefined)
      ? { defaultFromEmail: normalizeOptionalText(typeof record.publicConfig.defaultFromEmail === 'string' ? record.publicConfig.defaultFromEmail : undefined)! }
      : {}),
    ...(normalizeOptionalText(typeof record.publicConfig.defaultFromName === 'string' ? record.publicConfig.defaultFromName : undefined)
      ? { defaultFromName: normalizeOptionalText(typeof record.publicConfig.defaultFromName === 'string' ? record.publicConfig.defaultFromName : undefined)! }
      : {}),
    ...(normalizeOptionalText(typeof record.publicConfig.defaultReplyToEmail === 'string' ? record.publicConfig.defaultReplyToEmail : undefined)
      ? { defaultReplyToEmail: normalizeOptionalText(typeof record.publicConfig.defaultReplyToEmail === 'string' ? record.publicConfig.defaultReplyToEmail : undefined)! }
      : {}),
    ...(toOptionalMailTransportNumber(record.publicConfig.maxBatchSize)
      ? { maxBatchSize: toOptionalMailTransportNumber(record.publicConfig.maxBatchSize)! }
      : {}),
    ...(toOptionalMailTransportNumber(record.publicConfig.rateLimitPerMinute)
      ? { rateLimitPerMinute: toOptionalMailTransportNumber(record.publicConfig.rateLimitPerMinute)! }
      : {}),
    health: {
      visibleStatus: record.visibleStatus,
      ...(record.lastCheckedAt ? { lastCheckedAt: record.lastCheckedAt } : {}),
      ...(record.lastCheckStatus ? { lastCheckStatus: record.lastCheckStatus } : {}),
      ...(record.lastCheckErrorCode ? { lastCheckErrorCode: record.lastCheckErrorCode } : {}),
      ...(record.lastCheckErrorMessage ? { lastCheckErrorMessage: record.lastCheckErrorMessage } : {}),
    },
  } as const;

  if (transportType === 'smtp') {
    const host = normalizeOptionalText(typeof record.publicConfig.host === 'string' ? record.publicConfig.host : undefined);
    const port = toOptionalMailTransportNumber(record.publicConfig.port);
    return host && port ? { ...shared, transportType: 'smtp', host, port } : null;
  }

  const endpoint = normalizeOptionalText(typeof record.publicConfig.endpoint === 'string' ? record.publicConfig.endpoint : undefined);
  const mode = normalizeOptionalText(typeof record.publicConfig.mode === 'string' ? record.publicConfig.mode : undefined);
  return endpoint && mode ? { ...shared, transportType: 'provider_api', endpoint, mode } : null;
};

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

export const loadMailTransportConfigs = async (
  deps: WasteOperationRuntimeDeps,
  instanceId: string,
): Promise<ReadonlyMap<string, MailTransportConfig>> => {
  if (deps.listInterfaceRecords) {
    const records = await deps.listInterfaceRecords(instanceId);
    return new Map(
      records
        .filter((record) => record.typeKey === 'mail_transport')
        .map(readMailTransportConfigFromRecord)
        .flatMap((record) => (record ? [[record.transportId, record] as const] : [])),
    );
  }

  const fallback = await deps.loadDefaultInterfaceRecord?.(instanceId, 'mail_transport');
  const config = fallback ? readMailTransportConfigFromRecord(fallback) : null;
  return new Map(config ? [[config.transportId, config] as const] : []);
};
