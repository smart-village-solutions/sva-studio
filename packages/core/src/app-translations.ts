/** Internal fixed-catalog contract; no provider, transport or UI dependencies. */
/** Pilot defaults only; the provider's verified target list controls tenant availability. */
export const APP_TRANSLATION_LOCALES = [
  'de',
  'en',
  'uk',
  'es',
  'it',
  'pt-PT',
  'el',
  'ko',
  'id',
  'zh-Hans',
  'ja',
  'th',
  'tr',
  'pl',
  'da',
  'sv',
  'fi',
  'ru',
  'lv',
  'ro',
] as const;
export type AppTranslationLocale = string;
export const APP_TRANSLATION_MAX_LOCALES = 500;
export const isAppTranslationLocale = (value: unknown): value is AppTranslationLocale => {
  if (typeof value !== 'string' || value.length > 32) return false;
  try {
    return (
      Intl.getCanonicalLocales(value)[0] === value && new Intl.Locale(value).baseName === value
    );
  } catch {
    return false;
  }
};
export const appTranslationLanguage = (locale: AppTranslationLocale): string =>
  new Intl.Locale(locale).language;
export type CatalogValue = string | readonly string[];
export type CatalogScope =
  { kind: 'global' } | { kind: 'municipal'; instanceId: string; organizationId: string };
export type CatalogManifest = {
  contractId: string;
  manifestVersion: string;
  appCompatibility: { minVersion: string; maxVersion?: string };
  keys: Record<
    string,
    {
      type: 'string' | 'stringArray';
      defaultValue: CatalogValue;
      placeholders: Record<string, 'string' | 'number'>;
      allowEmpty: boolean;
    }
  >;
};
export type CatalogText = {
  value: CatalogValue;
  origin: 'default' | 'manual' | 'machine';
  sourceKind?: 'standard' | 'municipal';
  targetCode?: string;
  sourceDigest: string;
  confirmedSourceDigest: string | null;
};
export type CatalogTexts = Partial<Record<AppTranslationLocale, Record<string, CatalogText>>>;
export type CatalogDraft = {
  id: string;
  scope: CatalogScope;
  manifestId: string;
  manifest: CatalogManifest;
  draftRevision: string;
  supportedLocales: AppTranslationLocale[];
  valuesByLocale: CatalogTexts;
  machineStandardValuesByLocale?: CatalogTexts;
  baseReleaseId: string | null;
};
export type CatalogArtifact = {
  schemaVersion: 1;
  instanceId: string | null;
  organizationId: string | null;
  contractId: string;
  catalogSetRevision: string;
  locale: AppTranslationLocale;
  appCompatibility: CatalogManifest['appCompatibility'];
  sourceRevision: string;
  values: Record<string, CatalogValue>;
  fallbackKeys: string[];
  checksum: string;
};
export type CatalogRelease = {
  id: string;
  scope: CatalogScope;
  manifestId: string;
  contractId: string;
  catalogSetRevision: string;
  draftRevision: string;
  baseReleaseId: string | null;
  supportedLocales: AppTranslationLocale[];
  catalogs: Partial<Record<AppTranslationLocale, CatalogArtifact>>;
  descriptor: Record<string, unknown>;
  checksum: string;
  state: 'sealed';
};

export type CatalogReleaseSummary = Pick<
  CatalogRelease,
  'id' | 'contractId' | 'catalogSetRevision' | 'draftRevision' | 'supportedLocales' | 'checksum'
>;
export type CatalogOverview = {
  scope: CatalogScope;
  allowedLocales?: AppTranslationLocale[];
  setup?: DeepLSetupStatus;
  canManageInterfaces?: boolean;
  catalogs: (Pick<CatalogDraft, 'draftRevision' | 'supportedLocales' | 'baseReleaseId'> & {
    contractId: string;
  })[];
  releases: CatalogReleaseSummary[];
  bases: CatalogReleaseSummary[];
};
export type CatalogEditorData = {
  draft: CatalogDraft;
  values: CatalogTexts;
  baseCatalogs: CatalogRelease['catalogs'];
  allowedLocales?: AppTranslationLocale[];
  setup?: DeepLSetupStatus;
  canManageInterfaces?: boolean;
  targetCodes?: Record<string, string>;
};

