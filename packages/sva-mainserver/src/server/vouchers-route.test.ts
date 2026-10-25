import { voucherPoiWriteFields } from '../generated/vouchers.js';
import { voucherContentFingerprint, type WriteShape } from './vouchers-snapshot.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({
  local: vi.fn(),
  csrf: vi.fn(),
  reserve: vi.fn(),
  complete: vi.fn(),
  aggregate: vi.fn(),
  write: vi.fn(),
  detail: vi.fn(),
  visibility: vi.fn(),
  provider: vi.fn(),
  finalize: vi.fn(),
  access: vi.fn(),
  readActor: vi.fn(),
  list: vi.fn(),
  locations: vi.fn(),
}));
const ctx = { user: { id: 'subject', instanceId: 'tenant' }, activeOrganizationId: 'org' };
vi.mock('@sva/auth-runtime/server', () => ({
  withAuthenticatedUser: (_request: Request, handler: (ctx: unknown) => unknown) => handler(ctx),
  authorizeContentPrimitiveForUser: state.local,
  validateCsrf: state.csrf,
  reserveIdempotency: state.reserve,
  completeIdempotency: state.complete,
}));
vi.mock('@sva/server-runtime', () => ({ createSdkLogger: () => ({ warn: vi.fn() }) }));
vi.mock('./mutation-principal.js', () => ({
  resolveMainserverMutationActor: ({ request }: { request: Request }) => ({
    instanceId: 'tenant',
    operationExternalId:
      request.headers.get('X-SVA-Operation-Id') ?? '40000000-0000-4000-8000-000000000001',
    keycloakSubject: 'subject',
    actorAccountId: 'account',
    activeOrganizationId: 'org',
    actingPrincipalType: 'organization',
    credentialFingerprint: 'credential',
  }),
  resolveMainserverResourceActor: state.readActor,
  resolveMainserverResourceAccess: state.access,
  authorizeMainserverCreateForPrincipal: state.provider,
  authorizeMainserverExistingContent: state.provider,
  finalizeMainserverMutation: state.finalize,
  runMainserverMutationWithFailureFinalization: ({ operation }: { operation: () => unknown }) =>
    operation(),
}));
vi.mock('./service.js', () => ({
  getSvaMainserverVoucherPoi: state.aggregate,
  writeSvaMainserverVoucher: state.write,
  getSvaMainserverVoucher: state.detail,
  changeSvaMainserverGenericItemVisibility: state.visibility,
  listSvaMainserverVouchers: state.list,
  listSvaMainserverPoi: state.locations,
  loadSvaMainserverDataProviderIdentity: () => ({ dataProvider: { id: 'provider' } }),
}));
import { dispatchSvaMainserverVouchersRequest } from './vouchers-route.js';
const voucher = {
  title: 'Eintritt',
  teaser: '',
  body: '',
  pointOfInterestIds: ['1'],
  discountMode: 'percentage',
  discountValue: 20,
  maxQuantity: 100,
  frequency: 'monthly',
  visible: false,
  categories: [],
  mediaContents: [],
};
const id = '40000000-0000-4000-8000-000000000001';
const fingerprint = 'a'.repeat(64);
const request = (path: string, body: unknown) =>
  new Request(`https://studio.test/api/v1/mainserver/vouchers/${path}`, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: {
      'Content-Type': 'application/json',
      ...((body as { preparationId?: string }).preparationId
        ? { 'X-SVA-Operation-Id': (body as { preparationId: string }).preparationId }
        : {}),
    },
  });
