import {
  getHostMediaAsset,
  getHostMediaAssetFileName,
  getHostMediaDelivery,
  isMp3UploadFile,
  listHostMediaAssets,
  readHostMediaAssetFileName,
  readHostMediaAssetTitle,
  type HostMediaAssetListItem,
} from '@sva/plugin-sdk';
import {
  createLocalStudioMediaPickerAsset,
  isPersistableContentMediaUrl,
  useStudioMediaPickerOverlay,
  type StudioMediaPickerAssetDetail,
} from '@sva/studio-ui-react';
import { useState } from 'react';

const librarySummary = (asset: HostMediaAssetListItem) => ({
  id: asset.id,
  title: readHostMediaAssetTitle(asset),
  fileName: readHostMediaAssetFileName(asset),
  previewUrl: asset.previewUrl,
  mimeType: asset.mimeType,
  visibility: asset.visibility,
});

const loadAudioAsset = async (assetId: string, instanceId?: string) => {
  const input = { fetch: globalThis.fetch.bind(globalThis), assetId, instanceId };
  const [asset, delivery] = await Promise.all([
    getHostMediaAsset(input),
    getHostMediaDelivery(input),
  ]);
  if (
    asset.visibility !== 'public' ||
    asset.mimeType !== 'audio/mpeg' ||
    delivery.isPublicUrl !== true ||
    !isPersistableContentMediaUrl(delivery.deliveryUrl)
  )
    throw new Error('audio_public_delivery_unavailable');

  const fileName = getHostMediaAssetFileName(asset);
  const title = asset.metadata.title || fileName;
  return {
    id: assetId,
    title,
    fileName,
    mimeType: asset.mimeType,
    visibility: asset.visibility,
    persistentUrl: delivery.deliveryUrl,
    previewUrl: delivery.deliveryUrl,
    metadata: {
      title,
      altText: '',
      description: asset.metadata.description ?? '',
      copyright: asset.metadata.copyright ?? '',
      license: '',
    },
  };
};

export function useTourAudioLibrary(
  instanceId: string | undefined,
  onAccept: (asset: StudioMediaPickerAssetDetail) => void
) {
  const [assets, setAssets] = useState<readonly HostMediaAssetListItem[]>([]);
  const [libraryState, setLibraryState] = useState<'loading' | 'error'>();
  const refreshAssetList = async () => {
    setLibraryState('loading');
    try {
      const result = await listHostMediaAssets({
        fetch: globalThis.fetch.bind(globalThis),
        instanceId,
        visibility: 'public',
      });
      setAssets(result.filter((asset) => asset.mimeType === 'audio/mpeg'));
      setLibraryState(undefined);
    } catch {
      setLibraryState('error');
    }
  };
  const picker = useStudioMediaPickerOverlay<StudioMediaPickerAssetDetail>({
    isSupportedUploadFile: isMp3UploadFile,
    createLocalAsset: createLocalStudioMediaPickerAsset,
    loadAsset: (assetId) => loadAudioAsset(assetId, instanceId),
    saveAssetMetadata: async () => {
      throw new Error('audio_library_metadata_read_only');
    },
    onAccept,
  });
  return { picker, assets: assets.map(librarySummary), libraryState, refreshAssetList };
}
