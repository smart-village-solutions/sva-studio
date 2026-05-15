import { createWasteManagementSettingsTranslations } from './plugin.translations.shared.js';

export const wasteManagementPluginTranslationsENSettings = createWasteManagementSettingsTranslations({
  groupTitle: 'Waste data source',
  groupDescription: 'Maintain the instance-specific connection to the waste database through the host facade.',
  technical: {
    title: 'Technical status',
    description: 'The host evaluates the active waste data source and reflects the latest server-side connection check.',
  },
  fields: {
    projectUrl: 'Project URL',
    schemaName: 'Schema',
    databaseUrl: 'Database URL',
    serviceRoleKey: 'Service role key',
    enabled: 'Enable data source',
  },
  meta: {
    visibleStatus: 'Status: {{value}}',
    databaseUrlConfigured: 'Database URL configured: {{value}}',
    serviceRoleKeyConfigured: 'Service key configured: {{value}}',
    lastCheckedAt: 'Last check: {{value}}',
    databaseUrlConfiguredLabel: 'Database URL',
    serviceRoleKeyConfiguredLabel: 'Service key',
    lastCheckedAtLabel: 'Last check',
  },
  actions: {
    save: 'Save settings',
    saving: 'Saving…',
  },
  messages: {
    loading: 'Loading settings.',
    loadError: 'Waste settings could not be loaded.',
    loadForbidden: 'Missing permission to read waste settings.',
    saveSuccess: 'Waste settings were saved and validated server-side.',
    saveError: 'Waste settings could not be saved.',
    saveForbidden: 'Missing permission to save waste settings.',
  },
});
