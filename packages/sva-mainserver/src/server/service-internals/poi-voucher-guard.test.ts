import { describe, expect, it, vi } from 'vitest';
import { voucherPoiWriteFields } from '../../generated/vouchers.js';
import {
  voucherSnapshotHash,
  voucherWriteSnapshot,
  type RawRecord,
  type WriteShape,
} from '../vouchers-snapshot.js';
import { createPoiOperations } from './poi-operations.js';
import type { GraphqlExecutor } from './shared.js';
import type { SvaMainserverInstanceConfig } from '../../types.js';
const config = {} as SvaMainserverInstanceConfig;
const input = { instanceId: 'tenant', keycloakSubject: 'subject', poiId: '1' };
describe('POI voucher write guard', () => {
  it.each(['update', 'delete'])(
    'blocks %s before destructive mutation even without the plugin',
    async (operation) => {
      const execute = vi.fn().mockResolvedValue({ pointOfInterest: { vouchers: [{ id: '2' }] } });
      const service = createPoiOperations(execute as GraphqlExecutor);
      await expect(
        operation === 'delete'
          ? service.destroyPoiWithConfig(input, config)
          : service.writePoiWithConfig({ ...input, poi: { name: 'Changed' } }, config)
      ).rejects.toThrow('voucher_dedicated_editor_required');
      expect(execute).toHaveBeenCalledOnce();
      expect(execute.mock.calls[0][0].operationName).toBe('SvaMainserverPoiVoucherGuard');
    }
  );
  it('fails closed on a degraded read', async () => {
    const execute = vi.fn().mockResolvedValue({ pointOfInterest: {} });
    await expect(
      createPoiOperations(execute as GraphqlExecutor).destroyPoiWithConfig(input, config)
    ).rejects.toThrow('voucher_snapshot_incomplete');
    expect(execute).toHaveBeenCalledOnce();
  });
});

it('uses the same complete aggregate for a confirmed ordinary POI update and preserves sibling IDs for a regular CMS provider', async () => {
  const blank = (shape: WriteShape): RawRecord =>
    Object.fromEntries(
      Object.entries(shape).map(([key, field]) => [key, typeof field === 'object' ? [] : null])
    );
  const sibling = {
    ...blank(voucherPoiWriteFields.vouchers),
    id: '2',
    title: 'Alt',
    genericType: 'Voucher',
    payload: { id: 'uuid-2', opaque: 'keep' },
    dataProvider: { id: 'provider' },
    genericItems: [],
    genericItemMessages: [],
    pushNotifications: [],
    likeCount: 0,
  };
  let poi: RawRecord = {
    ...blank(voucherPoiWriteFields),
    id: '1',
    name: 'Ort',
    contact: null,
    operatingCompany: null,
    location: null,
    accessibilityInformation: null,
    mediaContents: [
      {
        ...blank(voucherPoiWriteFields.mediaContents),
        contentType: 'image',
        captionText: 'Keep caption',
        sourceUrl: null,
      },
    ],
    payload: { opaque: 'poi' },
    dataProvider: { id: 'provider', dataType: 'cms' },
    vouchers: [sibling],
  };
  const fingerprint = voucherSnapshotHash({
    snapshot: voucherWriteSnapshot(poi),
    provider: poi.dataProvider,
  });
  const execute = vi.fn().mockImplementation(async ({ operationName, variables }) => {
    if (operationName === 'SvaMainserverVoucherWrite') {
      poi = {
        ...poi,
        ...variables,
        vouchers: variables.vouchers,
      };
      return { createPointOfInterest: { id: '1' } };
    }
    return { pointOfInterest: poi, categories: [] };
  });
  const result = await createPoiOperations(execute as GraphqlExecutor).writePoiWithConfig(
    {
      ...input,
      poi: { name: 'Neu', payload: { opaque: 'poi', studioUpdateId: 'update' } },
      voucherResetFingerprint: fingerprint,
      voucherResetIdentities: { '2': 'uuid-2' },
      voucherResetOperationId: 'attempt',
    },
    config
  );
  expect(result).toMatchObject({
    id: '1',
    name: 'Neu',
    voucherIdChanges: [{ previousId: '2', id: '2' }],
  });
  const write = execute.mock.calls.find(
    ([call]) => call.operationName === 'SvaMainserverVoucherWrite'
  )?.[0];
  expect(write.allowRetry).toBe(false);
  expect(JSON.parse(JSON.stringify(write.variables))).not.toHaveProperty('contact');
  expect(JSON.parse(JSON.stringify(write.variables))).toMatchObject({
    mediaContents: [{ contentType: 'image', captionText: 'Keep caption' }],
  });
  expect(write.variables.vouchers).toEqual([
    voucherWriteSnapshot(sibling, voucherPoiWriteFields.vouchers),
  ]);
});
