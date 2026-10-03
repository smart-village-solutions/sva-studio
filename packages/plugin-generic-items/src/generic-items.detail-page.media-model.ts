import type React from 'react';
import {
  getHostMediaAssetFileName,
  getHostMediaAsset,
  getHostMediaDelivery,
  readHostMediaAssetFileName as readAssetFileName,
  readHostMediaAssetTitle as readAssetTitle,
  type HostMediaAssetDetail,
} from '@sva/plugin-sdk';
import {
  isPersistableContentMediaUrl,
  ContentMediaUsageBlock,
  toContentMediaAssetSnapshot,
  type ContentMediaUsage,
  type StudioMediaPickerAssetDetail,
  type StudioMediaPickerAssetSummary,
} from '@sva/studio-ui-react';
import type { useForm } from 'react-hook-form';
import type { GenericItemsDetailFormValues } from './generic-items.validation.js';

const getFieldErrorMessage = (error: unknown): string | undefined => {
  if (typeof error !== 'object' || error === null || !('message' in error)) {
    return undefined;
  }

  return typeof error.message === 'string' && error.message.length > 0 ? error.message : undefined;
};

export const createSummaryErrors = (
  errors: ReturnType<typeof useForm<GenericItemsDetailFormValues>>['formState']['errors']
) => {
  const entries = [
    getFieldErrorMessage(errors.title)
      ? { field: 'generic-item-title', message: getFieldErrorMessage(errors.title) }
      : null,
    getFieldErrorMessage(errors.genericType)
      ? { field: 'generic-item-type', message: getFieldErrorMessage(errors.genericType) }
      : null,
    getFieldErrorMessage(errors.categories)
      ? { field: 'generic-item-categories', message: getFieldErrorMessage(errors.categories) }
      : null,
    getFieldErrorMessage(errors.payloadText)
      ? { field: 'generic-item-payload', message: getFieldErrorMessage(errors.payloadText) }
      : null,
  ];

  return entries.filter((entry): entry is { field: string; message: string } => entry !== null);
};

export type GenericItemsMediaPickerAsset = StudioMediaPickerAssetDetail;
export const genericItemsMediaReferenceTargetType = 'generic-items.generic-item';

export const resolveGenericItemsPersistentDeliveryUrl = (
  delivery: Readonly<{ deliveryUrl: string; isPublicUrl?: boolean }>
): string | null =>
  delivery.isPublicUrl === true && isPersistableContentMediaUrl(delivery.deliveryUrl)
    ? delivery.deliveryUrl
    : null;

export const toGenericItemsMediaPickerSummary = (
  asset: Parameters<typeof readAssetTitle>[0]
): StudioMediaPickerAssetSummary => ({
  id: asset.id,
  title: readAssetTitle(asset),
  fileName: readAssetFileName(asset),
  previewUrl: asset.previewUrl,
  mimeType: asset.mimeType,
  visibility: asset.visibility,
});

export const toGenericItemsMediaPickerDetail = (
  asset: HostMediaAssetDetail,
  summary?: Parameters<typeof readAssetTitle>[0],
  persistentUrl?: string | null
): GenericItemsMediaPickerAsset => {
  const fileName = summary ? readAssetFileName(summary) : getHostMediaAssetFileName(asset);
  const title = asset.metadata.title?.trim() || (summary ? readAssetTitle(summary) : fileName);

  return {
    id: asset.id,
    title,
    fileName,
    previewUrl: asset.previewUrl?.trim() || summary?.previewUrl?.trim() || null,
    persistentUrl: persistentUrl ?? undefined,
    mimeType: asset.mimeType,
    visibility: asset.visibility,
    metadata: {
      title,
      altText: asset.metadata.altText?.trim() ?? '',
      description: asset.metadata.description?.trim() ?? '',
      copyright: asset.metadata.copyright?.trim() ?? '',
      license: asset.metadata.license?.trim() ?? '',
    },
  };
};

export const createSelectedMediaUsage = (
  asset: GenericItemsMediaPickerAsset,
  persistentUrl: string,
  contentType: string,
  sortOrder: number
): ContentMediaUsage => ({
  uiId: `generic-item-asset-${asset.id}-${sortOrder}`,
  assetId: asset.localDraft ? undefined : asset.id,
  localDraft: asset.localDraft,
  persistentUrl,
  previewUrl: asset.previewUrl ?? undefined,
  altText: asset.metadata.altText || asset.fileName,
  caption: asset.metadata.description || asset.title,
  credit: asset.metadata.copyright,
  license: asset.metadata.license,
  role: 'gallery_item',
  sortOrder,
  additionalData: { contentType, width: '', height: '' },
  assetSnapshot: toContentMediaAssetSnapshot({
    persistentUrl,
    altText: asset.metadata.altText || asset.fileName,
    caption: asset.metadata.description || asset.title,
    credit: asset.metadata.copyright,
    license: asset.metadata.license,
  }),
  referenceStatus: 'pending',
});

export const loadGenericItemsAssetSnapshot: NonNullable<
  React.ComponentProps<typeof ContentMediaUsageBlock>['onLoadAssetSnapshot']
> = async (usage) => {
  if (!usage.assetId) throw new Error('asset_unavailable');
  const [detail, delivery] = await Promise.all([
    getHostMediaAsset({ fetch: globalThis.fetch.bind(globalThis), assetId: usage.assetId }),
    getHostMediaDelivery({ fetch: globalThis.fetch.bind(globalThis), assetId: usage.assetId }),
  ]);
  const persistentUrl = resolveGenericItemsPersistentDeliveryUrl(delivery);
  if (!persistentUrl) throw new Error('asset_unavailable');
  return toContentMediaAssetSnapshot({
    persistentUrl,
    altText: detail.metadata.altText ?? '',
    caption: detail.metadata.description ?? detail.metadata.title ?? '',
    credit: detail.metadata.copyright ?? '',
    license: detail.metadata.license ?? '',
  });
};
