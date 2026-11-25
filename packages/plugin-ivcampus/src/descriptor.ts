import {
  definePluginActions,
  definePluginModuleIamContract,
  definePluginPermissions,
  type PluginDescriptor,
} from '@sva/plugin-sdk';

import { ivCampusTranslations } from './translations.js';

const access = {
  kind: 'tenant',
  moduleId: 'ivcampus',
  actions: { mode: 'allOf', values: ['ivcampus.readSettings'] },
} as const;

export const pluginIvCampus: PluginDescriptor = {
  id: 'ivcampus',
  displayName: 'ivCampus',
  navigation: [],
  permissions: definePluginPermissions('ivcampus', [
    { id: 'ivcampus.readSettings', titleKey: 'ivcampus.readSettings' },
  ]),
  actions: definePluginActions('ivcampus', [
    { id: 'ivcampus.readSettings', titleKey: 'ivcampus.readSettings', accessRequirement: access },
  ]),
  moduleIam: definePluginModuleIamContract('ivcampus', {
    moduleId: 'ivcampus',
    permissionIds: ['ivcampus.readSettings'],
    systemRoles: [{ roleName: 'system_admin', permissionIds: ['ivcampus.readSettings'] }],
  }),
  routes: [
    {
      id: 'ivcampus.settings',
      path: '/plugins/ivcampus/settings',
      documentation: { kind: 'page', id: 'ivcampus.settings', pageType: 'detail' },
      actionId: 'ivcampus.readSettings',
      accessRequirement: access,
    },
  ],
  settings: { routeId: 'ivcampus.settings' },
  contentHistory: { mode: 'none', reasonCode: 'infrastructure_only' },
  translations: ivCampusTranslations,
};