beforeEach(() => {
  vi.clearAllMocks();
  state.readActor.mockReturnValue(undefined);
  state.csrf.mockReturnValue(null);
  state.local.mockResolvedValue({
    ok: true,
    actor: { instanceId: 'tenant', keycloakSubject: 'subject', organizationId: 'org' },
  });
  state.aggregate.mockResolvedValue({
    poi: {
      id: '1',
      name: 'Ort',
      dataProvider: { id: 'provider' },
      vouchers: [{ id: '2', title: 'Alt' }],
    },
    snapshot: {
      name: 'Ort',
      payload: { opaque: 'keep' },
      mediaContents: [{ captionText: 'Keep' }],
      vouchers: [{ title: 'Alt' }],
    },
    fingerprint,
  });
  state.access.mockResolvedValue({ 'vouchers.read': true });
  state.provider.mockResolvedValue({});
  state.reserve.mockResolvedValue({ status: 'reserved' });
  state.write.mockResolvedValue({ id: '3', dataProvider: { id: 'provider' } });
});
describe('voucher request boundaries', () => {
  it('does not match unrelated routes', async () => {
    expect(
      await dispatchSvaMainserverVouchersRequest(new Request('https://studio.test/other'))
    ).toBeNull();
  });
  it('prepares the full reset scope without a provider mutation', async () => {
    const response = await dispatchSvaMainserverVouchersRequest(request('prepare', { voucher }));
    expect(response?.status).toBe(200);
    expect(await response?.json()).toMatchObject({
      data: { requiresReset: true, affected: [{ id: '2', title: 'Alt' }] },
    });
    expect(state.write).not.toHaveBeenCalled();
  });
  it('rejects missing CSRF protection', async () => {
    state.csrf.mockReturnValue({ code: 'bad' });
    expect(
      (await dispatchSvaMainserverVouchersRequest(request('prepare', { voucher })))?.status
    ).toBe(403);
    expect(state.aggregate).not.toHaveBeenCalled();
  });
  it('does not allow creation to bypass sibling-update permissions', async () => {
    state.local.mockImplementation(({ action }) =>
      action === 'vouchers.update'
        ? { ok: false, status: 403, error: 'forbidden', message: 'forbidden' }
        : { ok: true, actor: { instanceId: 'tenant', keycloakSubject: 'subject' } }
    );
    expect(
      (await dispatchSvaMainserverVouchersRequest(request('prepare', { voucher })))?.status
    ).toBe(403);
    expect(state.write).not.toHaveBeenCalled();
  });
  it('rejects commit without a previously prepared attempt', async () => {
    expect(
      (
        await dispatchSvaMainserverVouchersRequest(
          request('commit', { voucher, preparationId: id, confirmed: true })
        )
      )?.status
    ).toBe(409);
    expect(state.write).not.toHaveBeenCalled();
  });
  it('rejects unconfirmed reset and in-progress retries', async () => {
    state.reserve.mockResolvedValue({ status: 'replay', responseBody: {}, responseStatus: 200 });
    expect(
      (
        await dispatchSvaMainserverVouchersRequest(
          request('commit', { voucher, preparationId: id })
        )
      )?.status
    ).toBe(409);
    state.reserve
      .mockResolvedValueOnce({
        status: 'replay',
        responseBody: { siblingIdentities: { '2': 'uuid-2' } },
      })
      .mockResolvedValueOnce({ status: 'conflict' });
    expect(
      (
        await dispatchSvaMainserverVouchersRequest(
          request('commit', { voucher, preparationId: id, confirmed: true })
        )
      )?.status
    ).toBe(409);
    expect(state.write).not.toHaveBeenCalled();
  });
  it('performs one confirmed write with the pre-issued creation identity', async () => {
    state.reserve
      .mockResolvedValueOnce({
        status: 'replay',
        responseBody: { siblingIdentities: { '2': 'uuid-2' } },
      })
      .mockResolvedValueOnce({ status: 'reserved' });
    expect(
      (
        await dispatchSvaMainserverVouchersRequest(
          request('commit', {
            voucher,
            preparationId: id,
            preparationFingerprint: fingerprint,
            confirmed: true,
          })
        )
      )?.status
    ).toBe(200);
    expect(state.write).toHaveBeenCalledOnce();
    expect(state.write).toHaveBeenCalledWith(
      expect.objectContaining({ creationId: id, expectedFingerprint: fingerprint })
    );
    expect(state.finalize).toHaveBeenCalledOnce();
  });

  it('records an uncertain write outcome without retrying after transport failure', async () => {
    state.reserve
      .mockResolvedValueOnce({
        status: 'replay',
        responseBody: { siblingIdentities: { '2': 'uuid-2' } },
      })
      .mockResolvedValueOnce({ status: 'reserved' });
    state.write.mockRejectedValueOnce(new Error('network_timeout'));
    const response = await dispatchSvaMainserverVouchersRequest(
      request('commit', {
        voucher,
        preparationId: id,
        preparationFingerprint: fingerprint,
        confirmed: true,
      })
    );
    expect(response?.status).toBe(409);
    expect(state.write).toHaveBeenCalledOnce();
    expect(state.finalize).toHaveBeenCalledWith(
      expect.objectContaining({
        providerOutcome: 'unknown',
        reconciliationStatus: 'reconciliation_required',
      })
    );
  });
  it('visibility does not write or reset the POI aggregate', async () => {
    state.detail.mockResolvedValue({ id: '2', visible: false, dataProvider: { id: 'provider' } });
    expect(
      (await dispatchSvaMainserverVouchersRequest(request('2/visibility', { visible: false })))
        ?.status
    ).toBe(200);
    expect(state.visibility).toHaveBeenCalledOnce();
    expect(state.aggregate).not.toHaveBeenCalled();
    expect(state.write).not.toHaveBeenCalled();
  });
});
describe('voucher recovery', () => {
  it('reads back by pre-issued identity after response loss without another provider write', async () => {
    const prepared = await dispatchSvaMainserverVouchersRequest(request('prepare', { voucher }));
    const { data } = await prepared!.json();
    const binding = state.complete.mock.calls.at(-1)![0].responseBody;
    expect(data).not.toHaveProperty('expectedSnapshot');
    state.reserve.mockResolvedValue({
      status: 'replay',
      responseBody: binding,
      responseStatus: 200,
    });
    state.aggregate.mockResolvedValue({
      poi: {
        ...binding.expectedSnapshot,
        vouchers: binding.expectedSnapshot.vouchers.map(
          (item: Record<string, unknown>, index: number) => ({
            ...item,
            id: index === 0 ? '2' : '99',
          })
        ),
      },
    });
    state.detail.mockResolvedValue({
      id: '99',
      mediaContents: [],
      dataProvider: { id: 'provider' },
    });
    const response = await dispatchSvaMainserverVouchersRequest(
      request('reconcile', { preparationId: data.preparationId, payloadHash: data.payloadHash })
    );
    expect(response?.status).toBe(200);
    expect(await response?.json()).toMatchObject({ data: { id: '99' } });
    expect(state.write).not.toHaveBeenCalled();
  });
  it.each(['poi', 'sibling', 'voucher', 'payload', 'media'] as const)(
    'does not confirm recovery when the provider lost %s content',
    async (field) => {
      const prepared = await dispatchSvaMainserverVouchersRequest(request('prepare', { voucher }));
      const { data } = await prepared!.json();
      const binding = state.complete.mock.calls.at(-1)![0].responseBody;
      const poi = structuredClone(binding.expectedSnapshot);
      poi.vouchers = poi.vouchers.map((item: Record<string, unknown>, index: number) => ({
        ...item,
        id: String(index + 10),
      }));
      if (field === 'poi') poi.name = 'Lost';
      if (field === 'payload') delete poi.payload.opaque;
      if (field === 'media') poi.mediaContents = [];
      if (field === 'sibling') poi.vouchers[0].title = 'Lost';
      if (field === 'voucher') poi.vouchers[1].quota.maxQuantity = 1;
      state.reserve.mockResolvedValue({
        status: 'replay',
        responseBody: binding,
        responseStatus: 200,
      });
      state.aggregate.mockResolvedValue({ poi });
      const response = await dispatchSvaMainserverVouchersRequest(
        request('reconcile', { preparationId: data.preparationId, payloadHash: data.payloadHash })
      );
      expect(response?.status).toBe(409);
      expect(await response?.json()).toMatchObject({ error: 'voucher_outcome_unknown' });
      expect(state.finalize).not.toHaveBeenCalled();
      expect(state.write).not.toHaveBeenCalled();
    }
  );
  it('rejects changed context and ambiguous identities without a write', async () => {
    const prepared = await dispatchSvaMainserverVouchersRequest(request('prepare', { voucher }));
    const { data } = await prepared!.json();
    state.reserve.mockResolvedValue({
      status: 'replay',
      responseBody: { ...data, recoveryContext: 'changed' },
      responseStatus: 200,
    });
    expect(
      (
        await dispatchSvaMainserverVouchersRequest(
          request('reconcile', { preparationId: data.preparationId, payloadHash: data.payloadHash })
        )
      )?.status
    ).toBe(409);
    expect(state.write).not.toHaveBeenCalled();
  });
});

