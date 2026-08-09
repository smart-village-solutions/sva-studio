import {
  createStandardContentPluginContribution,
  createStandardContentPluginDefinition,
  type PluginDefinition,
} from '@sva/plugin-sdk';

import { PROJECTS_CONTENT_TYPE, PROJECTS_GENERIC_TYPE } from './projects.constants.js';
import { pluginProjectsTranslations } from './plugin.translations.js';

const contribution = createStandardContentPluginContribution({
  pluginId: 'projects',
  displayName: 'Projekte',
  contentType: PROJECTS_CONTENT_TYPE,
  mainserverGenericType: PROJECTS_GENERIC_TYPE,
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
