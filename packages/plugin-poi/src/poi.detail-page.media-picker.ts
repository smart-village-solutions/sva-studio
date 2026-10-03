import React from 'react';
import type { UseFormReturn } from 'react-hook-form';
import {
  getHostMediaAsset,
  getHostMediaDelivery,
  getHostMediaAssetFileName,
  isSupportedContentMediaUploadFile as isSupportedUploadFile,
  readHostMediaAssetFileName as readAssetFileName,
  readHostMediaAssetTitle as readAssetTitle,
  updateHostMediaAsset,
  type HostMediaAssetDetail,
  type HostMediaAssetListItem,
  usePluginTranslation,
} from '@sva/plugin-sdk';
import {
  createLocalStudioMediaPickerAsset,
  createManualContentMediaUsage,
  isPersistableContentMediaUrl,
  resolveStudioMediaPickerFeedback,
  useStudioMediaPickerOverlay,
  type ContentMediaUsage,
  type StudioMediaPickerAssetDetail,
} from '@sva/studio-ui-react';
import { poiAssetToUsage, poiMediaUsagesToContents } from './poi.content-media-adapter.js';
import type { PoiDetailFormValues } from './poi.detail-form.js';
import { mediaContentSourceKey } from './poi.detail-media.helpers.js';

type PoiMediaPickerAsset = StudioMediaPickerAssetDetail;
type PickerInput = Readonly<{
  instanceId?: string;
  methods: UseFormReturn<PoiDetailFormValues>;
  pt: ReturnType<typeof usePluginTranslation>;
  mediaUsages: readonly ContentMediaUsage[];
  setMediaUsages: React.Dispatch<React.SetStateAction<readonly ContentMediaUsage[]>>;
  setRequiresReferenceSync: React.Dispatch<React.SetStateAction<boolean>>;
  mediaAssetsRef: React.MutableRefObject<readonly HostMediaAssetListItem[]>;
  refreshMediaAssets: () => Promise<readonly HostMediaAssetListItem[]>;
}>;