function existingVoucher() {
  const blank = (shape: WriteShape) =>
    Object.fromEntries(
      Object.entries(shape).map(([key, field]) => [key, typeof field === 'object' ? [] : null])
    );
  return {
    ...blank(voucherPoiWriteFields.vouchers),
    id: '2',
    title: 'Alt',
    teaser: '',
    visible: true,
    genericType: 'Voucher',
    dataProvider: { id: 'provider' },
    pointOfInterest: { id: '1', name: 'Ort' },
    payload: { id: 'uuid' },
    quota: { maxQuantity: 100, maxPerPerson: null, frequency: 'monthly', availableQuantity: 63 },
    discountType: { ...blank(voucherPoiWriteFields.vouchers.discountType), discountPercentage: 20 },
    contentBlocks: [],
    dates: [],
    mediaContents: [],
    categories: [],
  };
}
describe('editor read version', () => {
  it('rejects content edited since opening while ignoring subsequent redemptions', async () => {
    const target = existingVoucher();
    const baseFingerprint = voucherContentFingerprint(target);
    target.quota.availableQuantity = 62;
    expect(voucherContentFingerprint(target)).toBe(baseFingerprint);
    target.title = 'Changed elsewhere';
    state.aggregate.mockResolvedValue({
      poi: { dataProvider: { id: 'provider' }, vouchers: [target] },
      snapshot: {
        name: 'Ort',
        payload: { opaque: 'keep' },
        mediaContents: [{ captionText: 'Keep' }],
        vouchers: [{ title: 'Alt' }],
      },
      fingerprint,
    });
    const response = await dispatchSvaMainserverVouchersRequest(
      request('prepare', {
        voucher: { ...voucher, visible: true },
        voucherId: '2',
        baseFingerprint,
      })
    );
    expect(response?.status).toBe(409);
    expect(state.write).not.toHaveBeenCalled();
    expect(state.reserve).not.toHaveBeenCalled();
  });
  it('allows content editing of a visible voucher without granting visibility publication rights', async () => {
    const target = existingVoucher();
    state.aggregate.mockResolvedValue({
      poi: { id: '1', name: 'Ort', dataProvider: { id: 'provider' }, vouchers: [target] },
      snapshot: {
        name: 'Ort',
        payload: { opaque: 'keep' },
        mediaContents: [{ captionText: 'Keep' }],
        vouchers: [{ title: 'Alt' }],
      },
      fingerprint,
    });
    state.local.mockImplementation(({ action }) =>
      action === 'vouchers.publish'
        ? { ok: false, status: 403, error: 'forbidden', message: 'forbidden' }
        : {
            ok: true,
            actor: { instanceId: 'tenant', keycloakSubject: 'subject', organizationId: 'org' },
          }
    );
    const response = await dispatchSvaMainserverVouchersRequest(
      request('prepare', {
        voucher: { ...voucher, visible: true },
        voucherId: '2',
        baseFingerprint: voucherContentFingerprint(target),
      })
    );
    expect(response?.status).toBe(200);
    expect(state.local.mock.calls.some(([call]) => call.action === 'vouchers.publish')).toBe(false);
  });
});

