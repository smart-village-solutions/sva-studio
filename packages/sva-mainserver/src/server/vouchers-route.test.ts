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
  resolveMainserverResourceActor: () => undefined,
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
  listSvaMainserverVouchers: vi.fn(),
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
    snapshot: {},
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
    state.reserve.mockResolvedValue({ status: 'replay', responseBody: data, responseStatus: 200 });
    state.aggregate.mockResolvedValue({
      poi: {
        payload: { studioVoucherOperationId: data.preparationId },
        vouchers: [
          { id: '99', payload: { id: data.voucherIdentity } },
          { id: '2', title: voucher.title, payload: { id: data.siblingIdentities['2'] } },
        ],
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
      snapshot: {},
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
      snapshot: {},
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
