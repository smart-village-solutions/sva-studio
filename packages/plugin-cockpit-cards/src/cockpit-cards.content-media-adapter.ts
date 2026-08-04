import type { ContentMediaUsage } from '@sva/studio-ui-react';

import type { CockpitCardMedia } from './cockpit-cards.types.js';

type ReferenceAlignment = Readonly<{
  assetId?: string;
  status: ContentMediaUsage['referenceStatus'];
}>;

const knownKeys = new Set(['sourceUrl', 'contentType', 'captionText', 'copyright']);
const sourceUrlAdditionalDataKey = 'cockpitCardSourceUrlAdditionalData';

export const cockpitCardMediaToUsages = (
  media: readonly CockpitCardMedia[],
  references: readonly ReferenceAlignment[] = []
): readonly ContentMediaUsage[] =>
  media.map((item, sortOrder) => {
    const reference = references[sortOrder];
    const sourceUrlAdditionalData = Object.fromEntries(
      Object.entries(item.sourceUrl).filter(([key]) => key !== 'url' && key !== 'description')
    );
    const additionalData = {
      ...Object.fromEntries(
      Object.entries(item).filter(([key]) => !knownKeys.has(key))
      ),
      ...(Object.keys(sourceUrlAdditionalData).length > 0 ? { [sourceUrlAdditionalDataKey]: sourceUrlAdditionalData } : {}),
    };
    return {
      uiId: `cockpit-card-media-${sortOrder}-${reference?.assetId ?? 'manual'}`,
      ...(reference?.assetId ? { assetId: reference.assetId } : {}),
      persistentUrl: item.sourceUrl.url,
      altText: item.sourceUrl.description ?? '',
      caption: item.captionText ?? '',
      credit: item.copyright ?? '',
      role: 'gallery_item',
      sortOrder,
      additionalData,
      referenceStatus: reference?.status ?? 'synced',
    };
  });

export const cockpitCardUsagesToMedia = (usages: readonly ContentMediaUsage[]): readonly CockpitCardMedia[] =>
  usages.map((usage) => {
    const { [sourceUrlAdditionalDataKey]: sourceUrlAdditionalData, ...additionalData } = usage.additionalData ?? {};
    return {
    ...additionalData,
    sourceUrl: {
      ...(sourceUrlAdditionalData && typeof sourceUrlAdditionalData === 'object' && !Array.isArray(sourceUrlAdditionalData) ? sourceUrlAdditionalData : {}),
      url: usage.persistentUrl,
      ...(usage.altText ? { description: usage.altText } : {}),
    },
    contentType: 'image' as const,
    ...(usage.caption ? { captionText: usage.caption } : {}),
    ...(usage.credit ? { copyright: usage.credit } : {}),
  };
  });
