import {
  APP_TRANSLATION_MAX_LOCALES,
  isAppTranslationLocale,
  type AppTranslationLocale,
} from './app-translations-validation.js';

export type SsfTranslationTarget = AppTranslationLocale;

export const isSsfTranslationTarget = (locale: unknown): locale is SsfTranslationTarget =>
  isAppTranslationLocale(locale) && locale !== 'de' && /^[a-z]{2,3}$/u.test(locale);

export const isSsfTranslationApiKey = (key: string): boolean => /^[!-~]{1,4096}$/u.test(key);

export const parseSsfTranslationOrigin = (value: string): string | undefined => {
  const url = URL.parse(value.trim());
  return url?.protocol === 'https:' && url.href === `${url.origin}/` ? url.origin : undefined;
};

export const isSsfTranslationLocaleList = (value: unknown): value is SsfTranslationTarget[] =>
  Array.isArray(value) &&
  value.length <= APP_TRANSLATION_MAX_LOCALES &&
  value.every(isSsfTranslationTarget) &&
  new Set(value).size === value.length;

export type SsfTranslationSettings = Readonly<{
  origin: string;
  selectedLocales: readonly SsfTranslationTarget[];
  availableLanguages: readonly SsfTranslationTarget[];
  revision: string;
  credentialRevision: string;
  verifiedCredentialRevision?: string;
}>;

export const readSsfTranslationSettings = (
  config: Readonly<Record<string, unknown>>
): SsfTranslationSettings | undefined => {
  const origin =
    typeof config.origin === 'string' ? parseSsfTranslationOrigin(config.origin) : undefined;
  if (
    !origin ||
    typeof config.revision !== 'string' ||
    typeof config.credentialRevision !== 'string' ||
    !isSsfTranslationLocaleList(config.selectedLocales) ||
    !isSsfTranslationLocaleList(config.availableLanguages)
  )
    return undefined;
  return {
    origin,
    revision: config.revision,
    credentialRevision: config.credentialRevision,
    verifiedCredentialRevision:
      typeof config.verifiedCredentialRevision === 'string'
        ? config.verifiedCredentialRevision
        : undefined,
    selectedLocales: config.selectedLocales,
    availableLanguages: config.availableLanguages,
  };
};
