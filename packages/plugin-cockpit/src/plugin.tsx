import { definePluginModuleIamContract, type PluginDefinition } from '@sva/plugin-sdk';

export const pluginCockpit: PluginDefinition = {
  id: 'cockpit',
  displayName: 'Cockpit',
  moduleIam: definePluginModuleIamContract('cockpit', {
    moduleId: 'cockpit',
    permissionIds: [],
    systemRoles: [],
  }),
  routes: [],
  navigation: [
    {
      id: 'cockpit.navigation',
      href: 'https://cockpit.guben.de',
      titleKey: 'shell.sidebar.cockpit',
      section: 'applications',
    },
  ],
  translations: {
    de: {
      plugins: { cockpit: { description: 'Öffnet das externe Cockpit aus der Seitenleiste.' } },
    },
    en: { plugins: { cockpit: { description: 'Opens the external Cockpit from the sidebar.' } } },
  },
};