const toPoiMediaPickerDetail = (
  asset: HostMediaAssetDetail,
  summary?: HostMediaAssetListItem,
  persistentUrl?: string | null
): PoiMediaPickerAsset => {
  const fileName = summary ? readAssetFileName(summary) : getHostMediaAssetFileName(asset);
  const title = asset.metadata.title?.trim() || (summary ? readAssetTitle(summary) : fileName);
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

const isPoiAssetSelectable = (
  asset: PoiMediaPickerAsset,
  { mediaUsages, methods }: PickerInput
) => {
  if (asset.localDraft) return mediaUsages.every((usage) => usage.localDraft?.id !== asset.id);
  if (!asset.persistentUrl) return mediaUsages.every((usage) => usage.assetId !== asset.id);
  if (!isPersistableContentMediaUrl(asset.persistentUrl)) return false;
  const existingSources = new Set(
    (methods.getValues('content.mediaContents') ?? []).map(mediaContentSourceKey).filter(Boolean)
  );
  return existingSources.has(asset.persistentUrl) === false;
};

const acceptPoiAsset = (asset: PoiMediaPickerAsset, input: PickerInput) => {
  const { mediaUsages, setMediaUsages, setRequiresReferenceSync, methods, refreshMediaAssets } =
    input;
  if (
    !asset.localDraft &&
    (!asset.persistentUrl || !isPersistableContentMediaUrl(asset.persistentUrl))
  )
    return;
  const usage = {
    ...poiAssetToUsage({
      assetId: asset.id,
      persistentUrl: asset.localDraft ? '' : (asset.persistentUrl ?? ''),
      previewUrl: asset.previewUrl,
      metadata: { ...asset.metadata, fileName: asset.fileName },
      sortOrder: mediaUsages.length,
    }),
    assetId: asset.localDraft ? undefined : asset.id,
    localDraft: asset.localDraft,
  };
  const nextUsages = [...mediaUsages, usage];
  setRequiresReferenceSync(true);
  setMediaUsages(nextUsages);
  methods.setValue(
    'content.mediaContents',
    poiMediaUsagesToContents(nextUsages.filter((entry) => !entry.localDraft)),
    { shouldDirty: true }
  );
  void refreshMediaAssets();
};

const loadPoiAsset = async (assetId: string, { instanceId, mediaAssetsRef }: PickerInput) => {
  const [detail, delivery] = await Promise.all([
    getHostMediaAsset({ fetch: globalThis.fetch.bind(globalThis), assetId, instanceId }),
    getHostMediaDelivery({ fetch: globalThis.fetch.bind(globalThis), assetId, instanceId }),
  ]);
  const summary = mediaAssetsRef.current.find((asset) => asset.id === assetId);
  return toPoiMediaPickerDetail(
    detail,
    summary,
    delivery.isPublicUrl === true && isPersistableContentMediaUrl(delivery.deliveryUrl)
      ? delivery.deliveryUrl
      : null
  );
};

const savePoiAssetMetadata = async (
  assetId: string,
  metadata: Parameters<
    NonNullable<Parameters<typeof useStudioMediaPickerOverlay>[0]['saveAssetMetadata']>
  >[1],
  { instanceId, mediaAssetsRef, refreshMediaAssets }: PickerInput
) => {
  const detail = await updateHostMediaAsset({
    fetch: globalThis.fetch.bind(globalThis),
    assetId,
    metadata,
    visibility: 'public',
    instanceId,
  });
  const assets = await refreshMediaAssets();
  mediaAssetsRef.current = assets;
  const summary = mediaAssetsRef.current.find((asset) => asset.id === assetId);
  const delivery = await getHostMediaDelivery({
    fetch: globalThis.fetch.bind(globalThis),
    assetId,
    instanceId,
  });
  return toPoiMediaPickerDetail(
    detail,
    summary,
    delivery.isPublicUrl === true && isPersistableContentMediaUrl(delivery.deliveryUrl)
      ? delivery.deliveryUrl
      : null
  );
};

export const usePoiMediaPicker = (input: PickerInput) => {
  const { methods, mediaUsages, setMediaUsages, setRequiresReferenceSync, pt } = input;
  const isAssetSelectable = React.useCallback(
    (asset: PoiMediaPickerAsset) => isPoiAssetSelectable(asset, input),
    [mediaUsages, methods]
  );
  const mediaPicker = useStudioMediaPickerOverlay<PoiMediaPickerAsset>({
    onAccept: (asset) => acceptPoiAsset(asset, input),
    canAcceptAsset: isAssetSelectable,
    isSupportedUploadFile,
    createLocalAsset: createLocalStudioMediaPickerAsset,
    loadAsset: (assetId) => loadPoiAsset(assetId, input),
    saveAssetMetadata: (assetId, metadata) => savePoiAssetMetadata(assetId, metadata, input),
  });
  const addManualMedia = React.useCallback(() => {
    const usage = createManualContentMediaUsage({ sortOrder: mediaUsages.length });
    const nextUsages = [...mediaUsages, usage];
    setMediaUsages(nextUsages);
    methods.setValue('content.mediaContents', poiMediaUsagesToContents(nextUsages), {
      shouldDirty: true,
    });
    setRequiresReferenceSync(
      (current) => current || nextUsages.some((entry) => Boolean(entry.assetId))
    );
    return usage.uiId;
  }, [mediaUsages, methods]);
  const mediaPickerFeedback = React.useMemo(
    () => resolveStudioMediaPickerFeedback(pt, mediaPicker.errorCode, mediaPicker.uploadPhase),
    [mediaPicker.errorCode, mediaPicker.uploadPhase, pt]
  );
  return { isAssetSelectable, mediaPicker, addManualMedia, mediaPickerFeedback };
};
