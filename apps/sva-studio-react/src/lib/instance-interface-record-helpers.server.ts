import type { ExternalInterfaceVisibleStatus } from '@sva/core';
import type { InstanceInterfaceDraft } from './instance-interfaces';
import { protectField } from '@sva/auth-runtime/server';
import { buildExternalInterfaceSecretConfigAad } from '@sva/server-runtime';

export const buildSecretCiphertext = (input: {
  readonly interfaceId: string;
  readonly secretConfig: Record<string, string>;
}): string | undefined => {
  if (Object.keys(input.secretConfig).length === 0) {
    return undefined;
  }

  const ciphertext = protectField(
    JSON.stringify(input.secretConfig),
    buildExternalInterfaceSecretConfigAad(input.interfaceId)
  );
  return ciphertext ?? undefined;
};

export const resolveVisibleStatus = (
  enabled: boolean,
  existingVisibleStatus: ExternalInterfaceVisibleStatus | undefined
): ExternalInterfaceVisibleStatus => {
  if (!enabled) {
    return 'disabled';
  }

  if (!existingVisibleStatus || existingVisibleStatus === 'disabled') {
    return 'unknown';
  }

  return existingVisibleStatus;
};

export const parseOptionalPositiveInteger = (value: string): number | undefined => {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }
  const parsed = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error('invalid_config');
  }
  return parsed;
};

export const parseRequiredPort = (value: string): number => {
  const parsed = parseOptionalPositiveInteger(value);
  if (parsed === undefined) {
    throw new Error('invalid_config');
  }
  return parsed;
};

export const trimToUndefined = (value: string): string | undefined => {
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
};

export const isValidAbsoluteHttpUrl = (value: string): boolean => {
  const trimmed = value.trim();
  if (!trimmed) {
    return false;
  }

  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
};

export const assertValidMapGeocodingDraft = (
  input: {
    readonly draft: Extract<InstanceInterfaceDraft, { type: 'mapGeocoding' }>;
    readonly existing: unknown;
    readonly hasDefaultRecord: boolean;
  },
  config: {
    readonly styleUrl: string;
    readonly suggestEndpoint: string;
    readonly geocodeEndpoint: string;
    readonly reverseGeocodeEndpoint: string;
    readonly nextApiKey: string;
  }
): void => {
  if (!input.draft.name.trim() || !isValidAbsoluteHttpUrl(config.styleUrl)) {
    throw new Error('invalid_config');
  }

  if (!input.existing && input.hasDefaultRecord) {
    throw new Error('invalid_config');
  }

  const hasEnabledOperation =
    input.draft.config.autocompleteEnabled ||
    input.draft.config.geocodeEnabled ||
    input.draft.config.reverseGeocodeEnabled;

  if (
    input.draft.config.provider === 'custom' &&
    ((input.draft.config.autocompleteEnabled && !isValidAbsoluteHttpUrl(config.suggestEndpoint)) ||
      (input.draft.config.geocodeEnabled && !isValidAbsoluteHttpUrl(config.geocodeEndpoint)) ||
      (input.draft.config.reverseGeocodeEnabled &&
        !isValidAbsoluteHttpUrl(config.reverseGeocodeEndpoint)))
  ) {
    throw new Error('invalid_config');
  }

  if (
    input.draft.config.provider === 'geoapify' &&
    hasEnabledOperation &&
    !config.nextApiKey.trim()
  ) {
    throw new Error('invalid_config');
  }
};
