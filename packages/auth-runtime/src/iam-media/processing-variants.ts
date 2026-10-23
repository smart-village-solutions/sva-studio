import sharp from 'sharp';
import {
  defaultMediaPresets,
  resolveMediaFocusCrop,
  type MediaCrop,
  type MediaFocusPoint,
  type MediaPreset,
} from '@sva/media';
import type { MediaService } from './service.js';
import type { MediaStoragePort } from './storage-port.js';
import { mediaProcessingPrefix } from './storage-key-paths.js';

const buildVariantStorageKey = (input: {
  readonly instanceId: string;
  readonly assetId: string;
  readonly claimToken: string;
  readonly variantKey: string;
  readonly format: string;
  readonly privateOutput?: boolean;
}): string =>
  `${mediaProcessingPrefix(input.instanceId, input.assetId, input.claimToken, input.privateOutput)}${input.variantKey}.${input.format}`;

export const cleanupReplacedClaimVariants = async (input: {
  readonly storagePort: Pick<MediaStoragePort, 'listObjects' | 'deleteObject'>;
  readonly instanceId: string;
  readonly assetId: string;
  readonly claimToken: string;
  readonly privateOutput?: boolean;
  readonly privateSource?: boolean;
}): Promise<void> => {
  const prefixes = [
    mediaProcessingPrefix(input.instanceId, input.assetId, input.claimToken, input.privateOutput),
  ];
  if (input.privateSource && !input.privateOutput)
    prefixes.push(mediaProcessingPrefix(input.instanceId, input.assetId, input.claimToken, true));
  for (const prefix of prefixes) {
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
  }
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

  if (input.crop) {
    image.extract({
      left: Math.max(0, Math.round(input.crop.x)),
      top: Math.max(0, Math.round(input.crop.y)),
      width: Math.max(1, Math.round(input.crop.width)),
      height: Math.max(1, Math.round(input.crop.height)),
    });
  } else {
    if (input.focusPoint && sourceWidth && sourceHeight) {
      const focused = resolveMediaFocusCrop(
        sourceWidth,
        sourceHeight,
        input.preset,
        input.focusPoint
      );
      if (focused) image.extract(focused);
    }
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
  readonly privateOutput?: boolean;
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
      privateOutput: input.privateOutput,
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
