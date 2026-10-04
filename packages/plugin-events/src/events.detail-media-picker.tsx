import React from 'react';
import { useNavigate } from '@tanstack/react-router';
import { StudioMediaPickerOverlay } from '@sva/studio-ui-react';
import {
  toEventsMediaPickerSummary,
  isEventsAssetSelectable,
  acceptEventsMediaAsset,
} from './events.detail-media.helpers.js';
import type { useEventsDetailMedia } from './events.detail-media.js';
import type { Dispatch, SetStateAction } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import {
  listHostMediaAssets,
  isSupportedContentMediaUploadFile as isSupportedUploadFile,
  usePluginTranslation,
  type HostMediaAssetListItem,
} from '@sva/plugin-sdk';
import {
  createLocalStudioMediaPickerAsset,
  createStudioMediaPickerLabels,
  resolveStudioMediaPickerFeedback,
  useStudioMediaPickerOverlay,
  type ContentMediaUsage,
  type StudioMediaPickerAssetDetail,
} from '@sva/studio-ui-react';
import type { EventsDetailFormValues } from './events.detail-form.js';

import { loadEventsMediaAsset, saveEventsMediaMetadata } from './events.detail-media-actions.js';

export const useEventsMediaPicker = (
  methods: UseFormReturn<EventsDetailFormValues>,
  pt: ReturnType<typeof usePluginTranslation>,
  mediaUsages: readonly ContentMediaUsage[],
  setMediaUsages: Dispatch<SetStateAction<readonly ContentMediaUsage[]>>,
  setRequiresReferenceSync: Dispatch<SetStateAction<boolean>>
) => {
  const { mediaAssets, mediaAssetsRef, refreshMediaAssets } = useEventsMediaAssets();
  const isAssetSelectable = React.useCallback(
    (asset: StudioMediaPickerAssetDetail) => isEventsAssetSelectable(asset, mediaUsages, methods),
    [mediaUsages, methods]
  );
  const mediaPicker = useStudioMediaPickerOverlay<StudioMediaPickerAssetDetail>({
    onAccept: (asset) =>
      acceptEventsMediaAsset(
        asset,
        methods,
        setMediaUsages,
        setRequiresReferenceSync,
        refreshMediaAssets
      ),
    canAcceptAsset: isAssetSelectable,
    isSupportedUploadFile,
    createLocalAsset: createLocalStudioMediaPickerAsset,
    loadAsset: (assetId) => loadEventsMediaAsset(assetId, mediaAssetsRef),
    saveAssetMetadata: (assetId, metadata) =>
      saveEventsMediaMetadata(assetId, metadata, mediaAssetsRef, refreshMediaAssets),
  });
  const mediaPickerLabels = React.useMemo(() => createStudioMediaPickerLabels(pt), [pt]);
  const mediaPickerFeedback = React.useMemo(
    () => resolveStudioMediaPickerFeedback(pt, mediaPicker.errorCode, mediaPicker.uploadPhase),
    [mediaPicker.errorCode, mediaPicker.uploadPhase, pt]
  );
  return {
    mediaAssets,
    refreshMediaAssets,
    isAssetSelectable,
    mediaPicker,
    mediaPickerLabels,
    mediaPickerFeedback,
  };
};

export const useEventsMediaAssets = () => {
  const [mediaAssets, setMediaAssets] = React.useState<readonly HostMediaAssetListItem[]>([]);
  const mediaAssetsRef = React.useRef<readonly HostMediaAssetListItem[]>([]);
  const refreshMediaAssets = React.useCallback(async () => {
    try {
      const assets = await listHostMediaAssets({
        fetch: globalThis.fetch.bind(globalThis),
        visibility: 'public',
      });
      mediaAssetsRef.current = assets;
      setMediaAssets(assets);
      return assets;
    } catch {
      mediaAssetsRef.current = [];
      setMediaAssets([]);
      return [];
    }
  }, []);
  return { mediaAssets, mediaAssetsRef, refreshMediaAssets };
};

export function EventsDetailMediaPicker({
  media,
  canUploadMedia,
  canUpdateMedia,
  navigate,
}: Readonly<{
  media: ReturnType<typeof useEventsDetailMedia>;
  canUploadMedia: boolean;
  canUpdateMedia: boolean;
  navigate: ReturnType<typeof useNavigate>;
}>) {
  const {
    mediaAssets,
    mediaPickerFeedback,
    isAssetSelectable,
    mediaPicker,
    mediaPickerLabels,
    addManualMedia,
  } = media;
  return (
    <StudioMediaPickerOverlay
      assets={mediaAssets.map(toEventsMediaPickerSummary)}
      canUpload={canUploadMedia}
      feedbackMessage={mediaPickerFeedback.message}
      feedbackTone={mediaPickerFeedback.tone}
      isAssetSelectable={(asset) =>
        isAssetSelectable({
          ...asset,
          metadata: {
            title: asset.title,
            altText: '',
            description: '',
            copyright: '',
            license: '',
          },
        })
      }
      isLoadingReviewAsset={mediaPicker.isLoadingReviewAsset}
      isSavingReviewAsset={mediaPicker.isSavingReviewAsset}
      labels={mediaPickerLabels}
      metadataDraft={mediaPicker.metadataDraft}
      mode={mediaPicker.mode}
      onAddManual={addManualMedia}
      onBackFromReview={mediaPicker.goBackFromReview}
      onChangeMode={(pickerMode) =>
        pickerMode === 'upload' ? mediaPicker.openUpload() : mediaPicker.openLibrary()
      }
      onClose={mediaPicker.close}
      onConfirmSelection={() => void mediaPicker.confirmSelection()}
      onMetadataChange={(key, value) => mediaPicker.updateMetadataField(key, value)}
      onOpenMediaManagement={(assetId) =>
        void navigate({ to: '/admin/media/$mediaId', params: { mediaId: assetId } })
      }
      onSearchValueChange={mediaPicker.setSearchValue}
      onSelectAsset={(asset) => void mediaPicker.selectAsset(asset)}
      onUploadFile={(file) => void mediaPicker.uploadFile(file)}
      open={mediaPicker.open}
      reviewAsset={mediaPicker.reviewAsset}
      reviewSource={mediaPicker.reviewSource}
      isMetadataEditable={canUpdateMedia}
      searchValue={mediaPicker.searchValue}
      uploadPhase={mediaPicker.uploadPhase}
    />
  );
}
