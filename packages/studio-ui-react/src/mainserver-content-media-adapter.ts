import type { ContentMediaUsage } from './content-media-usage.js';

export type MainserverContentMedia = Readonly<Record<string, unknown>> & {
  readonly captionText?: string;
  readonly copyright?: string;
  readonly contentType?: string;
  readonly height?: number | string;
  readonly width?: number | string;
  readonly sourceUrl?: Readonly<Record<string, unknown>> & {
    readonly url?: string;
    readonly description?: string;
  };
};

export const mainserverContentMediaToUsages = (
  mediaContents: readonly MainserverContentMedia[],
  references: readonly Readonly<{ assetId?: string; status: ContentMediaUsage['referenceStatus'] }>[] = [],
  role = 'gallery_item'
): readonly ContentMediaUsage[] => mediaContents.map((media, sortOrder) => ({
  uiId: `mainserver-media-${sortOrder}-${encodeURIComponent(media.sourceUrl?.url ?? '')}`,
  assetId: references[sortOrder]?.assetId,
  persistentUrl: media.sourceUrl?.url?.trim() ?? '',
  altText: media.sourceUrl?.description?.trim() ?? '',
  caption: media.captionText?.trim() ?? '',
  credit: media.copyright?.trim() ?? '',
  role,
  sortOrder,
  referenceStatus: references[sortOrder]?.status ?? (references.length > 0 ? 'missing' : 'pending'),
  additionalData: { original: media, contentType: media.contentType ?? '', width: media.width, height: media.height },
}));

export const contentMediaUsagesToMainserver = (
  usages: readonly ContentMediaUsage[]
): readonly MainserverContentMedia[] => usages.map((usage) => {
  const original = typeof usage.additionalData?.original === 'object' && usage.additionalData.original !== null
    ? usage.additionalData.original as MainserverContentMedia
    : {};
  const originalSource = typeof original.sourceUrl === 'object' && original.sourceUrl !== null ? original.sourceUrl : {};
  return {
    ...original,
    captionText: usage.caption,
    copyright: usage.credit,
    contentType: typeof usage.additionalData?.contentType === 'string' ? usage.additionalData.contentType : undefined,
    height: typeof usage.additionalData?.height === 'number' || typeof usage.additionalData?.height === 'string'
      ? usage.additionalData.height : undefined,
    width: typeof usage.additionalData?.width === 'number' || typeof usage.additionalData?.width === 'string'
      ? usage.additionalData.width : undefined,
    sourceUrl: { ...originalSource, url: usage.persistentUrl, description: usage.altText },
  };
});
