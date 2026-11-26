import {
  createStandardContentPluginContribution,
  createStandardContentPluginDefinition,
  definePluginActions,
  definePluginModuleIamContract,
  type PluginDescriptor,
} from '@sva/plugin-sdk';

import { toursTranslations } from './plugin.translations.js';

export const toursPath = '/admin/tours';
export const toursCreatePath = '/admin/tours/new';
export const tourDetailPath = '/admin/tours/$id';
const pluginId = 'tours';
const permissionIds = ['tours.read', 'tours.create'] as const;
const standard = createStandardContentPluginContribution({
  pluginId,
  displayName: 'Touren',
  contentType: 'tours.tour',
  titleKey: 'tours.title',
  listBindingKey: 'toursList',
  detailBindingKey: 'toursDetail',
  editorBindingKey: 'toursEditor',
});

export const pluginTours: PluginDescriptor = createStandardContentPluginDefinition({
  pluginId,
  displayName: 'Touren',
  translations: toursTranslations,
  contribution: {
    ...standard,
    permissions: standard.permissions.filter(
      ({ id }) => id === 'tours.read' || id === 'tours.create'
    ),
    actions: [
      ...standard.actions.filter(({ id }) => id === 'tours.create'),
      ...definePluginActions(pluginId, [
        {
          id: 'tours.read',
          titleKey: 'tours.read',
          accessRequirement: {
            kind: 'tenant',
            moduleId: pluginId,
            actions: { mode: 'allOf', values: ['tours.read'] },
          },
        },
      ]),
    ],
    moduleIam: definePluginModuleIamContract(pluginId, {
      moduleId: pluginId,
      permissionIds,
      systemRoles: [{ roleName: 'system_admin', permissionIds }],
    }),
    adminResources: standard.adminResources.map((resource) => ({
      ...resource,
      capabilities: { list: { ...resource.capabilities?.list, dedicatedRoute: true } },
    })),
  },
});
