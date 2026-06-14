export const homeDEResources = {
  devAuth: {
    prompt: 'Lokaler Dev-Auth-Modus ist aktiv. Keycloak wird für diese Sitzung umgangen.',
  },
  hero: {
    eyebrow: 'Studio Workspace',
    openSourcePrefix: 'Open Source Software made with',
    openSourceLoveLabel: 'love',
    openSourceSuffix: 'in Bad Belzig',
    subtitle: 'Smart Village App Self-Service Plattform für Inhalte, Module und Erweiterungen.',
    body: 'Verwalten Sie Inhalte, Kontokontext und angeschlossene Module in einer gemeinsamen Oberfläche mit serverseitig abgesicherter Authentifizierung und Berechtigungsprüfung.',
    primaryAction: 'Inhalte öffnen',
    secondaryAction: 'Konto öffnen',
  },
  session: {
    loading: 'Sitzung wird geladen ...',
  },
  sections: {
    overviewTitle: 'Direkte Einstiege',
    overviewBody:
      'Nutzen Sie die wichtigsten Bereiche direkt aus der Startseite. Details zu Rollen, Guards und technischen Entscheidungen bleiben in den jeweiligen Fachbereichen verankert.',
  },
  cards: {
    content: {
      title: 'Inhalte',
      description:
        'Pflegen Sie redaktionelle Inhalte, Metadaten und Veröffentlichungsstände in der zentralen Inhaltsverwaltung.',
      action: 'Inhalte öffnen',
    },
    account: {
      title: 'Konto',
      description:
        'Prüfen Sie Ihr Profil, Ihren Datenschutzkontext und weitere selbstbedienbare Kontofunktionen.',
      action: 'Konto öffnen',
    },
    interfaces: {
      title: 'Schnittstellen',
      description:
        'Überblicken Sie angebundene Integrationen und öffnen Sie die verwalteten Schnittstellenbereiche.',
      action: 'Schnittstellen öffnen',
    },
  },
  authError: {
    loginFailed: 'Login fehlgeschlagen. Bitte erneut versuchen.',
    stateExpired: 'Login abgebrochen oder abgelaufen. Bitte erneut anmelden.',
    sessionExpired: 'Ihre Sitzung ist abgelaufen. Bitte melden Sie sich erneut an.',
    insufficientRole:
      'Keine Berechtigung für diese Seite. Bitte wenden Sie sich an die Administration.',
    sessionLoadFailed: 'Fehler beim Laden der Session. Bitte erneut anmelden.',
    requestId: 'Request-ID: {{requestId}}',
    authFlowId: 'Auth-Flow: {{authFlowId}}',
    loginAction: 'Erneut anmelden',
  },
} as const;
