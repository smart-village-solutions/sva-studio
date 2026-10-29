/** Read validated instance-owned DeepL configuration. */
import {
  APP_TRANSLATION_MAX_LOCALES,
  isAppTranslationLocale,
  appTranslationLanguage,
  type AppTranslationLocale,
} from './app-translations-validation.js';
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
const validSelectedLocales = (locales: unknown): locales is AppTranslationLocale[] =>
  Array.isArray(locales) &&
  locales.length <= APP_TRANSLATION_MAX_LOCALES &&
  !locales.some(
    (locale) => !isAppTranslationLocale(locale) || appTranslationLanguage(locale) === 'de'
  ) &&
  new Set(locales.map(appTranslationLanguage)).size === locales.length;
const validAvailableLanguages = (languages: unknown): languages is DeepLLanguage[] =>
  Array.isArray(languages) &&
  languages.length <= 500 &&
  !languages.some(
    (language) =>
      !language ||
      typeof language !== 'object' ||
      !isAppTranslationLocale(language.code) ||
      typeof language.name !== 'string' ||
      typeof language.tagHandling !== 'boolean'
  );
export const readDeepLSettings = (
  value: Readonly<Record<string, unknown>>
): DeepLSettings | undefined => {
  if (
    typeof value.revision !== 'string' ||
    typeof value.credentialRevision !== 'string' ||
    !['free', 'pro'].includes(String(value.plan)) ||
    !['en-GB', 'en-US'].includes(String(value.englishVariant)) ||
    !validSelectedLocales(value.selectedLocales) ||
    !validAvailableLanguages(value.availableLanguages)
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
