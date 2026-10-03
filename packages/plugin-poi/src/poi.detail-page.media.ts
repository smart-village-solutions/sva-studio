import React from 'react';
import type { UseFormReturn } from 'react-hook-form';
import {
  listHostMediaAssets,
  readHostMediaAssetFileName as readAssetFileName,
  readHostMediaAssetTitle as readAssetTitle,
  type HostMediaAssetListItem,
  usePluginTranslation,
} from '@sva/plugin-sdk';
import {
  useStudioMediaReferenceSync,
  type ContentMediaUsage,
  type StudioMediaPickerAssetSummary,
} from '@sva/studio-ui-react';
import type { PoiDetailFormValues } from './poi.detail-form.js';
import { usePoiMediaPicker } from './poi.detail-page.media-picker.js';

export const toPoiMediaPickerSummary = (
  asset: HostMediaAssetListItem
): StudioMediaPickerAssetSummary => ({
  id: asset.id,
  title: readAssetTitle(asset),
  fileName: readAssetFileName(asset),
  previewUrl: asset.previewUrl,
  mimeType: asset.mimeType,
  visibility: asset.visibility,
});

type MediaInput = Readonly<{
  instanceId?: string;
  mode: 'create' | 'edit';
  methods: UseFormReturn<PoiDetailFormValues>;
  pt: ReturnType<typeof usePluginTranslation>;
}>;

export const usePoiDetailMedia = ({ instanceId, mode, methods, pt }: MediaInput) => {
  const [mediaAssets, setMediaAssets] = React.useState<readonly HostMediaAssetListItem[]>([]);
  const [mediaUsages, setMediaUsages] = React.useState<readonly ContentMediaUsage[]>([]);
  const mediaReferenceSync = useStudioMediaReferenceSync({ mediaUsages, setMediaUsages });
  const [requiresReferenceSync, setRequiresReferenceSync] = React.useState(false);
  const [mediaReferencesReady, setMediaReferencesReady] = React.useState(mode === 'create');
  const mediaAssetsRef = React.useRef<readonly HostMediaAssetListItem[]>([]);
  const refreshMediaAssets = React.useCallback(async () => {
    try {
      const assets = await listHostMediaAssets({
        fetch: globalThis.fetch.bind(globalThis),
        instanceId,
        visibility: 'public',
      });
      mediaAssetsRef.current = assets;
      setMediaAssets(assets);
      return assets;
    } catch {
      mediaAssetsRef.current = [];
      setMediaAssets([]);
      return [];
    }
  }, [instanceId]);
  const picker = usePoiMediaPicker({
    instanceId,
    methods,
    pt,
    mediaUsages,
    setMediaUsages,
    setRequiresReferenceSync,
    mediaAssetsRef,
    refreshMediaAssets,
  });
  return {
    mediaAssets,
    mediaUsages,
    setMediaUsages,
    mediaReferenceSync,
    requiresReferenceSync,
    setRequiresReferenceSync,
    mediaReferencesReady,
    setMediaReferencesReady,
    refreshMediaAssets,
    ...picker,
  };
};
