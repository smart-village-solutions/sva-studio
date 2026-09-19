import type { PluginTranslations } from '@sva/plugin-sdk';

const createCategoriesLocaleTranslations = <TCategories extends Readonly<Record<string, unknown>>>(
  categories: TCategories
) => ({ categories }) as const;

const categoriesTranslationsDe = createCategoriesLocaleTranslations({
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
    updatedAt: 'Aktualisiert',
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
  },
  empty: {
    title: 'Aktuell wurden keine Kategorien aus dem Mainserver geladen.',
    description: 'Sobald Kategorien vorhanden sind, erscheinen sie hier als flache Tabelle.',
  },
  messages: {
    loading: 'Kategorien werden geladen.',
    loadError: 'Kategorien konnten nicht geladen werden.',
    loadErrorMissingCredentials:
      'Für den aktuellen Kontext fehlen Mainserver-Zugangsdaten. Bitte wählen Sie eine Organisation mit gepflegten Mainserver-Credentials oder hinterlegen Sie persönliche Mainserver-Zugangsdaten.',
    loadErrorIntegrationDisabled:
      'Die Mainserver-Integration ist für diese Instanz derzeit nicht aktiv.',
    loadErrorConfigMissing: 'Für diese Instanz ist noch keine Mainserver-Konfiguration hinterlegt.',
    loadErrorForbidden: 'Zum Laden der Kategorien fehlt die Berechtigung categories.read.',
    loadErrorManagementAccess:
      'Die Mainserver-Zugangsdaten sind nicht für die Kategorienverwaltung berechtigt.',
    mutationError: 'Die Kategorie konnte nicht gespeichert werden.',
    nameTaken: 'Dieser Kategoriename ist bereits vergeben.',
    invalidParent: 'Die ausgewählte übergeordnete Kategorie ist nicht mehr gültig.',
    categoryNotFound: 'Die Kategorie ist im Mainserver nicht mehr vorhanden.',
    contractError: 'Der Mainserver lieferte eine ungültige Kategorienantwort.',
    nameRequired: 'Bitte geben Sie einen Kategorienamen an.',
    positionInvalid: 'Die Position muss eine ganze Zahl ab 0 sein.',
    emailInvalid: 'Bitte geben Sie genau eine gültige E-Mail-Adresse an.',
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
});

const categoriesTranslationsEn = createCategoriesLocaleTranslations({
  navigation: {
    title: 'Categories',
  },
  permissions: {
    read: 'Read categories',
    create: 'Create categories',
    update: 'Update categories',
    delete: 'Delete categories',
  },
  list: {
    title: 'Categories',
    description: 'Manage Mainserver categories including hierarchy, status, and data types.',
  },
  fields: {
    status: 'Status',
    actions: 'Actions',
    name: 'Name',
    id: 'ID',
    hierarchy: 'Hierarchy',
    position: 'Position',
    tags: 'Tags',
    parent: 'Parent category',
    icon: 'Icon',
    email: 'Notification email',
    dataTypes: 'Data types',
    active: 'Active',
    createdAt: 'Created at',
    updatedAt: 'Updated at',
  },
  actions: {
    edit: 'Edit',
    createChild: 'New subcategory',
    create: 'Create category',
    save: 'Save',
    saving: 'Saving',
    cancel: 'Cancel',
    delete: 'Delete',
    reload: 'Reload',
  },
  empty: {
    title: 'No categories were loaded from Mainserver yet.',
    description: 'Categories will appear here as a flat table once they are available.',
  },
  messages: {
    loading: 'Loading categories.',
    loadError: 'Categories could not be loaded.',
    loadErrorMissingCredentials:
      'Mainserver credentials are missing for the current context. Select an organization with configured Mainserver credentials or store personal Mainserver credentials.',
    loadErrorIntegrationDisabled:
      'The Mainserver integration is currently disabled for this instance.',
    loadErrorConfigMissing: 'No Mainserver configuration has been stored for this instance yet.',
    loadErrorForbidden: 'The categories.read permission is required to load categories.',
    loadErrorManagementAccess:
      'The Mainserver credentials are not authorized to manage categories.',
    mutationError: 'The category could not be saved.',
    nameTaken: 'This category name is already in use.',
    invalidParent: 'The selected parent category is no longer valid.',
    categoryNotFound: 'The category no longer exists in Mainserver.',
    contractError: 'Mainserver returned an invalid category response.',
    nameRequired: 'Enter a category name.',
    positionInvalid: 'Position must be an integer greater than or equal to 0.',
    emailInvalid: 'Enter exactly one valid email address.',
    deleteBlocked: 'The category cannot be deleted because it is in use.',
    saved: 'The category was saved.',
    savedWithDescendants: 'The category and {{count}} affected subcategories were saved.',
    savedReloadFailed: 'The category was saved, but the current state could not be reloaded.',
    deleted: 'The category was deleted.',
    deletedReloadFailed: 'The category was deleted, but the current state could not be reloaded.',
  },
  values: {
    active: 'Active',
    inactive: 'Inactive',
    notAvailable: '—',
    root: 'No parent category',
    unavailableType: '{{value}} (no longer available)',
  },
  dataTypes: {
    eventRecord: 'Events',
    newsItem: 'News',
    pointOfInterest: 'Points of interest',
    tour: 'Tours',
  },
  table: {
    ariaLabel: 'Categories table',
    caption: 'Flat view of Mainserver categories',
    countLabel: '{{count}} categories',
  },
  form: {
    createTitle: 'Create category',
    editTitle: 'Edit category',
    description: 'Required fields and assignments are validated by Mainserver.',
  },
  deleteDialog: {
    title: 'Delete category',
    description: 'Do you really want to delete “{{target}}”? Existing use may block deletion.',
    confirm: 'Delete category',
    pending: 'Deleting category',
    usage: {
      children: 'Subcategories',
      resourceAssignments: 'Content assignments',
      externalServiceAssignments: 'External service assignments',
      dataResourceSettings: 'Data resource settings',
      notificationConfigurations: 'Notification configurations',
    },
  },
  cascadeDialog: {
    title: 'Confirm status change',
    description: 'The status change may affect {{count}} subcategories. Do you want to continue?',
    confirm: 'Change status',
  },
});

export const pluginCategoriesTranslations = {
  de: categoriesTranslationsDe,
  en: categoriesTranslationsEn,
} as const satisfies PluginTranslations;
