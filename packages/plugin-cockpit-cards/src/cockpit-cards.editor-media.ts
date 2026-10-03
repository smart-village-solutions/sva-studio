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
  toContentMediaAssetSnapshot,
  useStudioMediaPickerOverlay,
  type ContentMediaUsage,
  type StudioMediaPickerAssetDetail,
} from '@sva/studio-ui-react';
import * as React from 'react';
import type { UseFormReturn } from 'react-hook-form';

import { cockpitCardUsagesToMedia } from './cockpit-cards.content-media-adapter.js';
import type { CockpitCardFormValues } from './cockpit-cards.types.js';

export const cockpitCardMetadataFields = ['altText'] as const;
const hasPersistablePublicDelivery = (delivery: { readonly deliveryUrl: string }): boolean =>
  (delivery as { readonly isPublicUrl?: unknown }).isPublicUrl === true &&
  isPersistableContentMediaUrl(delivery.deliveryUrl);

type SetUsages = React.Dispatch<React.SetStateAction<readonly ContentMediaUsage[]>>;
type SetSync = React.Dispatch<React.SetStateAction<boolean>>;

function useMediaAssets() {
  const [mediaAssets, setMediaAssets] = React.useState<readonly HostMediaAssetListItem[]>([]);
  const mediaAssetsRef = React.useRef<readonly HostMediaAssetListItem[]>([]);
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
  React.useEffect(() => {
    void refreshMediaAssets();
  }, [refreshMediaAssets]);
  const toDetail = React.useCallback(
    (asset: HostMediaAssetDetail, persistentUrl?: string | null): StudioMediaPickerAssetDetail => {
      const summary = mediaAssetsRef.current.find((item) => item.id === asset.id);
      const fileName = summary?.fileName ?? getHostMediaAssetFileName(asset);
      return {
        id: asset.id,
        fileName,
        title: asset.metadata.title?.trim() || fileName,
        previewUrl: asset.previewUrl ?? summary?.previewUrl ?? null,
        mimeType: asset.mimeType,
        visibility: asset.visibility,
        persistentUrl,
        metadata: {
          title: asset.metadata.title ?? '',
          altText: asset.metadata.altText ?? '',
          description: asset.metadata.description ?? '',
          copyright: asset.metadata.copyright ?? '',
          license: asset.metadata.license ?? '',
        },
      };
    },
    []
  );
  return { mediaAssets, refreshMediaAssets, toDetail };
}

function acceptAsset(
  asset: StudioMediaPickerAssetDetail,
  mediaUsages: readonly ContentMediaUsage[],
  form: UseFormReturn<CockpitCardFormValues>,
  setMediaUsages: SetUsages,
  setRequiresReferenceSync: SetSync,
  refreshMediaAssets: () => Promise<readonly HostMediaAssetListItem[]>
) {
  if (
    !asset.localDraft &&
    (!asset.persistentUrl || !isPersistableContentMediaUrl(asset.persistentUrl))
  )
    return;
  const persistentUrl = asset.localDraft ? '' : (asset.persistentUrl ?? '');
  const usage: ContentMediaUsage = {
    uiId: `cockpit-card-asset-${asset.id}-${mediaUsages.length}`,
    assetId: asset.localDraft ? undefined : asset.id,
    localDraft: asset.localDraft,
    persistentUrl,
    previewUrl: asset.previewUrl ?? undefined,
    altText: asset.metadata.altText || asset.fileName,
    caption: asset.metadata.description || asset.title,
    credit: asset.metadata.copyright,
    license: asset.metadata.license,
    role: 'gallery_item',
    sortOrder: mediaUsages.length,
    referenceStatus: 'pending',
    assetSnapshot: toContentMediaAssetSnapshot({
      persistentUrl,
      altText: asset.metadata.altText || asset.fileName,
      caption: asset.metadata.description || asset.title,
      credit: asset.metadata.copyright,
      license: asset.metadata.license,
    }),
  };
  const next = [...mediaUsages, usage];
  setMediaUsages(next);
  form.setValue(
    'images',
    [...cockpitCardUsagesToMedia(next.filter((entry) => !entry.localDraft))],
    { shouldDirty: true }
  );
  setRequiresReferenceSync(true);
  void refreshMediaAssets();
}

