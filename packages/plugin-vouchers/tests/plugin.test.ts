import { createContentTypeRegistry } from '@sva/plugin-sdk';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { pluginVouchers } from '../src/plugin.js';
import { pluginVouchersTranslations } from '../src/plugin.translations.js';
import { pluginViewBindings, pluginVouchers as browserPlugin } from '../src/index.js';
const leaves = (value: unknown, prefix = ''): string[] =>
  typeof value === 'object' && value !== null
    ? Object.entries(value).flatMap(([key, child]) => leaves(child, `${prefix}.${key}`))
    : [prefix];
describe('voucher plugin registration', () => {
  afterEach(() => vi.unstubAllGlobals());

  it.each([['draft', false], ['published', true]] as const)(
    'sets the list status to %s through the voucher visibility endpoint',
    async (status, visible) => {
      const registry = createContentTypeRegistry(browserPlugin.contentTypes ?? []);
      const mutation = registry.get('vouchers.voucher')?.mutations?.status;
      expect(mutation).toMatchObject({
        requiredAction: 'vouchers.publish',
        supportedStatuses: ['draft', 'published'],
      });
      const fetchMock = vi.fn(async (_url: string, _init: RequestInit) =>
        Response.json({ data: { id: '2', visible } })
      );
      vi.stubGlobal('fetch', fetchMock);

      await mutation?.execute('2', status, 'organization');

      expect(fetchMock).toHaveBeenCalledExactlyOnceWith(
        '/api/v1/mainserver/vouchers/2/visibility',
        expect.objectContaining({ method: 'POST', body: JSON.stringify({ visible }) })
      );
      expect(new Headers(fetchMock.mock.calls[0]?.[1].headers).get('X-SVA-Acting-Principal-Type'))
        .toBe('organization');
    }
  );

  it('uses host routes and history and grants namespaced deletion to system admins', () => {
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
      'vouchers.delete',
      'vouchers.publish',
    ]);
    expect(pluginVouchers.actions?.some((item) => item.id === 'vouchers.delete')).toBe(true);
    expect(pluginVouchers.moduleIam?.systemRoles).toEqual([
      expect.objectContaining({
        roleName: 'system_admin',
        permissionIds: expect.arrayContaining(['vouchers.delete']),
      }),
    ]);
    expect(browserPlugin.contentTypes?.[0]?.mutations?.delete).toEqual({
      requiredAction: 'vouchers.delete',
      execute: expect.any(Function),
    });
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