describe('authorized voucher reads', () => {
  const actor = { instanceId: 'tenant', keycloakSubject: 'subject' };
  const get = (path: string) =>
    dispatchSvaMainserverVouchersRequest(
      new Request(`https://studio.test/api/v1/mainserver/vouchers${path}`)
    );
  it('requires both local permission and a resolved read principal', async () => {
    expect((await get(''))?.status).toBe(403);
    state.local.mockResolvedValue({
      ok: false,
      status: 403,
      error: 'forbidden',
      message: 'forbidden',
    });
    expect((await get('/2'))?.status).toBe(403);
    expect((await get('/locations'))?.status).toBe(403);
    expect(state.list).not.toHaveBeenCalled();
    expect(state.detail).not.toHaveBeenCalled();
    expect(state.locations).not.toHaveBeenCalled();
  });
  it.each(['true', 'false', undefined])(
    'filters collection reads by exact resource grants with visibility %s',
    async (visible) => {
      state.readActor.mockReturnValue(actor);
      const rows = [
        { id: '2', dataProvider: { id: 'provider' } },
        { id: '3', dataProvider: null },
      ];
      state.list.mockResolvedValue({
        data: rows,
        pagination: { page: 2, pageSize: 25, hasNextPage: true },
      });
      state.access.mockImplementation(({ item }) => ({ 'vouchers.read': item.id === '2' }));
      const response = await get(
        `?page=2&pageSize=25&poiId=1&categoryId=cat&search=Eintritt${visible ? `&visible=${visible}` : ''}`
      );
      expect(response?.status).toBe(200);
      expect(await response?.json()).toMatchObject({
        data: [rows[0]],
        pagination: { hasNextPage: true },
      });
      expect(state.list).toHaveBeenCalledWith(
        expect.objectContaining({
          page: 2,
          pageSize: 25,
          poiId: '1',
          categoryId: 'cat',
          search: 'Eintritt',
          visible: visible === undefined ? undefined : visible === 'true',
        })
      );
      expect(state.access).toHaveBeenCalledWith(
        expect.objectContaining({ forceExactScopeActions: ['vouchers.read'] })
      );
    }
  );
  it('reads details with current resource actions and rejects a revoked read grant', async () => {
    state.readActor.mockReturnValue(actor);
    state.detail.mockResolvedValue({ id: '2', dataProvider: null, title: 'Eintritt' });
    state.access.mockResolvedValue({ 'vouchers.read': true, 'vouchers.update': false });
    const response = await get('/2');
    expect(await response?.json()).toMatchObject({
      data: { id: '2' },
      meta: { access: { 'vouchers.read': true, 'vouchers.update': false } },
      fetchedAt: expect.any(String),
    });
    state.access.mockResolvedValue({ 'vouchers.read': false });
    expect((await get('/2'))?.status).toBe(403);
  });
  it('returns only owned editable locations without changing upstream pagination', async () => {
    expect((await get('/locations'))?.status).toBe(403);
    state.readActor.mockReturnValue(actor);
    state.locations.mockResolvedValue({
      data: [
        { id: '1', name: 'Allowed', addresses: [], dataProvider: { id: 'provider' } },
        { id: '2', name: 'Foreign', dataProvider: { id: 'other' } },
        { id: '3', name: 'Denied', dataProvider: { id: 'provider' } },
        { id: '4', name: 'No provider', dataProvider: null },
      ],
      pagination: { page: 2, hasNextPage: true },
    });
    state.local.mockImplementation(({ resource }) =>
      resource.contentId === '3'
        ? { ok: false, status: 403, error: 'forbidden', message: 'forbidden' }
        : { ok: true, actor }
    );
    const response = await get('/locations?page=2&pageSize=100');
    expect(await response?.json()).toEqual({
      data: [{ id: '1', name: 'Allowed', addresses: [] }],
      pagination: { page: 2, hasNextPage: true },
    });
    expect(state.locations).toHaveBeenCalledWith(
      expect.objectContaining({ page: 2, pageSize: 100, includeInvisible: true })
    );
  });
});

