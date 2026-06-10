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
    description: 'Lesen Sie die Kategorien aus dem Mainserver in einer schreibgeschützten Übersicht.',
  },
  fields: {
    actions: 'Aktionen',
    name: 'Name',
    id: 'ID',
    hierarchy: 'Hierarchie',
    position: 'Position',
    tags: 'Tags',
    createdAt: 'Erstellt am',
    updatedAt: 'Aktualisiert',
  },
  actions: {
    edit: 'Bearbeiten',
    createChild: 'Neue Unterkategorie',
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
    loadErrorIntegrationDisabled: 'Die Mainserver-Integration ist für diese Instanz derzeit nicht aktiv.',
    loadErrorConfigMissing: 'Für diese Instanz ist noch keine Mainserver-Konfiguration hinterlegt.',
    loadErrorForbidden: 'Zum Laden der Kategorien fehlt die Berechtigung categories.read.',
    actionsHint: 'Die Seite ist vorerst read-only.',
  },
  values: {
    notAvailable: '—',
    readOnlyHint: 'Aktionen werden in einem späteren Schritt freigeschaltet.',
  },
  table: {
    ariaLabel: 'Kategorien-Tabelle',
    caption: 'Flache Ansicht der Mainserver-Kategorien',
    countLabel: '{{count}} Kategorien',
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
    description: 'Read categories from Mainserver in a read-only overview.',
  },
  fields: {
    actions: 'Actions',
    name: 'Name',
    id: 'ID',
    hierarchy: 'Hierarchy',
    position: 'Position',
    tags: 'Tags',
    createdAt: 'Created at',
    updatedAt: 'Updated at',
  },
  actions: {
    edit: 'Edit',
    createChild: 'New subcategory',
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
    loadErrorIntegrationDisabled: 'The Mainserver integration is currently disabled for this instance.',
    loadErrorConfigMissing: 'No Mainserver configuration has been stored for this instance yet.',
    loadErrorForbidden: 'The categories.read permission is required to load categories.',
    actionsHint: 'This page is read-only for now.',
  },
  values: {
    notAvailable: '—',
    readOnlyHint: 'Actions will be enabled in a later step.',
  },
  table: {
    ariaLabel: 'Categories table',
    caption: 'Flat view of Mainserver categories',
    countLabel: '{{count}} categories',
  },
});

export const pluginCategoriesTranslations = {
  de: categoriesTranslationsDe,
  en: categoriesTranslationsEn,
} as const satisfies PluginTranslations;
