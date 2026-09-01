const publicWasteMessages = {
  de: {
    'errors.boundRegionUnavailable':
      'Die angegebene Region ist ungültig oder für den öffentlichen Abfallkalender nicht verfügbar.',
  },
  en: {
    'errors.boundRegionUnavailable':
      'The specified region is invalid or unavailable for the public waste calendar.',
  },
} as const;

type PublicWasteLocale = keyof typeof publicWasteMessages;
type PublicWasteTranslationKey = keyof (typeof publicWasteMessages)['de'];

const resolvePublicWasteLocale = (locale: string): PublicWasteLocale =>
  locale.toLowerCase().startsWith('en') ? 'en' : 'de';

export const createPublicWasteTranslator =
  (locale: string) =>
  (key: PublicWasteTranslationKey): string =>
    publicWasteMessages[resolvePublicWasteLocale(locale)][key];
