import { DEFAULT_LOCALE, i18nResources, type SupportedLocale } from './resources';

type TranslationTree = (typeof i18nResources)[typeof DEFAULT_LOCALE];
type Primitive = string;

type DotPath<T> = T extends Primitive
  ? never
  : {
      [K in keyof T & string]: T[K] extends Primitive ? K : `${K}.${DotPath<T[K]>}`;
    }[keyof T & string];

export type TranslationKey = DotPath<TranslationTree>;

export type TranslationVariables = Readonly<Record<string, string | number>>;

const readTranslationValue = (locale: SupportedLocale, key: TranslationKey): string | undefined => {
  const segments = key.split('.');
  let pointer: unknown = i18nResources[locale];

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
  return (key: TranslationKey, variables?: TranslationVariables): string => {
    const localizedMessage = readTranslationValue(locale, key);
    if (localizedMessage) {
      return interpolate(localizedMessage, variables);
    }

    const fallbackMessage = readTranslationValue(DEFAULT_LOCALE, key);
    if (fallbackMessage) {
      return interpolate(fallbackMessage, variables);
    }

    return key;
  };
};

export const t = createTranslator(DEFAULT_LOCALE);
