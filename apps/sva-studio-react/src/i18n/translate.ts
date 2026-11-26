import {
  translateResource,
  type TranslationResourceNode,
  type TranslationVariables,
} from '@sva/core';
import { DEFAULT_LOCALE, i18nResources, type SupportedLocale } from './resources';

export type { TranslationVariables } from '@sva/core';

export type TranslationKey = string;

type TranslationResources = Readonly<Record<SupportedLocale, TranslationResourceNode>>;

let activeLocale: SupportedLocale = DEFAULT_LOCALE;
const translatorCache = new Map<SupportedLocale, ReturnType<typeof createTranslatorFromResources>>();

export const resetTranslatorCache = (): void => {
  translatorCache.clear();
};

export const createTranslator = (locale: SupportedLocale = DEFAULT_LOCALE) => {
  return createTranslatorFromResources(i18nResources, locale);
};

export const isSupportedLocale = (value: string): value is SupportedLocale => {
  return Object.hasOwn(i18nResources, value);
};

export const getActiveLocale = (): SupportedLocale => {
  return activeLocale;
};

export const setActiveLocale = (locale: SupportedLocale): void => {
  if (typeof globalThis.window === 'undefined') {
    return;
  }

  activeLocale = locale;
  resetTranslatorCache();
};

export const createTranslatorFromResources =
  (resources: TranslationResources, locale: SupportedLocale = DEFAULT_LOCALE) =>
  (key: TranslationKey, variables?: TranslationVariables): string =>
    translateResource(resources[locale], resources[DEFAULT_LOCALE], key, variables);

export const t = (key: TranslationKey, variables?: TranslationVariables): string => {
  let translator = translatorCache.get(activeLocale);
  if (!translator) {
    translator = createTranslatorFromResources(i18nResources, activeLocale);
    translatorCache.set(activeLocale, translator);
  }

  return translator(key, variables);
};
