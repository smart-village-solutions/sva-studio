import React from 'react';
import type { UseFormReturn } from 'react-hook-form';
import {
  getHostMediaAsset,
  getHostMediaDelivery,
  isSupportedContentMediaUploadFile as isSupportedUploadFile,
  updateHostMediaAsset,
  type HostMediaAssetListItem,
} from '@sva/plugin-sdk';
import {
  createLocalStudioMediaPickerAsset,
  createManualContentMediaUsage,
  isPersistableContentMediaUrl,
  resolveStudioMediaPickerFeedback,
  useStudioMediaPickerOverlay,
  type ContentMediaUsage,
} from '@sva/studio-ui-react';
import { genericItemMediaUsagesToFormValues } from './generic-items.content-media-adapter.js';
import { mediaContentFromAsset } from './generic-items.detail-media.helpers.js';
import { createEmptyMediaContent } from './generic-items.detail-media-upload.js';
import {
  createSelectedMediaUsage,
  resolveGenericItemsPersistentDeliveryUrl,
  toGenericItemsMediaPickerDetail,
  type GenericItemsMediaPickerAsset,
} from './generic-items.detail-page.media-model.js';
import type { GenericItemsDetailFormValues } from './generic-items.validation.js';

const isGenericItemsAssetSelectable = (
  asset: GenericItemsMediaPickerAsset,
  mediaUsages: readonly ContentMediaUsage[],
  mediaContents: GenericItemsDetailFormValues['mediaContents']
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
  const existingSources = new Set(
    (mediaContents ?? [])
      .map((entry) => entry.sourceUrl?.url?.trim() ?? '')
      .filter((value) => value.length > 0)
  );
  return !existingSources.has(nextMedia.sourceUrl?.url?.trim() ?? '');
};

const acceptGenericItemsAsset = (
  asset: GenericItemsMediaPickerAsset,
  {
    methods,
    setMediaUsages,
    setRequiresReferenceSync,
    refreshMediaAssets,
  }: Readonly<{
    methods: UseFormReturn<GenericItemsDetailFormValues>;
    setMediaUsages: React.Dispatch<React.SetStateAction<readonly ContentMediaUsage[]>>;
    setRequiresReferenceSync: React.Dispatch<React.SetStateAction<boolean>>;
    refreshMediaAssets: () => Promise<readonly HostMediaAssetListItem[]>;
  }>
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

  const currentMedia = methods.getValues('mediaContents') ?? [];
  methods.setValue(
    'mediaContents',
    asset.localDraft
      ? currentMedia
      : [
          ...currentMedia,
          {
            ...createEmptyMediaContent(),
            captionText: nextMedia.captionText ?? '',
            copyright: nextMedia.copyright ?? '',
            contentType: nextMedia.contentType ?? '',
            sourceUrl: {
              url: persistentUrl,
              description: nextMedia.sourceUrl?.description ?? '',
            },
          },
        ],
    { shouldDirty: true }
  );
  setMediaUsages((current) => [
    ...current,
    createSelectedMediaUsage(asset, persistentUrl, nextMedia.contentType ?? '', current.length),
  ]);
  setRequiresReferenceSync(true);
  void refreshMediaAssets();
};

const addManualGenericItemsMedia = ({
  methods,
  mediaUsages,
  setMediaUsages,
  setRequiresReferenceSync,
}: Readonly<{
  methods: UseFormReturn<GenericItemsDetailFormValues>;
  mediaUsages: readonly ContentMediaUsage[];
  setMediaUsages: React.Dispatch<React.SetStateAction<readonly ContentMediaUsage[]>>;
  setRequiresReferenceSync: React.Dispatch<React.SetStateAction<boolean>>;
}>) => {
  const usage = {
    ...createManualContentMediaUsage({ sortOrder: mediaUsages.length }),
    additionalData: { contentType: '', width: '', height: '' },
  };
  const nextUsages = [...mediaUsages, usage];
  methods.setValue('mediaContents', genericItemMediaUsagesToFormValues(nextUsages), {
    shouldDirty: true,
  });
  setMediaUsages(nextUsages);
  setRequiresReferenceSync(
    (current) => current || nextUsages.some((entry) => Boolean(entry.assetId))
  );
  return usage.uiId;
};

