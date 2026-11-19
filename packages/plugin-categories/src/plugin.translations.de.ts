export const categoriesTranslationsDe = {
  navigation: {
    title: 'Kategorien',
  },
  permissions: {
    read: 'Kategorien lesen',
    create: 'Kategorien anlegen',
    update: 'Kategorien bearbeiten',
    delete: 'Kategorien löschen',
  },
  list: {
    title: 'Kategorien',
    description:
      'Verwalten Sie Kategorien aus dem Mainserver inklusive Hierarchie, Status und Datentypen.',
  },
  fields: {
    status: 'Status',
    actions: 'Aktionen',
    name: 'Name',
    id: 'ID',
    hierarchy: 'Hierarchie',
    position: 'Position',
    tags: 'Tags',
    parent: 'Übergeordnete Kategorie',
    icon: 'Icon',
    email: 'Benachrichtigungs-E-Mail',
    dataTypes: 'Datentypen',
    active: 'Aktiv',
    createdAt: 'Erstellt am',
    updatedAt: 'Aktualisiert am',
  },
  actions: {
    edit: 'Bearbeiten',
    createChild: 'Neue Unterkategorie',
    create: 'Kategorie anlegen',
    save: 'Speichern',
    saving: 'Wird gespeichert',
    cancel: 'Abbrechen',
    delete: 'Löschen',
    reload: 'Erneut laden',
    close: 'Schließen',
  },
  empty: {
    title: 'Aktuell wurden keine Kategorien aus dem Mainserver geladen.',
    description: 'Sobald Kategorien vorhanden sind, erscheinen sie hier als flache Tabelle.',
  },
  messages: {
    loading: 'Kategorien werden geladen.',
    loadError: 'Kategorien konnten nicht geladen werden.',
    mutationActionsLoading: 'Verfügbare Schreibaktionen werden geprüft.',
    mutationActionsLoadError: 'Schreibaktionen konnten nicht geprüft werden und bleiben gesperrt.',
    loadErrorMissingCredentials:
      'Für den aktuellen Kontext fehlen Mainserver-Zugangsdaten. Bitte wählen Sie eine Organisation mit gepflegten Mainserver-Credentials oder hinterlegen Sie persönliche Mainserver-Zugangsdaten.',
    loadErrorIntegrationDisabled:
      'Die Mainserver-Integration ist für diese Instanz derzeit nicht aktiv.',
    loadErrorConfigMissing: 'Für diese Instanz ist noch keine Mainserver-Konfiguration hinterlegt.',
    loadErrorForbidden: 'Zum Laden der Kategorien fehlt die Berechtigung categories.read.',
    createForbidden: 'Zum Anlegen einer Kategorie fehlt die Berechtigung categories.create.',
    updateForbidden: 'Zum Bearbeiten einer Kategorie fehlt die Berechtigung categories.update.',
    deleteForbidden: 'Zum Löschen einer Kategorie fehlt die Berechtigung categories.delete.',
    loadErrorManagementAccess:
      'Die Mainserver-Zugangsdaten sind nicht für die Kategorienverwaltung berechtigt.',
    mutationError: 'Die Kategorie konnte nicht gespeichert werden.',
    nameTaken: 'Dieser Kategoriename ist bereits vergeben.',
    invalidParent: 'Die ausgewählte übergeordnete Kategorie ist nicht mehr gültig.',
    categoryNotFound: 'Die Kategorie ist im Mainserver nicht mehr vorhanden.',
    contractError: 'Der Mainserver lieferte eine ungültige Kategorienantwort.',
    nameRequired: 'Bitte geben Sie einen Kategorienamen an.',
    positionInvalid: 'Die Position muss eine ganze Zahl zwischen 0 und 2147483647 sein.',
    iconInvalid: 'Das Icon muss ein gültiger Name oder eine HTTP(S)-URL bis 255 Zeichen sein.',
    dataTypeInvalid: 'Mindestens ein Datentyp-Identifier ist ungültig.',
    emailInvalid: 'Bitte geben Sie genau eine gültige E-Mail-Adresse an.',
    deleteError: 'Die Kategorie konnte nicht gelöscht werden.',
    deleteBlocked: 'Die Kategorie kann wegen bestehender Verwendungen nicht gelöscht werden.',
    saved: 'Die Kategorie wurde gespeichert.',
    savedWithDescendants:
      'Die Kategorie und {{count}} betroffene Unterkategorien wurden gespeichert.',
    savedReloadFailed:
      'Die Kategorie wurde gespeichert, der aktuelle Stand konnte aber nicht neu geladen werden.',
    deleted: 'Die Kategorie wurde gelöscht.',
    deletedReloadFailed:
      'Die Kategorie wurde gelöscht, der aktuelle Stand konnte aber nicht neu geladen werden.',
  },
  values: {
    active: 'Aktiv',
    inactive: 'Inaktiv',
    notAvailable: '—',
    root: 'Keine übergeordnete Kategorie',
    unavailableType: '{{value}} (nicht mehr verfügbar)',
  },
  dataTypes: {
    eventRecord: 'Veranstaltungen',
    newsItem: 'Neuigkeiten',
    pointOfInterest: 'Orte',
    tour: 'Touren',
  },
  table: {
    ariaLabel: 'Kategorien-Tabelle',
    caption: 'Flache Ansicht der Mainserver-Kategorien',
    countLabel: '{{count}} Kategorien',
  },
  form: {
    createTitle: 'Kategorie anlegen',
    editTitle: 'Kategorie bearbeiten',
    description: 'Pflichtfelder und Zuordnungen werden im Mainserver geprüft.',
  },
  detailsDialog: {
    trigger: '{{name}} – Details anzeigen',
    title: 'Details zu „{{name}}“',
    description:
      'Diese Angaben stammen aus dem Mainserver und können hier nicht bearbeitet werden.',
  },
  deleteDialog: {
    title: 'Kategorie löschen',
    description:
      'Möchten Sie „{{target}}“ wirklich löschen? Bestehende Verwendungen können das Löschen blockieren.',
    confirm: 'Kategorie löschen',
    pending: 'Kategorie wird gelöscht',
    usage: {
      children: 'Unterkategorien',
      resourceAssignments: 'Inhaltszuordnungen',
      externalServiceAssignments: 'External-Service-Zuordnungen',
      dataResourceSettings: 'Data-Resource-Einstellungen',
      notificationConfigurations: 'Benachrichtigungskonfigurationen',
    },
  },
  cascadeDialog: {
    title: 'Statusänderung bestätigen',
    description:
      'Die Statusänderung kann {{count}} Unterkategorien betreffen. Möchten Sie fortfahren?',
    confirm: 'Status ändern',
  },
} as const;
