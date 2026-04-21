import { pluginNews } from '@sva/plugin-news';
import {
  createBuildTimeRegistry,
  createBrowserLogger,
  registerPluginTranslationResolver,
} from '@sva/sdk';
import { appAdminResources } from '../routing/admin-resources';

import { mergeI18nResources, resetTranslatorCache, t } from '../i18n';

const pluginLogger = createBrowserLogger({
  component: 'plugin-actions',
  level: 'warn',
});

const warnedDeprecatedPluginActionAliases = new Set<string>();

export const studioBuildTimeRegistry = createBuildTimeRegistry({
  plugins: [pluginNews],
  adminResources: appAdminResources,
});

mergeI18nResources(studioBuildTimeRegistry.translations);

export const studioPlugins = studioBuildTimeRegistry.plugins;
export const studioPluginRegistry = studioBuildTimeRegistry.pluginRegistry;
export const studioPluginActionRegistry = studioBuildTimeRegistry.pluginActionRegistry;
export const studioPluginRoutes = studioBuildTimeRegistry.routes;
export const studioPluginNavigation = studioBuildTimeRegistry.navigation;
export const studioPluginContentTypes = studioBuildTimeRegistry.contentTypes;
export const studioAdminResources = studioBuildTimeRegistry.adminResources;

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
