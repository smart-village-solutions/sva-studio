export const rulesAccountDEResources = {
  title: 'Kontoregeln',
  navLabel: 'Kontoregeln',
  subtitle:
    'Prüfen Sie tenantweite Löschregeln und die Behandlung Ihrer eigenen Inhalte in einer separaten Ansicht.',
  summary: {
    deactivateAfterDays: 'Deaktivierung nach',
    deactivateAfterDaysHint: 'Zeit bis zur Deaktivierung in Tagen.',
    pseudonymizeAfterDays: 'Pseudonymisierung nach',
    pseudonymizeAfterDaysHint: 'Zeit bis zur Pseudonymisierung in Tagen.',
    deleteAfterDays: 'Löschung nach',
    deleteAfterDaysHint: 'Zeit bis zur endgültigen Löschung in Tagen.',
    defaultContentStrategy: 'Standardregel für Inhalte',
  },
  sections: {
    global: {
      title: 'Tenantweite Regeln',
      deactivateAfterDays:
        'Nach der konfigurierten Frist wird das Konto zunächst deaktiviert und für direkte Logins gesperrt.',
      pseudonymizeAfterDays:
        'Nach der zweiten Frist werden personenbezogene Daten pseudonymisiert, soweit keine Aufbewahrungspflicht greift.',
      deleteAfterDays:
        'Nach Ablauf der letzten Frist wird das Konto endgültig entfernt, sofern keine rechtliche Sperre besteht.',
      defaultContentStrategy:
        'Die Standardregel für Inhalte legt fest, ob eigene Inhalte erhalten bleiben oder mit dem Besitzer-Lebenszyklus mitlaufen.',
    },
    personal: {
      title: 'Eigene Inhaltsregel',
    },
  },
  fields: {
    contentPreference: 'Regel für eigene Inhalte',
    contentPreferenceHint:
      'Wählen Sie, ob Ihre eigenen Inhalte dauerhaft erhalten bleiben oder dem Konto-Lebenszyklus folgen sollen.',
  },
  actions: {
    save: 'Inhaltsregel speichern',
    saving: 'Inhaltsregel wird gespeichert ...',
  },
  messages: {
    loading: 'Kontoregeln werden geladen ...',
    saveSuccess: 'Die Inhaltsregel wurde gespeichert.',
  },
  strategies: {
    retain: 'Inhalte beibehalten',
    with_owner_lifecycle: 'Inhalte mit dem Konto-Lebenszyklus behandeln',
  },
} as const;
