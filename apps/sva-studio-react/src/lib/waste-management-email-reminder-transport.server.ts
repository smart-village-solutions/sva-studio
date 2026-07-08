import type { ExternalInterfaceRecord, MailTransportConfig } from '@sva/core';
import { buildExternalInterfaceSecretConfigAad } from '@sva/server-runtime';
import { revealField } from '@sva/auth-runtime/server';

import { normalizeOptionalText } from './waste-management-operations.shared.js';
import type { WasteOperationRuntimeDeps } from './waste-management-operations.types.js';

const toOptionalMailTransportNumber = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : undefined;

const readOptionalPublicConfigText = (record: ExternalInterfaceRecord, key: string): string | undefined =>
  normalizeOptionalText(typeof record.publicConfig[key] === 'string' ? record.publicConfig[key] : undefined);

const withOptionalTextField = <T extends object>(
  target: T,
  key: 'defaultFromEmail' | 'defaultFromName' | 'defaultReplyToEmail' | 'username',
  value: string | undefined,
): T & Partial<Record<typeof key, string>> => (value ? { ...target, [key]: value } : target);

const withOptionalNumberField = <T extends object>(
  target: T,
  key: 'maxBatchSize' | 'rateLimitPerMinute',
  value: number | undefined,
): T & Partial<Record<typeof key, number>> => (value ? { ...target, [key]: value } : target);

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
    Object.entries(parsed).flatMap(([key, value]) => (typeof value === 'string' && value.length > 0 ? [[key, value]] : [])),
  );
};

const buildMailTransportHealth = (
  record: ExternalInterfaceRecord,
): MailTransportConfig['health'] => ({
  visibleStatus: record.visibleStatus,
  ...(record.lastCheckedAt ? { lastCheckedAt: record.lastCheckedAt } : {}),
  ...(record.lastCheckStatus ? { lastCheckStatus: record.lastCheckStatus } : {}),
  ...(record.lastCheckErrorCode ? { lastCheckErrorCode: record.lastCheckErrorCode } : {}),
  ...(record.lastCheckErrorMessage ? { lastCheckErrorMessage: record.lastCheckErrorMessage } : {}),
});

type SharedMailTransportConfig = Omit<MailTransportConfig, 'endpoint' | 'host' | 'mode' | 'port' | 'transportType'>;

const buildSharedMailTransportConfig = (
  record: ExternalInterfaceRecord,
  transportId: string,
  password: string | undefined,
): SharedMailTransportConfig =>
  withOptionalNumberField(
    withOptionalNumberField(
      withOptionalTextField(
        withOptionalTextField(
          withOptionalTextField(
            withOptionalTextField(
              {
                transportId,
                displayName: record.displayName,
                securityMode: readOptionalPublicConfigText(record, 'securityMode') as MailTransportConfig['securityMode'],
                authMode: readOptionalPublicConfigText(record, 'authMode') as MailTransportConfig['authMode'],
                enabled: record.enabled,
                ...(password ? { password } : {}),
                health: buildMailTransportHealth(record),
              },
              'username',
              readOptionalPublicConfigText(record, 'username'),
            ),
            'defaultFromEmail',
            readOptionalPublicConfigText(record, 'defaultFromEmail'),
          ),
          'defaultFromName',
          readOptionalPublicConfigText(record, 'defaultFromName'),
        ),
        'defaultReplyToEmail',
        readOptionalPublicConfigText(record, 'defaultReplyToEmail'),
      ),
      'maxBatchSize',
      toOptionalMailTransportNumber(record.publicConfig.maxBatchSize),
    ),
    'rateLimitPerMinute',
    toOptionalMailTransportNumber(record.publicConfig.rateLimitPerMinute),
  );

const buildSmtpMailTransportConfig = (
  record: ExternalInterfaceRecord,
  shared: SharedMailTransportConfig,
): MailTransportConfig | null => {
  const host = readOptionalPublicConfigText(record, 'host');
  const port = toOptionalMailTransportNumber(record.publicConfig.port);
  return host && port ? { ...shared, transportType: 'smtp', host, port } : null;
};

const buildProviderApiMailTransportConfig = (
  record: ExternalInterfaceRecord,
  shared: SharedMailTransportConfig,
): MailTransportConfig | null => {
  const endpoint = readOptionalPublicConfigText(record, 'endpoint');
  const mode = readOptionalPublicConfigText(record, 'mode');
  return endpoint && mode ? { ...shared, transportType: 'provider_api', endpoint, mode } : null;
};

const readMailTransportConfigFromRecord = (record: ExternalInterfaceRecord): MailTransportConfig | null => {
  if (record.typeKey !== 'mail_transport') {
    return null;
  }
  const transportId = readOptionalPublicConfigText(record, 'transportId');
  const transportType = readOptionalPublicConfigText(record, 'transportType');
  const securityMode = readOptionalPublicConfigText(record, 'securityMode');
  const authMode = readOptionalPublicConfigText(record, 'authMode');
  const password = normalizeOptionalText(parseInterfaceSecretConfig(record).password);
  if (!transportId || !transportType || !securityMode || !authMode) {
    return null;
  }
  if (authMode === 'basic' && !password) {
    return null;
  }
  const shared = buildSharedMailTransportConfig(record, transportId, password);

  if (transportType === 'smtp') {
    return buildSmtpMailTransportConfig(record, shared);
  }

  return buildProviderApiMailTransportConfig(record, shared);
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
