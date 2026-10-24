import { StudioMediaPickerOverlay } from '@sva/studio-ui-react';
import { toGenericItemsMediaPickerSummary } from './generic-items.detail-page.media-model.js';
import type { GenericItemsDetailPageViewModel } from './generic-items.detail-page.view-content.js';

export const GenericItemsMediaPickerView = ({
  view,
}: Readonly<{ view: GenericItemsDetailPageViewModel }>) => {
  const {
    mediaAssets,
    canUploadMedia,
    mediaPickerFeedback,
    isAssetSelectable,
    mediaPicker,
    mediaPickerLabels,
    addManualMedia,
    canUpdateMedia,
    navigate,
  } = view;
  return (
    <StudioMediaPickerOverlay
      assets={mediaAssets.map(toGenericItemsMediaPickerSummary)}
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
      canConfirmSelection={mediaPicker.canConfirmSelection}
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
      isMetadataEditable
      visibleMetadataFields={['altText', 'description', 'copyright']}
      persistenceContext="content"
      canEditCentralMetadata={canUpdateMedia}
      onSaveCentralMetadata={mediaPicker.saveCentralMetadata}
      onApplyImageEdit={canUploadMedia ? mediaPicker.applyImageEdit : undefined}
      onImageFocusChange={mediaPicker.updateImageFocus}
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
};
