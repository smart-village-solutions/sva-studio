/** Existing catalog edit operations on the caller transaction. */

import {
  catalogAssert,
  catalogDigest,
  catalogTextSource,
  resolveCatalogValues,
  validateCatalogLocales,
  validateCatalogValue,
  type AppTranslationLocale,
  type CatalogValue,
  type CatalogText,
} from '@sva/core';

import { type CatalogRepositoryContext } from './app-translations-context.js';
export const configureLocales = async (
  context: CatalogRepositoryContext,
  contractId: string,
  expectedRevision: string,
  locales: readonly AppTranslationLocale[]
) => {
  const { save, locked } = context;

  const draft = await locked(contractId, expectedRevision);
  draft.supportedLocales = validateCatalogLocales(locales);
  return save(draft);
};
export const editText = async (
  context: CatalogRepositoryContext,
  contractId: string,
  expectedRevision: string,
  locale: AppTranslationLocale,
  key: string,
  value: unknown,
  targetCode?: string
) => {
  const { baseOf, save, locked } = context;

  const draft = await locked(contractId, expectedRevision);
  catalogAssert(draft.supportedLocales.includes(locale));
  const validValue = validateCatalogValue(draft.manifest, key, value);
  const effective = resolveCatalogValues(draft, await baseOf(draft));
  const current = effective[locale]?.[key];
  const sourceKind =
    current?.sourceKind ??
    (current?.origin === 'default' && draft.scope.kind === 'municipal' ? 'standard' : 'municipal');
  const source =
    locale === 'de'
      ? validValue
      : catalogTextSource(draft, await baseOf(draft), key, {
          ...effective[locale]?.[key],
          value: validValue,
          origin: 'manual',
          sourceDigest: '',
          confirmedSourceDigest: null,
          sourceKind,
        });
  catalogAssert(source !== undefined, 'catalog_incomplete');
  const digest = await catalogDigest(source);
  draft.valuesByLocale[locale] ??= {};
  draft.valuesByLocale[locale]![key] = {
    value: validValue,
    origin: 'manual',
    sourceKind,
    ...(targetCode ? { targetCode } : {}),
    sourceDigest: digest,
    confirmedSourceDigest: digest,
  };
  return save(draft);
};
export const resetOverride = async (
  context: CatalogRepositoryContext,
  contractId: string,
  expectedRevision: string,
  locale: AppTranslationLocale,
  key: string
) => {
  const { scope, save, locked } = context;

  catalogAssert(scope.kind === 'municipal', 'catalog_forbidden');
  const draft = await locked(contractId, expectedRevision);
  catalogAssert(
    draft.supportedLocales.includes(locale) &&
      Object.prototype.hasOwnProperty.call(draft.manifest.keys, key)
  );
  delete draft.valuesByLocale[locale]?.[key];
  return save(draft);
};
export const confirmCorrection = async (
  context: CatalogRepositoryContext,
  contractId: string,
  expectedRevision: string,
  locale: AppTranslationLocale,
  key: string,
  targetCode?: string
) => {
  const { baseOf, save, locked } = context;

  const draft = await locked(contractId, expectedRevision);
  catalogAssert(locale !== 'de' && draft.supportedLocales.includes(locale));
  const text = draft.valuesByLocale[locale]?.[key];
  catalogAssert(text?.origin === 'manual');
  const source = catalogTextSource(draft, await baseOf(draft), key, text);
  catalogAssert(source !== undefined, 'catalog_incomplete');
  text.confirmedSourceDigest = await catalogDigest(source);
  if (targetCode) text.targetCode = targetCode;
  return save(draft);
};

/** Existing catalog machine operations on the caller transaction. */

export const applyMachineBatch = async (
  context: CatalogRepositoryContext,
  contractId: string,
  expectedRevision: string,
  entries: readonly {
    locale: string;
    key: string;
    value: CatalogValue;
    sourceDigest: string;
    targetCode: string;
    sourceKind: 'standard' | 'municipal';
    overrideDigest?: string;
  }[]
) => {
  const { scope, baseOf, save, locked } = context;

  catalogAssert(scope.kind === 'municipal', 'catalog_forbidden');
  const draft = await locked(contractId, expectedRevision);
  const base = await baseOf(draft);
  catalogAssert(entries.length > 0 && entries.length <= 50);
  for (const entry of entries) {
    catalogAssert(entry.locale !== 'de' && draft.supportedLocales.includes(entry.locale));
    const text: CatalogText = {
      value: validateCatalogValue(draft.manifest, entry.key, entry.value),
      origin: 'machine',
      sourceKind: entry.sourceKind,
      targetCode: entry.targetCode,
      sourceDigest: entry.sourceDigest,
      confirmedSourceDigest: null,
    };
    const source = catalogTextSource(draft, base, entry.key, text);
    catalogAssert(
      source !== undefined && (await catalogDigest(source)) === entry.sourceDigest,
      'catalog_conflict'
    );
    const own = draft.valuesByLocale[entry.locale]?.[entry.key];
    if (own?.origin === 'manual' || entry.overrideDigest !== undefined)
      catalogAssert(
        entry.overrideDigest !== undefined &&
          (await catalogDigest(own ?? null)) === entry.overrideDigest,
        'catalog_conflict'
      );
    const values =
      entry.sourceKind === 'standard'
        ? (draft.machineStandardValuesByLocale ??= {})
        : draft.valuesByLocale;
    values[entry.locale] ??= {};
    values[entry.locale]![entry.key] = text;
    if (entry.sourceKind === 'standard' && entry.overrideDigest !== undefined)
      delete draft.valuesByLocale[entry.locale]?.[entry.key];
  }
  return save(draft);
};
