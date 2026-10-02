import type { ExternalInterfaceRecord } from '@sva/core';
import type { InstanceInterfaceDraft } from './instance-interfaces';
import {
  buildSecretCiphertext,
  resolveVisibleStatus,
  parseOptionalPositiveInteger,
  assertValidMapGeocodingDraft,
} from './instance-interface-record-helpers.server.js';

export const buildMapGeocodingRecord = (input: {
  readonly instanceId: string;
  readonly draft: Extract<InstanceInterfaceDraft, { type: 'mapGeocoding' }>;
  readonly interfaceId: string;
  readonly existing: ExternalInterfaceRecord | null;
  readonly hasDefaultRecord: boolean;
  readonly previousSecrets: Record<string, string>;
}): ExternalInterfaceRecord => {
  const existingPublicConfig = { ...(input.existing?.publicConfig ?? {}) };
  const styleUrl = input.draft.config.styleUrl.trim();
  const suggestEndpoint = input.draft.config.suggestEndpoint.trim();
  const geocodeEndpoint = input.draft.config.geocodeEndpoint.trim();
  const reverseGeocodeEndpoint = input.draft.config.reverseGeocodeEndpoint.trim();
  const timeoutMs = parseOptionalPositiveInteger(input.draft.config.requestTimeoutMs);
  const rateLimitPerMinute = parseOptionalPositiveInteger(input.draft.config.rateLimitPerMinute);
  const nextApiKey = input.draft.config.apiKey.trim() || input.previousSecrets.apiKey || '';

  for (const key of [
    'provider',
    'styleUrl',
    'autocompleteEnabled',
    'geocodeEnabled',
    'reverseGeocodeEnabled',
    'suggestEndpoint',
    'geocodeEndpoint',
    'reverseGeocodeEndpoint',
    'requestTimeoutMs',
    'rateLimitPerMinute',
    'killSwitchEnabled',
  ] as const) {
    delete existingPublicConfig[key];
  }

  assertValidMapGeocodingDraft(input, {
    styleUrl,
    suggestEndpoint,
    geocodeEndpoint,
    reverseGeocodeEndpoint,
    nextApiKey,
  });

  return {
    id: input.interfaceId,
    instanceId: input.instanceId,
    typeKey: 'map_geocoding',
    ownerKind: 'host',
    ownerId: 'host',
    displayName: input.draft.name.trim(),
    alias: input.existing?.alias ?? input.interfaceId,
    enabled: input.draft.enabled,
    isDefault: input.existing?.isDefault ?? !input.hasDefaultRecord,
    category: 'api',
    baseUrl: suggestEndpoint || geocodeEndpoint || reverseGeocodeEndpoint || styleUrl,
    authMode: 'api_key',
    publicConfig: {
      ...existingPublicConfig,
      provider: input.draft.config.provider,
      styleUrl,
      autocompleteEnabled: input.draft.config.autocompleteEnabled,
      geocodeEnabled: input.draft.config.geocodeEnabled,
      reverseGeocodeEnabled: input.draft.config.reverseGeocodeEnabled,
      suggestEndpoint,
      geocodeEndpoint,
      reverseGeocodeEndpoint,
      ...(timeoutMs !== undefined ? { requestTimeoutMs: timeoutMs } : {}),
      ...(rateLimitPerMinute !== undefined ? { rateLimitPerMinute } : {}),
      killSwitchEnabled: input.draft.config.killSwitchEnabled,
    },
    secretConfigCiphertext: buildSecretCiphertext({
      interfaceId: input.interfaceId,
      secretConfig: nextApiKey.trim() ? { apiKey: nextApiKey.trim() } : {},
    }),
    statusCheckKind: 'map_geocoding',
    visibleStatus: resolveVisibleStatus(input.draft.enabled, input.existing?.visibleStatus),
    lastCheckedAt: input.existing?.lastCheckedAt,
    lastCheckStatus: input.existing?.lastCheckStatus,
    lastCheckErrorCode: input.existing?.lastCheckErrorCode,
    lastCheckErrorMessage: input.existing?.lastCheckErrorMessage,
    createdAt: input.existing?.createdAt,
    updatedAt: input.existing?.updatedAt,
  };
};