export class AppTranslationError extends Error {
  constructor(
    readonly code:
      | 'catalog_export_incompatible'
      | 'deepl_text_too_large'
      | 'invalid_catalog'
      | 'catalog_setup_required'
      | 'catalog_conflict'
      | 'catalog_incomplete'
      | 'catalog_review_required'
      | 'catalog_not_found'
      | 'catalog_forbidden'
  ) {
    super(code);
    this.name = 'AppTranslationError';
  }
}
export const catalogAssert: (
  condition: unknown,
  code?: AppTranslationError['code']
) => asserts condition = (condition, code = 'invalid_catalog') => {
  if (!condition) throw new AppTranslationError(code);
};

/** Canonical JSON v1: ASCII keys, unchanged valid Unicode, safe integers only. */
export const canonicalCatalogJson = (value: unknown): string => {
  const visit = (item: unknown, depth: number): string => {
    catalogAssert(depth <= 32);
    if (typeof item === 'string') {
      catalogAssert(
        !/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(item)
      );
      return JSON.stringify(item);
    }
    if (item === null || typeof item === 'boolean') return JSON.stringify(item);
    if (typeof item === 'number') {
      catalogAssert(Number.isSafeInteger(item));
      return JSON.stringify(item);
    }
    if (Array.isArray(item)) {
      catalogAssert(
        Array.from({ length: item.length }, (_, index) =>
          Object.prototype.hasOwnProperty.call(item, index)
        ).every(Boolean)
      );
      return `[${item.map((entry) => visit(entry, depth + 1)).join(',')}]`;
    }
    catalogAssert(
      typeof item === 'object' && item !== null && Object.getPrototypeOf(item) === Object.prototype
    );
    return `{${Object.keys(item)
      .sort()
      .map((key) => {
        catalogAssert(
          /^[\x20-\x7e]+$/.test(key) && !['__proto__', 'constructor', 'prototype'].includes(key)
        );
        return `${JSON.stringify(key)}:${visit((item as Record<string, unknown>)[key], depth + 1)}`;
      })
      .join(',')}}`;
  };
  const result = visit(value, 0);
  catalogAssert(new TextEncoder().encode(result).length <= 2 * 1024 * 1024);
  return result;
};
export const catalogDigest = async (value: unknown): Promise<string> => {
  const bytes = new TextEncoder().encode(canonicalCatalogJson(value));
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
};
const object = (value: unknown): Record<string, unknown> => {
  catalogAssert(
    typeof value === 'object' &&
      value !== null &&
      !Array.isArray(value) &&
      Object.getPrototypeOf(value) === Object.prototype
  );
  return value as Record<string, unknown>;
};
const fields = (value: Record<string, unknown>, names: readonly string[]): void =>
  catalogAssert(Object.keys(value).every((key) => names.includes(key)));
export const validateCatalogLocales = (input: unknown): AppTranslationLocale[] => {
  catalogAssert(
    Array.isArray(input) && input.length > 0 && input.length <= APP_TRANSLATION_MAX_LOCALES
  );
  catalogAssert(
    input.every(isAppTranslationLocale) &&
      new Set(input).size === input.length &&
      input.includes('de')
  );
  return [...input].sort() as AppTranslationLocale[];
};
export const validateCatalogValue = (
  manifest: CatalogManifest,
  key: string,
  value: unknown
): CatalogValue => {
  const definition = Object.prototype.hasOwnProperty.call(manifest.keys, key)
    ? manifest.keys[key]
    : undefined;
  catalogAssert(definition);
  catalogAssert(
    definition.type === 'string'
      ? typeof value === 'string'
      : Array.isArray(value) &&
          value.length > 0 &&
          value.length <= 100 &&
          value.every((part) => typeof part === 'string')
  );
  for (const text of typeof value === 'string' ? [value] : (value as string[])) {
    catalogAssert(text.length <= 32768 && (definition.allowEmpty || text.length > 0));
    const names = [...text.matchAll(/\{\{([A-Za-z][A-Za-z0-9_]*)\}\}/g)].map((match) => match[1]);
    const residue = text.replace(/\{\{[A-Za-z][A-Za-z0-9_]*\}\}/g, '');
    catalogAssert(!residue.includes('{{') && !residue.includes('}}'));
    catalogAssert(
      names.every(
        (name) =>
          name !== undefined && Object.prototype.hasOwnProperty.call(definition.placeholders, name)
      ) && Object.keys(definition.placeholders).every((name) => names.includes(name))
    );
  }
  canonicalCatalogJson(value);
  return value as CatalogValue;
};
export const validateCatalogManifest = (input: unknown): CatalogManifest => {
  canonicalCatalogJson(input);
  const root = object(input);
  fields(root, ['contractId', 'manifestVersion', 'appCompatibility', 'keys']);
  catalogAssert(
    typeof root.contractId === 'string' && /^[a-z][a-z0-9-]{0,63}$/.test(root.contractId)
  );
  catalogAssert(
    typeof root.manifestVersion === 'string' &&
      /^[A-Za-z0-9][A-Za-z0-9.-]{0,63}$/.test(root.manifestVersion)
  );
  const compatibility = object(root.appCompatibility);
  fields(compatibility, ['minVersion', 'maxVersion']);
  catalogAssert(
    typeof compatibility.minVersion === 'string' && /^\d+\.\d+\.\d+$/.test(compatibility.minVersion)
  );
  catalogAssert(
    compatibility.maxVersion === undefined ||
      (typeof compatibility.maxVersion === 'string' &&
        /^\d+\.\d+\.\d+$/.test(compatibility.maxVersion))
  );
  const keys = object(root.keys);
  catalogAssert(Object.keys(keys).length > 0 && Object.keys(keys).length <= 10000);
  for (const [key, raw] of Object.entries(keys)) {
    catalogAssert(/^[A-Za-z][A-Za-z0-9_.-]{0,127}$/.test(key));
    const entry = object(raw);
    fields(entry, ['type', 'defaultValue', 'placeholders', 'allowEmpty']);
    catalogAssert(
      ['string', 'stringArray'].includes(String(entry.type)) &&
        typeof entry.allowEmpty === 'boolean'
    );
    const placeholders = object(entry.placeholders);
    catalogAssert(
      Object.entries(placeholders).every(
        ([name, type]) =>
          /^[A-Za-z][A-Za-z0-9_]*$/.test(name) && ['string', 'number'].includes(String(type))
      )
    );
    validateCatalogValue(input as CatalogManifest, key, entry.defaultValue);
  }
  return structuredClone(input as CatalogManifest);
};

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

