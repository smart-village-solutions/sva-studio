import { deResources } from './resources/de.js';
import { enResources } from './resources/en.js';

export const i18nResources = {
  de: deResources,
  en: enResources,
} as const;

type TranslationNode = string | { [key: string]: TranslationNode };

const isTranslationBranch = (value: unknown): value is Record<string, TranslationNode> =>
  typeof value === 'object' && value !== null && Array.isArray(value) === false;

const mergeTranslationBranch = (
  target: Record<string, TranslationNode>,
  source: Record<string, TranslationNode>,
  locale: string,
  isRepeatedSource: boolean,
  pathPrefix = ''
): Record<string, TranslationNode> => {
  for (const [key, value] of Object.entries(source)) {
    const path = pathPrefix ? `${pathPrefix}.${key}` : key;
    if (isTranslationBranch(value) && isTranslationBranch(target[key])) {
      target[key] = mergeTranslationBranch(
        { ...(target[key] as Record<string, TranslationNode>) },
        value,
        locale,
        isRepeatedSource,
        path
      );
      continue;
    }

    if (target[key] !== undefined) {
      if (target[key] === value) {
        continue;
      }
      throw new Error(`duplicate_i18n_key:${locale}:${path}`);
    }

    target[key] = value;
  }

  return target;
};

const mergedPluginSourcesByLocale = Object.fromEntries(
  Object.keys(i18nResources).map((locale) => [locale, new WeakSet<object>()])
) as Record<SupportedLocale, WeakSet<object>>;
const mergedPluginSourceSignaturesByLocale = Object.fromEntries(
  Object.keys(i18nResources).map((locale) => [locale, new Set<string>()])
) as Record<SupportedLocale, Set<string>>;

export const mergeI18nResources = (
  resources: Readonly<Record<SupportedLocale, Readonly<Record<string, unknown>>>>
) => {
  const mutableResources = i18nResources as unknown as Record<SupportedLocale, Record<string, unknown>>;
  const mergedResources = { ...mutableResources } as Record<SupportedLocale, Record<string, unknown>>;
  const mergedSources: Array<readonly [SupportedLocale, object]> = [];

  for (const locale of Object.keys(resources) as SupportedLocale[]) {
    const source = resources[locale];
    const target = mutableResources[locale] as Record<string, TranslationNode>;
    const sourceRecord = source as Record<string, TranslationNode>;
    const sourceSignature = JSON.stringify(sourceRecord);
    const isRepeatedSource =
      mergedPluginSourcesByLocale[locale].has(sourceRecord) ||
      mergedPluginSourceSignaturesByLocale[locale].has(sourceSignature);
    mergedResources[locale] = mergeTranslationBranch(
      { ...target },
      sourceRecord,
      locale,
      isRepeatedSource
    ) as Record<string, unknown>;
    mergedSources.push([locale, sourceRecord]);
  }

  for (const locale of Object.keys(mergedResources) as SupportedLocale[]) {
    mutableResources[locale] = mergedResources[locale];
  }

  for (const [locale, source] of mergedSources) {
    mergedPluginSourcesByLocale[locale].add(source);
    mergedPluginSourceSignaturesByLocale[locale].add(JSON.stringify(source));
  }
};

export const DEFAULT_LOCALE = 'de';

export type SupportedLocale = keyof typeof i18nResources;
