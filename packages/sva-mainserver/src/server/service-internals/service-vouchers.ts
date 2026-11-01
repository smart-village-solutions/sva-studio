import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { sanitizeRichTextHtml } from '@sva/core/rich-text-html';
import type { SvaMainserverConnectionInput } from '../../types.js';
import type { VoucherInput, VoucherRecord } from '../../types-vouchers.js';
import {
  voucherDetailDocument,
  voucherListDocument,
  voucherPoiDocument,
  voucherWriteDocument,
  voucherPoiWriteFields,
} from '../../generated/vouchers.js';
import {
  assertVoucherPoiWritable,
  raw,
  records,
  voucherSnapshotHash,
  voucherContentFingerprint,
  voucherWriteSnapshot,
  voucherWriteMatches,
  type RawRecord,
} from '../vouchers-snapshot.js';
import { toVoucherFields } from '../vouchers-model.js';
import type { ServiceContext } from './service-context.js';
import { assertUpstreamScanLimit, withUpdatedPayload, toSvaMainserverError } from './shared.js';
import { voucherRecordSchema } from '../vouchers-read-model.js';
type VoucherServiceContext = Pick<
  ServiceContext,
  'loadValidatedInstanceConfig' | 'executeGraphqlWithConfig' | 'genericItemOperations'
