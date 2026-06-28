import type { HostMediaAssetListItem, HostMediaReferenceSelection } from '@sva/plugin-sdk';

import type { PoiMediaContent } from './poi.content.types.js';
import { mediaContentFromAsset } from './poi.detail-media.helpers.js';

const legacyPoiImageRoles = new Set(['teaser_image', 'attachment_image']);

export const mapLegacyPoiMediaReferences = (
  references: readonly HostMediaReferenceSelection[],
  assets: readonly HostMediaAssetListItem[]
): readonly PoiMediaContent[] => {
  const assetsById = new Map(assets.map((asset) => [asset.id, asset]));
  const seenUrls = new Set<string>();

  return references
    .filter((reference) => legacyPoiImageRoles.has(reference.role))
    .sort((left, right) => (left.sortOrder ?? 0) - (right.sortOrder ?? 0))
    .flatMap((reference) => {
      const mediaContent = mediaContentFromAsset(assetsById.get(reference.assetId) ?? { id: reference.assetId });
      const url = mediaContent?.sourceUrl?.url?.trim();
      if (!mediaContent || !url || seenUrls.has(url)) {
        return [];
      }
      seenUrls.add(url);
      return [mediaContent];
    });
};
