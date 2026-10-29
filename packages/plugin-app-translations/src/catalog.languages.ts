import { usePluginTranslation } from '@sva/plugin-sdk';
import { APP_TRANSLATION_LOCALES } from '@sva/plugin-sdk/app-translations';
export const useCatalogLanguages = () => {
  const pt = usePluginTranslation('appTranslations.ui');
  const displayNames = new Intl.DisplayNames([pt('languageTag') === 'en' ? 'en' : 'de'], {
    type: 'language',
  });
  const languageName = (locale: string) =>
    (APP_TRANSLATION_LOCALES as readonly string[]).includes(locale)
      ? pt(`locales.${locale}`)
      : (displayNames.of(locale) ?? locale);
  const languageNames = (locales: readonly string[]) =>
    [...locales]
      .sort(
        (left, right) =>
          Number(right === 'de') - Number(left === 'de') ||
          languageName(left).localeCompare(
            languageName(right),
            pt('languageTag') === 'en' ? 'en' : 'de'
          )
      )
      .map(languageName)
      .join(', ');
  return { pt, languageName, languageNames };
};
