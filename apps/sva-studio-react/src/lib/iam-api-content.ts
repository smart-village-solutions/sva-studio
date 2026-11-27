import type {
  ApiItemResponse,
  ApiListResponse,
  IamContentDetail,
  IamContentHistoryEntry,
  IamContentListQuery,
  IamContentOwnershipTarget,
  IamContentOwnershipTransferResult,
  TransferIamContentOwnershipInput,
} from '@sva/core';
import { notifyStudioTableDataChanged } from '@sva/plugin-sdk';

import { IAM_HEADERS, patchJson, postJson, requestJson } from './iam-http-client';

import type {
  ContentSelectionItem,
  CreateContentPayload,
  IamContentListResponse,
  MainserverAuthoringDiagnostics,
  RefreshProjectedContentsPayload,
  RefreshProjectedContentsResult,
  UpdateContentPayload,
} from './iam-api-content-types';

const createContentListParams = (query: IamContentListQuery): URLSearchParams => {
  const params = new URLSearchParams({
    page: String(query.page),
    pageSize: String(query.pageSize),
    sortBy: query.sortBy,
    sortDirection: query.sortDirection,
  });

  if (query.q) {
    params.set('q', query.q);
  }
  if (query.type) {
    params.set('type', query.type);
  }
  if (query.type === 'faq.faq' && query.languageCode) {
    params.set('languageCode', query.languageCode);
  }
  if (query.type === 'vouchers.voucher' && query.poiId) {
    params.set('poiId', query.poiId);
  }
  if (query.categoryId) params.set('categoryId', query.categoryId);
  if (query.status) {
    params.set('status', query.status);
  }
  for (const contentType of query.visibleTypes ?? []) {
    params.append('visibleType', contentType);
  }

  return params;
};

export const listContents = (
  query: IamContentListQuery,
  signal?: AbortSignal
): Promise<IamContentListResponse> =>
  requestJson<IamContentListResponse>(`/api/v1/iam/contents?${createContentListParams(query)}`, signal ? { signal } : undefined);

export const listContentSelection = (query: IamContentListQuery): Promise<{ data: readonly ContentSelectionItem[] }> => {
  const params = createContentListParams(query);
  params.set('selection', 'all');
  return requestJson(`/api/v1/iam/contents?${params}`);
};

export const refreshProjectedContents = async (
  payload: RefreshProjectedContentsPayload
): Promise<ApiItemResponse<RefreshProjectedContentsResult>> =>
  postJson<ApiItemResponse<RefreshProjectedContentsResult>, RefreshProjectedContentsPayload>(
    '/api/v1/iam/contents/refresh',
    payload
  );

export const getMainserverAuthoringDiagnostics = async (): Promise<
  ApiItemResponse<MainserverAuthoringDiagnostics>
> =>
  requestJson<ApiItemResponse<MainserverAuthoringDiagnostics>>(
    '/api/v1/iam/contents/mainserver-diagnostics'
  );

export type MainserverMutationCapabilities = Readonly<{
  enabledActions: readonly string[];
}>;

export const getMainserverMutationCapabilities = async (): Promise<
  ApiItemResponse<MainserverMutationCapabilities>
> =>
  requestJson<ApiItemResponse<MainserverMutationCapabilities>>(
    '/api/v1/mainserver/mutation-capabilities'
  );

export const getContent = async (
  contentId: string,
  options: Readonly<{ contentType?: string; signal?: AbortSignal }> = {}
): Promise<ApiItemResponse<IamContentDetail>> => {
  const contentTypeQuery = options.contentType
    ? `?contentType=${encodeURIComponent(options.contentType)}`
    : '';
  return requestJson<ApiItemResponse<IamContentDetail>>(
    `/api/v1/iam/contents/${encodeURIComponent(contentId)}${contentTypeQuery}`,
    options.signal ? { signal: options.signal } : undefined
  );
};

export const getContentHistory = async (
  contentId: string,
  signal?: AbortSignal
): Promise<ApiListResponse<IamContentHistoryEntry>> =>
  requestJson<ApiListResponse<IamContentHistoryEntry>>(
    `/api/v1/iam/contents/${contentId}/history`,
    signal ? { signal } : undefined
  );

const notifyContentsChanged = <T>(response: T): T => {
  notifyStudioTableDataChanged('contents');
  return response;
};

export const createContent = async (
  payload: CreateContentPayload
): Promise<ApiItemResponse<IamContentDetail>> =>
  postJson<ApiItemResponse<IamContentDetail>, CreateContentPayload>(
    '/api/v1/iam/contents',
    payload,
    true
  ).then(notifyContentsChanged);

export const updateContent = async (
  contentId: string,
  payload: UpdateContentPayload
): Promise<ApiItemResponse<IamContentDetail>> =>
  patchJson<ApiItemResponse<IamContentDetail>, UpdateContentPayload>(
    `/api/v1/iam/contents/${contentId}`,
    payload
  ).then(notifyContentsChanged);

export const deleteContent = async (contentId: string): Promise<ApiItemResponse<{ id: string }>> =>
  requestJson<ApiItemResponse<{ id: string }>>(`/api/v1/iam/contents/${contentId}`, {
    method: 'DELETE',
    headers: IAM_HEADERS,
  }).then((response) => {
    notifyStudioTableDataChanged('contents', true);
    return response;
  });

export const listContentOwnershipTargets = async (
  contentId: string,
  query: {
    readonly type: 'account' | 'organization';
    readonly page?: number;
    readonly pageSize?: number;
    readonly q?: string;
  }
): Promise<ApiListResponse<IamContentOwnershipTarget>> => {
  const params = new URLSearchParams({
    type: query.type,
    page: String(query.page ?? 1),
    pageSize: String(query.pageSize ?? 25),
  });
  if (query.q) {
    params.set('q', query.q);
  }
  return requestJson<ApiListResponse<IamContentOwnershipTarget>>(
    `/api/v1/iam/contents/${encodeURIComponent(contentId)}/ownership-targets?${params.toString()}`
  );
};

export const transferContentOwnership = async (
  contentId: string,
  payload: TransferIamContentOwnershipInput
): Promise<ApiItemResponse<IamContentOwnershipTransferResult>> =>
  postJson<ApiItemResponse<IamContentOwnershipTransferResult>, TransferIamContentOwnershipInput>(
    `/api/v1/iam/contents/${encodeURIComponent(contentId)}/transfer-ownership`,
    payload
  ).then(notifyContentsChanged);
