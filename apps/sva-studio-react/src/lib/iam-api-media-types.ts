export type MediaVisibility = 'public' | 'protected';

export type MediaUploadStatus = 'pending' | 'validated' | 'processed' | 'failed' | 'blocked';

export type MediaProcessingStatus = 'pending' | 'ready' | 'failed';

export type MediaMetadata = Readonly<{
  title?: string;
  description?: string;
  altText?: string;
  copyright?: string;
  license?: string;
  focusPoint?: Readonly<{
    x: number;
    y: number;
  }>;
  crop?: Readonly<{
    x: number;
    y: number;
    width: number;
    height: number;
  }>;
}>;

export type IamRegisteredMediaAsset = Readonly<{
  id: string;
  instanceId: string;
  storageKey: string;
  mediaType: 'image';
  mimeType: string;
  byteSize: number;
  visibility: MediaVisibility;
  uploadStatus: MediaUploadStatus;
  processingStatus: MediaProcessingStatus;
  metadata: MediaMetadata;
  technical: Readonly<Record<string, unknown>>;
  createdAt?: string;
  updatedAt?: string;
  previewUrl?: string | null;
}>;

export type IamUnregisteredMediaAsset = Readonly<{
  source: 'bucket';
  registrationStatus: 'unregistered';
  storageKey: string;
  fileName: string;
  folderPath: string;
  relativePath: string;
  byteSize: number;
  updatedAt?: string | null;
  lastModified?: string | null;
  previewUrl?: string | null;
}>;

export type IamMediaAsset = IamRegisteredMediaAsset | IamUnregisteredMediaAsset;

export type IamMediaUsageReference = Readonly<{
  id: string;
  assetId: string;
  targetType: string;
  targetId: string;
  role: string;
  sortOrder?: number;
  createdAt?: string;
}>;

export type IamMediaUsageImpact = Readonly<{
  assetId: string;
  totalReferences: number;
  references: readonly IamMediaUsageReference[];
}>;

export type InitializeMediaUploadPayload = Readonly<{
  mediaType?: 'image';
  mimeType: string;
  byteSize: number;
  visibility?: MediaVisibility;
}>;

export type InitializeMediaUploadResponse = Readonly<{
  assetId: string;
  uploadSessionId: string;
  uploadUrl: string;
  method: string;
  headers: Readonly<Record<string, string>>;
  expiresAt: string;
  status: string;
  initializedAt: string;
}>;

export type CompleteMediaUploadResponse = Readonly<{
  assetId: string;
  uploadSessionId: string;
  status: string;
}>;

export type UpdateMediaMetadataPayload = Readonly<{
  title?: string | null;
  description?: string | null;
  altText?: string | null;
  copyright?: string | null;
  license?: string | null;
  focusPoint?: MediaMetadata['focusPoint'] | null;
  crop?: MediaMetadata['crop'] | null;
}>;

export type UpdateMediaPayload = Readonly<{
  visibility?: MediaVisibility;
  metadata: UpdateMediaMetadataPayload;
}>;

export type RegisterBucketMediaPayload = Readonly<{
  instanceId?: string;
  storageKey: string;
  fileName: string;
  byteSize: number;
  mimeType: string;
  visibility?: MediaVisibility;
  metadata?: UpdateMediaMetadataPayload;
}>;

export type IamMediaDelivery = Readonly<{
  assetId: string;
  visibility: MediaVisibility;
  deliveryUrl: string;
  expiresAt?: string;
}>;

export type MediaListQuery = {
  readonly search?: string;
  readonly visibility?: MediaVisibility | 'all';
  readonly cursor?: string;
  readonly limit?: number;
};

export type MediaCursorListResponse<T> = Readonly<{
  data: readonly T[];
  pagination: Readonly<{
    limit: number;
    nextCursor: string | null;
    hasNextPage: boolean;
  }>;
  requestId?: string;
}>;

export const isRegisteredMediaAsset = (asset: IamMediaAsset): asset is IamRegisteredMediaAsset =>
  'id' in asset;

export const getMediaLibraryItemKey = (asset: IamMediaAsset): string =>
  isRegisteredMediaAsset(asset) ? asset.id : asset.storageKey;
