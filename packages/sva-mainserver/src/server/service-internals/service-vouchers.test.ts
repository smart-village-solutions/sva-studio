import { createItemService } from './service-items.js';
import { createPoiOperations } from './poi-operations.js';
import { createGenericItemOperations } from './generic-item-operations.js';
import type { GraphqlExecutor } from './shared.js';
import { describe, expect, it, vi } from 'vitest';
import { voucherPoiWriteFields } from '../../generated/vouchers.js';
import { createVoucherService } from './service-vouchers.js';
import {
  voucherSnapshotHash,
  voucherWriteSnapshot,
  type RawRecord,
  type WriteShape,
} from '../vouchers-snapshot.js';
import type { ServiceContext } from './service-context.js';
const blank = (shape: WriteShape): RawRecord =>
  Object.fromEntries(
    Object.entries(shape).map(([key, value]) => [
      key,
      value === true || typeof value === 'string' ? null : [],
    ])
  );
const voucher = (id: string, uuid: string) => ({
  ...blank(voucherPoiWriteFields.vouchers),
  id,
  title: 'Alt',
  teaser: '',
  genericType: 'Voucher',
  visible: false,
  payload: { id: uuid, opaque: { nested: [1, 2] } },
  dataProvider: { id: 'provider' },
  pointOfInterest: { id: '1', name: 'Ort' },
  contentBlocks: [
    { ...blank(voucherPoiWriteFields.vouchers.contentBlocks), title: 'Block', body: 'Alt' },
  ],
  dates: [
    { ...blank(voucherPoiWriteFields.vouchers.dates), dateStart: '2026-01-01', weekday: 'Monday' },
  ],
  quota: { maxQuantity: 100, availableQuantity: 63, frequency: 'monthly', maxPerPerson: 2 },
  discountType: {
    originalPrice: null,
    discountedPrice: null,
    discountPercentage: 20,
    discountAmount: null,
  },
  mediaContents: [],
  categories: [],
  genericItems: [],
  genericItemMessages: [],
  pushNotifications: [],
  likeCount: 0,
});
const input = {
  title: 'Neu',
  teaser: '',
  body: '<p>Hallo</p>',
  pointOfInterestIds: ['1'],
  discountMode: 'percentage' as const,
  discountValue: 30,
  maxQuantity: 100,
  frequency: 'monthly' as const,
  visible: false,
  categories: [],
  mediaContents: [],
  dateStart: '2026-02-01',
};
const connection = { instanceId: 'tenant', keycloakSubject: 'subject' };
function setup() {
  const poi = {
    ...blank(voucherPoiWriteFields),
    id: '1',
    name: 'Ort',
    payload: { unknown: 'keep' },
    contact: null,
    location: null,
    operatingCompany: null,
    accessibilityInformation: null,
    dataProvider: { id: 'provider', dataType: 'cms' },
    vouchers: [voucher('2', 'uuid-2'), voucher('3', 'uuid-3')],
  };
  const execute = vi.fn().mockImplementation(async ({ operationName, variables }) => {
    if (operationName === 'SvaMainserverVoucherWrite') {
      poi.vouchers = variables.vouchers.map((item: RawRecord, index: number) => ({
        ...voucher(String(index + 20), ''),
        ...item,
        contentBlocks: (item.contentBlocks as RawRecord[]).map((block) => ({
          ...blank(voucherPoiWriteFields.vouchers.contentBlocks),
          ...block,
        })),
        dates: (item.dates as RawRecord[]).map((date) => ({
          ...blank(voucherPoiWriteFields.vouchers.dates),
          ...date,
        })),
        quota: {
          ...(item.quota as RawRecord),
          availableQuantity:
            poi.vouchers.find((stored) => stored.id === item.id)?.quota.availableQuantity ??
            (item.quota as RawRecord).maxQuantity,
        },
        discountType: {
          originalPrice: null,
          discountedPrice: null,
          discountPercentage: null,
          discountAmount: null,
          ...(item.discountType as RawRecord),
        },
      }));
      const { vouchers: _writtenVouchers, ...fields } = variables;
      Object.assign(
        poi,
        Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined))
      );
      return { createPointOfInterest: { id: '1' } };
    }
    if (operationName === 'SvaMainserverVoucherDetail')
      return { genericItem: poi.vouchers.find((item) => item.id === variables.id) };
    return { pointOfInterest: poi, categories: [] };
  });
  const service = createVoucherService({
    loadValidatedInstanceConfig: vi.fn(),
    executeGraphqlWithConfig: execute as ServiceContext['executeGraphqlWithConfig'],
  });
  const fingerprint = () =>
    voucherSnapshotHash({ snapshot: voucherWriteSnapshot(poi), provider: poi.dataProvider });
  return { poi, execute, service, fingerprint };
}
describe('voucher aggregate write', () => {
  it('preserves database IDs, usage, siblings and opaque POI data for a regular CMS provider', async () => {
    const { poi, execute, service, fingerprint } = setup();
    const sibling = voucherWriteSnapshot(poi.vouchers[1], voucherPoiWriteFields.vouchers);
    const result = await service.writeVoucher({
      ...connection,
      poiId: '1',
      voucherId: '2',
      voucher: input,
      creationId: 'attempt',
      expectedFingerprint: fingerprint(),
    });
    expect(result.id).toBe('2');
    expect(poi.vouchers.map((item) => item.id)).toEqual(['2', '3']);
    expect(result.quota?.availableQuantity).toBe(63);
    expect(result.payload).toEqual({ id: 'uuid-2', opaque: { nested: [1, 2] } });
    const write = execute.mock.calls.find(
      ([call]) => call.operationName === 'SvaMainserverVoucherWrite'
    )?.[0];
    expect(write.allowRetry).toBe(false);
    expect(write.variables.payload).toMatchObject({
      unknown: 'keep',
      studioUpdateId: expect.any(String),
      studioUpdatedAt: expect.any(String),
    });
    expect(write.variables.vouchers[1]).toEqual(sibling);
    expect(write.variables.vouchers[0].contentBlocks[0]).toMatchObject({
      title: 'Block',
      body: '<p>Hallo</p>',
    });
    expect(write.variables.vouchers[0].dates[0]).toMatchObject({
      weekday: 'Monday',
      dateStart: '2026-02-01',
    });
  });
  it('preserves weekday and time rules when editing content without date boundaries', async () => {
    const { poi, service, fingerprint } = setup();
    const date = {
      ...blank(voucherPoiWriteFields.vouchers.dates),
      weekday: 'Monday',
      timeStart: '09:00',
      timeEnd: '12:00',
      timeDescription: 'Morning',
      useOnlyTimeDescription: false,
    };
    const [target] = poi.vouchers;
    if (!target) throw new Error('Missing voucher fixture');
    target.dates = [date];
    const result = await service.writeVoucher({
      ...connection,
      poiId: '1',
      voucherId: '2',
      voucher: { ...input, body: 'Alt', discountValue: 20, maxPerPerson: 2, dateStart: undefined },
      creationId: 'attempt',
      expectedFingerprint: fingerprint(),
    });
    expect(result.dates).toEqual([{ dateStart: null, dateEnd: null }]);
    expect(poi.vouchers[0]?.dates).toEqual([date]);
  });
  it('retains unedited image metadata and opaque payload while rebinding a library asset', async () => {
    const { poi, service, fingerprint } = setup();
    const [target] = poi.vouchers;
    if (!target) throw new Error('Missing voucher fixture');
    Object.assign(target, {
      mediaContents: [
        {
          ...blank(voucherPoiWriteFields.vouchers.mediaContents),
          contentType: 'image',
          captionText: 'Old caption',
          copyright: 'Credit',
          height: 480,
          width: 640,
          payload: { studioMediaAssetId: 'old-id', opaque: 'keep' },
          sourceUrl: { url: 'https://example.test/image.jpg', description: 'Alt text' },
        },
      ],
    });
    const assetId = '40000000-0000-4000-8000-000000000001';
    await service.writeVoucher({
      ...connection,
      poiId: '1',
      voucherId: '2',
      creationId: 'attempt',
      expectedFingerprint: fingerprint(),
      voucher: {
        ...input,
        mediaContents: [
          {
            contentType: 'image',
            hostMediaAssetId: assetId,
            captionText: 'New caption',
            sourceUrl: { url: 'https://example.test/image.jpg' },
          },
        ],
      },
    });
    expect(poi.vouchers[0]?.mediaContents).toEqual([
      expect.objectContaining({
        captionText: 'New caption',
        copyright: 'Credit',
        height: 480,
        width: 640,
        payload: { studioMediaAssetId: assetId, opaque: 'keep' },
        sourceUrl: { url: 'https://example.test/image.jpg', description: 'Alt text' },
      }),
    ]);
  });
  it('uses the pre-issued creation identity exactly once', async () => {
    const { execute, service, fingerprint } = setup();
    const result = await service.writeVoucher({
      ...connection,
      poiId: '1',
      voucher: input,
      creationId: 'attempt',
      expectedFingerprint: fingerprint(),
    });
    expect(result.payload.id).toBe('attempt');
    expect(
      execute.mock.calls.filter(([call]) => call.operationName === 'SvaMainserverVoucherWrite')
    ).toHaveLength(1);
  });
  it('creates, reopens, edits and adds a second voucher without changing existing IDs', async () => {
    const { poi, service, fingerprint } = setup();
    poi.vouchers = [];
    const first = await service.writeVoucher({
      ...connection,
      poiId: '1',
      voucher: input,
      creationId: 'first',
      expectedFingerprint: fingerprint(),
    });
    const reopened = await service.getVoucher({ ...connection, voucherId: first.id });
    expect(reopened.payload.id).toBe('first');
    await service.writeVoucher({
      ...connection,
      poiId: '1',
      voucher: { ...input, title: 'Second' },
      creationId: 'second',
      expectedFingerprint: fingerprint(),
    });
    const edited = await service.writeVoucher({
      ...connection,
      poiId: '1',
      voucherId: first.id,
      voucher: { ...input, title: 'Edited' },
      creationId: 'edit',
      expectedFingerprint: fingerprint(),
    });
    expect(edited.id).toBe(first.id);
    expect(poi.vouchers.map((item) => item.payload.id)).toEqual(['first', 'second']);
    expect(poi.vouchers.map((item) => item.title)).toEqual(['Edited', 'Second']);
    expect(poi.vouchers.map((item) => item.quota.availableQuantity)).toEqual([100, 100]);
  });
  it('sends database IDs for legacy siblings without a payload UUID', async () => {
    const { poi, execute, service, fingerprint } = setup();
    Object.assign(poi.vouchers[0]!.payload, { id: undefined });
    await service.writeVoucher({
      ...connection,
      poiId: '1',
      voucher: input,
      creationId: 'new',
      siblingIdentities: { '2': 'legacy-2', '3': 'uuid-3' },
      expectedFingerprint: fingerprint(),
    });
    const write = execute.mock.calls.find(
      ([call]) => call.operationName === 'SvaMainserverVoucherWrite'
    )![0];
    expect(write.variables.vouchers[0]).toMatchObject({
      id: '2',
      payload: { id: 'legacy-2', opaque: { nested: [1, 2] } },
    });
    expect(poi.vouchers.map((item) => item.id)).toEqual(['2', '3', '22']);
  });
  it('clears the previous discount mode on the retained discount record', async () => {
    const { service, fingerprint } = setup();
    const result = await service.writeVoucher({
      ...connection,
      poiId: '1',
      voucherId: '2',
      creationId: 'mode-change',
      voucher: { ...input, discountMode: 'amount', discountValue: 5 },
      expectedFingerprint: fingerprint(),
    });
    expect(result.discountType).toEqual({
      discountPercentage: null,
      discountAmount: 5,
      originalPrice: null,
      discountedPrice: null,
    });
  });
  it('rejects concurrent changes before any write', async () => {
    const { poi, execute, service, fingerprint } = setup();
    const expectedFingerprint = fingerprint();
    poi.name = 'Changed';
    await expect(
      service.writeVoucher({
        ...connection,
        poiId: '1',
        voucher: input,
        creationId: 'attempt',
        expectedFingerprint,
      })
    ).rejects.toThrow('voucher_content_conflict');
    expect(
      execute.mock.calls.some(([call]) => call.operationName === 'SvaMainserverVoucherWrite')
    ).toBe(false);
  });
  it('does not retry a timeout or guess records by title', async () => {
    const { execute, service, fingerprint } = setup();
    const base = execute.getMockImplementation()!;
    execute.mockImplementation(async (call) => {
      if (call.operationName === 'SvaMainserverVoucherWrite') throw new Error('timeout');
      return base(call);
    });
    await expect(
      service.writeVoucher({
        ...connection,
        poiId: '1',
        voucher: input,
        creationId: 'attempt',
        expectedFingerprint: fingerprint(),
      })
    ).rejects.toThrow('timeout');
    expect(
      execute.mock.calls.filter(([call]) => call.operationName === 'SvaMainserverVoucherWrite')
    ).toHaveLength(1);
  });
});

