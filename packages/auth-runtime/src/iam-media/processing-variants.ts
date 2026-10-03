import sharp from 'sharp';
import {
  defaultMediaPresets,
  type MediaCrop,
  type MediaFocusPoint,
  type MediaPreset,
} from '@sva/media';
import type { MediaService } from './service.js';
import type { MediaStoragePort } from './storage-port.js';

const buildVariantStorageKey = (input: {
  readonly instanceId: string;
  readonly assetId: string;
  readonly claimToken: string;
  readonly variantKey: string;
  readonly format: string;
}): string =>
  `${input.instanceId}/variants/${input.assetId}/${input.claimToken}/${input.variantKey}.${input.format}`;

export const cleanupReplacedClaimVariants = async (input: {
  readonly storagePort: Pick<MediaStoragePort, 'listObjects' | 'deleteObject'>;
  readonly instanceId: string;
  readonly assetId: string;
  readonly claimToken: string;
}): Promise<void> => {
  const prefix = `${input.instanceId}/variants/${input.assetId}/${input.claimToken}/`;
  let cursor: string | undefined;

  do {
    const page = await input.storagePort.listObjects({
      instanceId: input.instanceId,
      limit: 1000,
      prefix,
      ...(cursor ? { cursor } : {}),
    });
    await Promise.all(
      page.items.map(({ storageKey }) =>
        input.storagePort.deleteObject({ instanceId: input.instanceId, storageKey })
      )
    );
    cursor = page.nextCursor ?? undefined;
  } while (cursor);
};

const isMediaFocusPoint = (value: unknown): value is MediaFocusPoint =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as { x?: unknown }).x === 'number' &&
  typeof (value as { y?: unknown }).y === 'number';

const isMediaCrop = (value: unknown): value is MediaCrop =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as { x?: unknown }).x === 'number' &&
  typeof (value as { y?: unknown }).y === 'number' &&
  typeof (value as { width?: unknown }).width === 'number' &&
  typeof (value as { height?: unknown }).height === 'number';

const readMediaFocusPoint = (
  metadata: Record<string, unknown> | undefined
): MediaFocusPoint | undefined => {
  const focusPoint = metadata?.focusPoint;
  return isMediaFocusPoint(focusPoint) ? focusPoint : undefined;
};

const readMediaCrop = (metadata: Record<string, unknown> | undefined): MediaCrop | undefined => {
  const crop = metadata?.crop;
  return isMediaCrop(crop) ? crop : undefined;
};

const resolvePresetContentType = (format: MediaPreset['format']): string => {
  switch (format) {
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    default:
      return 'image/webp';
  }
};

const createVariantBuffer = async (input: {
  readonly buffer: Uint8Array;
  readonly preset: MediaPreset;
  readonly crop?: MediaCrop;
  readonly focusPoint?: MediaFocusPoint;
}): Promise<Buffer> => {
  const image = sharp(input.buffer, { failOn: 'error' }).rotate();
  const sourceMetadata = await image.metadata();
  const sourceWidth = sourceMetadata.width;
  const sourceHeight = sourceMetadata.height;

  const extractAroundFocusPoint = () => {
    if (!input.focusPoint || !input.preset.height || !sourceWidth || !sourceHeight) {
      return;
    }

    const targetAspectRatio = input.preset.width / input.preset.height;
    const sourceAspectRatio = sourceWidth / sourceHeight;
    if (!Number.isFinite(targetAspectRatio) || !Number.isFinite(sourceAspectRatio)) {
      return;
    }

    if (sourceAspectRatio > targetAspectRatio) {
      const extractWidth = Math.max(
        1,
        Math.min(sourceWidth, Math.round(sourceHeight * targetAspectRatio))
      );
      const focusX = Math.max(0, Math.min(1, input.focusPoint.x));
      const left = Math.max(
        0,
        Math.min(sourceWidth - extractWidth, Math.round(focusX * sourceWidth - extractWidth / 2))
      );
      image.extract({
        left,
        top: 0,
        width: extractWidth,
        height: sourceHeight,
      });
      return;
    }

    if (sourceAspectRatio < targetAspectRatio) {
      const extractHeight = Math.max(
        1,
        Math.min(sourceHeight, Math.round(sourceWidth / targetAspectRatio))
      );
      const focusY = Math.max(0, Math.min(1, input.focusPoint.y));
      const top = Math.max(
        0,
        Math.min(
          sourceHeight - extractHeight,
          Math.round(focusY * sourceHeight - extractHeight / 2)
        )
      );
      image.extract({
        left: 0,
        top,
        width: sourceWidth,
        height: extractHeight,
      });
    }
  };

  if (input.crop) {
    image.extract({
      left: Math.max(0, Math.round(input.crop.x)),
      top: Math.max(0, Math.round(input.crop.y)),
      width: Math.max(1, Math.round(input.crop.width)),
      height: Math.max(1, Math.round(input.crop.height)),
    });
  } else {
    extractAroundFocusPoint();
  }

  const resized = image.resize({
    width: input.preset.width,
    ...(input.preset.height
      ? {
          height: input.preset.height,
          fit: 'cover' as const,
          position: 'centre' as const,
        }
      : {}),
    withoutEnlargement: true,
  });

  switch (input.preset.format) {
    case 'jpeg':
      return resized.jpeg({ quality: 82 }).toBuffer();
    case 'png':
      return resized.png().toBuffer();
    default:
      return resized.webp({ quality: 82 }).toBuffer();
  }
};

export const createMediaVariants = async (input: {
  readonly body: Uint8Array;
  readonly asset: NonNullable<Awaited<ReturnType<MediaService['getAssetById']>>>;
  readonly instanceId: string;
  readonly claimToken: string;
  readonly createId: () => string;
}) => {
  const variantsToPersist: Array<{
    id: string;
    assetId: string;
    variantKey: string;
    presetKey: string;
    format: string;
    width: number;
    height?: number;
    storageKey: string;
    generationStatus: 'ready';
    body: Buffer;
    contentType: string;
  }> = [];

  for (const preset of defaultMediaPresets) {
    const variantBuffer = await createVariantBuffer({
      buffer: input.body,
      preset,
      crop: readMediaCrop(input.asset.metadata),
      focusPoint: readMediaFocusPoint(input.asset.metadata),
    });
    const storageKey = buildVariantStorageKey({
      instanceId: input.instanceId,
      assetId: String(input.asset.id),
      claimToken: input.claimToken,
      variantKey: preset.key,
      format: preset.format,
    });
    const variantMetadata = await sharp(variantBuffer).metadata();
    variantsToPersist.push({
      id: input.createId(),
      assetId: input.asset.id,
      variantKey: preset.key,
      presetKey: preset.key,
      format: preset.format,
      width: variantMetadata.width ?? preset.width,
      height: variantMetadata.height,
      storageKey,
      generationStatus: 'ready',
      body: variantBuffer,
      contentType: resolvePresetContentType(preset.format),
    });
  }

  return variantsToPersist;
};
