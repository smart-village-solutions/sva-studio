import type { ExternalInterfaceRecord } from '@sva/core';
import { mailTransportContract } from '@sva/core';
import type { InstanceInterfaceDraft } from './instance-interfaces';
import {
  buildSecretCiphertext,
  resolveVisibleStatus,
  parseOptionalPositiveInteger,
  parseRequiredPort,
  trimToUndefined,
} from './instance-interface-record-helpers.server.js';

const isObviouslyUrlLikeMailHost = (value: string): boolean => {
  const trimmed = value.trim();
  return (
    trimmed.includes('://') ||
    trimmed.includes('/') ||
    trimmed.includes('?') ||
    trimmed.includes('#')
  );
};

const assertValidMailTransportDraft = (
  draft: Extract<InstanceInterfaceDraft, { type: 'mailTransport' }>,
  input: {
    readonly displayName: string;
    readonly transportId: string;
    readonly nextPassword: string;
  }
): void => {
  const validationRules = [
    !input.transportId || !input.displayName,
    !mailTransportContract.isSecurityMode(draft.config.securityMode),
    !mailTransportContract.isAuthMode(draft.config.authMode),
    draft.config.authMode === 'basic' && !input.nextPassword.trim(),
    draft.config.authMode === 'basic' && !draft.config.username.trim(),
    !draft.config.host.trim(),
    isObviouslyUrlLikeMailHost(draft.config.host),
  ];

  if (validationRules.some(Boolean)) {
    throw new Error('invalid_config');
  }
};

const buildMailTransportPublicConfig = (input: {
  readonly draft: Extract<InstanceInterfaceDraft, { type: 'mailTransport' }>;
  readonly existingPublicConfig: ExternalInterfaceRecord['publicConfig'];
  readonly transportId: string;
  readonly port: number | undefined;
  readonly maxBatchSize: number | undefined;
  readonly rateLimitPerMinute: number | undefined;
}): ExternalInterfaceRecord['publicConfig'] => {
  const nextPublicConfig = { ...input.existingPublicConfig };
  for (const key of [
    'username',
    'defaultFromEmail',
    'defaultFromName',
    'defaultReplyToEmail',
    'maxBatchSize',
    'rateLimitPerMinute',
    'host',
    'port',
    'endpoint',
    'mode',
    'transportType',
  ] as const) {
    delete nextPublicConfig[key];
  }

  const optionalFields = {
    username: trimToUndefined(input.draft.config.username),
    defaultFromEmail: trimToUndefined(input.draft.config.defaultFromEmail),
    defaultFromName: trimToUndefined(input.draft.config.defaultFromName),
    defaultReplyToEmail: trimToUndefined(input.draft.config.defaultReplyToEmail),
    maxBatchSize: input.maxBatchSize,
    rateLimitPerMinute: input.rateLimitPerMinute,
  };

  return {
    ...nextPublicConfig,
    transportId: input.transportId,
    transportType: 'smtp',
    securityMode: input.draft.config.securityMode,
    authMode: input.draft.config.authMode,
    ...Object.fromEntries(
      Object.entries(optionalFields).flatMap(([key, value]) =>
        value !== undefined ? [[key, value]] : []
      )
    ),
    host: input.draft.config.host.trim(),
    port: input.port,
  };
};

export const buildMailTransportRecord = (input: {
  readonly instanceId: string;
  readonly draft: Extract<InstanceInterfaceDraft, { type: 'mailTransport' }>;
  readonly interfaceId: string;
  readonly existing: ExternalInterfaceRecord | null;
  readonly hasDefaultRecord: boolean;
  readonly previousSecrets: Record<string, string>;
}): ExternalInterfaceRecord => {
  const transportId = input.draft.config.transportId.trim();
  const displayName = input.draft.name.trim();
  const nextPassword = input.draft.config.password || input.previousSecrets.password || '';
  assertValidMailTransportDraft(input.draft, { displayName, transportId, nextPassword });

  const port = parseRequiredPort(input.draft.config.port);
  const maxBatchSize = parseOptionalPositiveInteger(input.draft.config.maxBatchSize);
  const rateLimitPerMinute = parseOptionalPositiveInteger(input.draft.config.rateLimitPerMinute);
  const existingPublicConfig = input.existing?.publicConfig ?? {};

  return {
    id: input.interfaceId,
    instanceId: input.instanceId,
    typeKey: 'mail_transport',
    ownerKind: 'host',
    ownerId: 'host',
    displayName,
    alias: transportId,
    enabled: input.draft.enabled,
    isDefault: input.existing?.isDefault ?? !input.hasDefaultRecord,
    category: 'api',
    baseUrl: input.draft.config.host.trim(),
    authMode: input.draft.config.authMode,
    publicConfig: buildMailTransportPublicConfig({
      draft: input.draft,
      existingPublicConfig,
      transportId,
      port,
      maxBatchSize,
      rateLimitPerMinute,
    }),
    secretConfigCiphertext: buildSecretCiphertext({
      interfaceId: input.interfaceId,
      secretConfig: nextPassword.trim() ? { password: nextPassword.trim() } : {},
    }),
    statusCheckKind: 'mail_transport',
    visibleStatus: resolveVisibleStatus(input.draft.enabled, input.existing?.visibleStatus),
    lastCheckedAt: input.existing?.lastCheckedAt,
    lastCheckStatus: input.existing?.lastCheckStatus,
    lastCheckErrorCode: input.existing?.lastCheckErrorCode,
    lastCheckErrorMessage: input.existing?.lastCheckErrorMessage,
    createdAt: input.existing?.createdAt,
    updatedAt: input.existing?.updatedAt,
  };
};