describe('voucher pre-write rejection contracts', () => {
  it.each([
    [],
    [{ name: 'Kultur', active: false }],
    [{ name: 'Kultur', active: true, dataTypes: ['news_item'] }],
  ])('rejects a category absent from the active voucher category set %j', async (...categories) => {
    const aggregate = await state.aggregate();
    state.aggregate.mockResolvedValue({ ...aggregate, categories: categories.flat() });
    const response = await dispatchSvaMainserverVouchersRequest(
      request('prepare', { voucher: { ...voucher, categories: [{ name: 'Kultur' }] } })
    );
    expect(response?.status).toBe(400);
    expect(state.write).not.toHaveBeenCalled();
    expect(state.reserve).not.toHaveBeenCalled();
  });
  it.each([{ dataTypes: undefined }, { dataTypes: [] }, { dataTypes: ['generic_item_voucher'] }])(
    'accepts an active category whose type scope permits vouchers: %j',
    async ({ dataTypes }) => {
      const aggregate = await state.aggregate();
      state.aggregate.mockResolvedValue({
        ...aggregate,
        categories: [{ name: 'Kultur', active: true, dataTypes }],
      });
      const response = await dispatchSvaMainserverVouchersRequest(
        request('prepare', { voucher: { ...voucher, categories: [{ name: 'Kultur' }] } })
      );
      expect(response?.status).toBe(200);
      expect(state.write).not.toHaveBeenCalled();
    }
  );
  it('rejects a foreign data provider and a voucher no longer belonging to the selected POI', async () => {
    const aggregate = await state.aggregate();
    state.aggregate.mockResolvedValue({
      ...aggregate,
      poi: { ...aggregate.poi, dataProvider: { id: 'foreign' } },
    });
    expect(
      (await dispatchSvaMainserverVouchersRequest(request('prepare', { voucher })))?.status
    ).toBe(403);
    state.aggregate.mockResolvedValue(aggregate);
    expect(
      (
        await dispatchSvaMainserverVouchersRequest(
          request('prepare', { voucher, voucherId: '999', baseFingerprint: fingerprint })
        )
      )?.status
    ).toBe(409);
    expect(state.write).not.toHaveBeenCalled();
  });
  it('rejects a content no-op and requires publish permission for a visible create', async () => {
    const target = existingVoucher();
    const aggregate = await state.aggregate();
    state.aggregate.mockResolvedValue({
      ...aggregate,
      poi: { ...aggregate.poi, vouchers: [target] },
    });
    const response = await dispatchSvaMainserverVouchersRequest(
      request('prepare', {
        voucher: { ...voucher, title: 'Alt', visible: true },
        voucherId: '2',
        baseFingerprint: voucherContentFingerprint(target),
      })
    );
    expect(await response?.json()).toMatchObject({ error: 'voucher_no_changes' });
    state.local.mockImplementation(({ action }) =>
      action === 'vouchers.publish'
        ? { ok: false, status: 403, error: 'forbidden', message: 'forbidden' }
        : { ok: true, actor: { instanceId: 'tenant', keycloakSubject: 'subject' } }
    );
    expect(
      (
        await dispatchSvaMainserverVouchersRequest(
          request('prepare', { voucher: { ...voucher, visible: true } })
        )
      )?.status
    ).toBe(403);
    expect(state.write).not.toHaveBeenCalled();
  });
  it('reports unsupported methods and provider failures without a successful mutation', async () => {
    expect(
      (
        await dispatchSvaMainserverVouchersRequest(
          new Request('https://studio.test/api/v1/mainserver/vouchers/2', { method: 'DELETE' })
        )
      )?.status
    ).toBe(405);
    state.aggregate.mockRejectedValueOnce(new Error('upstream_unavailable'));
    expect(
      (await dispatchSvaMainserverVouchersRequest(request('prepare', { voucher })))?.status
    ).toBe(502);
    state.aggregate.mockRejectedValueOnce(new Error('voucher_snapshot_incomplete'));
    expect(
      (await dispatchSvaMainserverVouchersRequest(request('prepare', { voucher })))?.status
    ).toBe(409);
    expect(state.write).not.toHaveBeenCalled();
  });
});

