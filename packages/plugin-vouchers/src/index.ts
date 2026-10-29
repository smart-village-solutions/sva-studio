export {
  pluginVouchers,
  pluginVouchersActionDefinitions,
  pluginVouchersPermissionDefinitions,
} from './plugin.js';
export { getVoucherUsage } from './vouchers.usage.js';
export type * from './vouchers.types.js';
import { VouchersListPage } from './vouchers.list.js';
import { VouchersCreatePage, VouchersEditPage } from './vouchers.editor.js';
export const pluginViewBindings = [
  { bindingKey: 'vouchersList', component: VouchersListPage },
  { bindingKey: 'vouchersDetail', component: VouchersEditPage },
  { bindingKey: 'vouchersEditor', component: VouchersCreatePage },
] as const;