export type DeepLLanguage = Readonly<{ code: string; name: string; tagHandling: boolean }>;
export type DeepLSettings = Readonly<{
  revision: string;
  credentialRevision: string;
  verifiedCredentialRevision?: string;
  plan: 'free' | 'pro';
  englishVariant: 'en-GB' | 'en-US';
  selectedLocales: readonly AppTranslationLocale[];
  availableLanguages: readonly DeepLLanguage[];
}>;
export type DeepLSetupStatus = Readonly<{
  ready: boolean;
  reason:
    | 'not_configured'
    | 'disabled'
    | 'secret_missing'
    | 'check_required'
    | 'languages_required'
    | 'ready';
  interfaceId: string | null;
  selectedLocales: readonly AppTranslationLocale[];
}>;
export const deepLTargetCode = (
  locale: AppTranslationLocale,
  englishVariant: DeepLSettings['englishVariant'],
  available?: readonly DeepLLanguage[]
): string =>
  locale === 'en' && (!available || available.some((language) => language.code === englishVariant))
    ? englishVariant
    : locale;
export const readDeepLSettings = (
  value: Readonly<Record<string, unknown>>
): DeepLSettings | undefined => {
  if (
    typeof value.revision !== 'string' ||
    typeof value.credentialRevision !== 'string' ||
    !['free', 'pro'].includes(String(value.plan)) ||
    !['en-GB', 'en-US'].includes(String(value.englishVariant)) ||
    !Array.isArray(value.selectedLocales) ||
    value.selectedLocales.length > APP_TRANSLATION_MAX_LOCALES ||
    value.selectedLocales.some(
      (locale) => !isAppTranslationLocale(locale) || appTranslationLanguage(locale) === 'de'
    ) ||
    new Set(value.selectedLocales.map(appTranslationLanguage)).size !==
      value.selectedLocales.length ||
    !Array.isArray(value.availableLanguages) ||
    value.availableLanguages.length > 500 ||
    value.availableLanguages.some(
      (language) =>
        !language ||
        typeof language !== 'object' ||
        !isAppTranslationLocale(language.code) ||
        typeof language.name !== 'string' ||
        typeof language.tagHandling !== 'boolean'
    )
  )
    return undefined;
  return {
    revision: value.revision,
    credentialRevision: value.credentialRevision,
    ...(typeof value.verifiedCredentialRevision === 'string'
      ? { verifiedCredentialRevision: value.verifiedCredentialRevision }
      : {}),
    plan: value.plan as DeepLSettings['plan'],
    englishVariant: value.englishVariant as DeepLSettings['englishVariant'],
    selectedLocales: value.selectedLocales as AppTranslationLocale[],
    availableLanguages: value.availableLanguages as DeepLLanguage[],
  };
};
