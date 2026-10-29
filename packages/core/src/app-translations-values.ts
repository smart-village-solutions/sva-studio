/** Resolve catalog inheritance and source freshness. */
import {
  catalogAssert,
  catalogDigest,
  validateCatalogValue,
} from './app-translations-validation.js';
import type {
  CatalogDraft,
  CatalogRelease,
  CatalogTexts,
  CatalogText,
  CatalogValue,
  CatalogEditorData,
} from './app-translations-types.js';
/** Resolve per-language inheritance; a German override does not change other inherited values. */
export const resolveCatalogValues = (
  draft: CatalogDraft,
  base: CatalogRelease | null
): CatalogTexts => {
  catalogAssert(
    draft.scope.kind === 'global'
      ? base === null
      : Boolean(
          base &&
          base.scope.kind === 'global' &&
          base.contractId === draft.manifest.contractId &&
          base.manifestId === draft.manifestId &&
          base.id === draft.baseReleaseId
        ),
    'catalog_conflict'
  );
  const result: CatalogTexts = {};
  for (const locale of draft.supportedLocales) {
    const inherited = base?.catalogs[locale];
    const inheritedValues = inherited?.values ?? {};
    result[locale] = Object.fromEntries(
      Object.entries(inheritedValues).map(([key, value]) => [
        key,
        { value, origin: 'default', sourceDigest: '', confirmedSourceDigest: null },
      ])
    );
    for (const [key, text] of Object.entries(draft.machineStandardValuesByLocale?.[locale] ?? {}))
      if (Object.prototype.hasOwnProperty.call(draft.manifest.keys, key))
        result[locale]![key] = structuredClone(text);
    for (const [key, text] of Object.entries(draft.valuesByLocale[locale] ?? {}))
      if (Object.prototype.hasOwnProperty.call(draft.manifest.keys, key))
        result[locale]![key] = structuredClone(text);
  }
  return result;
};
/** Legacy corrections retain their previous effective-German source binding. */
export const catalogTextSource = (
  draft: CatalogDraft,
  base: CatalogRelease | null,
  key: string,
  text: CatalogText
): CatalogValue | undefined => {
  if (text.sourceKind === 'standard') return base?.catalogs.de?.values[key];
  catalogAssert(
    draft.scope.kind === 'global'
      ? base === null
      : Boolean(
          base &&
          base.scope.kind === 'global' &&
          base.contractId === draft.manifest.contractId &&
          base.manifestId === draft.manifestId &&
          base.id === draft.baseReleaseId
        ),
    'catalog_conflict'
  );
  if (!draft.supportedLocales.includes('de')) return undefined;
  const own = draft.valuesByLocale.de?.[key];
  if (own) return own.value;
  const machine = draft.machineStandardValuesByLocale?.de?.[key];
  if (machine && Object.prototype.hasOwnProperty.call(draft.manifest.keys, key))
    return machine.value;
  return base?.catalogs.de?.values[key];
};

export const catalogTextIsCurrent = async (
  text: CatalogText,
  source: CatalogValue | undefined,
  targetCode?: string
): Promise<boolean> =>
  source !== undefined &&
  (!targetCode || text.targetCode === targetCode) &&
  (text.origin === 'manual' ? text.confirmedSourceDigest : text.sourceDigest) ===
    (await catalogDigest(source));

export const catalogTranslationSource = async (
  data: CatalogEditorData,
  mode: 'missing' | 'municipal' | 'standard',
  locale: string,
  key: string,
  targetCode: string
) => {
  const source =
    mode === 'municipal' ? data.values.de?.[key]?.value : data.baseCatalogs.de?.values[key];
  catalogAssert(source !== undefined, 'catalog_conflict');
  if (mode === 'missing') {
    if (data.draft.valuesByLocale[locale]?.[key]?.origin === 'manual') return undefined;
    const standard = data.draft.machineStandardValuesByLocale?.[locale]?.[key];
    if (standard && (await catalogTextIsCurrent(standard, source, targetCode))) return undefined;
    if (!standard && data.values[locale]?.[key]?.origin === 'default' && locale !== 'en')
      return undefined;
  }
  return source;
};

/** Materialize immutable complete release payloads. */
export const prepareCatalogRelease = async (
  draft: CatalogDraft,
  base: CatalogRelease | null,
  revision: string,
  targetCodes?: Readonly<Record<string, string>>
) => {
  catalogAssert(/^[1-9][0-9]{0,19}$/.test(revision));
  const effective = resolveCatalogValues(draft, base);
  const catalogs: CatalogRelease['catalogs'] = {};
  const basis = {
    manifestId: draft.manifestId,
    draftId: draft.id,
    draftRevision: draft.draftRevision,
    baseReleaseId: draft.baseReleaseId,
  };
  const sourceRevision = await catalogDigest(basis);
  for (const locale of draft.supportedLocales) {
    const values: Record<string, CatalogValue> = {};
    for (const key of Object.keys(draft.manifest.keys).sort()) {
      const text = effective[locale]?.[key];
      catalogAssert(text, 'catalog_incomplete');
      values[key] = validateCatalogValue(draft.manifest, key, text.value);
      if (locale !== 'de' && text.origin !== 'default') {
        catalogAssert(
          await catalogTextIsCurrent(
            text,
            catalogTextSource(draft, base, key, text),
            text.origin === 'machine' || text.targetCode || locale === 'en'
              ? targetCodes?.[locale]
              : undefined
          ),
          'catalog_review_required'
        );
      }
    }
    catalogAssert(
      Object.keys(effective[locale] ?? {}).every((key) =>
        Object.prototype.hasOwnProperty.call(draft.manifest.keys, key)
      )
    );
    const payload = {
      schemaVersion: 1 as const,
      instanceId: draft.scope.kind === 'municipal' ? draft.scope.instanceId : null,
      organizationId: draft.scope.kind === 'municipal' ? draft.scope.organizationId : null,
      locale,
      contractId: draft.manifest.contractId,
      catalogSetRevision: revision,
      appCompatibility: draft.manifest.appCompatibility,
      sourceRevision,
      values,
      fallbackKeys: [] as string[],
    };
    catalogs[locale] = { ...payload, checksum: await catalogDigest(payload) };
  }
  const namespace = await catalogDigest([
    'catalog-namespace-v1',
    draft.scope.kind === 'municipal' ? draft.scope.instanceId : null,
    draft.scope.kind === 'municipal' ? draft.scope.organizationId : null,
  ]);
  const descriptor = {
    schemaVersion: 1,
    instanceId: draft.scope.kind === 'municipal' ? draft.scope.instanceId : null,
    organizationId: draft.scope.kind === 'municipal' ? draft.scope.organizationId : null,
    contractId: draft.manifest.contractId,
    catalogSetRevision: revision,
    appCompatibility: draft.manifest.appCompatibility,
    supportedLocales: draft.supportedLocales,
    catalogs: draft.supportedLocales.map((locale) => ({
      locale,
      name: `app-texts-${namespace}-${draft.manifest.contractId}-${locale.toLowerCase()}-r${revision}`,
      version: draft.manifest.appCompatibility.minVersion,
      checksum: catalogs[locale]!.checksum,
    })),
  };
  return { catalogs, descriptor, checksum: await catalogDigest(descriptor) };
};
