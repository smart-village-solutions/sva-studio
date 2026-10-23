import sharp from 'sharp';
import { fileTypeFromBuffer } from 'file-type';
import {
  getMediaEditingResources,
  mediaEditingLimits,
  parseMediaEditingDocument,
  type MediaEditingDocument,
} from '@sva/media';

import { scanConfiguredMedia } from './clamav.js';
import type { MediaService } from './service.js';
import type { MediaStoragePort } from './storage-port.js';

type Asset = NonNullable<Awaited<ReturnType<MediaService['getAssetById']>>>;
type EditingData = Readonly<{
  document: MediaEditingDocument;
  documentBytes: number;
  source?: { body: Uint8Array; contentType: string; extension: string };
}>;

export const getMediaEditingIntakeKeys = (asset: {
  technical?: Readonly<Record<string, unknown>>;
}): readonly string[] => [
  ...new Set(
    [asset.technical?.editingSourceIntakeKey, asset.technical?.editingOutputIntakeKey].filter(
      (key): key is string => typeof key === 'string'
    )
  ),
];

const verifyRaster = async (body: Uint8Array, expectedMime: string): Promise<string> => {
  const detected = await fileTypeFromBuffer(body);
  if (
    !detected ||
    detected.mime !== expectedMime ||
    !['image/jpeg', 'image/png', 'image/webp'].includes(detected.mime)
  ) {
    throw new Error('invalid_media_editor_resource');
  }
  // Decode before accepting persistent resources, including malformed compressed image content.
  await sharp(body, { failOn: 'error' }).resize(1, 1).png().toBuffer();
  return detected.ext;
};

/** Validate private foundations and inline raster resources inside the existing upload processor. */
export const prepareMediaEditingData = async (input: {
  asset: Asset;
  storage: Pick<MediaStoragePort, 'readObject'>;
  scanRequired: boolean;
}): Promise<EditingData | undefined> => {
  if (!input.asset.editingDocument) return undefined;
  const document = parseMediaEditingDocument(input.asset.editingDocument);
  for (const resource of getMediaEditingResources(document)) {
    const separator = resource.indexOf(',');
    const body = Buffer.from(resource.slice(separator + 1), 'base64');
    if (body.byteLength > mediaEditingLimits.resourceBytes)
      throw new Error('invalid_media_editor_resource');
    if (input.scanRequired) await scanConfiguredMedia(body);
    await verifyRaster(body, resource.slice(5, resource.indexOf(';')));
  }
  const documentBytes = Buffer.byteLength(JSON.stringify(document));
  if (!input.asset.editingSourceKey) return { document, documentBytes };
  const declaredBytes = input.asset.technical.editingSourceUploadBytes;
  const declaredMime = input.asset.technical.editingSourceMimeType;
  if (
    typeof declaredBytes !== 'number' ||
    declaredBytes <= 0 ||
    declaredBytes > 64 * 1024 * 1024 ||
    typeof declaredMime !== 'string'
  ) {
    throw new Error('invalid_media_editor_source');
  }
  const source = await input.storage.readObject({
    instanceId: input.asset.instanceId,
    storageKey: input.asset.editingSourceKey,
    maxBytes: declaredBytes,
  });
  if (source.body.byteLength > declaredBytes) throw new Error('upload_size_mismatch');
  if (input.scanRequired) await scanConfiguredMedia(source.body);
  const extension = await verifyRaster(source.body, declaredMime);
  return {
    document,
    documentBytes,
    source: { body: source.body, contentType: declaredMime, extension },
  };
};

/** Remove only an asset's own private editing files, after its primary objects. */
export const deleteMediaEditingObjects = async (
  storage: Pick<MediaStoragePort, 'deleteObject'>,
  instanceId: string,
  asset: {
    storageKey: string;
    editingSourceKey?: string;
    technical?: Readonly<Record<string, unknown>>;
  }
): Promise<void> => {
  const keys = new Set([
    ...getMediaEditingIntakeKeys(asset),
    ...(asset.editingSourceKey ? [asset.editingSourceKey] : []),
  ]);
  keys.delete(asset.storageKey);
  for (const storageKey of keys) await storage.deleteObject({ instanceId, storageKey });
};
