import { randomUUID } from 'node:crypto';
import {
  appTranslationLanguage,
  isAppTranslationLocale,
  deepLTargetCode,
  readDeepLSettings,
  type ExternalInterfaceRecord,
} from '@sva/core';
import type { InstanceInterfaceDraft } from './instance-interfaces';
import { buildSecretCiphertext } from './instance-interface-record-helpers.server.js';

type DeepLDraft = Extract<InstanceInterfaceDraft, { type: 'deepl' }>;
const selectedLocales = (
  config: DeepLDraft['config'],
  previous: ReturnType<typeof readDeepLSettings>,
  existing: ExternalInterfaceRecord | null,
  changed: boolean
) => {
  const selected = [...config.selectedLocales];
  if (
    selected.some((locale) => !previous?.selectedLocales.includes(locale)) &&
    (existing?.lastCheckStatus !== 'succeeded' ||
      previous?.verifiedCredentialRevision !== previous?.credentialRevision)
  )
    throw new Error('invalid_config');
  if (
    selected.some((locale) => !isAppTranslationLocale(locale)) ||
    new Set(selected.map(appTranslationLanguage)).size !== selected.length ||
    selected.some(
      (locale) =>
        appTranslationLanguage(locale) === 'de' ||
        !(changed
          ? previous?.selectedLocales.includes(locale)
          : previous?.availableLanguages.some(
              (language) =>
                language.code ===
                deepLTargetCode(locale, config.englishVariant, previous?.availableLanguages)
            ))
    )
  )
    throw new Error('invalid_config');
  return selected;
};

const retainedCheckMetadata = (existing: ExternalInterfaceRecord | null, changed: boolean) => ({
  lastCheckStatus: changed ? undefined : existing?.lastCheckStatus,
  lastCheckedAt: changed ? undefined : existing?.lastCheckedAt,
  lastCheckErrorCode: changed ? undefined : existing?.lastCheckErrorCode,
});

export const buildDeepLRecord = (input: {
  instanceId: string;
  interfaceId: string;
  existing: ExternalInterfaceRecord | null;
  previousSecrets: Record<string, string>;
  draft: DeepLDraft;
}): ExternalInterfaceRecord => {
  const { existing, interfaceId, previousSecrets } = input;
  const config = input.draft.config;
  const previous = existing ? readDeepLSettings(existing.publicConfig) : undefined;
  if (config.revision !== (previous?.revision ?? '0')) throw new Error('interface_conflict');
  const apiKey = config.apiKey.trim() || previousSecrets.apiKey || '';
  if (input.draft.enabled && !apiKey) throw new Error('deepl_secret_missing');
  const changed =
    !previous ||
    (!existing?.enabled && input.draft.enabled) ||
    config.plan !== previous.plan ||
    (!!config.apiKey.trim() && config.apiKey.trim() !== previousSecrets.apiKey);
  const selected = selectedLocales(config, previous, existing, changed);
  const ciphertext = buildSecretCiphertext({
    interfaceId,
    secretConfig: apiKey ? { apiKey } : {},
  });
  if (apiKey && !ciphertext) throw new Error('deepl_secret_unavailable');
  return {
    id: interfaceId,
    instanceId: input.instanceId,
    typeKey: 'deepl',
    ownerKind: 'host',
    ownerId: 'host',
    displayName: input.draft.name.trim(),
    alias: 'deepl',
    enabled: input.draft.enabled,
    isDefault: true,
    category: 'api',
    authMode: 'api_key',
    baseUrl: config.plan === 'free' ? 'https://api-free.deepl.com' : 'https://api.deepl.com',
    publicConfig: {
      ...existing?.publicConfig,
      revision: randomUUID(),
      credentialRevision: changed ? randomUUID() : previous!.credentialRevision,
      verifiedCredentialRevision: changed ? null : (previous?.verifiedCredentialRevision ?? null),
      plan: config.plan,
      englishVariant: config.englishVariant,
      selectedLocales: selected,
      availableLanguages: changed ? [] : (previous?.availableLanguages ?? []),
    },
    secretConfigCiphertext: ciphertext,
    statusCheckKind: 'deepl',
    visibleStatus: !input.draft.enabled
      ? 'disabled'
      : changed
        ? 'unknown'
        : (existing?.visibleStatus ?? 'unknown'),
    ...retainedCheckMetadata(existing, changed),
  };
};
