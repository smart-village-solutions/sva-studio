import { randomUUID } from 'node:crypto';
import {
  isSsfTranslationApiKey,
  parseSsfTranslationOrigin,
  readSsfTranslationSettings,
  type ExternalInterfaceRecord,
} from '@sva/core';
import type { InstanceInterfaceDraft } from './instance-interfaces';
import { buildSecretCiphertext } from './instance-interface-record-helpers.server.js';

type SsfDraft = Extract<InstanceInterfaceDraft, { type: 'ssf_translation' }>;

const resolveSsfCredentials = (
  draft: SsfDraft,
  existing: ExternalInterfaceRecord | null,
  savedKey?: string
) => {
  const previous = existing ? readSsfTranslationSettings(existing.publicConfig) : undefined;
  if (draft.config.revision !== (previous?.revision ?? '0')) throw new Error('interface_conflict');
  const origin = parseSsfTranslationOrigin(draft.config.origin);
  const replacementKey = draft.config.apiKey.trim();
  if (previous && origin !== previous.origin && savedKey && !replacementKey)
    throw new Error('ssf_translation_origin_key_required');
  const apiKey = replacementKey || savedKey || '';
  if (!origin || ((draft.enabled || apiKey) && !isSsfTranslationApiKey(apiKey)))
    throw new Error('ssf_translation_invalid_config');
  const changed =
    !previous ||
    origin !== previous.origin ||
    apiKey !== savedKey ||
    (!existing?.enabled && draft.enabled);
  return { previous, origin, apiKey, changed };
};

export const buildSsfTranslationRecord = ({
  draft,
  instanceId,
  interfaceId,
  existing,
  hasDefaultRecord,
  previousSecrets,
}: {
  draft: Extract<InstanceInterfaceDraft, { type: 'ssf_translation' }>;
  instanceId: string;
  interfaceId: string;
  existing: ExternalInterfaceRecord | null;
  hasDefaultRecord: boolean;
  previousSecrets: Record<string, string>;
}): ExternalInterfaceRecord => {
  if (hasDefaultRecord && !existing) throw new Error('interface_conflict');
  const { previous, origin, apiKey, changed } = resolveSsfCredentials(
    draft,
    existing,
    previousSecrets.apiKey
  );
  const selectedLocales = draft.config.selectedLocales;
  const availableLanguages = changed ? [] : (previous?.availableLanguages ?? []);
  const canSelect =
    !changed &&
    existing?.lastCheckStatus === 'succeeded' &&
    previous?.verifiedCredentialRevision === previous?.credentialRevision;
  if (
    selectedLocales.some(
      (locale) =>
        !previous?.selectedLocales.includes(locale) &&
        !(canSelect && availableLanguages.includes(locale))
    )
  )
    throw new Error('ssf_translation_invalid_config');
  const secretConfigCiphertext = buildSecretCiphertext({
    interfaceId,
    secretConfig: apiKey ? { apiKey } : {},
  });
  if (apiKey && !secretConfigCiphertext) throw new Error('deepl_secret_unavailable');
  return {
    id: interfaceId,
    instanceId: instanceId,
    typeKey: 'ssf_translation',
    ownerKind: 'host',
    ownerId: 'host',
    displayName: draft.name.trim(),
    alias: 'ssf_translation',
    enabled: draft.enabled,
    isDefault: true,
    category: 'api',
    baseUrl: origin,
    authMode: 'api_key',
    publicConfig: {
      origin,
      selectedLocales,
      availableLanguages,
      revision: randomUUID(),
      credentialRevision: changed ? randomUUID() : previous?.credentialRevision,
      verifiedCredentialRevision: changed ? null : (previous?.verifiedCredentialRevision ?? null),
    },
    secretConfigCiphertext,
    statusCheckKind: 'ssf_translation',
    visibleStatus: !draft.enabled
      ? 'disabled'
      : changed
        ? 'unknown'
        : (existing?.visibleStatus ?? 'unknown'),
    lastCheckedAt: changed ? undefined : existing?.lastCheckedAt,
    lastCheckStatus: changed ? undefined : existing?.lastCheckStatus,
    lastCheckErrorCode: changed ? undefined : existing?.lastCheckErrorCode,
  };
};