const loadMediaPickerAsset = async (
  assetId: string,
  mediaAssetsRef: React.RefObject<readonly HostMediaAssetListItem[]>
) => {
  const [detail, delivery] = await Promise.all([
    getHostMediaAsset({ fetch: globalThis.fetch.bind(globalThis), assetId }),
    getHostMediaDelivery({ fetch: globalThis.fetch.bind(globalThis), assetId }),
  ]);
  const summary = mediaAssetsRef.current.find((asset) => asset.id === assetId);
  return toGenericItemsMediaPickerDetail(
    detail,
    summary,
    resolveGenericItemsPersistentDeliveryUrl(delivery)
  );
};

const saveMediaPickerAssetMetadata = async (
  assetId: string,
  metadata: Parameters<
    NonNullable<
      Parameters<
        typeof useStudioMediaPickerOverlay<GenericItemsMediaPickerAsset>
      >[0]['saveAssetMetadata']
    >
  >[1],
  mediaAssetsRef: React.RefObject<readonly HostMediaAssetListItem[]>,
  refreshMediaAssets: () => Promise<readonly HostMediaAssetListItem[]>
) => {
  const detail = await updateHostMediaAsset({
    fetch: globalThis.fetch.bind(globalThis),
    assetId,
    metadata,
    visibility: 'public',
  });
  const assets = await refreshMediaAssets();
  mediaAssetsRef.current = assets;
  const summary = mediaAssetsRef.current.find((asset) => asset.id === assetId);
  const delivery = await getHostMediaDelivery({
    fetch: globalThis.fetch.bind(globalThis),
    assetId,
  });
  return toGenericItemsMediaPickerDetail(
    detail,
    summary,
    resolveGenericItemsPersistentDeliveryUrl(delivery)
  );
};

export const useGenericItemsPageMedia = ({
  methods,
  mediaUsages,
  setMediaUsages,
  setRequiresReferenceSync,
  mediaAssets,
  refreshMediaAssets,
  pt,
}: Readonly<{
  methods: UseFormReturn<GenericItemsDetailFormValues>;
  mediaUsages: readonly ContentMediaUsage[];
  setMediaUsages: React.Dispatch<React.SetStateAction<readonly ContentMediaUsage[]>>;
  setRequiresReferenceSync: React.Dispatch<React.SetStateAction<boolean>>;
  mediaAssets: readonly HostMediaAssetListItem[];
  refreshMediaAssets: () => Promise<readonly HostMediaAssetListItem[]>;
  pt: (key: string) => string;
}>) => {
  const mediaAssetsRef = React.useRef(mediaAssets);
  const isAssetSelectable = React.useCallback(
    (asset: GenericItemsMediaPickerAsset) =>
      isGenericItemsAssetSelectable(asset, mediaUsages, methods.getValues('mediaContents')),
    [mediaUsages, methods]
  );

  const mediaPicker = useStudioMediaPickerOverlay<GenericItemsMediaPickerAsset>({
    onAccept: (asset) =>
      acceptGenericItemsAsset(asset, {
        methods,
        setMediaUsages,
        setRequiresReferenceSync,
        refreshMediaAssets,
      }),
    canAcceptAsset: isAssetSelectable,
    isSupportedUploadFile,
    createLocalAsset: createLocalStudioMediaPickerAsset,
    loadAsset: (assetId) => loadMediaPickerAsset(assetId, mediaAssetsRef),
    saveAssetMetadata: (assetId, metadata) =>
      saveMediaPickerAssetMetadata(assetId, metadata, mediaAssetsRef, refreshMediaAssets),
  });

  React.useEffect(() => {
    mediaAssetsRef.current = mediaAssets;
  }, [mediaAssets]);
  const addManualMedia = React.useCallback(
    () =>
      addManualGenericItemsMedia({
        methods,
        mediaUsages,
        setMediaUsages,
        setRequiresReferenceSync,
      }),
    [methods, mediaUsages, setMediaUsages, setRequiresReferenceSync]
  );

  const mediaPickerFeedback = React.useMemo(
    () => resolveStudioMediaPickerFeedback(pt, mediaPicker.errorCode, mediaPicker.uploadPhase),
    [mediaPicker.errorCode, mediaPicker.uploadPhase, pt]
  );

  return { isAssetSelectable, mediaPicker, addManualMedia, mediaPickerFeedback };
};
