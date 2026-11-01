export { pluginVouchersActionDefinitions, pluginVouchersPermissionDefinitions } from './plugin.js';
import { pluginVouchers as descriptor } from './plugin.js';
import { deleteVoucher } from './vouchers.api.js';
import type { PluginDefinition } from '@sva/plugin-sdk';
export const pluginVouchers: PluginDefinition = {
  ...descriptor,
  contentTypes: descriptor.contentTypes?.map((definition) => ({
    ...definition,
    mutations: {
      delete: { requiredAction: 'vouchers.delete', execute: deleteVoucher },
    },
  })),
};
export { getVoucherUsage } from './vouchers.usage.js';
export type * from './vouchers.types.js';
import { VouchersListPage } from './vouchers.list.js';
import { VouchersCreatePage, VouchersEditPage } from './vouchers.editor.js';
export const pluginViewBindings = [
  { bindingKey: 'vouchersList', component: VouchersListPage },
  { bindingKey: 'vouchersDetail', component: VouchersEditPage },
  { bindingKey: 'vouchersEditor', component: VouchersCreatePage },
] as const;
