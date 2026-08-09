import {
  createStandardContentPluginContribution,
  createStandardContentPluginDefinition,
  type PluginDefinition,
} from '@sva/plugin-sdk';

import { projectsMainserverGenericItemOwnership } from './generic-item-ownership.js';
import { pluginProjectsTranslations } from './plugin.translations.js';

const contribution = createStandardContentPluginContribution({
  pluginId: 'projects',
  displayName: 'Projekte',
  contentType: projectsMainserverGenericItemOwnership.contentType,
  mainserverGenericType: projectsMainserverGenericItemOwnership.mainserverGenericType,
  titleKey: 'projects.navigation.title',
  listBindingKey: 'projectsList',
  detailBindingKey: 'projectsDetail',
  editorBindingKey: 'projectsEditor',
  basePath: 'projects',
});

const standardDefinition = createStandardContentPluginDefinition({
  pluginId: 'projects',
  displayName: 'Projekte',
  contribution,
  translations: pluginProjectsTranslations,
});

export const pluginProjects: PluginDefinition = {
  ...standardDefinition,
  navigation: [],
};

export const pluginProjectsPermissionDefinitions = contribution.permissions;
export const pluginProjectsActionDefinitions = contribution.actions;
