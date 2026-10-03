import {
  getHostMediaAssetPersistentUrl,
  readHostMediaAssetCopyright,
  readHostMediaAssetFileName,
  readHostMediaAssetTitle,
  getHostMediaAssetFileName,
  type HostMediaAssetDetail,
  type HostMediaAssetListItem,
} from '@sva/plugin-sdk';

import {
  isPersistableContentMediaUrl,
  toContentMediaAssetSnapshot,
  type ContentMediaUsage,
  type StudioMediaPickerAssetDetail,
  type StudioMediaPickerAssetSummary,
} from '@sva/studio-ui-react';
import type { Dispatch, SetStateAction } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import { createDefaultMediaContent, type EventsDetailFormValues } from './events.detail-form.js';

import type { EventMediaContent } from './events.types.js';
import { normalizeMediaContentType } from './events.detail-media-content-type.js';

export const mediaContentTypeOptions = ['image', 'audio', 'video', 'logo', 'attachment'] as const;

export const mediaContentTypeFromAsset = (asset: HostMediaAssetListItem): string => {
  const mimeType = asset.mimeType?.trim();
  if (!mimeType) {
    return '';
  }
  if (mimeType.startsWith('image/')) {
    return 'image';
  }
  if (mimeType.startsWith('audio/')) {
    return 'audio';
  }
  if (mimeType.startsWith('video/')) {
    return 'video';
  }
  return normalizeMediaContentType(mimeType) ?? '';
};

export const mediaContentFromAsset = (asset: HostMediaAssetListItem): EventMediaContent | null => {
  const url = getHostMediaAssetPersistentUrl(asset);
  if (!url) {
    return null;
  }

  return {
    captionText: readHostMediaAssetTitle(asset),
    copyright: readHostMediaAssetCopyright(asset),
    contentType: mediaContentTypeFromAsset(asset),
    sourceUrl: {
      url,
      description: readHostMediaAssetFileName(asset),
    },
  };
};

export const toEventsMediaPickerSummary = (
  asset: HostMediaAssetListItem
): StudioMediaPickerAssetSummary => ({
  id: asset.id,
  title: readHostMediaAssetTitle(asset),
  fileName: readHostMediaAssetFileName(asset),
  previewUrl: asset.previewUrl,
  mimeType: asset.mimeType,
  visibility: asset.visibility,
});

export const toEventsMediaPickerDetail = (
  asset: HostMediaAssetDetail,
  summary?: HostMediaAssetListItem,
  persistentUrl?: string | null
): StudioMediaPickerAssetDetail => {
  const fileName = summary ? readHostMediaAssetFileName(summary) : getHostMediaAssetFileName(asset);
  const title =
    asset.metadata.title?.trim() || (summary ? readHostMediaAssetTitle(summary) : fileName);

  return {
    id: asset.id,
    title,
    fileName,
    previewUrl: asset.previewUrl?.trim() || summary?.previewUrl?.trim() || null,
    mimeType: asset.mimeType,
    visibility: asset.visibility,
    persistentUrl,
    metadata: {
      title,
      altText: asset.metadata.altText?.trim() ?? '',
      description: asset.metadata.description?.trim() ?? '',
      copyright: asset.metadata.copyright?.trim() ?? '',
      license: asset.metadata.license?.trim() ?? '',
    },
  };
};

export const isEventsAssetSelectable = (
  asset: StudioMediaPickerAssetDetail,
  mediaUsages: readonly ContentMediaUsage[],
  methods: UseFormReturn<EventsDetailFormValues>
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
  if (!nextMedia) return false;
  const existingUrls = new Set(
    (methods.getValues('content.mediaContents') ?? [])
      .map((entry) => entry.sourceUrl?.url?.trim() ?? '')
      .filter((value) => value.length > 0)
  );
  return !existingUrls.has(nextMedia.sourceUrl?.url?.trim() ?? '');
};

type SelectedMedia = NonNullable<ReturnType<typeof mediaContentFromAsset>>;

const appendSelectedMediaToForm = (
  asset: StudioMediaPickerAssetDetail,
  nextMedia: SelectedMedia,
  persistentUrl: string,
  methods: UseFormReturn<EventsDetailFormValues>
) => {
  const currentMedia = methods.getValues('content.mediaContents') ?? [];
  methods.setValue(
    'content.mediaContents',
    asset.localDraft
      ? currentMedia
      : [
          ...currentMedia,
          {
            ...createDefaultMediaContent(),
            captionText: nextMedia.captionText ?? '',
            copyright: nextMedia.copyright ?? '',
            contentType: nextMedia.contentType ?? '',
            sourceUrl: { url: persistentUrl, description: nextMedia.sourceUrl?.description ?? '' },
          },
        ],
    { shouldDirty: true }
  );
};

const createSelectedMediaUsage = (
  asset: StudioMediaPickerAssetDetail,
  nextMedia: SelectedMedia,
  persistentUrl: string,
  sortOrder: number
): ContentMediaUsage => {
  const altText = asset.metadata.altText || asset.fileName;
  const caption = asset.metadata.description || asset.title;
  return {
    uiId: `event-asset-${asset.id}-${sortOrder}`,
    assetId: asset.localDraft ? undefined : asset.id,
    localDraft: asset.localDraft,
    persistentUrl,
    previewUrl: asset.previewUrl ?? undefined,
    altText,
    caption,
    credit: asset.metadata.copyright,
    license: asset.metadata.license,
    role: 'gallery_item',
    sortOrder,
    assetSnapshot: toContentMediaAssetSnapshot({
      persistentUrl,
      altText,
      caption,
      credit: asset.metadata.copyright,
      license: asset.metadata.license,
    }),
    referenceStatus: 'pending',
    additionalData: { contentType: nextMedia.contentType ?? 'image', width: '', height: '' },
  };
};

export const acceptEventsMediaAsset = (
  asset: StudioMediaPickerAssetDetail,
  methods: UseFormReturn<EventsDetailFormValues>,
  setMediaUsages: Dispatch<SetStateAction<readonly ContentMediaUsage[]>>,
  setRequiresReferenceSync: Dispatch<SetStateAction<boolean>>,
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
  if (!nextMedia) return;
  appendSelectedMediaToForm(asset, nextMedia, persistentUrl, methods);
  setMediaUsages((current) => [
    ...current,
    createSelectedMediaUsage(asset, nextMedia, persistentUrl, current.length),
  ]);
  setRequiresReferenceSync(true);
  void refreshMediaAssets();
};
