const publicWasteMessages = {
  de: {
    'calendar.title': 'Abfallkalender',
    'calendar.loading': 'Abfallkalender wird geladen.',
    'selection.fractionsWithEmailReminder':
      'Diese Auswahl steuert Liste, Kalenderexport, PDF/Druckversion und E-Mail-Erinnerung gemeinsam.',
    'selection.fractionsWithoutEmailReminder':
      'Diese Auswahl steuert Liste, Kalenderexport und PDF/Druckversion gemeinsam.',
    'errors.boundRegionUnavailable':
      'Die angegebene Region ist ungültig oder für den öffentlichen Abfallkalender nicht verfügbar.',
    'errors.loadFailed': 'Die öffentlichen Abfallkalender-Daten konnten nicht geladen werden.',
  },
  en: {
    'calendar.title': 'Waste calendar',
    'calendar.loading': 'Loading waste calendar.',
    'selection.fractionsWithEmailReminder':
      'This selection controls the list, calendar export, PDF/print version and email reminders.',
    'selection.fractionsWithoutEmailReminder':
      'This selection controls the list, calendar export and PDF/print version.',
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
