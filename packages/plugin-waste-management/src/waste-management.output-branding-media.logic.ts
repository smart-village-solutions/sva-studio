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
  type HostMediaUploadCheckpoint,
  type HostMediaAssetDetail,
  type HostMediaAssetListItem,
} from '@sva/plugin-sdk';
import {
  isPersistableContentMediaUrl,
  revokeBrowserObjectUrl,
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
      tags: asset.metadata.tags,
    },
    instanceId: asset.instanceId,
    hasEditingDocument: asset.hasEditingDocument,
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
  const [error, setError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const assetsRef = useRef<readonly HostMediaAssetListItem[]>([]);
  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const nextAssets = await listHostMediaAssets({
        fetch: globalThis.fetch.bind(globalThis),
        visibility: 'public',
      });
      assetsRef.current = nextAssets;
      setAssets(nextAssets);
      setError(false);
      return nextAssets;
    } catch {
      setError(true);
      return assetsRef.current;
    } finally {
      setIsLoading(false);
    }
  }, []);
  return { assets, assetsRef, capabilities, error, isLoading, refresh, setAssets, setError };
};

const acceptBrandingMediaAsset = async (
  asset: WasteBrandingMediaPickerAsset,
  loadAsset: (assetId: string) => Promise<WasteBrandingMediaPickerAsset>,
  refresh: () => Promise<readonly HostMediaAssetListItem[]>,
  onChange: (value: string) => void,
  checkpoint: { current: { draftId: string; upload: HostMediaUploadCheckpoint } | null },
  onInitialize: (draftId: string) => void
) => {
  let selected = asset;
  if (asset.localDraft?.editing) {
    const uploaded = await uploadHostMediaFile({
      fetch: globalThis.fetch.bind(globalThis),
      file: asset.localDraft.file,
      checkpoint:
        checkpoint.current?.draftId === asset.localDraft.id ? checkpoint.current.upload : undefined,
      onCheckpoint: (upload) => {
        checkpoint.current = { draftId: asset.localDraft!.id, upload };
        onInitialize(asset.localDraft!.id);
      },
      visibility: 'public',
      editing: asset.localDraft.editing,
      metadata: {
        ...asset.localDraft.metadata,
        ...asset.metadata,
        tags: asset.metadata.tags ? [...asset.metadata.tags] : undefined,
      },
    });
    selected = await loadAsset(uploaded.assetId);
    await refresh();
  }
  if (!selected.persistentUrl || !isPublicPersistableAsset(selected))
    throw new Error('media_asset_unavailable');
  onChange(selected.persistentUrl);
  if (asset.localDraft) revokeBrowserObjectUrl(asset.previewUrl);
};

const uploadBrandingFile = async (
  file: File,
  refresh: () => Promise<readonly HostMediaAssetListItem[]>
) => {
  const uploaded = await uploadHostMediaFile({
    fetch: globalThis.fetch.bind(globalThis),
    file,
    mediaType: 'image',
    visibility: 'public',
  });
  await refresh();
  return { assetId: uploaded.assetId, previewUrl: uploaded.previewUrl };
};

export const useWasteBrandingMediaController = (onChange: (value: string) => void) => {
  const library = useMediaLibrary();
  const [initializedDraftId, setInitializedDraftId] = useState<string | null>(null);
  const checkpoint = useRef<{ draftId: string; upload: HostMediaUploadCheckpoint } | null>(null);
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
    persistenceContext: 'settings',
    onAccept: (asset) =>
      acceptBrandingMediaAsset(
        asset,
        loadAsset,
        library.refresh,
        onChange,
        checkpoint,
        setInitializedDraftId
      ),
    canAcceptAsset: (asset) =>
      Boolean(asset.localDraft?.editing) || isPublicPersistableAsset(asset),
    isSupportedUploadFile: isSupportedContentMediaUploadFile,
    uploadAsset: (file) => uploadBrandingFile(file, library.refresh),
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
      library.setError(false);
      library.assetsRef.current = [];
      picker.close();
    }
  }, [
    library.assetsRef,
    library.capabilities.canSelect,
    library.refresh,
    library.setAssets,
    library.setError,
    picker.close,
  ]);
  return {
    isUploadInitialized: initializedDraftId === picker.reviewAsset?.localDraft?.id,
    mediaAssets: library.assets,
    mediaCapabilities: library.capabilities,
    mediaLibraryError: library.error,
    isMediaLibraryLoading: library.isLoading,
    retryMediaLibrary: library.refresh,
    mediaPicker: picker,
  };
};
