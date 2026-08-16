import {
  getHostMediaAsset,
  getHostMediaAssetFileName,
  getHostMediaDelivery,
  isSupportedContentMediaUploadFile,
  listHostMediaAssets,
  readHostMediaAssetFileName,
  readHostMediaAssetTitle,
  readSessionAccessSnapshot,
  resolveContentMediaCapabilities,
  subscribeSessionAccessSnapshot,
  updateHostMediaAsset,
  uploadHostMediaFile,
  type HostMediaAssetDetail,
  type HostMediaAssetListItem,
} from '@sva/plugin-sdk';
import {
  isPersistableContentMediaUrl,
  useStudioMediaPickerOverlay,
  type StudioMediaPickerAssetDetail,
  type StudioMediaPickerAssetSummary,
} from '@sva/studio-ui-react';
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';

export type WasteBrandingMediaPickerAsset = StudioMediaPickerAssetDetail;

export const toMediaPickerSummary = (
  asset: HostMediaAssetListItem
): StudioMediaPickerAssetSummary => ({
  id: asset.id,
  title: readHostMediaAssetTitle(asset),
  fileName: readHostMediaAssetFileName(asset),
  previewUrl: asset.previewUrl,
  mimeType: asset.mimeType,
  visibility: asset.visibility,
});

const toMediaPickerDetail = (
  asset: HostMediaAssetDetail,
  persistentUrl: string | null,
  summary?: HostMediaAssetListItem
): WasteBrandingMediaPickerAsset => {
  const fileName = summary ? readHostMediaAssetFileName(summary) : getHostMediaAssetFileName(asset);
  const title =
    asset.metadata.title?.trim() || (summary ? readHostMediaAssetTitle(summary) : fileName);
  return {
    id: asset.id,
    title,
    fileName,
    previewUrl: asset.previewUrl?.trim() || summary?.previewUrl?.trim() || null,
    mimeType: asset.mimeType,
    visibility: asset.visibility,
    persistentUrl,
    metadata: {
      title,
      altText: asset.metadata.altText?.trim() ?? '',
      description: asset.metadata.description?.trim() ?? '',
      copyright: asset.metadata.copyright?.trim() ?? '',
      license: asset.metadata.license?.trim() ?? '',
    },
  };
};

const isPublicPersistableAsset = (asset: WasteBrandingMediaPickerAsset): boolean =>
  asset.visibility === 'public' &&
  Boolean(asset.persistentUrl && isPersistableContentMediaUrl(asset.persistentUrl));

const useMediaLibrary = () => {
  const sessionAccess = useSyncExternalStore(
    subscribeSessionAccessSnapshot,
    readSessionAccessSnapshot,
    readSessionAccessSnapshot
  );
  const capabilities = useMemo(
    () =>
      resolveContentMediaCapabilities({
        canEditContent:
          sessionAccess.isResolved &&
          sessionAccess.permissionActions.includes('waste-management.settings.manage'),
        permissionActions: sessionAccess.permissionActions,
      }),
    [sessionAccess.isResolved, sessionAccess.permissionActions]
  );
  const [assets, setAssets] = useState<readonly HostMediaAssetListItem[]>([]);
  const assetsRef = useRef<readonly HostMediaAssetListItem[]>([]);
  const refresh = useCallback(async () => {
    try {
      const nextAssets = await listHostMediaAssets({
        fetch: globalThis.fetch.bind(globalThis),
        visibility: 'public',
      });
      assetsRef.current = nextAssets;
      setAssets(nextAssets);
      return nextAssets;
    } catch {
      assetsRef.current = [];
      setAssets([]);
      return [];
    }
  }, []);
  return { assets, assetsRef, capabilities, refresh, setAssets };
};

export const useWasteBrandingMediaController = (onChange: (value: string) => void) => {
  const library = useMediaLibrary();
  const loadAsset = useCallback(
    async (assetId: string) => {
      const [asset, delivery] = await Promise.all([
        getHostMediaAsset({ fetch: globalThis.fetch.bind(globalThis), assetId }),
        getHostMediaDelivery({ fetch: globalThis.fetch.bind(globalThis), assetId }),
      ]);
      const persistentUrl =
        delivery.isPublicUrl && isPersistableContentMediaUrl(delivery.deliveryUrl)
          ? delivery.deliveryUrl
          : null;
      return toMediaPickerDetail(
        asset,
        persistentUrl,
        library.assetsRef.current.find((entry) => entry.id === assetId)
      );
    },
    [library.assetsRef]
  );
  const picker = useStudioMediaPickerOverlay<WasteBrandingMediaPickerAsset>({
    onAccept: (asset) =>
      asset.persistentUrl && isPublicPersistableAsset(asset) && onChange(asset.persistentUrl),
    canAcceptAsset: isPublicPersistableAsset,
    editableMetadataFields: library.capabilities.canEditAssetMetadata
      ? ['title', 'altText', 'description', 'copyright', 'license']
      : [],
    isSupportedUploadFile: isSupportedContentMediaUploadFile,
    uploadAsset: async (file) => {
      const uploaded = await uploadHostMediaFile({
        fetch: globalThis.fetch.bind(globalThis),
        file,
        mediaType: 'image',
        visibility: 'public',
      });
      await library.refresh();
      return { assetId: uploaded.assetId, previewUrl: uploaded.previewUrl };
    },
    loadAsset,
    saveAssetMetadata: async (assetId, metadata) => {
      await updateHostMediaAsset({
        fetch: globalThis.fetch.bind(globalThis),
        assetId,
        metadata,
        visibility: 'public',
      });
      await library.refresh();
      return loadAsset(assetId);
    },
  });
  useEffect(() => {
    if (library.capabilities.canSelect) {
      void library.refresh();
    } else {
      library.setAssets([]);
      library.assetsRef.current = [];
      picker.close();
    }
  }, [
    library.assetsRef,
    library.capabilities.canSelect,
    library.refresh,
    library.setAssets,
    picker.close,
  ]);
  return {
    mediaAssets: library.assets,
    mediaCapabilities: library.capabilities,
    mediaPicker: picker,
  };
};
