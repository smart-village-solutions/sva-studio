import {
  definePluginModuleIamContract,
  definePluginPermissions,
  type PluginDefinition,
} from '@sva/plugin-sdk';

import { pluginCategoriesTranslations } from './plugin.translations.js';

const categoryPermissions = definePluginPermissions('categories', [
  { id: 'categories.read', titleKey: 'categories.permissions.read' },
  { id: 'categories.create', titleKey: 'categories.permissions.create' },
  { id: 'categories.update', titleKey: 'categories.permissions.update' },
  { id: 'categories.delete', titleKey: 'categories.permissions.delete' },
] as const);

const categoryModuleIam = definePluginModuleIamContract('categories', {
  moduleId: 'categories',
  permissionIds: ['categories.read', 'categories.create', 'categories.update', 'categories.delete'],
  systemRoles: [
    {
      roleName: 'system_admin',
      permissionIds: ['categories.read', 'categories.create', 'categories.update', 'categories.delete'],
    },
  ],
});

export const pluginCategories: PluginDefinition = {
  id: 'categories',
  displayName: 'Kategorien',
  routes: [],
  permissions: categoryPermissions,
  moduleIam: categoryModuleIam,
  translations: pluginCategoriesTranslations,
};
