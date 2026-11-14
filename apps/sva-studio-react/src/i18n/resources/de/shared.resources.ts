export const sharedDEResources = {
  datePicker: {
    time: 'Uhrzeit',
    timeFor: 'Uhrzeit: {{label}}',
    openCalendar: 'Kalender öffnen',
    calendar: 'Datum auswählen',
    navigation: 'Kalendernavigation',
    previousMonth: 'Vorheriger Monat',
    nextMonth: 'Nächster Monat',
    formatHint: 'TT.MM.JJJJ',
    today: 'Heute',
    selected: 'Ausgewählt',
    errors: {
      invalidTime: 'Bitte eine gültige Uhrzeit eingeben.',
      invalidInstant:
        'Bitte einen gültigen Zeitpunkt eingeben. Die Uhrzeit muss in der Redaktionszeitzone existieren.',
      invalid: 'Bitte ein gültiges Datum eingeben.',
      required: 'Bitte ein Datum eingeben.',
      min: 'Das Datum liegt vor dem frühesten zulässigen Datum.',
      max: 'Das Datum liegt nach dem spätesten zulässigen Datum.',
    },
  },
  errorFallback: {
    title: 'Fehler',
    heading: 'Ein unerwarteter Fehler ist aufgetreten',
    body: 'Bitte versuchen Sie es erneut oder kehren Sie zur Startseite zurück.',
    retry: 'Erneut versuchen',
    home: 'Zur Startseite',
    diagnosticsLabel: 'Lokale Diagnose',
  },
  notFound: {
    heading: 'Seite nicht gefunden',
    body: 'Die angeforderte Seite existiert nicht oder wurde verschoben.',
    home: 'Zur Startseite',
  },
} as const;
