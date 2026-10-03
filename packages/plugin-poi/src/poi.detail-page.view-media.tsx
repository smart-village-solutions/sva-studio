import { type NavigateFn } from '@tanstack/react-router';
import { createStudioMediaPickerLabels, StudioMediaPickerOverlay } from '@sva/studio-ui-react';
import { toPoiMediaPickerSummary, usePoiDetailMedia } from './poi.detail-page.media.js';

type OverlayInput = Readonly<{
  media: ReturnType<typeof usePoiDetailMedia>;
  canUploadMedia: boolean;
  canUpdateMedia: boolean;
  mediaPickerLabels: ReturnType<typeof createStudioMediaPickerLabels>;
  navigate: NavigateFn;
}>;

export function PoiDetailMediaOverlay({
  media,
  canUploadMedia,
  canUpdateMedia,
  mediaPickerLabels,
  navigate,
}: OverlayInput) {
  const { mediaAssets, mediaPicker, mediaPickerFeedback, isAssetSelectable, addManualMedia } =
    media;
  return (
    <StudioMediaPickerOverlay
      assets={mediaAssets.map(toPoiMediaPickerSummary)}
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
      isMetadataEditable={canUpdateMedia}
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
      searchValue={mediaPicker.searchValue}
      uploadPhase={mediaPicker.uploadPhase}
    />
  );
}
