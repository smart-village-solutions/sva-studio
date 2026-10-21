/** Internal fixed-catalog contract; no provider, transport or UI dependencies. */
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
export type AppTranslationLocale = (typeof APP_TRANSLATION_LOCALES)[number];
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
  origin: 'default' | 'manual';
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

export class AppTranslationError extends Error {
  constructor(
    readonly code:
      | 'invalid_catalog'
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
    Array.isArray(input) && input.length > 0 && input.length <= APP_TRANSLATION_LOCALES.length
  );
  catalogAssert(
    input.every((locale) => APP_TRANSLATION_LOCALES.includes(locale as AppTranslationLocale)) &&
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
    for (const [key, text] of Object.entries(draft.valuesByLocale[locale] ?? {}))
      result[locale]![key] = structuredClone(text);
  }
  return result;
};
export const prepareCatalogRelease = async (
  draft: CatalogDraft,
  base: CatalogRelease | null,
  revision: string
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
      if (
        locale !== 'de' &&
        Object.prototype.hasOwnProperty.call(draft.valuesByLocale[locale] ?? {}, key)
      ) {
        const source = effective.de?.[key];
        catalogAssert(source, 'catalog_incomplete');
        catalogAssert(
          text.confirmedSourceDigest === (await catalogDigest(source.value)),
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
