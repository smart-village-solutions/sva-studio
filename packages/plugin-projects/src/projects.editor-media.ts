import {
  getHostMediaAsset,
  getHostMediaAssetFileName,
  getHostMediaDelivery,
  listHostMediaAssets,
  updateHostMediaAsset,
  type HostMediaAssetDetail,
  type HostMediaAssetListItem,
} from '@sva/plugin-sdk';
import {
  createLocalStudioMediaPickerAsset,
  createManualContentMediaUsage,
  isPersistableContentMediaUrl,
  useStudioMediaPickerOverlay,
  type ContentMediaUsage,
  type StudioMediaPickerAssetDetail,
} from '@sva/studio-ui-react';
import * as React from 'react';
import type { UseFormReturn } from 'react-hook-form';
import {
  projectAssetToMediaUsage,
  projectMediaUsagesToImages,
  resolveProjectPersistentDeliveryUrl,
} from './projects.content-media-adapter.js';
import type { ProjectFormValues } from './projects.validation.js';

export const toPickerSummary = (asset: HostMediaAssetListItem) => ({
  id: asset.id,
  title:
    (typeof asset.metadata?.title === 'string' ? asset.metadata.title.trim() : '') ||
    asset.fileName?.trim() ||
    asset.id,
  fileName: asset.fileName?.trim() || asset.id,
  previewUrl: asset.previewUrl?.trim() || null,
  mimeType: asset.mimeType,
  visibility: asset.visibility,
});

const toPickerDetail = (
  asset: HostMediaAssetDetail,
  summary: HostMediaAssetListItem | undefined,
  persistentUrl: string | null
): StudioMediaPickerAssetDetail => {
  const fileName = summary?.fileName?.trim() || getHostMediaAssetFileName(asset);
  const summaryTitle =
    typeof summary?.metadata?.title === 'string' ? summary.metadata.title.trim() : '';
  const title = asset.metadata.title?.trim() || summaryTitle || fileName;
  return {
    id: asset.id,
    title,
    fileName,
    persistentUrl,
    previewUrl: asset.previewUrl?.trim() || summary?.previewUrl?.trim() || null,
    mimeType: asset.mimeType,
    visibility: asset.visibility,
    metadata: {
      title,
      altText: asset.metadata.altText?.trim() ?? '',
      description: asset.metadata.description?.trim() ?? '',
      copyright: asset.metadata.copyright?.trim() ?? '',
      license: asset.metadata.license?.trim() ?? '',
    },
  };
};

type MediaInput = Readonly<{
  form: UseFormReturn<ProjectFormValues>;
  mediaUsages: readonly ContentMediaUsage[];
  setMediaUsages: React.Dispatch<React.SetStateAction<readonly ContentMediaUsage[]>>;
  setRequiresReferenceSync: React.Dispatch<React.SetStateAction<boolean>>;
}>;

type PickerInput = MediaInput &
  Readonly<{
    mediaAssetsRef: React.RefObject<readonly HostMediaAssetListItem[]>;
    refreshMediaAssets: () => Promise<readonly HostMediaAssetListItem[]>;
  }>;

function acceptProjectMedia(asset: StudioMediaPickerAssetDetail, input: PickerInput) {
  if (
    !asset.localDraft &&
    (!asset.persistentUrl || !isPersistableContentMediaUrl(asset.persistentUrl))
  )
    return;
  const usage = {
    ...projectAssetToMediaUsage({
      assetId: asset.id,
      persistentUrl: asset.localDraft ? '' : (asset.persistentUrl ?? ''),
      previewUrl: asset.previewUrl,
      metadata: { ...asset.metadata, fileName: asset.fileName },
      sortOrder: input.mediaUsages.length,
    }),
    assetId: asset.localDraft ? undefined : asset.id,
    localDraft: asset.localDraft,
  };
  const next = [...input.mediaUsages, usage];
  input.setMediaUsages(next);
  input.form.setValue(
    'images',
    [...projectMediaUsagesToImages(next.filter((entry) => !entry.localDraft))],
    { shouldDirty: true, shouldValidate: true }
  );
  input.setRequiresReferenceSync(true);
  void input.refreshMediaAssets();
}

function useProjectMediaPicker(input: PickerInput) {
  return useStudioMediaPickerOverlay<StudioMediaPickerAssetDetail>({
    onAccept: (asset) => acceptProjectMedia(asset, input),
    canAcceptAsset: (asset) =>
      Boolean(
        (asset.localDraft ||
          (asset.persistentUrl && isPersistableContentMediaUrl(asset.persistentUrl))) &&
        input.mediaUsages.every((usage) => usage.assetId !== asset.id)
      ),
    isSupportedUploadFile: (file) => ['image/jpeg', 'image/png', 'image/webp'].includes(file.type),
    createLocalAsset: createLocalStudioMediaPickerAsset,
    loadAsset: async (assetId) => {
      const [asset, delivery] = await Promise.all([
        getHostMediaAsset({ fetch: globalThis.fetch.bind(globalThis), assetId }),
        getHostMediaDelivery({ fetch: globalThis.fetch.bind(globalThis), assetId }),
      ]);
      return toPickerDetail(
        asset,
        input.mediaAssetsRef.current.find((item) => item.id === assetId),
        resolveProjectPersistentDeliveryUrl(delivery)
      );
    },
    saveAssetMetadata: async (assetId, metadata) => {
      const asset = await updateHostMediaAsset({
        fetch: globalThis.fetch.bind(globalThis),
        assetId,
        visibility: 'public',
        metadata,
      });
      const delivery = await getHostMediaDelivery({
        fetch: globalThis.fetch.bind(globalThis),
        assetId,
      });
      const assets = await input.refreshMediaAssets();
      return toPickerDetail(
        asset,
        assets.find((item) => item.id === assetId),
        resolveProjectPersistentDeliveryUrl(delivery)
      );
    },
  });
}

export function useProjectEditorMedia(input: MediaInput) {
  const [mediaAssets, setMediaAssets] = React.useState<readonly HostMediaAssetListItem[]>([]);
  const mediaAssetsRef = React.useRef(mediaAssets);
  const refreshMediaAssets = React.useCallback(async () => {
    try {
      const assets = (
        await listHostMediaAssets({
          fetch: globalThis.fetch.bind(globalThis),
          visibility: 'public',
        })
      ).filter((asset) => asset.mimeType?.startsWith('image/'));
      mediaAssetsRef.current = assets;
      setMediaAssets(assets);
      return assets;
    } catch {
      mediaAssetsRef.current = [];
      setMediaAssets([]);
      return [];
    }
  }, []);
  const mediaPicker = useProjectMediaPicker({ ...input, mediaAssetsRef, refreshMediaAssets });
  const addManualMedia = React.useCallback(() => {
    const usage = createManualContentMediaUsage({ sortOrder: input.mediaUsages.length });
    const nextUsages = [...input.mediaUsages, usage];
    input.setMediaUsages(nextUsages);
    input.form.setValue('images', [...projectMediaUsagesToImages(nextUsages)], {
      shouldDirty: true,
      shouldValidate: true,
    });
    input.setRequiresReferenceSync(
      (current) => current || nextUsages.some((entry) => Boolean(entry.assetId))
    );
    return usage.uiId;
  }, [input.form, input.mediaUsages, input.setMediaUsages, input.setRequiresReferenceSync]);
  React.useEffect(() => {
    void refreshMediaAssets();
  }, [refreshMediaAssets]);
  return { mediaAssets, mediaPicker, addManualMedia };
}
