import {
  createStandardContentPluginActionIds,
  createStandardContentPluginDefinition,
  createStandardContentPluginContribution,
  definePluginActions,
  definePluginModuleIamContract,
  definePluginPermissions,
  type PluginDefinition,
} from '@sva/plugin-sdk';

import { NEWS_CONTENT_TYPE } from './news.constants.js';
import { pluginNewsTranslations } from './plugin.translations.js';
export { NEWS_CONTENT_TYPE } from './news.constants.js';

const standardNewsActionIds = createStandardContentPluginActionIds('news');
export const pluginNewsPushNotificationActionId = 'news.pushNotification';

const standardNewsContribution = createStandardContentPluginContribution({
  pluginId: 'news',
  displayName: 'News',
  contentType: NEWS_CONTENT_TYPE,
  titleKey: 'news.navigation.title',
  listBindingKey: 'newsList',
  detailBindingKey: 'newsDetail',
  editorBindingKey: 'newsEditor',
  actionOptions: {
    legacyAliases: {
      create: ['create'],
      edit: ['edit'],
      update: ['save', 'update'],
      delete: ['delete'],
    },
  },
});

export const pluginNewsPermissionDefinitions = definePluginPermissions('news', [
  ...standardNewsContribution.permissions,
  {
    id: pluginNewsPushNotificationActionId,
    titleKey: 'news.permissions.pushNotification',
  },
] as const);

export const pluginNewsActionDefinitions = definePluginActions('news', [
  ...standardNewsContribution.actions,
  {
    id: pluginNewsPushNotificationActionId,
    titleKey: 'news.actions.pushNotification',
    requiredAction: pluginNewsPushNotificationActionId,
    accessRequirement: {
      kind: 'tenant',
      moduleId: 'news',
      actions: { mode: 'allOf', values: [pluginNewsPushNotificationActionId] },
    },
  },
] as const);

const pluginNewsModuleIam = definePluginModuleIamContract('news', {
  moduleId: 'news',
  permissionIds: pluginNewsPermissionDefinitions.map((permission) => permission.id),
  systemRoles: [
    {
      roleName: 'system_admin',
      permissionIds: pluginNewsPermissionDefinitions.map((permission) => permission.id),
    },
  ],
});

export const pluginNewsActionIds = {
  ...standardNewsActionIds,
  pushNotification: pluginNewsPushNotificationActionId,
} as const;

export const getPluginNewsActionDefinition = (
  actionId: (typeof pluginNewsActionIds)[keyof typeof pluginNewsActionIds]
) => pluginNewsActionDefinitions.find((action) => action.id === actionId);

export const pluginNews: PluginDefinition = createStandardContentPluginDefinition({
  pluginId: 'news',
  displayName: 'News',
  contribution: {
    ...standardNewsContribution,
    actions: pluginNewsActionDefinitions,
    permissions: pluginNewsPermissionDefinitions,
    moduleIam: pluginNewsModuleIam,
  },
  translations: pluginNewsTranslations,
});
