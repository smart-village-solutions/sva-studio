import type { ContentMediaAssetSnapshot, ContentMediaUsage } from '@sva/studio-ui-react';

import type { PoiMediaContent } from './poi.content.types.js';

const text = (value: string | undefined) => value?.trim() ?? '';

export const poiMediaContentsToUsages = (
  mediaContents: readonly PoiMediaContent[],
  references: readonly Readonly<{ assetId?: string; status: ContentMediaUsage['referenceStatus'] }>[] = []
): readonly ContentMediaUsage[] =>
  mediaContents.map((media, sortOrder) => ({
    uiId: `poi-media-${sortOrder}-${encodeURIComponent(media.sourceUrl?.url ?? '')}`,
    assetId: references[sortOrder]?.assetId,
    persistentUrl: text(media.sourceUrl?.url),
    altText: text(media.sourceUrl?.description),
    caption: text(media.captionText),
    credit: text(media.copyright),
    role: 'gallery_item',
    sortOrder,
    referenceStatus: references[sortOrder]?.status ?? (references.length > 0 ? 'missing' : 'pending'),
    additionalData: {
      original: media,
      contentType: text(media.contentType),
      width: media.width,
      height: media.height,
    },
  }));

export const poiMediaUsagesToContents = (usages: readonly ContentMediaUsage[]): readonly PoiMediaContent[] =>
  usages.map((usage) => ({
    ...(typeof usage.additionalData?.original === 'object' && usage.additionalData.original !== null
      ? usage.additionalData.original
      : {}),
    sourceUrl: { url: usage.persistentUrl, description: usage.altText },
    captionText: usage.caption,
    copyright: usage.credit,
    contentType: typeof usage.additionalData?.contentType === 'string' ? usage.additionalData.contentType : undefined,
    width: typeof usage.additionalData?.width === 'number' ? usage.additionalData.width : undefined,
    height: typeof usage.additionalData?.height === 'number' ? usage.additionalData.height : undefined,
  }));

export const poiAssetToUsage = (input: {
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
  const snapshot: ContentMediaAssetSnapshot = {
    persistentUrl: input.persistentUrl,
    altText: input.metadata.altText || input.metadata.fileName,
    caption: input.metadata.description || input.metadata.title,
    credit: input.metadata.copyright,
    license: input.metadata.license,
  };
  return {
    uiId: `poi-asset-${input.assetId}-${input.sortOrder}`,
    assetId: input.assetId,
    persistentUrl: input.persistentUrl,
    previewUrl: input.previewUrl ?? undefined,
    altText: snapshot.altText,
    caption: snapshot.caption,
    credit: snapshot.credit,
    license: snapshot.license,
    role: 'gallery_item',
    sortOrder: input.sortOrder,
    assetSnapshot: snapshot,
    referenceStatus: 'pending',
    additionalData: { contentType: 'image' },
  };
};
