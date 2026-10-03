import type { MutableRefObject } from 'react';
import {
  getHostMediaAsset,
  getHostMediaDelivery,
  updateHostMediaAsset,
  type HostMediaAssetListItem,
} from '@sva/plugin-sdk';
import {
  isPersistableContentMediaUrl,
  toContentMediaAssetSnapshot,
  type ContentMediaUsage,
} from '@sva/studio-ui-react';
import { toEventsMediaPickerDetail } from './events.detail-media.helpers.js';

export const loadEventsMediaAsset = async (
  assetId: string,
  mediaAssetsRef: MutableRefObject<readonly HostMediaAssetListItem[]>
) => {
  const [detail, delivery] = await Promise.all([
    getHostMediaAsset({ fetch: globalThis.fetch.bind(globalThis), assetId }),
    getHostMediaDelivery({ fetch: globalThis.fetch.bind(globalThis), assetId }),
  ]);
  const summary = mediaAssetsRef.current.find((asset) => asset.id === assetId);
  return toEventsMediaPickerDetail(
    detail,
    summary,
    delivery.isPublicUrl === true && isPersistableContentMediaUrl(delivery.deliveryUrl)
      ? delivery.deliveryUrl
      : null
  );
};

export const saveEventsMediaMetadata = async (
  assetId: string,
  metadata: Parameters<typeof updateHostMediaAsset>[0]['metadata'],
  mediaAssetsRef: MutableRefObject<readonly HostMediaAssetListItem[]>,
  refreshMediaAssets: () => Promise<readonly HostMediaAssetListItem[]>
) => {
  const detail = await updateHostMediaAsset({
    fetch: globalThis.fetch.bind(globalThis),
    assetId,
    visibility: 'public',
    metadata,
  });
  const assets = await refreshMediaAssets();
  mediaAssetsRef.current = assets;
  const summary = mediaAssetsRef.current.find((asset) => asset.id === assetId);
  const delivery = await getHostMediaDelivery({
    fetch: globalThis.fetch.bind(globalThis),
    assetId,
  });
  return toEventsMediaPickerDetail(
    detail,
    summary,
    delivery.isPublicUrl === true && isPersistableContentMediaUrl(delivery.deliveryUrl)
      ? delivery.deliveryUrl
      : null
  );
};

export const loadEventsContentAssetSnapshot = async (usage: ContentMediaUsage) => {
  if (!usage.assetId) throw new Error('asset_unavailable');
  const [detail, delivery] = await Promise.all([
    getHostMediaAsset({ fetch: globalThis.fetch.bind(globalThis), assetId: usage.assetId }),
    getHostMediaDelivery({ fetch: globalThis.fetch.bind(globalThis), assetId: usage.assetId }),
  ]);
  if (delivery.isPublicUrl !== true || !isPersistableContentMediaUrl(delivery.deliveryUrl))
    throw new Error('asset_unavailable');
  return toContentMediaAssetSnapshot({
    persistentUrl: delivery.deliveryUrl,
    altText: detail.metadata.altText ?? '',
    caption: detail.metadata.description ?? '',
    credit: detail.metadata.copyright ?? '',
    license: detail.metadata.license ?? '',
  });
};
