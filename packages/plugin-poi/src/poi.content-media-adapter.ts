import {
  contentMediaUsagesToMainserver,
  readMainserverMediaFocusPoint,
  type ContentMediaAssetSnapshot,
  type ContentMediaUsage,
} from '@sva/studio-ui-react';

import type { PoiMediaContent } from './poi.content.types.js';

const text = (value: string | undefined) => value?.trim() ?? '';

export const poiMediaContentsToUsages = (
  mediaContents: readonly PoiMediaContent[],
  references: readonly Readonly<{
    assetId?: string;
    status: ContentMediaUsage['referenceStatus'];
  }>[] = []
): readonly ContentMediaUsage[] =>
  mediaContents.map((media, sortOrder) => ({
    uiId: `poi-media-${sortOrder}-${encodeURIComponent(media.sourceUrl?.url ?? '')}`,
    assetId: references[sortOrder]?.assetId,
    persistentUrl: text(media.sourceUrl?.url),
    altText: text(media.sourceUrl?.description),
    caption: text(media.captionText),
    credit: text(media.copyright),
    focusPoint: readMainserverMediaFocusPoint(media.payload),
    role: 'gallery_item',
    sortOrder,
    referenceStatus:
      references[sortOrder]?.status ?? (references.length > 0 ? 'missing' : 'pending'),
    additionalData: {
      original: media,
      contentType: text(media.contentType),
      width: media.width,
      height: media.height,
    },
  }));

export const poiMediaUsagesToContents = (
  usages: readonly ContentMediaUsage[]
): readonly PoiMediaContent[] =>
  contentMediaUsagesToMainserver(usages).map((media) => ({
    ...media,
    width: typeof media.width === 'number' ? media.width : undefined,
    height: typeof media.height === 'number' ? media.height : undefined,
  })) as readonly PoiMediaContent[];

export const poiAssetToUsage = (input: {
  readonly assetId: string;
  readonly mimeType?: string;
  readonly persistentUrl: string;
  readonly previewUrl?: string | null;
  readonly metadata: Readonly<{
    title: string;
    fileName: string;
    altText: string;
    description: string;
    copyright: string;
    license: string;
    focusPoint?: ContentMediaUsage['focusPoint'];
  }>;
  readonly centralMetadata?: Readonly<{
    title: string;
    altText: string;
    description: string;
    copyright: string;
    license: string;
    focusPoint?: ContentMediaUsage['focusPoint'];
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
    focusPoint: input.metadata.focusPoint,
    role: 'gallery_item',
    sortOrder: input.sortOrder,
    assetSnapshot: input.centralMetadata
      ? {
          persistentUrl: input.persistentUrl,
          altText: input.centralMetadata.altText || input.metadata.fileName,
          caption: input.centralMetadata.description || input.centralMetadata.title,
          credit: input.centralMetadata.copyright,
          license: input.centralMetadata.license,
        }
      : snapshot,
    referenceStatus: 'pending',
    additionalData: { contentType: input.mimeType === 'audio/mpeg' ? 'audio' : 'image' },
  };
};
