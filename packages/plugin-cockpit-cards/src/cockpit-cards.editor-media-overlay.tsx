import {
  StudioMediaPickerOverlay,
  type StudioMediaPickerOverlayLabels,
} from '@sva/studio-ui-react';
import { useNavigate } from '@tanstack/react-router';

import {
  cockpitCardMetadataFields,
  type useCockpitCardMedia,
} from './cockpit-cards.editor-media.js';

export function CockpitCardMediaOverlay({
  media,
  canUploadMedia,
  canUpdateMedia,
  pt,
}: Readonly<{
  media: ReturnType<typeof useCockpitCardMedia>;
  canUploadMedia: boolean;
  canUpdateMedia: boolean;
  pt: (key: string) => string;
}>) {
  const navigate = useNavigate();
  const { mediaAssets, mediaPicker, mediaUsages, addManualMedia } = media;
  return (
    <StudioMediaPickerOverlay
      canUpload={canUploadMedia}
      assets={mediaAssets.map((asset) => ({
        id: asset.id,
        title:
          typeof asset.metadata?.title === 'string'
            ? asset.metadata.title
            : (asset.fileName ?? asset.id),
        fileName: asset.fileName ?? asset.id,
        previewUrl: asset.previewUrl ?? null,
        mimeType: asset.mimeType,
        visibility: asset.visibility,
      }))}
      open={mediaPicker.open}
      mode={mediaPicker.mode}
      labels={cockpitCardPickerLabels(pt)}
      reviewAsset={mediaPicker.reviewAsset}
      reviewSource={mediaPicker.reviewSource}
      metadataDraft={mediaPicker.metadataDraft}
      searchValue={mediaPicker.searchValue}
      uploadPhase={mediaPicker.uploadPhase}
      isLoadingReviewAsset={mediaPicker.isLoadingReviewAsset}
      isSavingReviewAsset={mediaPicker.isSavingReviewAsset}
      isMetadataEditable={canUpdateMedia}
      visibleMetadataFields={cockpitCardMetadataFields}
      feedbackMessage={mediaPicker.errorCode ? pt('messages.mediaError') : null}
      feedbackTone={mediaPicker.errorCode ? 'error' : 'default'}
      isAssetSelectable={(asset) => !mediaUsages.some((usage) => usage.assetId === asset.id)}
      onAddManual={addManualMedia}
      onClose={mediaPicker.close}
      onBackFromReview={mediaPicker.goBackFromReview}
      onChangeMode={(next) =>
        next === 'upload' ? mediaPicker.openUpload() : mediaPicker.openLibrary()
      }
      onSearchValueChange={mediaPicker.setSearchValue}
      onSelectAsset={(asset) => void mediaPicker.selectAsset(asset)}
      onUploadFile={(file) => void mediaPicker.uploadFile(file)}
      onConfirmSelection={() => void mediaPicker.confirmSelection()}
      onMetadataChange={(key, value) => mediaPicker.updateMetadataField(key, value)}
      onOpenMediaManagement={(assetId) =>
        void navigate({ to: '/admin/media/$mediaId', params: { mediaId: assetId } })
      }
    />
  );
}

function cockpitCardPickerLabels(pt: (key: string) => string): StudioMediaPickerOverlayLabels {
  return {
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
      select: pt('actions.selectImage'),
    },
    upload: {
      regionLabel: pt('media.uploadRegion'),
      title: pt('actions.uploadImage'),
      description: pt('media.uploadDescription'),
      browseAction: pt('media.browse'),
      supportLabel: pt('media.support'),
    },
    review: { title: pt('media.review'), description: pt('media.reviewDescription') },
    fields: {
      title: pt('fields.heading'),
      altText: pt('media.altText'),
      description: pt('media.caption'),
      copyright: pt('media.credit'),
      license: pt('media.license'),
    },
    actions: {
      cancel: pt('media.cancel'),
      backToLibrary: pt('media.backLibrary'),
      backToUpload: pt('media.backUpload'),
      openMediaManagement: pt('media.openManagement'),
      useMedia: pt('media.use'),
    },
  };
}
