import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  commitVoucher,
  reconcileVoucher,
  prepareVoucher,
  getVoucher,
  listVouchers,
  listVoucherCategories,
  listVoucherLocations,
  changeVoucherVisibility,
  deleteVoucher,
  type VoucherPreparation,
} from '../src/vouchers.api.js';
import { emptyVoucherDraft, parseVoucherDraft } from '../src/vouchers.form-model.js';
const preparation: VoucherPreparation = {
  preparationId: '40000000-0000-4000-8000-000000000001',
  payloadHash: 'a'.repeat(64),
  preparationFingerprint: 'b'.repeat(64),
  voucherIdentity: 'uuid',
  poiId: '1',
  poiName: 'Ort',
  affected: [],
  requiresReset: false,
};
afterEach(() => vi.unstubAllGlobals());
it('binds deletion to a fresh voucher read with the same principal before sending one DELETE', async () => {
  const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
    if (init.method !== 'DELETE') {
      return Response.json(
        { data: { id: '2' } },
        { headers: { 'X-SVA-Context-Binding': 'v1.current-context' } }
      );
    }
    return new Headers(init.headers).get('X-SVA-Context-Binding') === 'v1.current-context'
      ? Response.json({ data: { id: '2' } })
      : Response.json({ error: 'stale_mainserver_context' }, { status: 409 });
  });
  vi.stubGlobal('fetch', fetchMock);
  await deleteVoucher('2', 'organization');
  expect(fetchMock).toHaveBeenCalledTimes(2);
  const [readUrl, readInit] = fetchMock.mock.calls[0];
  expect(readUrl).toBe('/api/v1/mainserver/vouchers/2');
  expect(readInit.method ?? 'GET').toBe('GET');
  expect(new Headers(readInit.headers).get('X-SVA-Acting-Principal-Type')).toBe('organization');
  const [url, init] = fetchMock.mock.calls[1];
  expect(url).toBe('/api/v1/mainserver/vouchers/2');
  expect(init.method).toBe('DELETE');
  expect(new Headers(init.headers).get('X-SVA-Acting-Principal-Type')).toBe('organization');
  expect(new Headers(init.headers).get('X-Requested-With')).toBe('XMLHttpRequest');
  expect(new Headers(init.headers).get('X-SVA-Context-Binding')).toBe('v1.current-context');
});
it('does not delete when the fresh read provides no context binding', async () => {
  const fetchMock = vi.fn(async () => Response.json({ data: { id: '2' } }));
  vi.stubGlobal('fetch', fetchMock);
  await expect(deleteVoucher('2', 'user')).rejects.toMatchObject({
    code: 'mainserver_context_binding_missing',
  });
  expect(fetchMock).toHaveBeenCalledOnce();
  expect(fetchMock).toHaveBeenCalledWith(
    '/api/v1/mainserver/vouchers/2',
    expect.objectContaining({ headers: expect.any(Headers) })
  );
  expect((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].method).toBeUndefined();
});
it('does not delete when the fresh voucher read is denied', async () => {
  const fetchMock = vi.fn(async () => Response.json({ error: 'forbidden' }, { status: 403 }));
  vi.stubGlobal('fetch', fetchMock);
  await expect(deleteVoucher('2', 'user')).rejects.toMatchObject({ code: 'forbidden' });
  expect(fetchMock).toHaveBeenCalledOnce();
  expect((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].method).toBeUndefined();
});
it('does not retry a rejected deletion', async () => {
  const fetchMock = vi.fn(async (_url: string, init: RequestInit) =>
    init.method === 'DELETE'
      ? Response.json({ error: 'stale_mainserver_context' }, { status: 409 })
      : Response.json(
          { data: { id: '2' } },
          { headers: { 'X-SVA-Context-Binding': 'v1.current-context' } }
        )
  );
  vi.stubGlobal('fetch', fetchMock);
  await expect(deleteVoucher('2', 'user')).rejects.toMatchObject({
    code: 'stale_mainserver_context',
  });
  expect(fetchMock.mock.calls.filter(([, init]) => init.method === 'DELETE')).toHaveLength(1);
  expect(fetchMock).toHaveBeenCalledTimes(2);
});
describe('voucher operation identity', () => {
  it('uses the same pre-issued operation identity for commit and readback recovery', async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({ data: { id: '20' }, meta: { reset: false } })
    );
    vi.stubGlobal('fetch', fetchMock);
    await commitVoucher(parseVoucherDraft(emptyVoucherDraft()), undefined, preparation, 'user');
    await reconcileVoucher(preparation, 'user');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    for (const [, init] of fetchMock.mock.calls as unknown as readonly [unknown, RequestInit][]) {
      expect(new Headers(init.headers).get('X-SVA-Operation-Id')).toBe(preparation.preparationId);
      expect(new Headers(init.headers).get('X-Requested-With')).toBe('XMLHttpRequest');
    }
  });
});

it('binds the editing version and scopes reads and safe visibility to the selected principal', async () => {
  const mockedFetch = vi.fn(async () => Response.json({ data: {} }));
  vi.stubGlobal('fetch', mockedFetch);
  const input = parseVoucherDraft(emptyVoucherDraft());
  await prepareVoucher(input, '2', 'user', 'c'.repeat(64));
  await commitVoucher(input, '2', { ...preparation, baseFingerprint: 'c'.repeat(64) }, 'user');
  const calls = mockedFetch.mock.calls as unknown as [string, RequestInit][];
  expect(JSON.parse(String(calls[0][1].body))).toMatchObject({
    voucherId: '2',
    baseFingerprint: 'c'.repeat(64),
  });
  expect(JSON.parse(String(calls[1][1].body))).toMatchObject({
    voucherId: '2',
    baseFingerprint: 'c'.repeat(64),
  });
  await getVoucher('2', 'user');
  await listVouchers(2, 'a&b', 'user', { poiId: '1', visible: 'false' });
  await listVouchers(1, '');
  await listVoucherCategories();
  await listVoucherLocations(2, 'user');
  await changeVoucherVisibility('2', true, 'user');
  expect(calls[3][0]).toContain('search=a%26b');
  expect(calls[3][0]).toContain('visible=false');
  expect(calls[6][0]).toContain('/locations?page=2');
  expect(JSON.parse(String(calls[7][1].body))).toEqual({ visible: true });
});

it('omits edit-only version fields when creating and omits empty filters from a read', async () => {
  const mockedFetch = vi.fn(async () => Response.json({ data: {} }));
  vi.stubGlobal('fetch', mockedFetch);
  await prepareVoucher(parseVoucherDraft(emptyVoucherDraft()), undefined, 'user');
  await listVouchers(1, '', 'user', { poiId: '', categoryId: '', visible: '' });
  const calls = mockedFetch.mock.calls as unknown as [string, RequestInit][];
  expect(JSON.parse(String(calls[0][1].body))).not.toHaveProperty('baseFingerprint');
  expect(JSON.parse(String(calls[0][1].body))).not.toHaveProperty('voucherId');
  expect(calls[1][0]).not.toContain('poiId');
  expect(calls[1][0]).not.toContain('visible');
});
