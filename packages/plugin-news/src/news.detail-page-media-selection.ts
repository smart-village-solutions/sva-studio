import * as React from 'react';
import type { UseFormReturn } from 'react-hook-form';
import {
  isPersistableContentMediaUrl,
  toContentMediaAssetSnapshot,
  type ContentMediaUsage,
} from '@sva/studio-ui-react';
import { mediaContentFromAsset, mediaContentSourceKey } from './news.detail-media.helpers.js';
import type { NewsMediaPickerAsset } from './news.detail-page.helpers.js';
import type { HostMediaAssetListItem } from '@sva/plugin-sdk';
import type { NewsDetailFormValues } from './news.types.js';

export const isNewsAssetSelectable = (
  asset: NewsMediaPickerAsset,
  mediaUsages: readonly ContentMediaUsage[],
  methods: UseFormReturn<NewsDetailFormValues>
) => {
  if (asset.localDraft) return mediaUsages.every((usage) => usage.localDraft?.id !== asset.id);
  if (!asset.persistentUrl) return mediaUsages.every((usage) => usage.assetId !== asset.id);
  if (!isPersistableContentMediaUrl(asset.persistentUrl)) return false;
  const nextMedia = mediaContentFromAsset({
    id: asset.id,
    fileName: asset.fileName,
    metadata: asset.metadata,
    visibility: asset.visibility,
    mimeType: asset.mimeType,
    previewUrl: asset.previewUrl,
  });
  if (!nextMedia) {
    return false;
  }

  const existingSources = new Set(
    (methods.getValues('contentMedia') ?? []).map(mediaContentSourceKey).filter(Boolean)
  );
  return existingSources.has(mediaContentSourceKey(nextMedia)) === false;
};

export const acceptNewsMediaAsset = (
  asset: NewsMediaPickerAsset,
  methods: UseFormReturn<NewsDetailFormValues>,
  setMediaUsages: React.Dispatch<React.SetStateAction<readonly ContentMediaUsage[]>>,
  setRequiresReferenceSync: React.Dispatch<React.SetStateAction<boolean>>,
  refreshMediaAssets: () => Promise<readonly HostMediaAssetListItem[]>
) => {
  if (
    !asset.localDraft &&
    (!asset.persistentUrl || !isPersistableContentMediaUrl(asset.persistentUrl))
  )
    return;
  const persistentUrl = asset.localDraft ? '' : (asset.persistentUrl ?? '');
  const nextMedia = mediaContentFromAsset({
    id: asset.id,
    fileName: asset.fileName,
    metadata: asset.metadata,
    visibility: asset.visibility,
    mimeType: asset.mimeType,
    previewUrl: asset.previewUrl,
  });
  if (!nextMedia) {
    return;
  }
  const persistedMedia = {
    ...nextMedia,
    sourceUrl: { ...nextMedia.sourceUrl, url: persistentUrl },
  };

  const currentMedia = methods.getValues('contentMedia') ?? [];
  methods.setValue(
    'contentMedia',
    asset.localDraft ? currentMedia : [...currentMedia, persistedMedia],
    { shouldDirty: true }
  );
  setMediaUsages((current) => [
    ...current,
    {
      uiId: `news-asset-${asset.id}-${current.length}`,
      assetId: asset.localDraft ? undefined : asset.id,
      localDraft: asset.localDraft,
      persistentUrl,
      previewUrl: asset.previewUrl ?? undefined,
      altText: asset.metadata.altText || asset.fileName,
      caption: asset.metadata.description || asset.title,
      credit: asset.metadata.copyright,
      license: asset.metadata.license,
      role: 'gallery_item',
      sortOrder: current.length,
      assetSnapshot: toContentMediaAssetSnapshot({
        persistentUrl,
        altText: asset.metadata.altText || asset.fileName,
        caption: asset.metadata.description || asset.title,
        credit: asset.metadata.copyright,
        license: asset.metadata.license,
      }),
      referenceStatus: 'pending',
      additionalData: {
        contentType: persistedMedia.contentType,
        width: persistedMedia.width,
        height: persistedMedia.height,
      },
    },
  ]);
  setRequiresReferenceSync(true);
  void refreshMediaAssets();
};