export function useCockpitCardMedia(form: UseFormReturn<CockpitCardFormValues>) {
  const [mediaUsages, setMediaUsages] = React.useState<readonly ContentMediaUsage[]>([]);
  const [requiresReferenceSync, setRequiresReferenceSync] = React.useState(false);
  const { mediaAssets, refreshMediaAssets, toDetail } = useMediaAssets();
  const mediaPicker = useStudioMediaPickerOverlay<StudioMediaPickerAssetDetail>({
    editableMetadataFields: cockpitCardMetadataFields,
    onAccept: (asset) =>
      acceptAsset(
        asset,
        mediaUsages,
        form,
        setMediaUsages,
        setRequiresReferenceSync,
        refreshMediaAssets
      ),
    canAcceptAsset: (asset) =>
      Boolean(
        (asset.localDraft ||
          (asset.persistentUrl && isPersistableContentMediaUrl(asset.persistentUrl))) &&
        !mediaUsages.some((usage) => usage.assetId === asset.id)
      ),
    isSupportedUploadFile: (file) => ['image/jpeg', 'image/png', 'image/webp'].includes(file.type),
    createLocalAsset: createLocalStudioMediaPickerAsset,
    loadAsset: async (assetId) => {
      const [asset, delivery] = await Promise.all([
        getHostMediaAsset({ fetch: globalThis.fetch.bind(globalThis), assetId }),
        getHostMediaDelivery({ fetch: globalThis.fetch.bind(globalThis), assetId }),
      ]);
      return toDetail(asset, hasPersistablePublicDelivery(delivery) ? delivery.deliveryUrl : null);
    },
    saveAssetMetadata: async (assetId, metadata) => {
      const asset = await updateHostMediaAsset({
        fetch: globalThis.fetch.bind(globalThis),
        assetId,
        visibility: 'public',
        metadata,
      });
      await refreshMediaAssets();
      const delivery = await getHostMediaDelivery({
        fetch: globalThis.fetch.bind(globalThis),
        assetId,
      });
      return toDetail(asset, hasPersistablePublicDelivery(delivery) ? delivery.deliveryUrl : null);
    },
  });
  const addManualMedia = React.useCallback(() => {
    const usage = createManualContentMediaUsage({ sortOrder: mediaUsages.length });
    const nextUsages = [...mediaUsages, usage];
    setMediaUsages(nextUsages);
    form.setValue('images', [...cockpitCardUsagesToMedia(nextUsages)], { shouldDirty: true });
    setRequiresReferenceSync(
      (current) => current || nextUsages.some((entry) => Boolean(entry.assetId))
    );
    return usage.uiId;
  }, [form, mediaUsages]);
  const loadAssetSnapshot = (usage: ContentMediaUsage) =>
    loadCockpitCardAssetSnapshot(usage, toDetail);
  return {
    mediaUsages,
    setMediaUsages,
    requiresReferenceSync,
    setRequiresReferenceSync,
    mediaAssets,
    mediaPicker,
    addManualMedia,
    loadAssetSnapshot,
  };
}

async function loadCockpitCardAssetSnapshot(
  usage: ContentMediaUsage,
  toDetail: (
    asset: HostMediaAssetDetail,
    persistentUrl?: string | null
  ) => StudioMediaPickerAssetDetail
) {
  if (!usage.assetId) throw new Error('missing_asset_id');
  const [asset, delivery] = await Promise.all([
    getHostMediaAsset({ fetch: globalThis.fetch.bind(globalThis), assetId: usage.assetId }),
    getHostMediaDelivery({ fetch: globalThis.fetch.bind(globalThis), assetId: usage.assetId }),
  ]);
  if (!hasPersistablePublicDelivery(delivery)) throw new Error('non_persistable_delivery_url');
  const detail = toDetail(asset, delivery.deliveryUrl);
  return toContentMediaAssetSnapshot({
    persistentUrl: delivery.deliveryUrl,
    altText: detail.metadata.altText || detail.fileName,
    caption: detail.metadata.description || detail.title,
    credit: detail.metadata.copyright,
    license: detail.metadata.license,
  });
}