describe('recovery request trust boundaries', () => {
  it('requires CSRF, a valid prepared identity and permission before consulting the provider', async () => {
    const body = { preparationId: id, payloadHash: fingerprint };
    state.csrf.mockReturnValueOnce({ code: 'invalid' });
    expect((await dispatchSvaMainserverVouchersRequest(request('reconcile', body)))?.status).toBe(
      403
    );
    expect((await dispatchSvaMainserverVouchersRequest(request('reconcile', {})))?.status).toBe(
      400
    );
    state.local.mockResolvedValue({
      ok: false,
      status: 403,
      error: 'forbidden',
      message: 'forbidden',
    });
    expect((await dispatchSvaMainserverVouchersRequest(request('reconcile', body)))?.status).toBe(
      403
    );
    expect(state.aggregate).not.toHaveBeenCalled();
    expect(state.finalize).not.toHaveBeenCalled();
  });
  it('refuses a mismatched operation and an attempt whose preparation is not complete', async () => {
    const body = { preparationId: id, payloadHash: fingerprint };
    const mismatch = request('reconcile', body);
    mismatch.headers.set('X-SVA-Operation-Id', '40000000-0000-4000-8000-000000000002');
    expect((await dispatchSvaMainserverVouchersRequest(mismatch))?.status).toBe(400);
    expect(state.reserve).not.toHaveBeenCalled();
    expect((await dispatchSvaMainserverVouchersRequest(request('reconcile', body)))?.status).toBe(
      409
    );
    expect(state.aggregate).not.toHaveBeenCalled();
    expect(state.write).not.toHaveBeenCalled();
  });
  it('does not confirm recovery when exact resource read permission was revoked', async () => {
    const prepared = await dispatchSvaMainserverVouchersRequest(request('prepare', { voucher }));
    const { data } = await prepared!.json();
    const binding = state.complete.mock.calls.at(-1)![0].responseBody;
    state.reserve.mockResolvedValue({ status: 'replay', responseBody: binding });
    state.aggregate.mockResolvedValue({
      poi: {
        ...binding.expectedSnapshot,
        vouchers: binding.expectedSnapshot.vouchers.map(
          (item: Record<string, unknown>, index: number) => ({ ...item, id: String(index + 10) })
        ),
      },
    });
    state.detail.mockResolvedValue({ id: '11', dataProvider: null });
    state.access.mockResolvedValue({ 'vouchers.read': false });
    const response = await dispatchSvaMainserverVouchersRequest(
      request('reconcile', { preparationId: data.preparationId, payloadHash: data.payloadHash })
    );
    expect(response?.status).toBe(403);
    expect(state.finalize).not.toHaveBeenCalled();
    expect(state.write).not.toHaveBeenCalled();
  });
});