>;
const execute = async <T>(
  context: VoucherServiceContext,
  input: SvaMainserverConnectionInput,
  document: string,
  operationName: string,
  variables: Record<string, unknown>,
  allowRetry = true
) => {
  const config = await context.loadValidatedInstanceConfig(input, 'load_instance_config');
  return context.executeGraphqlWithConfig<T>(
    { ...input, document, operationName, variables, allowRetry },
    config
  );
};
const listVouchers = async (
  context: VoucherServiceContext,
  input: SvaMainserverConnectionInput & {
    page: number;
    pageSize: number;
    search?: string;
    categoryId?: string;
    poiId?: string;
    visible?: boolean;
  }
) => {
  const filtered = input.poiId !== undefined || input.visible !== undefined;
  const offset = (input.page - 1) * input.pageSize;
  const items: VoucherRecord[] = [];
  let skip = filtered ? 0 : offset;
  const limit = filtered ? 100 : input.pageSize + 1;
  do {
    assertUpstreamScanLimit(skip);
    const response = await execute<{
      genericItems: unknown;
    }>(context, input, voucherListDocument, 'SvaMainserverVoucherList', {
      limit,
      skip,
      search: input.search || undefined,
      categoryId: input.categoryId || undefined,
    });
    const page = z.array(voucherRecordSchema).parse(response.genericItems);
    items.push(
      ...page.filter(
        (item) =>
          (!input.poiId || item.pointOfInterest?.id === input.poiId) &&
          (input.visible === undefined || item.visible === input.visible)
      )
    );
    if (!filtered || page.length < limit) break;
    skip += page.length;
  } while (items.length <= offset + input.pageSize);
  const selected = filtered ? items.slice(offset) : items;
  return {
    data: selected.slice(0, input.pageSize),
    pagination: {
      page: input.page,
      pageSize: input.pageSize,
      hasNextPage: selected.length > input.pageSize,
    },
    fetchedAt: new Date().toISOString(),
  };
};
const getVoucher = async (
  context: VoucherServiceContext,
  input: SvaMainserverConnectionInput & {
    voucherId: string;
  }
): Promise<VoucherRecord> => {
  const response = await execute<{
    genericItem: unknown;
  }>(context, input, voucherDetailDocument, 'SvaMainserverVoucherDetail', { id: input.voucherId });
  if (!response.genericItem)
    throw toSvaMainserverError({
      code: 'not_found',
      message: 'voucher_not_found',
      statusCode: 404,
    });
  return {
    ...voucherRecordSchema.parse(response.genericItem),
    contentFingerprint: voucherContentFingerprint(raw(response.genericItem)),
  };
};
const getPoiVoucherState = async (
  context: VoucherServiceContext,
  input: SvaMainserverConnectionInput & {
    poiId: string;
  }
) => {
  const response = await execute<{
    pointOfInterest: unknown;
    categories: unknown;
  }>(context, input, voucherPoiDocument, 'SvaMainserverVoucherPoi', { id: input.poiId });
  const poi = raw(response.pointOfInterest);
  if (records(poi.vouchers).length) assertVoucherPoiWritable(poi, records(response.categories));
  const snapshot = raw(voucherWriteSnapshot(poi));
  return {
    poi,
    snapshot,
    categories: records(response.categories),
    fingerprint: voucherSnapshotHash({ snapshot, provider: poi.dataProvider }),
  };
};
const getVoucherPoi = async (
  context: VoucherServiceContext,
  input: SvaMainserverConnectionInput & {
    poiId: string;
  }
) => {
  const state = await getPoiVoucherState(context, input);
  assertVoucherPoiWritable(state.poi, state.categories);
  return state;
};
const writeVoucher = async (
  context: VoucherServiceContext,
  input: SvaMainserverConnectionInput & {
    poiId: string;
    voucherId?: string;
    voucher: VoucherInput;
    creationId: string;
    expectedFingerprint: string;
    siblingIdentities?: Readonly<Record<string, string>>;
  }
) => {
  const current = await getVoucherPoi(context, input);
  if (current.fingerprint !== input.expectedFingerprint)
    throw new Error('voucher_content_conflict');
  const { existing, next, uuid, updated, expected } = buildVoucherWrite(current, input);
  await execute(
    context,
    input,
    voucherWriteDocument,
    'SvaMainserverVoucherWrite',
    { ...expected, id: input.poiId },
    false
  );
  const refreshed = await execute<{
    pointOfInterest: unknown;
  }>(context, input, voucherPoiDocument, 'SvaMainserverVoucherPoi', { id: input.poiId });
  if (!voucherWriteMatches(refreshed.pointOfInterest, expected))
    throw new Error('voucher_reconciliation_required');
  const matches = records(raw(refreshed.pointOfInterest).vouchers).filter(
    (item) => item.payload != null && raw(item.payload).id === uuid
  );
  if (matches.length !== 1 || !voucherWriteMatches(matches[0], updated))
    throw new Error('voucher_reconciliation_required');
  const after = records(raw(refreshed.pointOfInterest).vouchers);
  const voucherIdChanges = existing.map((item, i) => {
    const candidate = next[i];
    if (!candidate) throw new Error('voucher_identity_conflict');
    const identity = raw(candidate.payload).id;
    const matches = after.filter(
      (record) => record.payload != null && raw(record.payload).id === identity
    );
    const match = matches[0];
    if (matches.length !== 1 || !match) throw new Error('voucher_reconciliation_required');
    return { previousId: String(item.id), id: String(match.id) };
  });
  return {
    ...voucherRecordSchema.parse(matches[0]),
    contentFingerprint: voucherContentFingerprint(raw(matches[0])),
    voucherIdChanges,
  };
};
// Shared by preparation and writing so recovery checks the same complete aggregate.
export function buildVoucherWrite(
  current: Pick<Awaited<ReturnType<typeof getVoucherPoi>>, 'poi' | 'snapshot'>,
  input: {
    voucherId?: string;
    voucher: VoucherInput;
    creationId: string;
    siblingIdentities?: Readonly<Record<string, string>>;
  }
) {
  const existing = records(current.poi.vouchers);
  const index = input.voucherId ? existing.findIndex((v) => v.id === input.voucherId) : -1;
  if (input.voucherId && index < 0) throw new Error('voucher_content_conflict');
  const currentPayload =
    index < 0 || existing[index]?.payload == null ? {} : raw(existing[index]?.payload);
  const uuid =
    typeof currentPayload.id === 'string' && currentPayload.id
      ? currentPayload.id
      : input.creationId;
  const next = buildSiblingSnapshots(current.snapshot, existing, input.siblingIdentities);
  const controlled = applyVoucherFields(
    index < 0 ? undefined : next[index],
    input.voucher,
    currentPayload,
    uuid
  );
  const updated = index < 0 ? controlled : { ...next[index], ...controlled };
  if (index < 0) next.push(updated);
  else next[index] = updated;
  // Strip read-only values from unchanged siblings using the same field inventory.
  const vouchers = next.map((item) =>
    voucherWriteSnapshot(item, voucherPoiWriteFields.vouchers, false)
  );
  const expected = {
    ...current.snapshot,
    payload: {
      ...withUpdatedPayload(undefined, current.snapshot.payload),
      studioVoucherOperationId: input.creationId,
    },
    vouchers,
  };
  return { existing, next, uuid, updated, expected };
}
export const createVoucherService = (context: VoucherServiceContext) => ({
  listVouchers: (input: Parameters<typeof listVouchers>[1]) => listVouchers(context, input),
  getVoucher: (input: Parameters<typeof getVoucher>[1]) => getVoucher(context, input),
  deleteVoucher: async (input: Parameters<typeof getVoucher>[1]) => {
    await getVoucher(context, input);
    const config = await context.loadValidatedInstanceConfig(input, 'load_instance_config');
    return context.genericItemOperations.destroyGenericItemWithConfig(
      { ...input, genericItemId: input.voucherId, allowRetry: false },
      config
    );
  },
  getPoiVoucherState: (input: Parameters<typeof getPoiVoucherState>[1]) =>
    getPoiVoucherState(context, input),
  getVoucherPoi: (input: Parameters<typeof getVoucherPoi>[1]) => getVoucherPoi(context, input),
  writeVoucher: (input: Parameters<typeof writeVoucher>[1]) => writeVoucher(context, input),
});
function buildSiblingSnapshots(
  snapshot: RawRecord,
  existing: readonly RawRecord[],
  siblingIdentities: Readonly<Record<string, string>> | undefined
) {
  const next: RawRecord[] = records(snapshot.vouchers).map((item, i) => ({
    ...item,
    payload: {
      ...(item.payload == null ? {} : raw(item.payload)),
      id:
        siblingIdentities?.[String(existing[i]?.id)] ??
        (item.payload == null ? randomUUID() : raw(item.payload).id || randomUUID()),
    },
  }));
  return next;
}
function applyVoucherFields(
  previous: RawRecord | undefined,
  voucher: VoucherInput,
  payload: RawRecord,
  uuid: string
) {
  const controlled = {
    ...toVoucherFields({ ...voucher, body: sanitizeRichTextHtml(voucher.body) }),
    payload: { ...payload, id: uuid },
  };
  if (previous) {
    const blocks = records(previous?.contentBlocks ?? []);
    const dates = records(previous?.dates ?? []);
    if (controlled.dates.length)
      controlled.dates = [
        { ...dates[0], ...controlled.dates[0] },
        ...dates.slice(1),
      ] as typeof controlled.dates;
    else
      controlled.dates = dates.map((date, index) =>
        index === 0 ? { ...date, dateStart: null, dateEnd: null } : date
      ) as typeof controlled.dates;
    const media = records(previous?.mediaContents ?? []);
    controlled.mediaContents = controlled.mediaContents.map((item) => {
      const old = media.find((candidate) => raw(candidate.sourceUrl).url === item.sourceUrl.url);
      return {
        ...old,
        ...item,
        ...(old?.payload
          ? { payload: { ...raw(old.payload), ...('payload' in item ? item.payload : {}) } }
          : {}),
        sourceUrl: { ...(old ? raw(old.sourceUrl) : {}), ...item.sourceUrl },
      };
    });
    controlled.contentBlocks = [
      { ...blocks[0], body: controlled.contentBlocks[0]?.body ?? '' },
      ...blocks.slice(1),
    ] as typeof controlled.contentBlocks;
  }
  return controlled;
}
