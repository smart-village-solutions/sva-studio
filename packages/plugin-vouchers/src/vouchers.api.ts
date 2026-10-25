import {
  createMainserverMutationHeaders,
  createMainserverReadHeaders,
  requestMainserverJson,
  type MainserverActingPrincipalType,
} from '@sva/plugin-sdk';
import type { VoucherInput, VoucherRecord } from './vouchers.types.js';
export type VoucherPreparation = Readonly<{
  preparationId: string;
  baseFingerprint?: string;
  payloadHash: string;
  voucherIdentity: string;
  preparationFingerprint: string;
  poiId: string;
  poiName: string;
  requiresReset: boolean;
  affected: readonly Readonly<{
    id: string;
    title: string;
  }>[];
}>;
export type VoucherList = Readonly<{
  data: readonly VoucherRecord[];
  pagination: Readonly<{
    page: number;
    pageSize: number;
    hasNextPage: boolean;
  }>;
  fetchedAt: string;
}>;
const base = '/api/v1/mainserver/vouchers';
export const listVouchers = (
  page: number,
  search: string,
  principal?: MainserverActingPrincipalType,
  filters: Readonly<{
    poiId?: string;
    categoryId?: string;
    visible?: string;
  }> = {}
) => {
  const query = new URLSearchParams({ page: String(page), pageSize: '25', search });
  for (const [key, value] of Object.entries(filters)) if (value) query.set(key, value);
  return requestMainserverJson<VoucherList>({
    url: `${base}?${query}`,
    init: { headers: principal ? createMainserverReadHeaders(principal) : undefined },
  });
};
export const getVoucher = (id: string, principal: MainserverActingPrincipalType) =>
  requestMainserverJson<{
    data: VoucherRecord;
    meta: {
      access: Readonly<Record<string, boolean>>;
    };
    fetchedAt: string;
  }>({
    url: `${base}/${encodeURIComponent(id)}`,
    init: { headers: createMainserverReadHeaders(principal) },
  });
export const prepareVoucher = (
  voucher: VoucherInput,
  voucherId: string | undefined,
  principal: MainserverActingPrincipalType,
  baseFingerprint?: string
) =>
  requestMainserverJson<{
    data: VoucherPreparation;
  }>({
    url: `${base}/prepare`,
    init: {
      method: 'POST',
      headers: createMainserverMutationHeaders(principal),
      body: JSON.stringify({ voucher, ...(voucherId ? { voucherId, baseFingerprint } : {}) }),
    },
  });
export const commitVoucher = (
  voucher: VoucherInput,
  voucherId: string | undefined,
  preparation: VoucherPreparation,
  principal: MainserverActingPrincipalType
) =>
  requestMainserverJson<{
    data: VoucherRecord;
    meta: {
      reset: boolean;
    };
  }>({
    url: `${base}/commit`,
    init: {
      method: 'POST',
      headers: createMainserverMutationHeaders(principal, undefined, preparation.preparationId),
      body: JSON.stringify({
        voucher,
        ...(voucherId ? { voucherId, baseFingerprint: preparation.baseFingerprint } : {}),
        preparationId: preparation.preparationId,
        preparationFingerprint: preparation.preparationFingerprint,
        confirmed: true,
      }),
    },
  });
export const changeVoucherVisibility = (
  id: string,
  visible: boolean,
  principal: MainserverActingPrincipalType
) =>
  requestMainserverJson<{
    data: VoucherRecord;
  }>({
    url: `${base}/${encodeURIComponent(id)}/visibility`,
    init: {
      method: 'POST',
      headers: createMainserverMutationHeaders(principal),
      body: JSON.stringify({ visible }),
    },
  });
export const listVoucherLocations = (page: number, principal: MainserverActingPrincipalType) =>
  requestMainserverJson<{
    data: readonly Readonly<{
      id: string;
      name: string;
    }>[];
    pagination: {
      hasNextPage: boolean;
    };
  }>({
    url: `${base}/locations?page=${page}&pageSize=100`,
    init: { headers: createMainserverReadHeaders(principal) },
  });
export const listVoucherCategories = () =>
  requestMainserverJson<{
    data: readonly Readonly<{
      id: string;
      name: string;
    }>[];
  }>({ url: '/api/v1/mainserver/categories?dataType=generic_item_voucher' });
export const reconcileVoucher = (
  preparation: Pick<VoucherPreparation, 'preparationId' | 'payloadHash'>,
  principal: MainserverActingPrincipalType
) =>
  requestMainserverJson<{
    data: VoucherRecord;
  }>({
    url: `${base}/reconcile`,
    init: {
      method: 'POST',
      headers: createMainserverMutationHeaders(principal, undefined, preparation.preparationId),
      body: JSON.stringify({
        preparationId: preparation.preparationId,
        payloadHash: preparation.payloadHash,
      }),
    },
  });
