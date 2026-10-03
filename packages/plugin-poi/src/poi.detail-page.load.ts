import React from 'react';
import type { UseFormReturn } from 'react-hook-form';
import {
  alignHostMediaReferencesByOrder,
  listHostMediaReferencesByTarget,
  usePluginTranslation,
} from '@sva/plugin-sdk';
import type { ContentMediaUsage, MainserverPrincipalType } from '@sva/studio-ui-react';
import { getPoiDetail, listPoiCategories, PoiApiError } from './poi.api.js';
import { mapPoiItemToDetailFormValues, type PoiDetailFormValues } from './poi.detail-form.js';
import { poiMediaContentsToUsages } from './poi.content-media-adapter.js';
import type { PoiContentItem } from './poi.types.js';
import type { PoiStatusMessage } from './poi.detail-page.save.js';

type LoadInput = Readonly<{
  mode: 'create' | 'edit';
  contentId?: string;
  instanceId?: string;
  initialPrincipalType: MainserverPrincipalType;
  actingPrincipalType: MainserverPrincipalType;
  methods: UseFormReturn<PoiDetailFormValues>;
  pt: ReturnType<typeof usePluginTranslation>;
  refreshMediaAssets: () => Promise<readonly import('@sva/plugin-sdk').HostMediaAssetListItem[]>;
  setMediaUsages: React.Dispatch<React.SetStateAction<readonly ContentMediaUsage[]>>;
  setRequiresReferenceSync: React.Dispatch<React.SetStateAction<boolean>>;
  setMediaReferencesReady: React.Dispatch<React.SetStateAction<boolean>>;
  setStatus: React.Dispatch<React.SetStateAction<PoiStatusMessage | null>>;
  loadedItem: PoiContentItem | null;
  setLoadedItem: React.Dispatch<React.SetStateAction<PoiContentItem | null>>;
  setLoading: React.Dispatch<React.SetStateAction<boolean>>;
  setDeviations: React.Dispatch<React.SetStateAction<readonly { fieldGroup: string }[]>>;
  setResourceAccess: React.Dispatch<React.SetStateAction<Readonly<Record<string, boolean>>>>;
  setCategoryOptions: React.Dispatch<
    React.SetStateAction<readonly import('./poi.types.js').PoiCategoryOption[]>
  >;
  setCategoryOptionsLoading: React.Dispatch<React.SetStateAction<boolean>>;
  setCategoryOptionsError: React.Dispatch<React.SetStateAction<string | null>>;
}>;

const errorMessage = (pt: LoadInput['pt'], error: unknown, fallbackKey: string) =>
  error instanceof PoiApiError ? error.message : pt(fallbackKey);

const usePoiCategoryOptions = (input: LoadInput) => {
  const {
    pt,
    refreshMediaAssets,
    setCategoryOptions,
    setCategoryOptionsError,
    setCategoryOptionsLoading,
  } = input;
  React.useEffect(() => {
    void listPoiCategories()
      .then((categories) => {
        setCategoryOptions(categories);
        setCategoryOptionsError(null);
      })
      .catch((loadError: unknown) => {
        setCategoryOptions([]);
        setCategoryOptionsError(errorMessage(pt, loadError, 'messages.categoryOptionsLoadError'));
      })
      .finally(() => setCategoryOptionsLoading(false));
    void refreshMediaAssets();
  }, [pt, refreshMediaAssets]);
};

const loadPoiReferences = (
  input: LoadInput,
  mediaContents: NonNullable<PoiContentItem['mediaContents']>,
  isActive: () => boolean
) => {
  const {
    contentId,
    instanceId,
    methods,
    setMediaUsages,
    setRequiresReferenceSync,
    setMediaReferencesReady,
    setStatus,
    pt,
  } = input;
  void listHostMediaReferencesByTarget({
    fetch: globalThis.fetch.bind(globalThis),
    targetType: 'poi.point-of-interest',
    targetId: contentId as string,
    instanceId,
  })
    .then((references) => {
      if (!isActive()) return;
      if (!methods.getFieldState('content.mediaContents').isDirty) {
        setMediaUsages(
          poiMediaContentsToUsages(
            mediaContents,
            alignHostMediaReferencesByOrder({
              itemCount: mediaContents.length,
              role: 'gallery_item',
              references,
            })
          )
        );
      }
      setRequiresReferenceSync(
        (current) =>
          current || references.length > 0 || methods.getFieldState('content.mediaContents').isDirty
      );
      setMediaReferencesReady(true);
    })
    .catch(() => {
      if (isActive()) setStatus({ kind: 'error', text: pt('messages.mediaReferenceLoadError') });
    });
};

const usePoiInitialDetail = (
  input: LoadInput,
  loadedPrincipalTypeRef: React.MutableRefObject<MainserverPrincipalType | undefined>
) => {
  const {
    mode,
    contentId,
    initialPrincipalType,
    methods,
    pt,
    setDeviations,
    setResourceAccess,
    setMediaUsages,
    setRequiresReferenceSync,
    setLoadedItem,
    setLoading,
    setStatus,
    instanceId,
  } = input;
  const { reset } = methods;
  React.useEffect(() => {
    if (mode !== 'edit' || !contentId) return;
    let active = true;
    void getPoiDetail(contentId, initialPrincipalType)
      .then((detail) => {
        if (!active) return;
        const item = detail.data;
        setDeviations(detail.deviations);
        setResourceAccess(detail.access);
        loadedPrincipalTypeRef.current = initialPrincipalType;
        reset(mapPoiItemToDetailFormValues(item));
        const mediaContents = item.mediaContents ?? [];
        setMediaUsages(poiMediaContentsToUsages(mediaContents));
        setRequiresReferenceSync(false);
        setLoadedItem(item);
        setLoading(false);
        loadPoiReferences(input, mediaContents, () => active);
      })
      .catch((loadError) => {
        if (!active) return;
        setStatus({ kind: 'error', text: errorMessage(pt, loadError, 'messages.missingContent') });
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [contentId, instanceId, mode, pt, reset]);
};

const usePoiAccessRefresh = (
  input: LoadInput,
  loadedPrincipalTypeRef: React.MutableRefObject<MainserverPrincipalType | undefined>
) => {
  const { mode, contentId, loadedItem, actingPrincipalType, setResourceAccess } = input;
  React.useEffect(() => {
    if (
      mode !== 'edit' ||
      !contentId ||
      !loadedItem ||
      loadedPrincipalTypeRef.current === actingPrincipalType
    )
      return;
    let active = true;
    void getPoiDetail(contentId, actingPrincipalType)
      .then((detail) => {
        if (!active) return;
        setResourceAccess(detail.access);
        loadedPrincipalTypeRef.current = actingPrincipalType;
      })
      .catch(() => {
        if (active) setResourceAccess({});
      });
    return () => {
      active = false;
    };
  }, [actingPrincipalType, contentId, loadedItem, mode]);
};

export const usePoiDetailLoad = (input: LoadInput) => {
  const loadedPrincipalTypeRef = React.useRef<MainserverPrincipalType | undefined>(undefined);
  usePoiCategoryOptions(input);
  usePoiInitialDetail(input, loadedPrincipalTypeRef);
  usePoiAccessRefresh(input, loadedPrincipalTypeRef);
};
