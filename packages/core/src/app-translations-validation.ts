/** Canonical catalog locale identifiers and limits. */
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

/** Shared catalog error codes and fail-closed assertion. */
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

/** Canonical catalog serialization and integrity digest. */
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

/** Manifest, locale and placeholder validation. */
import type { CatalogManifest, CatalogValue } from './app-translations-types.js';
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
