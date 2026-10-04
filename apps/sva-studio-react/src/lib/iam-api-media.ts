import type { ApiItemResponse } from '@sva/core';

import { IAM_HEADERS, patchJson, postJson, requestJson } from './iam-http-client';

import type {
  CompleteMediaUploadResponse,
  IamMediaAsset,
  IamMediaDelivery,
  IamMediaUsageImpact,
  IamRegisteredMediaAsset,
  InitializeMediaUploadPayload,
  InitializeMediaUploadResponse,
  MediaCursorListResponse,
  MediaListQuery,
  RegisterBucketMediaPayload,
  UpdateMediaPayload,
} from './iam-api-media-types';

export const listMedia = async (
  query: MediaListQuery = {}
): Promise<MediaCursorListResponse<IamMediaAsset>> => {
  const params = new URLSearchParams();

  if (query.search) {
    params.set('search', query.search);
  }
  if (query.visibility && query.visibility !== 'all') {
    params.set('visibility', query.visibility);
  }
  if (query.cursor) {
    params.set('cursor', query.cursor);
  }
  if (typeof query.limit === 'number') {
    params.set('limit', String(query.limit));
  }

  const suffix = params.toString();
  return requestJson<MediaCursorListResponse<IamMediaAsset>>(
    `/api/v1/iam/media${suffix ? `?${suffix}` : ''}`
  );
};

export const getMedia = async (
  assetId: string
): Promise<ApiItemResponse<IamRegisteredMediaAsset>> =>
  requestJson<ApiItemResponse<IamRegisteredMediaAsset>>(`/api/v1/iam/media/${assetId}`);

export const getMediaUsage = async (
  assetId: string
): Promise<ApiItemResponse<IamMediaUsageImpact>> =>
  requestJson<ApiItemResponse<IamMediaUsageImpact>>(`/api/v1/iam/media/${assetId}/usage`);

export const initializeMediaUpload = async (
  payload: InitializeMediaUploadPayload
): Promise<ApiItemResponse<InitializeMediaUploadResponse>> =>
  postJson<ApiItemResponse<InitializeMediaUploadResponse>, InitializeMediaUploadPayload>(
    '/api/v1/iam/media/upload-sessions',
    payload,
    true
  );

export const completeMediaUpload = async (
  uploadSessionId: string
): Promise<ApiItemResponse<CompleteMediaUploadResponse>> =>
  requestJson<ApiItemResponse<CompleteMediaUploadResponse>>(
    `/api/v1/iam/media/upload-sessions/${uploadSessionId}/complete`,
    {
      method: 'POST',
      headers: IAM_HEADERS,
    }
  );

export const registerBucketMedia = async (
  payload: RegisterBucketMediaPayload
): Promise<ApiItemResponse<IamRegisteredMediaAsset>> =>
  postJson<ApiItemResponse<IamRegisteredMediaAsset>, RegisterBucketMediaPayload>(
    '/api/v1/iam/media/register',
    payload,
    true
  );

export const updateMedia = async (
  assetId: string,
  payload: UpdateMediaPayload
): Promise<ApiItemResponse<IamRegisteredMediaAsset>> =>
  patchJson<ApiItemResponse<IamRegisteredMediaAsset>, UpdateMediaPayload>(
    `/api/v1/iam/media/${assetId}`,
    payload
  );

export const getMediaDelivery = async (
  assetId: string
): Promise<ApiItemResponse<IamMediaDelivery>> =>
  requestJson<ApiItemResponse<IamMediaDelivery>>(`/api/v1/iam/media/${assetId}/delivery`);

export const deleteMedia = async (assetId: string): Promise<ApiItemResponse<{ id: string }>> =>
  requestJson<ApiItemResponse<{ id: string }>>(`/api/v1/iam/media/${assetId}`, {
    method: 'DELETE',
    headers: IAM_HEADERS,
  });
