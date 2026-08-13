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
  },
  session: {
    loading: 'Sitzung wird geladen ...',
  },
  cards: {
    news: {
      title: 'Nachricht erstellen',
      description:
        'Verfassen Sie eine neue Nachricht und bereiten Sie diese für die Veröffentlichung vor.',
    },
    events: {
      title: 'Veranstaltung anlegen',
      description: 'Erfassen Sie eine neue Veranstaltung mit Termin, Ort und weiteren Angaben.',
    },
    media: {
      title: 'Medium hochladen',
      description: 'Laden Sie ein neues Bild oder Dokument in die zentrale Mediathek hoch.',
    },
    users: {
      title: 'Benutzerverwaltung öffnen',
      description: 'Verwalten Sie Benutzerkonten und deren Zugriff auf das Studio.',
    },
  },
  changelog: {
    title: 'Letzte Änderungen',
    description:
      'Hier sehen Sie die zuletzt in das Studio übernommenen Verbesserungen und Korrekturen direkt nach dem Merge nach main.',
    loading: 'Letzte Änderungen werden geladen ...',
    empty: 'Noch keine Änderungen verfügbar.',
    error: 'Die letzten Änderungen konnten gerade nicht geladen werden.',
    entryTitle: 'Änderung aus PR #{{prNumber}}',
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
