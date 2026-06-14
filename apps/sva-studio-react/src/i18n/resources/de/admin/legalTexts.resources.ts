export const legalTextsAdminDEResources = {
  page: {
    title: 'Rechtstext-Verwaltung',
    subtitle:
      'Rechtstexte mit UUID, Namen, Versionen, Sprachvarianten, Status und HTML-Inhalten zentral verwalten.',
  },
  metrics: {
    total: 'Versionen gesamt',
    valid: 'Gültige Versionen',
    locales: 'Sprachvarianten',
    acceptances: 'Aktive Akzeptanzen',
  },
  filters: {
    searchLabel: 'Suche',
    searchPlaceholder: 'Nach UUID, Name, Version, Sprache oder Inhalt suchen',
    statusLabel: 'Status',
    statusAll: 'Alle',
    statusDraft: 'Nur Entwürfe',
    statusValid: 'Nur gültige',
    statusArchived: 'Nur archivierte',
  },
  actions: {
    create: 'Rechtstext anlegen',
    edit: 'Bearbeiten',
    delete: 'Löschen',
    save: 'Änderungen speichern',
    retry: 'Erneut versuchen',
  },
  status: {
    draft: 'Entwurf',
    valid: 'Gültig',
    archived: 'Archiv',
  },
  table: {
    caption: 'Tabelle der verwalteten Rechtstext-Versionen',
    ariaLabel: 'Rechtstext-Versionen',
    headerUuid: 'UUID',
    headerName: 'Name',
    headerVersion: 'Version',
    headerLocale: 'Sprache',
    headerStatus: 'Status',
    headerTargets: 'Zielgruppen',
    headerContent: 'Inhalt',
    headerPublished: 'Veröffentlicht',
    headerCreated: 'Erstellt',
    headerUpdated: 'Geändert',
    headerAcceptances: 'Akzeptanzen',
    headerLastAccepted: 'Zuletzt akzeptiert',
    headerActions: 'Aktionen',
    acceptanceSummary: '{{active}} aktiv / {{total}} gesamt',
    targetSummary: '{{roles}} Rollen / {{groups}} Gruppen',
    targetsAll: 'Alle Accounts',
    publishedUnset: 'Nicht gesetzt',
  },
  dialogs: {
    createTitle: 'Neuen Rechtstext anlegen',
    createDescription:
      'Legt einen neuen Rechtstext mit Name, Version, Sprache, Status und HTML-Inhalt an.',
    editTitle: 'Rechtstext-Version bearbeiten',
    editDescription: 'Aktualisiert Inhalt und Metadaten für {{id}} {{version}} ({{locale}}).',
    editDescriptionFallback: 'Aktualisiert die gewählte Rechtstext-Version.',
  },
  detail: {
    backToList: 'Zur Rechtstextliste',
    notFound: 'Die angeforderte Rechtstext-Version wurde nicht gefunden.',
  },
  confirm: {
    deleteTitle: 'Rechtstext-Version löschen?',
    deleteDescription:
      'Diese Rechtstext-Version wird dauerhaft entfernt. Bereits dokumentierte Akzeptanzen bleiben unverändert bestehen.',
  },
  fields: {
    name: 'Name',
    legalTextVersion: 'Version',
    locale: 'Sprache',
    status: 'Status',
    publishedAt: 'Veröffentlicht am',
    targetRoleIds: 'Zielrollen-IDs',
    targetRoleIdsPlaceholder:
      'z. B. 11111111-1111-1111-1111-111111111111, 22222222-2222-2222-2222-222222222222',
    targetGroupIds: 'Zielgruppen-IDs',
    targetGroupIdsPlaceholder:
      'z. B. aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa, bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    contentHtml: 'Inhalt',
    contentPlaceholder: 'HTML-Inhalt des Rechtstexts bearbeiten',
  },
  editor: {
    bold: 'Fett',
    italic: 'Kursiv',
    underline: 'Unterstreichen',
    paragraph: 'Absatz',
    heading: 'Zwischenüberschrift',
    bulletList: 'Liste',
    clearFormatting: 'Format entfernen',
  },
  meta: {
    uuid: 'UUID: {{value}}',
    createdAt: 'Erstellt: {{value}}',
    updatedAt: 'Geändert: {{value}}',
  },
  empty: {
    title: 'Noch keine Rechtstext-Versionen vorhanden',
    body: 'Legen Sie den ersten Rechtstext an, um Inhalte, Status und Akzeptanzen sichtbar zu machen.',
  },
  messages: {
    error: 'Rechtstexte konnten nicht geladen werden.',
  },
  errors: {
    forbidden: 'Unzureichende Berechtigungen für diese Rechtstext-Aktion.',
    csrfValidationFailed:
      'Sicherheitsprüfung fehlgeschlagen. Bitte Seite neu laden und erneut versuchen.',
    rateLimited: 'Zu viele Anfragen in kurzer Zeit. Bitte kurz warten und erneut versuchen.',
    conflict: 'Diese Rechtstext-Version existiert bereits.',
    notFound: 'Die angeforderte Rechtstext-Version wurde nicht gefunden.',
    databaseUnavailable:
      'Die IAM-Datenbank ist derzeit nicht erreichbar. Bitte später erneut versuchen.',
    invalidRequest: 'Der Rechtstext enthält ungültige oder unvollständige Daten.',
  },
  validation: {
    publishedAtRequired: 'Für gültige Rechtstexte ist ein Veröffentlichungsdatum erforderlich.',
    publishedAtInvalid:
      'Bitte geben Sie ein gültiges Veröffentlichungsdatum in der Fachzeitzone Europe/Berlin ein.',
  },
} as const;
