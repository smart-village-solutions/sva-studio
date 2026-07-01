import {
  createStandardContentPluginActionIds,
  createStandardContentPluginContribution,
  definePluginActions,
  definePluginModuleIamContract,
  definePluginPermissions,
  type PluginDefinition,
} from '@sva/plugin-sdk';

import { SURVEYS_CONTENT_TYPE } from './surveys.constants.js';
import { pluginSurveysTranslations } from './plugin.translations.js';

const standardSurveysContribution = createStandardContentPluginContribution({
  pluginId: 'surveys',
  displayName: 'Umfragen',
  contentType: SURVEYS_CONTENT_TYPE,
  titleKey: 'surveys.navigation.title',
  listBindingKey: 'surveysList',
  detailBindingKey: 'surveysDetail',
  editorBindingKey: 'surveysEditor',
});

const standardSurveyActionIds = createStandardContentPluginActionIds('surveys');

export const pluginSurveysModerationActionId = 'surveys.moderate';
export const pluginSurveysExportActionId = 'surveys.export';

export const pluginSurveysPermissionDefinitions = definePluginPermissions('surveys', [
  ...standardSurveysContribution.permissions,
  { id: 'surveys.moderate', titleKey: 'surveys.permissions.moderate' },
  { id: 'surveys.export', titleKey: 'surveys.permissions.export' },
] as const);

export const pluginSurveysActionDefinitions = definePluginActions('surveys', [
  ...standardSurveysContribution.actions,
  {
    id: pluginSurveysModerationActionId,
    titleKey: 'surveys.actions.moderate',
    requiredAction: 'surveys.moderate',
  },
  {
    id: pluginSurveysExportActionId,
    titleKey: 'surveys.actions.export',
    requiredAction: 'surveys.export',
  },
] as const);

export const pluginSurveysModuleIam = definePluginModuleIamContract('surveys', {
  moduleId: 'surveys',
  permissionIds: pluginSurveysPermissionDefinitions.map((permission) => permission.id),
  systemRoles: [
    {
      roleName: 'system_admin',
      permissionIds: pluginSurveysPermissionDefinitions.map((permission) => permission.id),
    },
  ],
});

export const pluginSurveys: PluginDefinition = {
  id: 'surveys',
  displayName: 'Umfragen',
  routes: [],
  navigation: standardSurveysContribution.navigation,
  actions: pluginSurveysActionDefinitions,
  permissions: pluginSurveysPermissionDefinitions,
  moduleIam: pluginSurveysModuleIam,
  contentTypes: standardSurveysContribution.contentTypes,
  adminResources: standardSurveysContribution.adminResources,
  auditEvents: [],
  translations: pluginSurveysTranslations,
};

export const pluginSurveysActionIds = {
  ...standardSurveyActionIds,
  moderate: pluginSurveysModerationActionId,
  export: pluginSurveysExportActionId,
} as const;
