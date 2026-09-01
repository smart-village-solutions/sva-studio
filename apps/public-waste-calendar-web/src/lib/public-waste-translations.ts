const publicWasteMessages = {
  de: {
    'errors.boundRegionUnavailable':
      'Die angegebene Region ist ungültig oder für den öffentlichen Abfallkalender nicht verfügbar.',
    'errors.loadFailed': 'Die öffentlichen Abfallkalender-Daten konnten nicht geladen werden.',
  },
  en: {
    'errors.boundRegionUnavailable':
      'The specified region is invalid or unavailable for the public waste calendar.',
    'errors.loadFailed': 'The public waste calendar data could not be loaded.',
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
