export const mainserverInstancesAdminDEResources = {
  title: 'Mainserver-Schnittstelle',
  description: 'Zentrale Konfiguration für diese aktive Instanz. Der Status beschreibt den gespeicherten Eintrag, nicht die Erreichbarkeit des Mainservers.',
  graphqlBaseUrl: 'GraphQL-URL',
  oauthTokenUrl: 'OAuth-Token-URL',
  enabled: 'Schnittstelle aktiviert',
  save: 'Schnittstelle speichern',
  saved: 'Schnittstelle gespeichert und erneut gelesen.',
  error: 'Mainserver-Schnittstellen konnten nicht geladen oder gespeichert werden. Bitte den Zustand erneut prüfen.',
  status: {
    loading: 'Wird geladen',
    missing: 'Fehlt',
    disabled: 'Deaktiviert',
    configured: 'Konfiguriert',
    error: 'Lesefehler',
  },
} as const;
