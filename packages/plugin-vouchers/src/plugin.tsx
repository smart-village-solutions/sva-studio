import {
  createStandardContentPluginContribution,
  createStandardContentPluginDefinition,
  definePluginActions,
  definePluginPermissions,
  definePluginModuleIamContract,
} from '@sva/plugin-sdk';
import { pluginVouchersTranslations } from './plugin.translations.js';
const base = createStandardContentPluginContribution({
  pluginId: 'vouchers',
  displayName: 'Gutscheine',
  contentType: 'vouchers.voucher',
  mainserverGenericType: 'Voucher',
  titleKey: 'vouchers.navigation.title',
  listBindingKey: 'vouchersList',
  detailBindingKey: 'vouchersDetail',
  editorBindingKey: 'vouchersEditor',
});
const permissions = definePluginPermissions('vouchers', [
  ...base.permissions.filter((item) => item.id !== 'vouchers.delete'),
  { id: 'vouchers.publish', titleKey: 'vouchers.permissions.publish' },
]);
const actions = definePluginActions('vouchers', [
  ...base.actions.filter((item) => item.id !== 'vouchers.delete'),
  {
    id: 'vouchers.publish',
    titleKey: 'vouchers.actions.publish',
    requiredAction: 'vouchers.publish',
    accessRequirement: {
      kind: 'tenant',
      moduleId: 'vouchers',
      actions: { mode: 'allOf', values: ['vouchers.publish'] },
    },
  },
]);
const permissionIds = permissions.map((item) => item.id);
export const pluginVouchers = createStandardContentPluginDefinition({
  pluginId: 'vouchers',
  displayName: 'Gutscheine',
  requiredTenantModuleIds: ['poi'],
  contribution: {
    ...base,
    actions,
    permissions,
    moduleIam: definePluginModuleIamContract('vouchers', {
      moduleId: 'vouchers',
      permissionIds,
      systemRoles: [{ roleName: 'system_admin', permissionIds }],
    }),
  },
  translations: pluginVouchersTranslations,
});
export const pluginVouchersActionDefinitions = actions;
export const pluginVouchersPermissionDefinitions = permissions;