describe('generic item mutation bypass protection', () => {
  it('rejects Voucher creation, update and deletion in the generic writer without a provider mutation', async () => {
    const execute = vi.fn().mockResolvedValue({
      genericItem: {
        id: '2',
        title: 'Alt',
        genericType: 'Voucher',
        visible: false,
        payload: { id: 'uuid-2' },
      },
    });
    const service = createItemService({
      loadValidatedInstanceConfig: vi.fn(),
      loadListCredentialMetadata: vi.fn(),
      poiOperations: createPoiOperations(execute as GraphqlExecutor),
      genericItemOperations: createGenericItemOperations(execute as GraphqlExecutor),
      genericItemVisibilityOperations: { changeGenericItemVisibilityWithConfig: vi.fn() },
    });
    await expect(
      service.createGenericItem({
        ...connection,
        genericItem: { title: 'Alt', genericType: 'Voucher' },
      })
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(execute).not.toHaveBeenCalled();
    await expect(
      service.updateGenericItem({
        ...connection,
        genericItemId: '2',
        genericItem: { title: 'Neu', genericType: 'FAQ' },
      })
    ).rejects.toMatchObject({ statusCode: 409 });
    await expect(
      service.deleteGenericItem({ ...connection, genericItemId: '2' })
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(
      execute.mock.calls.every(([call]) => call.operationName === 'SvaMainserverGenericItemDetail')
    ).toBe(true);
  });
});

describe('voucher provider reads and pagination', () => {
  it('uses an upstream lookahead and offset without local filters', async () => {
    const { service, execute } = setup();
    execute.mockResolvedValue({
      genericItems: [voucher('4', 'uuid-4'), voucher('5', 'uuid-5'), voucher('6', 'uuid-6')],
    });
    const result = await service.listVouchers({
      ...connection,
      page: 2,
      pageSize: 2,
      search: 'Eintritt',
      categoryId: 'cat',
    });
    expect(result.data.map((item) => item.id)).toEqual(['4', '5']);
    expect(result.pagination).toEqual({ page: 2, pageSize: 2, hasNextPage: true });
    expect(execute).toHaveBeenCalledWith(
      expect.objectContaining({
        variables: { limit: 3, skip: 2, search: 'Eintritt', categoryId: 'cat' },
        allowRetry: true,
      }),
      undefined
    );
  });
  it('continues through a full page with no location matches', async () => {
    const { service, execute } = setup();
    const unrelated = Array.from({ length: 100 }, (_, index) => ({
      ...voucher(String(index), `uuid-${index}`),
      pointOfInterest: null,
    }));
    execute.mockResolvedValueOnce({ genericItems: unrelated }).mockResolvedValueOnce({
      genericItems: [voucher('200', 'uuid-200'), voucher('201', 'uuid-201')],
    });
    const result = await service.listVouchers({
      ...connection,
      page: 1,
      pageSize: 1,
      poiId: '1',
      visible: false,
    });
    expect(result.data.map((item) => item.id)).toEqual(['200']);
    expect(result.pagination.hasNextPage).toBe(true);
    expect(execute.mock.calls.map(([call]) => call.variables.skip)).toEqual([0, 100]);
  });
  it('applies a visibility filter before local pagination and handles an empty result', async () => {
    const { service, execute } = setup();
    execute.mockResolvedValueOnce({
      genericItems: [
        { ...voucher('1', 'uuid-1'), visible: true },
        voucher('2', 'uuid-2'),
        voucher('3', 'uuid-3'),
      ],
    });
    const result = await service.listVouchers({
      ...connection,
      page: 2,
      pageSize: 1,
      visible: false,
    });
    expect(result.data.map((item) => item.id)).toEqual(['3']);
    expect(result.pagination.hasNextPage).toBe(false);
    execute.mockResolvedValueOnce({ genericItems: [] });
    expect((await service.listVouchers({ ...connection, page: 1, pageSize: 25 })).data).toEqual([]);
  });
  it('returns a content fingerprint and reports an absent provider record', async () => {
    const { service, execute } = setup();
    execute.mockResolvedValueOnce({ genericItem: voucher('2', 'uuid-2') });
    expect(await service.getVoucher({ ...connection, voucherId: '2' })).toMatchObject({
      id: '2',
      contentFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
    execute.mockResolvedValueOnce({ genericItem: null });
    await expect(service.getVoucher({ ...connection, voucherId: '2' })).rejects.toMatchObject({
      statusCode: 404,
    });
  });
  it('accepts a regular CMS provider after the announcement-preserving Mainserver fix', async () => {
    const { service } = setup();
    await expect(service.getVoucherPoi({ ...connection, poiId: '1' })).resolves.toMatchObject({
      poi: { dataProvider: { dataType: 'cms' } },
    });
  });
  it('rejects provider field loss without retry', async () => {
    const { service, execute, poi, fingerprint } = setup();
    const base = execute.getMockImplementation();
    if (!base) throw new Error('Missing executor fixture');
    execute.mockImplementation(async (call) => {
      const result = await base(call);
      if (call.operationName === 'SvaMainserverVoucherWrite') poi.name = 'Lost';
      return result;
    });
    await expect(
      service.writeVoucher({
        ...connection,
        poiId: '1',
        voucher: input,
        creationId: 'attempt',
        expectedFingerprint: fingerprint(),
      })
    ).rejects.toThrow('voucher_reconciliation_required');
    expect(
      execute.mock.calls.filter(([call]) => call.operationName === 'SvaMainserverVoucherWrite')
    ).toHaveLength(1);
  });
});
