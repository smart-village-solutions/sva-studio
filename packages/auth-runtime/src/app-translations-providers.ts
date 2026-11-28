import {
  appTranslationLanguage,
  deepLTargetCode,
  readDeepLSettings,
  readSsfTranslationSettings,
  type CatalogValue,
  type ExternalInterfaceRecord,
} from '@sva/core';
import { loadDefaultExternalInterfaceRecord } from '@sva/data-repositories/server';
import { fetchPublicHttps } from '@sva/server-runtime';
import type { QueryClient } from './db.js';
import { getDeepLSetupStatus, translateDeepLValues } from './app-translations-deepl.js';
import {
  getSsfSetupStatus,
  readSsfRecordConfig,
  selectSsfTranslationTarget,
  translateSsfValues,
} from './app-translations-ssf.js';

export type TranslationProviderPin = Readonly<{ interfaceId: string; credentialRevision: string }>;

const deepLProvider = (record: ExternalInterfaceRecord | null) => {
  const setup = getDeepLSetupStatus(record);
  const settings = record && readDeepLSettings(record.publicConfig);
  const targets = new Map(
    setup.ready && settings
      ? settings.selectedLocales.map((locale) => [
          locale,
          deepLTargetCode(locale, settings.englishVariant, settings.availableLanguages),
        ])
      : []
  );
  return { record, setup, settings, targets };
};

const ssfProvider = (record: ExternalInterfaceRecord | null) => {
  const setup = getSsfSetupStatus(record);
  const settings = record && readSsfTranslationSettings(record.publicConfig);
  const targets = new Map<string, string>(
    setup.ready && settings
      ? settings.selectedLocales
          .filter((locale) => settings.availableLanguages.includes(locale))
          .map((locale) => [locale, locale])
      : []
  );
  return { record, setup, settings, targets };
};

export const resolveTranslationProviders = (
  deepLRecord: ExternalInterfaceRecord | null,
  ssfRecord: ExternalInterfaceRecord | null
) => {
  const deepL = deepLProvider(deepLRecord);
  const ssf = ssfProvider(ssfRecord);
  const targets = new Map(deepL.targets);
  const deepLByLanguage = new Map(
    Array.from(deepL.targets.keys(), (locale) => [appTranslationLanguage(locale), locale])
  );
  for (const [locale, code] of ssf.targets) {
    const deepLLocale = deepLByLanguage.get(appTranslationLanguage(locale));
    if (!deepLLocale || deepLLocale === locale) targets.set(locale, code);
  }
  const preferred = ssf.setup.ready || (!deepL.record && ssf.record) ? ssf : deepL;
  return {
    setup: { ...preferred.setup, selectedLocales: [...targets.keys()] },
    targetCodes: Object.fromEntries(targets),
    select(locale: string, pin?: TranslationProviderPin) {
      if (!pin && !targets.has(locale)) return null;
      const provider = pin
        ? [ssf, deepL].find(({ record }) => record?.id === pin.interfaceId)
        : ssf.targets.has(locale)
          ? ssf
          : deepL;
      const targetCode = provider?.targets.get(locale);
      if (
        !targetCode ||
        !provider?.record ||
        !provider.settings ||
        (pin && provider.settings.credentialRevision !== pin.credentialRevision)
      )
        return null;
      return {
        record: provider.record,
        targetCode,
        pin: {
          interfaceId: provider.record.id,
          credentialRevision: provider.settings.credentialRevision,
        },
      };
    },
  };
};

export const loadTranslationProviderRecords = async (instanceId: string) => {
  const [deepL, ssf] = await Promise.all([
    loadDefaultExternalInterfaceRecord(instanceId, 'deepl'),
    loadDefaultExternalInterfaceRecord(instanceId, 'ssf_translation'),
  ]);
  return { deepL, ssf };
};

export const readCatalogTranslationProviders = async (
  client: QueryClient,
  instanceId: string,
  lock: boolean
) => {
  const records = await client.query<ExternalInterfaceRecord>(
    `SELECT id,type_key AS "typeKey",owner_kind AS "ownerKind",enabled,
       public_config_json AS "publicConfig",secret_config_ciphertext AS "secretConfigCiphertext",
       last_check_status AS "lastCheckStatus"
     FROM iam.instance_external_interfaces
     WHERE instance_id=$1 AND type_key IN ('deepl', 'ssf_translation') AND owner_kind='host' AND is_default
     ORDER BY type_key ${lock ? 'FOR SHARE' : ''}`,
    [instanceId]
  );
  return resolveTranslationProviders(
    records.rows.find((record) => record.typeKey === 'deepl') ?? null,
    records.rows.find((record) => record.typeKey === 'ssf_translation') ?? null
  );
};

export const translateWithInstanceProvider = (
  record: ExternalInterfaceRecord,
  targetCode: string,
  values: readonly CatalogValue[],
  signal: AbortSignal,
  fetchWhileActive?: (transport: typeof fetchPublicHttps) => typeof fetchPublicHttps
): Promise<CatalogValue[]> => {
  if (record.typeKey === 'ssf_translation') {
    const config = readSsfRecordConfig(record);
    const target = config && selectSsfTranslationTarget(config, targetCode);
    if (!config || !target) throw new Error('catalog_setup_required');
    return translateSsfValues(config, target, values, signal, fetchWhileActive?.(fetchPublicHttps));
  }
  return fetchWhileActive
    ? translateDeepLValues(record, targetCode, values, signal, fetchWhileActive(fetch))
    : translateDeepLValues(record, targetCode, values, signal);
};
