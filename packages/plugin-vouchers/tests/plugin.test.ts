import { describe, expect, it } from 'vitest';
import { pluginVouchers } from '../src/plugin.js';
import { pluginVouchersTranslations } from '../src/plugin.translations.js';
import { pluginViewBindings } from '../src/index.js';
const leaves = (value: unknown, prefix = ''): string[] =>
  typeof value === 'object' && value !== null
    ? Object.entries(value).flatMap(([key, child]) => leaves(child, `${prefix}.${key}`))
    : [prefix];
describe('voucher plugin registration', () => {
  it('uses host routes and history, owns its namespace and exposes no hard delete', () => {
    expect(pluginVouchers.contentTypes).toEqual([
      expect.objectContaining({
        contentType: 'vouchers.voucher',
        mainserverGenericType: 'Voucher',
      }),
    ]);
    expect(pluginVouchers.contentHistory).toEqual({ mode: 'host', coverage: 'studio_mutations' });
    expect(pluginVouchers.requiredTenantModuleIds).toEqual(['poi']);
    expect(pluginVouchers.actions?.every((item) => item.id.startsWith('vouchers.'))).toBe(true);
    expect(pluginVouchers.permissions?.map((item) => item.id)).toEqual([
      'vouchers.read',
      'vouchers.create',
      'vouchers.update',
      'vouchers.publish',
    ]);
    expect(pluginVouchers.actions?.some((item) => item.id === 'vouchers.delete')).toBe(false);
  });
  it('resolves every declared content binding', () => {
    const resource = pluginVouchers.adminResources?.[0];
    expect(resource?.contentUi?.bindings).toEqual({
      list: { bindingKey: 'vouchersList' },
      detail: { bindingKey: 'vouchersDetail' },
      editor: { bindingKey: 'vouchersEditor' },
    });
    expect(pluginViewBindings.map((item) => item.bindingKey)).toEqual([
      'vouchersList',
      'vouchersDetail',
      'vouchersEditor',
    ]);
  });
  it('provides matching German and English keys including the explicit editorial field names', () => {
    expect(leaves(pluginVouchersTranslations.de).sort()).toEqual(
      leaves(pluginVouchersTranslations.en).sort()
    );
    expect(pluginVouchersTranslations.de.vouchers.fields.title).toBe('Überschrift');
    expect(pluginVouchersTranslations.de.vouchers.fields.teaser).toBe('Einleitung (optional)');
  });
});
