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
    'reminder.action': 'E-Mail-Erinnerung',
    'reminder.description':
      'Das Abo verwendet diese Erinnerungszeiten für die aktiven Abfallarten:',
    'reminder.sameDay': 'am Abholtag',
    'reminder.oneDayBefore': '1 Tag vor der Abholung',
    'reminder.daysBefore': '{days} Tage vor der Abholung',
    'reminder.sendTime':
      'Versand gegen 7 Uhr im Winter und 8 Uhr im Sommer (Ortszeit Deutschland).',
    'reminder.email': 'E-Mail-Adresse',
    'reminder.consentFallback': 'Ich stimme der Verarbeitung meiner Daten zu.',
    'reminder.privacy': 'Datenschutzerklärung',
    'reminder.unsupported':
      'Für die aktuelle Auswahl sind nicht für alle Abfallarten E-Mail-Erinnerungen verfügbar. Passen Sie die Auswahl an.',
    'reminder.submit': 'E-Mail-Erinnerung anfordern',
    'reminder.submitting': 'Wird angefordert…',
    'reminder.unavailable': 'Der E-Mail-Erinnerungsdienst ist derzeit nicht verfügbar.',
    'reminder.invalidInput':
      'Bitte geben Sie eine gültige E-Mail-Adresse ein und bestätigen Sie die Datenschutz-Einwilligung.',
    'reminder.requestFailed': 'Die Erinnerung konnte nicht angefordert werden.',
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
    'reminder.action': 'Email reminder',
    'reminder.description':
      'The subscription uses these reminder times for the selected waste types:',
    'reminder.sameDay': 'on collection day',
    'reminder.oneDayBefore': '1 day before collection',
    'reminder.daysBefore': '{days} days before collection',
    'reminder.sendTime': 'Sent around 7 a.m. in winter and 8 a.m. in summer (German local time).',
    'reminder.email': 'Email address',
    'reminder.consentFallback': 'I agree to the processing of my data.',
    'reminder.privacy': 'Privacy policy',
    'reminder.unsupported':
      'Email reminders are unavailable for some selected waste types. Adjust your selection.',
    'reminder.submit': 'Request email reminder',
    'reminder.submitting': 'Requesting…',
    'reminder.unavailable': 'The email reminder service is currently unavailable.',
    'reminder.invalidInput': 'Enter a valid email address and accept the privacy notice.',
    'reminder.requestFailed': 'The reminder could not be requested.',
  },
} as const;

type PublicWasteLocale = keyof typeof publicWasteMessages;
export type PublicWasteTranslationKey = keyof (typeof publicWasteMessages)['de'];

const resolvePublicWasteLocale = (locale: string): PublicWasteLocale =>
  locale.toLowerCase().startsWith('en') ? 'en' : 'de';

export const createPublicWasteTranslator =
  (locale: string) =>
  (key: PublicWasteTranslationKey): string =>
    publicWasteMessages[resolvePublicWasteLocale(locale)][key];
