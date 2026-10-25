import { useEffect, useState } from 'react';
import {
  getHostMediaAsset,
  getHostMediaDelivery,
  listHostMediaAssets,
  readHostMediaAssetFileName,
  readHostMediaAssetTitle,
  getHostMediaAssetFileName,
  usePluginTranslation,
  type HostMediaAssetListItem,
} from '@sva/plugin-sdk';
import {
  Button,
  createStudioMediaPickerLabels,
  StudioMediaPickerOverlay,
  useStudioMediaPickerOverlay,
  type StudioMediaPickerAssetDetail,
} from '@sva/studio-ui-react';
import type { VoucherInput } from './vouchers.types.js';
type Media = VoucherInput['mediaContents'][number];
export function VoucherMediaLibrary({
  onSelect,
}: Readonly<{
  onSelect: (media: Media) => void;
}>) {
  const t = usePluginTranslation('vouchers');
  const [assets, setAssets] = useState<readonly HostMediaAssetListItem[]>([]);
  const [error, setError] = useState(false);
  const picker = useStudioMediaPickerOverlay({
    loadAsset: loadVoucherAsset,
    saveAssetMetadata: (id) => loadVoucherAsset(id),
    isSupportedUploadFile: () => false,
    editableMetadataFields: [],
    persistenceContext: 'content',
    canAcceptAsset: (asset) =>
      asset.visibility === 'public' &&
      asset.mimeType?.startsWith('image/') === true &&
      Boolean(asset.persistentUrl?.match(/^https?:\/\//)),
    onAccept: (asset) => {
      if (asset.persistentUrl)
        onSelect({
          contentType: 'image',
          hostMediaAssetId: asset.id,
          sourceUrl: { url: asset.persistentUrl, description: asset.metadata.altText },
          captionText: asset.metadata.description,
          copyright: asset.metadata.copyright,
        });
    },
  });
  useEffect(() => {
    if (!picker.open) return;
    let current = true;
    setError(false);
    const timer = setTimeout(() => {
      void listHostMediaAssets({
        fetch,
        visibility: 'public',
        search: picker.searchValue || undefined,
      }).then(
        (result) => {
          if (current) setAssets(result);
        },
        () => {
          if (current) setError(true);
        }
      );
    }, 200);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [picker.open, picker.searchValue]);
  return (
    <>
      <Button type="button" variant="secondary" onClick={picker.openLibrary}>
        {t('messages.mediaPickerLibraryAction')}
      </Button>
      <VoucherMediaOverlay assets={assets} error={error} picker={picker} />
    </>
  );
}
const loadVoucherAsset = async (assetId: string): Promise<StudioMediaPickerAssetDetail> => {
  const [asset, delivery] = await Promise.all([
    getHostMediaAsset({ fetch, assetId }),
    getHostMediaDelivery({ fetch, assetId }),
  ]);
  return {
    id: asset.id,
    fileName: getHostMediaAssetFileName(asset),
    title: asset.metadata.title ?? '',
    mimeType: asset.mimeType,
    visibility: asset.visibility,
    previewUrl: asset.previewUrl ?? null,
    persistentUrl: delivery.isPublicUrl ? delivery.deliveryUrl : null,
    metadata: {
      title: asset.metadata.title ?? '',
      altText: asset.metadata.altText ?? '',
      description: asset.metadata.description ?? '',
      copyright: asset.metadata.copyright ?? '',
      license: asset.metadata.license ?? '',
      tags: asset.metadata.tags,
    },
  };
};
function VoucherMediaOverlay({
  assets,
  error,
  picker,
}: Readonly<{
  assets: readonly HostMediaAssetListItem[];
  error: boolean;
  picker: ReturnType<typeof useStudioMediaPickerOverlay>;
}>) {
  const t = usePluginTranslation('vouchers');
  return (
    <StudioMediaPickerOverlay
      open={picker.open}
      mode={picker.mode}
      reviewSource={picker.reviewSource}
      assets={assets
        .filter((asset) => asset.mimeType?.startsWith('image/'))
        .map((asset) => ({
          id: asset.id,
          fileName: readHostMediaAssetFileName(asset),
          title: readHostMediaAssetTitle(asset),
          mimeType: asset.mimeType,
          visibility: asset.visibility,
          previewUrl: asset.previewUrl ?? null,
        }))}
      searchValue={picker.searchValue}
      onSearchValueChange={(value) => {
        picker.setSearchValue(value);
      }}
      onClose={picker.close}
      onChangeMode={() => picker.openLibrary()}
      onAddManual={picker.close}
      onSelectAsset={(asset) => void picker.selectAsset(asset)}
      uploadPhase={picker.uploadPhase}
      onUploadFile={() => undefined}
      reviewAsset={picker.reviewAsset}
      metadataDraft={picker.metadataDraft}
      onMetadataChange={picker.updateMetadataField}
      onBackFromReview={picker.goBackFromReview}
      onConfirmSelection={() => void picker.confirmSelection()}
      isLoadingReviewAsset={picker.isLoadingReviewAsset}
      canConfirmSelection={picker.canConfirmSelection}
      isMetadataEditable={false}
      canEditCentralMetadata={false}
      canUpload={false}
      feedbackMessage={error || picker.errorCode ? t('messages.mediaPickerLoadError') : null}
      feedbackTone="error"
      labels={createStudioMediaPickerLabels(t)}
    />
  );
}
