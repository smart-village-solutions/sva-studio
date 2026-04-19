import { pluginExample } from '@sva/plugin-example';
import { pluginNews } from '@sva/plugin-news';
import {
  createBrowserLogger,
  createPluginActionRegistry,
  createPluginRegistry,
  mergePluginContentTypes,
  mergePluginNavigationItems,
  mergePluginRouteDefinitions,
  mergePluginTranslations,
  registerPluginTranslationResolver,
} from '@sva/sdk';

import { mergeI18nResources, resetTranslatorCache, t } from '../i18n';

const pluginLogger = createBrowserLogger({
  component: 'plugin-actions',
  level: 'warn',
});

const warnedDeprecatedPluginActionAliases = new Set<string>();

export const studioPlugins = [pluginExample, pluginNews] as const;

mergeI18nResources(mergePluginTranslations(studioPlugins));

export const studioPluginRegistry = createPluginRegistry(studioPlugins);
export const studioPluginActionRegistry = createPluginActionRegistry(studioPlugins);
export const studioPluginRoutes = mergePluginRouteDefinitions(studioPlugins);
export const studioPluginNavigation = mergePluginNavigationItems(studioPlugins);
export const studioPluginContentTypes = mergePluginContentTypes(studioPlugins);

export const getStudioPluginAction = (actionId: string) => {
  const action = studioPluginActionRegistry.get(actionId);
  if (action?.deprecatedAlias && warnedDeprecatedPluginActionAliases.has(action.deprecatedAlias) === false) {
    warnedDeprecatedPluginActionAliases.add(action.deprecatedAlias);
    pluginLogger.warn('plugin_action_alias_deprecated', {
      requested_action_id: action.deprecatedAlias,
      canonical_action_id: action.actionId,
      owner_plugin_id: action.ownerPluginId,
    });
  }

  return action;
};

export const initializePluginTranslations = () => {
  registerPluginTranslationResolver((key, variables) => t(key, variables));
  resetTranslatorCache();
};

initializePluginTranslations();
