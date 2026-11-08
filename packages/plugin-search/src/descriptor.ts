import {
  definePluginActions,
  definePluginPermissions,
  definePluginModuleIamContract,
  type PluginDescriptor,
} from '@sva/plugin-sdk';
import { parseSearchQuery } from './search-contract.js';
import { searchTranslations } from './plugin.translations.js';
export const searchAccessRequirement = {
  kind: 'tenant',
  moduleId: 'search',
  actions: { mode: 'allOf', values: ['search.read'] },
} as const;
export const pluginSearch: PluginDescriptor = {
  id: 'search',
  displayName: 'Suche',
  routes: [
    {
      id: 'search.results',
      path: '/plugins/search',
      actionId: 'search.read',
      accessRequirement: searchAccessRequirement,
      documentation: { kind: 'page', id: 'search.results', pageType: 'overview' },
      validateSearch: parseSearchQuery,
    },
  ],
  navigation: [],
  permissions: definePluginPermissions('search', [
    { id: 'search.read', titleKey: 'search.readTitle', descriptionKey: 'search.readDescription' },
  ]),
  actions: definePluginActions('search', [
    { id: 'search.read', titleKey: 'search.readTitle', accessRequirement: searchAccessRequirement },
  ]),
  moduleIam: definePluginModuleIamContract('search', {
    moduleId: 'search',
    permissionIds: ['search.read'],
    systemRoles: [{ roleName: 'system_admin', permissionIds: ['search.read'] }],
  }),
  serverHandlers: [
    {
      id: 'search.query',
      path: '/api/v1/plugins/search/query',
      method: 'GET',
      actionId: 'search.read',
      accessRequirement: searchAccessRequirement,
    },
  ],
  contentHistory: { mode: 'none', reasonCode: 'infrastructure_only' },
  translations: searchTranslations,
};
