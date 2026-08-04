import { isPersistableContentMediaUrl, type ContentMediaAssetSnapshot, type ContentMediaUsage } from '@sva/studio-ui-react';

import type { ProjectImage } from './projects.api-types.js';

type ProjectImageRecord = ProjectImage & Readonly<Record<string, unknown>>;

const text = (value: string | undefined): string => value?.trim() ?? '';

export const resolveProjectPersistentDeliveryUrl = (delivery: Readonly<{
  deliveryUrl: string;
  isPublicUrl?: boolean;
}>): string | null =>
  delivery.isPublicUrl === true && isPersistableContentMediaUrl(delivery.deliveryUrl)
    ? delivery.deliveryUrl
    : null;

export const projectImagesToMediaUsages = (
  images: readonly ProjectImage[],
  references: readonly Readonly<{
    assetId?: string;
    status: ContentMediaUsage['referenceStatus'];
  }>[] = []
): readonly ContentMediaUsage[] =>
  images.map((image, sortOrder) => ({
    uiId: `project-image-${sortOrder}-${encodeURIComponent(image.url)}`,
    assetId: references[sortOrder]?.assetId,
    persistentUrl: text(image.url),
    altText: text(image.altText),
    caption: text(image.caption),
    credit: text(image.credits),
    role: 'gallery_item',
    sortOrder,
    referenceStatus:
      references[sortOrder]?.status ?? (references.length > 0 ? 'missing' : 'pending'),
    additionalData: { original: image },
  }));

export const projectMediaUsagesToImages = (
  usages: readonly ContentMediaUsage[]
): readonly ProjectImage[] =>
  usages.map((usage, position) => ({
    ...(typeof usage.additionalData?.original === 'object' && usage.additionalData.original !== null
      ? (usage.additionalData.original as ProjectImageRecord)
      : {}),
    url: usage.persistentUrl,
    altText: usage.altText,
    ...(usage.caption.trim() ? { caption: usage.caption } : { caption: undefined }),
    ...(usage.credit.trim() ? { credits: usage.credit } : { credits: undefined }),
    position,
  }));

export const projectAssetToMediaUsage = (input: {
  readonly assetId: string;
  readonly persistentUrl: string;
  readonly previewUrl?: string | null;
  readonly metadata: Readonly<{
    title: string;
    fileName: string;
    altText: string;
    description: string;
    copyright: string;
    license: string;
  }>;
  readonly sortOrder: number;
}): ContentMediaUsage => {
  const assetSnapshot: ContentMediaAssetSnapshot = {
    persistentUrl: input.persistentUrl,
    altText: input.metadata.altText || input.metadata.fileName,
    caption: input.metadata.description || input.metadata.title,
    credit: input.metadata.copyright,
    license: input.metadata.license,
  };
  return {
    uiId: `project-asset-${input.assetId}-${input.sortOrder}`,
    assetId: input.assetId,
    persistentUrl: input.persistentUrl,
    previewUrl: input.previewUrl ?? undefined,
    altText: assetSnapshot.altText,
    caption: assetSnapshot.caption,
    credit: assetSnapshot.credit,
    license: assetSnapshot.license,
    role: 'gallery_item',
    sortOrder: input.sortOrder,
    assetSnapshot,
    referenceStatus: 'pending',
  };
};
