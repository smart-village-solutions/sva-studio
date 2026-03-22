import { DEFAULT_LOCALE, i18nResources, type SupportedLocale } from './resources';

type TranslationTree = (typeof i18nResources)[typeof DEFAULT_LOCALE];
type Primitive = string;
type TranslationResourceNode = string | undefined | { readonly [key: string]: TranslationResourceNode };

type DotPath<T> = T extends Primitive
  ? never
  : {
      [K in keyof T & string]: T[K] extends Primitive ? K : `${K}.${DotPath<T[K]>}`;
    }[keyof T & string];

export type TranslationKey = DotPath<TranslationTree>;

export type TranslationVariables = Readonly<Record<string, string | number>>;

type TranslationResources = Readonly<Record<SupportedLocale, TranslationResourceNode>>;

let activeLocale: SupportedLocale = DEFAULT_LOCALE;
const translatorCache = new Map<SupportedLocale, ReturnType<typeof createTranslatorFromResources>>();

const readTranslationValue = (
  resources: TranslationResources,
  locale: SupportedLocale,
  key: TranslationKey
): string | undefined => {
  const segments = key.split('.');
  let pointer: unknown = resources[locale];

  for (const segment of segments) {
    if (!pointer || typeof pointer !== 'object' || !(segment in pointer)) {
      return undefined;
    }

    pointer = (pointer as Record<string, unknown>)[segment];
  }

  return typeof pointer === 'string' ? pointer : undefined;
};

const interpolate = (message: string, variables?: TranslationVariables): string => {
  if (!variables) {
    return message;
  }

  return message.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, variableName: string) => {
    const value = variables[variableName];
    return value === undefined ? match : String(value);
  });
};

export const createTranslator = (locale: SupportedLocale = DEFAULT_LOCALE) => {
  return createTranslatorFromResources(i18nResources, locale);
};

export const isSupportedLocale = (value: string): value is SupportedLocale => {
  return Object.prototype.hasOwnProperty.call(i18nResources, value);
};

export const getActiveLocale = (): SupportedLocale => {
  return activeLocale;
};

export const setActiveLocale = (locale: SupportedLocale): void => {
  if (typeof window === 'undefined') {
    return;
  }

  activeLocale = locale;
};

export const createTranslatorFromResources = (
  resources: TranslationResources,
  locale: SupportedLocale = DEFAULT_LOCALE
) => {
  return (key: TranslationKey, variables?: TranslationVariables): string => {
    const localizedMessage = readTranslationValue(resources, locale, key);
    if (localizedMessage) {
      return interpolate(localizedMessage, variables);
    }

    const fallbackMessage = readTranslationValue(resources, DEFAULT_LOCALE, key);
    if (fallbackMessage) {
      return interpolate(fallbackMessage, variables);
    }

    return key;
  };
};

export const t = (key: TranslationKey, variables?: TranslationVariables): string => {
  let translator = translatorCache.get(activeLocale);
  if (!translator) {
    translator = createTranslatorFromResources(i18nResources, activeLocale);
    translatorCache.set(activeLocale, translator);
  }

  return translator(key, variables);
};
