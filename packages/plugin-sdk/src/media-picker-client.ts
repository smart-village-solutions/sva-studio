import { requestJson, type FetchLike } from './http-client.js';
import { parseMediaEditingDocument, type MediaEditingDocument } from '@sva/media';

export type HostMediaAssetListItem = Readonly<{
  id: string;
  fileName?: string;
  metadata?: Readonly<Record<string, unknown>>;
  visibility?: string;
  mimeType?: string;
  previewUrl?: string | null;
  uploadStatus?: string;
  processingStatus?: string;
  deletionPending?: boolean;
}>;

export type HostMediaAssetMetadata = Readonly<{
  tags?: string[];
  title?: string | null;
  description?: string | null;
  altText?: string | null;
  copyright?: string | null;
  license?: string | null;
}>;

export type HostMediaAssetDetail = Readonly<{
  id: string;
  instanceId: string;
  storageKey: string;
  mediaType: 'image';
  mimeType: string;
  byteSize: number;
  visibility: 'public' | 'protected';
  uploadStatus: string;
  processingStatus: string;
  metadata: HostMediaAssetMetadata;
  technical: Readonly<Record<string, unknown>>;
  createdAt?: string;
  updatedAt?: string;
  previewUrl?: string | null;
  hasEditingDocument?: boolean;
  deletionPending?: boolean;
}>;

export type HostMediaEditingData = Readonly<{
  assetId: string;
  sourceAssetId: string;
  sourceUrl: string;
  sourceExpiresAt: string;
  document?: MediaEditingDocument;
}>;

export const getHostMediaEditing = async (input: {
  readonly fetch: FetchLike;
  readonly assetId: string;
  readonly instanceId?: string;
  readonly signal?: AbortSignal;
}): Promise<HostMediaEditingData> => {
  const query = new URLSearchParams();
  if (input.instanceId) query.set('instanceId', input.instanceId);
  const response = await requestJson<{ data: HostMediaEditingData }>({
    fetch: input.fetch,
    url: `/api/v1/iam/media/${encodeURIComponent(input.assetId)}/editing${query.size ? `?${query}` : ''}`,
    init: { signal: input.signal, cache: 'no-store' },
    errorFactory: (failure) => new Error(`media_editor_http_${failure.status}`),
  });
  return {
    ...response.data,
    document: response.data.document
      ? parseMediaEditingDocument(response.data.document)
      : undefined,
  };
};

export type HostMediaDelivery = Readonly<{
  deliveryUrl: string;
  expiresAt: string;
  contentType?: string;
  isPublicUrl?: boolean;
}>;

export const getHostMediaAssetFileName = (
  asset: Pick<HostMediaAssetDetail, 'id' | 'storageKey'>
): string => {
  const storageKeyParts = asset.storageKey.split('/');
  const fileName = storageKeyParts[storageKeyParts.length - 1]?.trim();
  return fileName || asset.id;
};

export type UpdateHostMediaMetadataInput = Readonly<{
  tags?: string[];
  title?: string | null;
  description?: string | null;
  altText?: string | null;
  copyright?: string | null;
  license?: string | null;
}>;

export type HostMediaReferenceSelection = Readonly<{
  id?: string;
  assetId: string;
  role: string;
  sortOrder?: number;
}>;

export const listHostMediaAssets = async (input: {
  readonly fetch: FetchLike;
  readonly search?: string;
  readonly tag?: string;
  readonly signal?: AbortSignal;
  readonly visibility?: 'public' | 'protected';
  readonly instanceId?: string;
}): Promise<readonly HostMediaAssetListItem[]> => {
  const searchParams = new URLSearchParams();
  if (input.tag) searchParams.set('tag', input.tag);
  if (input.search) {
    searchParams.set('search', input.search);
  }
  if (input.visibility) {
    searchParams.set('visibility', input.visibility);
  }
  if (input.instanceId) {
    searchParams.set('instanceId', input.instanceId);
  }

  const response = await requestJson<{ data: readonly HostMediaAssetListItem[] }>({
    fetch: input.fetch,
    url: `/api/v1/iam/media${searchParams.size > 0 ? `?${searchParams.toString()}` : ''}`,
    init: input.signal ? { signal: input.signal } : undefined,
    errorFactory: (failingResponse) => new Error(`media_picker_http_${failingResponse.status}`),
  });
  return response.data.filter(
    (asset) =>
      asset.uploadStatus === 'processed' &&
      asset.processingStatus === 'ready' &&
      !asset.deletionPending
  );
};

