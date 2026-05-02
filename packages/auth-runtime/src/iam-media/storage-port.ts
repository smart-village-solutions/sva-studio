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
  storageKey: string;
  visibility: string;
}>;

export type ReadMediaObjectInput = Readonly<{
  instanceId: string;
  storageKey: string;
}>;

export type WriteMediaObjectInput = Readonly<{
  instanceId: string;
  storageKey: string;
  body: Uint8Array;
  contentType: string;
}>;

export type DeleteMediaObjectInput = Readonly<{
  instanceId: string;
  storageKey: string;
}>;

export type MediaStoragePort = {
  prepareUpload(input: PrepareMediaUploadInput): Promise<MediaUploadPreparation>;
  resolveDelivery(input: ResolveMediaDeliveryInput): Promise<MediaDeliveryResolution>;
  readObject(input: ReadMediaObjectInput): Promise<{
    body: Uint8Array;
    byteSize: number;
    contentType?: string;
    etag?: string;
  }>;
  writeObject(input: WriteMediaObjectInput): Promise<{
    byteSize: number;
    etag?: string;
  }>;
  deleteObject(input: DeleteMediaObjectInput): Promise<void>;
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
  async readObject() {
    throw new MediaStorageUnavailableError();
  },
  async writeObject() {
    throw new MediaStorageUnavailableError();
  },
  async deleteObject() {
    throw new MediaStorageUnavailableError();
  },
});
