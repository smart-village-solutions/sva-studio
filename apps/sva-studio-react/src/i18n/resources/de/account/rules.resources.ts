export const rulesAccountDEResources = {
  title: 'Kontoregeln',
  navLabel: 'Kontoregeln',
  subtitle:
    'Prüfen Sie tenantweite Löschregeln und die Behandlung Ihrer eigenen Inhalte in einer separaten Ansicht.',
  summary: {
    deactivateAfterDays: 'Deaktivierung nach',
    deactivateAfterDaysHint: 'Tage seit dem letzten erfolgreichen Login bis zur Deaktivierung.',
    pseudonymizeAfterDays: 'Pseudonymisierung nach',
    pseudonymizeAfterDaysHint:
      'Tage seit dem letzten erfolgreichen Login bis zur Pseudonymisierung.',
    deleteAfterDays: 'Tombstone-Soft-Delete nach',
    deleteAfterDaysHint:
      'Tage seit dem letzten erfolgreichen Login bis zum finalen Tombstone-Soft-Delete.',
    defaultContentStrategy: 'Standardregel für Inhalte',
  },
  sections: {
    global: {
      title: 'Tenantweite Regeln',
      deactivateAfterDays:
        'Nach der konfigurierten Anzahl von Tagen seit dem letzten erfolgreichen Login wird das Konto deaktiviert und für direkte Logins gesperrt.',
      pseudonymizeAfterDays:
        'Nach der konfigurierten Anzahl von Tagen seit dem letzten erfolgreichen Login werden personenbezogene Daten pseudonymisiert, soweit keine Aufbewahrungspflicht greift.',
      deleteAfterDays:
        'Nach der konfigurierten Anzahl von Tagen seit dem letzten erfolgreichen Login erhält das Konto den finalen Tombstone-Soft-Delete-Zustand; es wird dabei nicht physisch entfernt.',
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
