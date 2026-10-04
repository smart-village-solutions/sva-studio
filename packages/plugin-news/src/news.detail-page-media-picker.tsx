import { useNavigate } from '@tanstack/react-router';
import { type HostMediaAssetListItem } from '@sva/plugin-sdk';
import {
  createStudioMediaPickerLabels,
  resolveStudioMediaPickerFeedback,
  StudioMediaPickerOverlay,
} from '@sva/studio-ui-react';
import { toNewsMediaPickerSummary, type NewsMediaPickerAsset } from './news.detail-page.helpers.js';
import { useNewsDetailMedia } from './news.detail-page-media.js';

export const NewsDetailMediaPicker = ({
  mediaAssets,
  canUploadMedia,
  mediaPickerFeedback,
  isAssetSelectable,
  mediaPicker,
  mediaPickerLabels,
  addManualMedia,
  canUpdateMedia,
}: Readonly<{
  mediaAssets: readonly HostMediaAssetListItem[];
  canUploadMedia: boolean;
  mediaPickerFeedback: ReturnType<typeof resolveStudioMediaPickerFeedback>;
  isAssetSelectable: (asset: NewsMediaPickerAsset) => boolean;
  mediaPicker: ReturnType<typeof useNewsDetailMedia>['mediaPicker'];
  mediaPickerLabels: ReturnType<typeof createStudioMediaPickerLabels>;
  addManualMedia: () => string;
  canUpdateMedia: boolean;
}>) => {
  const navigate = useNavigate();
  return (
    <StudioMediaPickerOverlay
      assets={mediaAssets.map(toNewsMediaPickerSummary)}
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
};
