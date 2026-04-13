import { pluginExample } from '@sva/plugin-example';
import { pluginNews } from '@sva/plugin-news';
import {
  createPluginRegistry,
  mergePluginContentTypes,
  mergePluginNavigationItems,
  mergePluginRouteDefinitions,
  mergePluginTranslations,
  registerPluginTranslationResolver,
} from '@sva/sdk';

import { mergeI18nResources, resetTranslatorCache, t } from '../i18n';

export const studioPlugins = [pluginExample, pluginNews] as const;

mergeI18nResources(mergePluginTranslations(studioPlugins));

export const studioPluginRegistry = createPluginRegistry(studioPlugins);
export const studioPluginRoutes = mergePluginRouteDefinitions(studioPlugins);
export const studioPluginNavigation = mergePluginNavigationItems(studioPlugins);
export const studioPluginContentTypes = mergePluginContentTypes(studioPlugins);

export const initializePluginTranslations = () => {
  registerPluginTranslationResolver((key, variables) => t(key, variables));
  resetTranslatorCache();
};

initializePluginTranslations();
