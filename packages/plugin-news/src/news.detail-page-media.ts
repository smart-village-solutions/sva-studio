import * as React from 'react';
import type { UseFormReturn } from 'react-hook-form';
import {
  getHostMediaAsset,
  getHostMediaDelivery,
  listHostMediaAssets,
  isSupportedContentMediaUploadFile as isSupportedUploadFile,
  updateHostMediaAsset,
  type HostMediaAssetListItem,
} from '@sva/plugin-sdk';
import {
  contentMediaUsagesToMainserver,
  createLocalStudioMediaPickerAsset,
  createManualContentMediaUsage,
  createStudioMediaPickerLabels,
  isPersistableContentMediaUrl,
  resolveStudioMediaPickerFeedback,
  useStudioMediaPickerOverlay,
  type ContentMediaUsage,
} from '@sva/studio-ui-react';
import { isNewsAssetSelectable, acceptNewsMediaAsset } from './news.detail-page-media-selection.js';
import {
  toNewsMediaPickerDetail,
  type NewsMediaPickerAsset,
  type PluginTranslator,
} from './news.detail-page.helpers.js';
import type { NewsDetailFormValues } from './news.types.js';

function useNewsMediaLibrary(
  setMediaAssets: React.Dispatch<React.SetStateAction<readonly HostMediaAssetListItem[]>>
) {
  const mediaAssetsRef = React.useRef<readonly HostMediaAssetListItem[]>([]);
  const [libraryLoading, setLibraryLoading] = React.useState(false);
  const [libraryError, setLibraryError] = React.useState(false);
  const refreshMediaAssets = React.useCallback(async () => {
    setLibraryLoading(true);
    setLibraryError(false);
    try {
      const assets = await listHostMediaAssets({
        fetch: globalThis.fetch.bind(globalThis),
        visibility: 'public',
      });
      mediaAssetsRef.current = assets;
      setMediaAssets(assets);
      return assets;
    } catch {
      setLibraryError(true);
      return mediaAssetsRef.current;
    } finally {
      setLibraryLoading(false);
    }
  }, []);
  const libraryStatus = {
    loading: libraryLoading,
    error: libraryError,
    onRetry: refreshMediaAssets,
  };
  return { mediaAssetsRef, refreshMediaAssets, libraryStatus };
}

export const useNewsDetailMedia = ({
  methods,
  mediaUsages,
  setMediaUsages,
  setRequiresReferenceSync,
  setMediaAssets,
  pt,
}: Readonly<{
  methods: UseFormReturn<NewsDetailFormValues>;
  mediaUsages: readonly ContentMediaUsage[];
  setMediaUsages: React.Dispatch<React.SetStateAction<readonly ContentMediaUsage[]>>;
  setRequiresReferenceSync: React.Dispatch<React.SetStateAction<boolean>>;
  setMediaAssets: React.Dispatch<React.SetStateAction<readonly HostMediaAssetListItem[]>>;
  pt: PluginTranslator;
}>) => {
  const { mediaAssetsRef, refreshMediaAssets, libraryStatus } = useNewsMediaLibrary(setMediaAssets);
  const mediaPickerLabels = React.useMemo(() => createStudioMediaPickerLabels(pt), [pt]);

  const isAssetSelectable = React.useCallback(
    (asset: NewsMediaPickerAsset) => isNewsAssetSelectable(asset, mediaUsages, methods),
    [mediaUsages, methods]
  );

  const mediaPicker = useStudioMediaPickerOverlay<NewsMediaPickerAsset>({
    onAccept: (asset) =>
      acceptNewsMediaAsset(
        asset,
        methods,
        setMediaUsages,
        setRequiresReferenceSync,
        refreshMediaAssets
      ),
    canAcceptAsset: isAssetSelectable,
    isSupportedUploadFile,
    createLocalAsset: createLocalStudioMediaPickerAsset,
    loadAsset: async (assetId) => {
      const [detail, delivery] = await Promise.all([
        getHostMediaAsset({ fetch: globalThis.fetch.bind(globalThis), assetId }),
        getHostMediaDelivery({ fetch: globalThis.fetch.bind(globalThis), assetId }),
      ]);
      const summary = mediaAssetsRef.current.find((asset) => asset.id === assetId);
      return toNewsMediaPickerDetail(
        detail,
        summary,
        delivery.isPublicUrl === true && isPersistableContentMediaUrl(delivery.deliveryUrl)
          ? delivery.deliveryUrl
          : null
      );
    },
    saveAssetMetadata: async (assetId, metadata) => {
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
      return toNewsMediaPickerDetail(
        detail,
        summary,
        delivery.isPublicUrl === true && isPersistableContentMediaUrl(delivery.deliveryUrl)
          ? delivery.deliveryUrl
          : null
      );
    },
  });
  const addManualMedia = React.useCallback(() => {
    const usage = {
      ...createManualContentMediaUsage({ sortOrder: mediaUsages.length }),
      additionalData: { contentType: 'image', width: '', height: '' },
    };
    const nextUsages = [...mediaUsages, usage];
    methods.setValue(
      'contentMedia',
      contentMediaUsagesToMainserver(nextUsages) as NewsDetailFormValues['contentMedia'],
      { shouldDirty: true }
    );
    setMediaUsages(nextUsages);
    setRequiresReferenceSync(
      (current) => current || nextUsages.some((entry) => Boolean(entry.assetId))
    );
    return usage.uiId;
  }, [mediaUsages, methods]);
  const mediaPickerFeedback = React.useMemo(
    () => resolveStudioMediaPickerFeedback(pt, mediaPicker.errorCode, mediaPicker.uploadPhase),
    [mediaPicker.errorCode, mediaPicker.uploadPhase, pt]
  );

  return {
    libraryStatus,
    mediaPicker,
    mediaPickerLabels,
    isAssetSelectable,
    addManualMedia,
    mediaPickerFeedback,
    refreshMediaAssets,
  };
};
