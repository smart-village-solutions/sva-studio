export const rulesAccountDEResources = {
  title: 'Kontoregeln',
  navLabel: 'Kontoregeln',
  subtitle:
    'Hier sehen Sie, wann Ihr Konto nach längerer Zeit ohne Anmeldung eingeschränkt wird und was mit Ihren Inhalten geschieht.',
  summary: {
    deactivateAfterDays: 'Konto deaktivieren nach',
    deactivateAfterDaysHint: 'Tage ohne erfolgreiche Anmeldung, bis das Konto gesperrt wird.',
    pseudonymizeAfterDays: 'Persönliche Angaben entfernen nach',
    pseudonymizeAfterDaysHint:
      'Tage ohne erfolgreiche Anmeldung, bis persönliche Angaben entfernt werden.',
    deleteAfterDays: 'Konto als gelöscht markieren nach',
    deleteAfterDaysHint:
      'Tage ohne erfolgreiche Anmeldung, bis das Konto als gelöscht markiert wird.',
    defaultContentStrategy: 'Was mit Ihren Inhalten geschieht',
  },
  sections: {
    global: {
      title: 'Regeln für Konten von Personen in dieser Instanz',
      deactivateAfterDays:
        'Nach der festgelegten Zeit ohne Anmeldung wird das Konto deaktiviert. Eine direkte Anmeldung ist dann nicht mehr möglich.',
      pseudonymizeAfterDays:
        'Später werden persönliche Angaben aus dem Konto entfernt, soweit sie nicht aufbewahrt werden müssen.',
      deleteAfterDays:
        'Danach wird das Konto als gelöscht markiert. Der Datensatz wird dabei nicht vollständig entfernt.',
      defaultContentStrategy:
        'Die Regel für Inhalte legt fest, ob Ihre Inhalte erhalten bleiben oder zusammen mit dem Konto behandelt werden.',
    },
    personal: {
      title: 'Eigene Inhaltsregel',
    },
  },
  fields: {
    contentPreference: 'Regel für eigene Inhalte',
    contentPreferenceHint:
      'Wählen Sie, ob Ihre Inhalte erhalten bleiben oder zusammen mit Ihrem Konto behandelt werden.',
  },
  actions: {
    save: 'Inhaltsregel speichern',
    saving: 'Wird gespeichert…',
    saved: 'Gespeichert',
  },
  messages: {
    loading: 'Kontoregeln werden geladen ...',
    saveSuccess: 'Die Inhaltsregel wurde gespeichert.',
  },
  strategies: {
    retain: 'Inhalte beibehalten',
    with_owner_lifecycle: 'Inhalte zusammen mit dem Konto behandeln',
  },
} as const;
