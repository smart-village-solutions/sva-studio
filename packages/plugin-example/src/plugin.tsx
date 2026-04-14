import type { PluginDefinition } from '@sva/sdk';

const PluginExamplePage = () => {
  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-2xl font-semibold">Plugin Example</h2>
      <p>Diese Route kommt aus @sva/plugin-example.</p>
    </div>
  );
};

export const pluginExample: PluginDefinition = {
  id: 'example',
  displayName: 'Plugin Example',
  routes: [
    {
      id: 'example.list',
      path: '/plugins/example',
      component: PluginExamplePage,
    },
  ],
  navigation: [
    {
      id: 'example.navigation',
      to: '/plugins/example',
      titleKey: 'example.navigation.title',
      section: 'system',
      requiredAction: 'content.read',
    },
  ],
  translations: {
    de: {
      example: {
        navigation: {
          title: 'Plugin-Beispiel',
        },
      },
    },
    en: {
      example: {
        navigation: {
          title: 'Plugin Example',
        },
      },
    },
  },
};
