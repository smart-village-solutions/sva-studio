import {
  contentMediaUsagesToMainserver,
  mainserverContentMediaToUsages,
  type ContentMediaUsage,
} from '@sva/studio-ui-react';

import type { GenericItemMediaContent } from './generic-items.content-types.js';

type ReferenceAlignment = Readonly<{ assetId?: string; status: ContentMediaUsage['referenceStatus'] }>;

export const genericItemMediaContentsToUsages = (
  mediaContents: readonly GenericItemMediaContent[],
  references: readonly ReferenceAlignment[] = []
): readonly ContentMediaUsage[] => mainserverContentMediaToUsages(mediaContents, references, 'gallery_item');

const optionalNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string' || value.trim().length === 0) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

export const genericItemMediaUsagesToContents = (
  usages: readonly ContentMediaUsage[]
): readonly GenericItemMediaContent[] => contentMediaUsagesToMainserver(usages).map((media) => ({
  ...media,
  captionText: typeof media.captionText === 'string' && media.captionText.trim() ? media.captionText.trim() : undefined,
  copyright: typeof media.copyright === 'string' && media.copyright.trim() ? media.copyright.trim() : undefined,
  contentType: typeof media.contentType === 'string' && media.contentType.trim() ? media.contentType.trim() : undefined,
  width: optionalNumber(media.width),
  height: optionalNumber(media.height),
  sourceUrl: typeof media.sourceUrl?.url === 'string' && media.sourceUrl.url.trim()
    ? { ...media.sourceUrl, url: media.sourceUrl.url.trim(), description: typeof media.sourceUrl.description === 'string' && media.sourceUrl.description.trim() ? media.sourceUrl.description.trim() : undefined }
    : undefined,
}));
