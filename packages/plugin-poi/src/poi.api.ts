import {
  createMainserverCrudClient,
  requestMainserverJson,
  translatePluginKey,
} from '@sva/plugin-sdk';
import type { MainserverActingPrincipalType, MainserverMutationOptions } from '@sva/plugin-sdk';

import type {
  PoiCategoryOption,
  PoiContentItem,
  PoiFormInput,
  PoiListQuery,
  PoiListResult,
} from './poi.types.js';

export class PoiApiError extends Error {
  public constructor(
    public readonly code: string,
    message = code
  ) {
    super(code.startsWith('voucher_') && code !== 'voucher_reset_cancelled'
      ? translatePluginKey('poi', ['voucher_outcome_unknown', 'voucher_reconciliation_required'].includes(code) ? 'messages.voucherSaveUnknown' : 'messages.voucherResetUnavailable')
      : message);
    this.name = 'PoiApiError';
  }
}

const poiClient = createMainserverCrudClient<
  PoiContentItem,
  PoiFormInput,
  PoiListResult,
  PoiListResult,
  PoiApiError
>({
  basePath: '/api/v1/mainserver/poi',
  errorFactory: (code, message) => new PoiApiError(code, message),
  mapListResponse: (response) => response,
});

export const listPoi = async (query: PoiListQuery): Promise<PoiListResult> => poiClient.list(query);

export const getPoi = async (contentId: string): Promise<PoiContentItem> =>
  poiClient.get(contentId);
export const getPoiDetail = async (
  contentId: string,
  actingPrincipalType?: MainserverActingPrincipalType
) => poiClient.getDetail(contentId, actingPrincipalType);

export const createPoi = async (
  input: PoiFormInput,
  actingPrincipalType: MainserverActingPrincipalType,
  mutationOptions?: MainserverMutationOptions
): Promise<PoiContentItem> =>
  mutationOptions
    ? poiClient.create(input, actingPrincipalType, mutationOptions)
    : poiClient.create(input, actingPrincipalType);

export const updatePoi = async (
  contentId: string,
  input: PoiFormInput,
  actingPrincipalType: MainserverActingPrincipalType,
  mutationOptions?: MainserverMutationOptions
): Promise<PoiContentItem> => {
  await poiClient.ensureMutationContext(contentId, actingPrincipalType);
  const url = `/api/v1/mainserver/poi/${encodeURIComponent(contentId)}`;
  const prepared = await requestMainserverJson<
    {
      voucherReset: {
        required: boolean;
        id?: string;
        fingerprint?: string;
        affected?: readonly { title: string }[];
      };
    },
    PoiApiError
  >({
    url,
    errorFactory: (code, message) => new PoiApiError(code, message),
    init: {
      method: 'PATCH',
      headers: poiClient.mutationHeaders(contentId, actingPrincipalType, {
        'X-SVA-Voucher-Reset-Mode': 'prepare',
      }),
      body: JSON.stringify(input),
    },
  });
  if (!prepared.voucherReset.required)
    return poiClient.update(contentId, input, actingPrincipalType, mutationOptions);
  const reset = prepared.voucherReset;
  if (
    !reset.id ||
    !reset.fingerprint ||
    !globalThis.confirm(
      translatePluginKey('poi', 'messages.voucherResetConfirmation', {
        vouchers: (reset.affected ?? []).map((item) => item.title).join('\n'),
      })
    )
  )
    throw new PoiApiError(
      'voucher_reset_cancelled',
      translatePluginKey('poi', 'messages.voucherResetCancelled')
    );
  const headers = poiClient.mutationHeaders(
    contentId,
    actingPrincipalType,
    {
      'X-SVA-Voucher-Reset-Id': reset.id,
      'X-SVA-Voucher-Reset-Fingerprint': reset.fingerprint,
    },
    mutationOptions?.operationId
  );
  if (mutationOptions?.contentMediaSaveOperationId)
    headers.set(
      'X-SVA-Content-Media-Save-Operation-Id',
      mutationOptions.contentMediaSaveOperationId
    );
  const response = await requestMainserverJson<{ data: PoiContentItem }, PoiApiError>({
    url,
    errorFactory: (code, message) => new PoiApiError(code, message),
    init: { method: 'PATCH', headers, body: JSON.stringify(input) },
  });
  return response.data;
};

export const deletePoi = async (
  contentId: string,
  actingPrincipalType: MainserverActingPrincipalType
): Promise<void> => poiClient.remove(contentId, actingPrincipalType);

export const listPoiCategories = async (): Promise<readonly PoiCategoryOption[]> => {
  const response = await requestMainserverJson<
    { readonly data: readonly PoiCategoryOption[] },
    PoiApiError
  >({
    url: '/api/v1/mainserver/categories?dataType=point_of_interest',
    errorFactory: (code, message) => new PoiApiError(code, message),
  });

  return response.data;
};
