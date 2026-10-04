import { usePluginTranslation, type HostMediaAssetListItem } from '@sva/plugin-sdk';
import {
  StudioMediaPickerOverlay,
  type ContentMediaUsage,
  type StudioMediaPickerOverlayLabels,
} from '@sva/studio-ui-react';
import type { useNavigate } from '@tanstack/react-router';
import { toPickerSummary, type useProjectEditorMedia } from './projects.editor-media.js';

type MediaPickerInput = Readonly<{
  pt: ReturnType<typeof usePluginTranslation>;
  mediaAssets: readonly HostMediaAssetListItem[];
  canUploadMedia: boolean;
  mediaPicker: ReturnType<typeof useProjectEditorMedia>['mediaPicker'];
  canUpdateMedia: boolean;
  mediaUsages: readonly ContentMediaUsage[];
  addManualMedia: () => string;
  navigate: ReturnType<typeof useNavigate>;
}>;

export function ProjectMediaPicker({
  pt,
  mediaAssets,
  canUploadMedia,
  mediaPicker,
  canUpdateMedia,
  mediaUsages,
  addManualMedia,
  navigate,
}: MediaPickerInput) {
  return (
    <StudioMediaPickerOverlay
      assets={mediaAssets.map(toPickerSummary)}
      canUpload={canUploadMedia}
      open={mediaPicker.open}
      mode={mediaPicker.mode}
      labels={pickerLabels(pt)}
      searchValue={mediaPicker.searchValue}
      metadataDraft={mediaPicker.metadataDraft}
      reviewAsset={mediaPicker.reviewAsset}
      reviewSource={mediaPicker.reviewSource}
      uploadPhase={mediaPicker.uploadPhase}
      isLoadingReviewAsset={mediaPicker.isLoadingReviewAsset}
      isSavingReviewAsset={mediaPicker.isSavingReviewAsset}
      isMetadataEditable={canUpdateMedia}
      isAssetSelectable={(asset) => mediaUsages.every((usage) => usage.assetId !== asset.id)}
      onAddManual={addManualMedia}
      onClose={mediaPicker.close}
      onChangeMode={(pickerMode) =>
        pickerMode === 'upload' ? mediaPicker.openUpload() : mediaPicker.openLibrary()
      }
      onSearchValueChange={mediaPicker.setSearchValue}
      onSelectAsset={(asset) => void mediaPicker.selectAsset(asset)}
      onUploadFile={(file) => void mediaPicker.uploadFile(file)}
      onMetadataChange={(key, value) => mediaPicker.updateMetadataField(key, value)}
      onBackFromReview={mediaPicker.goBackFromReview}
      onConfirmSelection={() => void mediaPicker.confirmSelection()}
      onOpenMediaManagement={(assetId) =>
        void navigate({ to: '/admin/media/$mediaId', params: { mediaId: assetId } })
      }
    />
  );
}

const pickerLabels = (
  pt: ReturnType<typeof usePluginTranslation>
): StudioMediaPickerOverlayLabels => ({
  title: pt('media.pickerTitle'),
  description: pt('media.pickerDescription'),
  modes: {
    library: pt('media.addFromLibrary'),
    upload: pt('media.upload'),
    manual: pt('media.addByLink'),
    review: pt('media.review'),
  },
  library: {
    searchLabel: pt('media.search'),
    empty: pt('media.empty'),
    select: pt('media.select'),
  },
  upload: {
    regionLabel: pt('media.uploadRegion'),
    title: pt('actions.uploadImage'),
    description: pt('media.uploadDescription'),
    browseAction: pt('media.browse'),
    supportLabel: pt('media.uploadSupport'),
  },
  review: { title: pt('media.reviewTitle'), description: pt('media.reviewDescription') },
  fields: {
    title: pt('fields.title'),
    altText: pt('fields.altText'),
    description: pt('fields.caption'),
    copyright: pt('fields.credits'),
    license: pt('media.license'),
  },
  actions: {
    cancel: pt('actions.back'),
    backToLibrary: pt('media.backToLibrary'),
    backToUpload: pt('media.backToUpload'),
    openMediaManagement: pt('media.openManagement'),
    useMedia: pt('media.useMedia'),
  },
});
