import { usePluginTranslation, type PluginDefinition } from '@sva/sdk';

const PluginExamplePage = () => {
  const pt = usePluginTranslation('example');

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-2xl font-semibold">{pt('page.title')}</h2>
      <p>{pt('page.description')}</p>
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
        page: {
          title: 'Plugin-Beispiel',
          description: 'Diese Route kommt aus @sva/plugin-example.',
        },
      },
    },
    en: {
      example: {
        navigation: {
          title: 'Plugin Example',
        },
        page: {
          title: 'Plugin Example',
          description: 'This route is provided by @sva/plugin-example.',
        },
      },
    },
  },
};