export const getHostMediaAsset = async (input: {
  readonly fetch: FetchLike;
  readonly assetId: string;
  readonly instanceId?: string;
  readonly signal?: AbortSignal;
}): Promise<HostMediaAssetDetail> => {
  const searchParams = new URLSearchParams();
  if (input.instanceId) {
    searchParams.set('instanceId', input.instanceId);
  }

  const response = await requestJson<{ data: HostMediaAssetDetail }>({
    fetch: input.fetch,
    url: `/api/v1/iam/media/${encodeURIComponent(input.assetId)}${
      searchParams.size > 0 ? `?${searchParams.toString()}` : ''
    }`,
    errorFactory: (failingResponse) => new Error(`media_picker_http_${failingResponse.status}`),
    init: { signal: input.signal },
  });
  return response.data;
};

export const getHostMediaDelivery = async (input: {
  readonly fetch: FetchLike;
  readonly assetId: string;
  readonly instanceId?: string;
}): Promise<HostMediaDelivery> => {
  const searchParams = new URLSearchParams();
  if (input.instanceId) searchParams.set('instanceId', input.instanceId);
  const response = await requestJson<{ data: HostMediaDelivery }>({
    fetch: input.fetch,
    url: `/api/v1/iam/media/${encodeURIComponent(input.assetId)}/delivery${
      searchParams.size > 0 ? `?${searchParams.toString()}` : ''
    }`,
    errorFactory: (failingResponse) => new Error(`media_picker_http_${failingResponse.status}`),
  });
  return response.data;
};

export const updateHostMediaAsset = async (input: {
  readonly fetch: FetchLike;
  readonly assetId: string;
  readonly metadata: UpdateHostMediaMetadataInput;
  readonly visibility?: 'public' | 'protected';
  readonly instanceId?: string;
}): Promise<HostMediaAssetDetail> => {
  const searchParams = new URLSearchParams();
  if (input.instanceId) {
    searchParams.set('instanceId', input.instanceId);
  }

  const response = await requestJson<{ data: HostMediaAssetDetail }>({
    fetch: input.fetch,
    url: `/api/v1/iam/media/${encodeURIComponent(input.assetId)}${
      searchParams.size > 0 ? `?${searchParams.toString()}` : ''
    }`,
    errorFactory: (failingResponse) => new Error(`media_picker_http_${failingResponse.status}`),
    init: {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify({
        ...(input.instanceId ? { instanceId: input.instanceId } : {}),
        ...(input.visibility ? { visibility: input.visibility } : {}),
        metadata: input.metadata,
      }),
    },
  });
  return response.data;
};

export const listHostMediaReferencesByTarget = async (input: {
  readonly fetch: FetchLike;
  readonly targetType: string;
  readonly targetId: string;
  readonly instanceId?: string;
}): Promise<readonly HostMediaReferenceSelection[]> => {
  const searchParams = new URLSearchParams({
    targetType: input.targetType,
    targetId: input.targetId,
  });
  if (input.instanceId) {
    searchParams.set('instanceId', input.instanceId);
  }
  const response = await requestJson<{ data: readonly HostMediaReferenceSelection[] }>({
    fetch: input.fetch,
    url: `/api/v1/iam/media/references?${searchParams.toString()}`,
    errorFactory: (failingResponse) => new Error(`media_picker_http_${failingResponse.status}`),
  });
  return response.data;
};

export const replaceHostMediaReferences = async (input: {
  readonly fetch: FetchLike;
  readonly targetType: string;
  readonly targetId: string;
  readonly references: readonly HostMediaReferenceSelection[];
  readonly instanceId?: string;
}): Promise<{
  readonly targetType: string;
  readonly targetId: string;
  readonly references: readonly HostMediaReferenceSelection[];
}> => {
  const response = await requestJson<{
    data: {
      readonly targetType: string;
      readonly targetId: string;
      readonly references: readonly HostMediaReferenceSelection[];
    };
  }>({
    fetch: input.fetch,
    url: '/api/v1/iam/media/references',
    errorFactory: (failingResponse) => new Error(`media_picker_http_${failingResponse.status}`),
    init: {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify({
        instanceId: input.instanceId,
        targetType: input.targetType,
        targetId: input.targetId,
        references: input.references,
      }),
    },
  });
  return response.data;
};
