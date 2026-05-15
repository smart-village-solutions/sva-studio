import { createWasteManagementSettingsTranslations } from './plugin.translations.shared.js';

export const wasteManagementPluginTranslationsDESettings = createWasteManagementSettingsTranslations({
  groupTitle: 'Waste-Datenquelle',
  groupDescription: 'Pflegen Sie die instanzbezogene Verbindung zur fachlichen Waste-Datenbank über die Host-Fassade.',
  technical: {
    title: 'Technischer Status',
    description: 'Der Host bewertet die aktive Waste-Datenquelle und spiegelt den letzten serverseitigen Verbindungscheck wider.',
  },
  fields: {
    projectUrl: 'Projekt-URL',
    schemaName: 'Schema',
    databaseUrl: 'Datenbank-URL',
    serviceRoleKey: 'Service-Role-Key',
    enabled: 'Datenquelle aktivieren',
  },
  meta: {
    visibleStatus: 'Status: {{value}}',
    databaseUrlConfigured: 'Datenbank-URL hinterlegt: {{value}}',
    serviceRoleKeyConfigured: 'Service-Key hinterlegt: {{value}}',
    lastCheckedAt: 'Letzter Check: {{value}}',
    databaseUrlConfiguredLabel: 'Datenbank-URL',
    serviceRoleKeyConfiguredLabel: 'Service-Key',
    lastCheckedAtLabel: 'Letzter Check',
  },
  actions: {
    save: 'Einstellungen speichern',
    saving: 'Speichert…',
  },
  messages: {
    loading: 'Einstellungen werden geladen.',
    loadError: 'Die Waste-Einstellungen konnten nicht geladen werden.',
    loadForbidden: 'Für die Waste-Einstellungen fehlt die Berechtigung.',
    saveSuccess: 'Die Waste-Einstellungen wurden gespeichert und serverseitig geprüft.',
    saveError: 'Die Waste-Einstellungen konnten nicht gespeichert werden.',
    saveForbidden: 'Für das Speichern der Waste-Einstellungen fehlt die Berechtigung.',
  },
});
