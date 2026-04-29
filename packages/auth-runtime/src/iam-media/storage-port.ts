export type MediaUploadPreparation = Readonly<{
  uploadUrl: string;
  method: 'PUT';
  headers?: Readonly<Record<string, string>>;
  storageKey: string;
  expiresAt: string;
}>;

export type MediaDeliveryResolution = Readonly<{
  deliveryUrl: string;
  expiresAt: string;
  contentType?: string;
}>;

export type PrepareMediaUploadInput = Readonly<{
  instanceId: string;
  assetId: string;
  uploadSessionId: string;
  mediaType: string;
  mimeType: string;
  byteSize: number;
}>;

export type ResolveMediaDeliveryInput = Readonly<{
  instanceId: string;
  assetId: string;
  visibility: string;
}>;

export type MediaStoragePort = {
  prepareUpload(input: PrepareMediaUploadInput): Promise<MediaUploadPreparation>;
  resolveDelivery(input: ResolveMediaDeliveryInput): Promise<MediaDeliveryResolution>;
};

export class MediaStorageUnavailableError extends Error {
  constructor() {
    super('media_storage_unavailable');
    this.name = 'MediaStorageUnavailableError';
  }
}

export const createUnavailableMediaStoragePort = (): MediaStoragePort => ({
  async prepareUpload() {
    throw new MediaStorageUnavailableError();
  },
  async resolveDelivery() {
    throw new MediaStorageUnavailableError();
  },
});
