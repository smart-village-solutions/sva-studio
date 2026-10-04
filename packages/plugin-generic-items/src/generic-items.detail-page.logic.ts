import {
  listHostMediaAssets,
  uploadHostMediaFile,
  usePluginTranslation,
  type HostMediaAssetListItem,
} from '@sva/plugin-sdk';
import { type NavigateFn } from '@tanstack/react-router';
import {
  addStudioDestructiveNavigationFeedback,
  type MainserverPrincipalType,
} from '@sva/studio-ui-react';
import React from 'react';
import type { UseFormReturn } from 'react-hook-form';

import {
  deleteGenericItem,
  GenericItemsApiError,
  getGenericItemDetail,
  listGenericItemCategories,
} from './generic-items.api.js';
import type { GenericItemCategoryOption } from './generic-items.api-types.js';
import { mapGenericItemToDetailFormValues } from './generic-items.detail-form.js';
import type { GenericItemsDetailTabId } from './generic-items.detail-tabs.js';
import type { GenericItemsDetailFormValues } from './generic-items.validation.js';

export type StatusMessage = Readonly<{
  kind: 'success' | 'error';
  text: string;
}>;

const genericItemsListNavigationTarget = {
  to: '/admin/content',
  search: { type: 'generic-items.generic-item' },
} as const;

const errorMessage = (
  pt: ReturnType<typeof usePluginTranslation>,
  error: unknown,
  fallbackKey: string
) => (error instanceof GenericItemsApiError ? error.message : pt(fallbackKey));

export const useGenericItemsMediaAssets = () => {
  const [mediaAssets, setMediaAssets] = React.useState<readonly HostMediaAssetListItem[]>([]);

  const refreshMediaAssets = React.useCallback(async () => {
    try {
      const assets = await listHostMediaAssets({
        fetch: globalThis.fetch.bind(globalThis),
        visibility: 'public',
      });
      setMediaAssets(assets);
      return assets;
    } catch {
      setMediaAssets([]);
      return [];
    }
  }, []);

  const uploadMediaFile = React.useCallback(
    async (file: File): Promise<HostMediaAssetListItem> => {
      const uploaded = await uploadHostMediaFile({
        fetch: globalThis.fetch.bind(globalThis),
        file,
        mediaType: 'image',
        visibility: 'public',
      });
      const assets = await refreshMediaAssets();
      const uploadedAsset = assets.find((asset) => asset.id === uploaded.assetId);
      if (!uploadedAsset) {
        throw new Error('generic_items_media_uploaded_asset_not_found');
      }
      return uploadedAsset;
    },
    [refreshMediaAssets]
  );

  React.useEffect(() => {
    void refreshMediaAssets();
  }, [refreshMediaAssets]);

  return { mediaAssets, refreshMediaAssets, uploadMediaFile };
};

export const useGenericItemsCategoryOptions = (pt: ReturnType<typeof usePluginTranslation>) => {
  const [categoryOptions, setCategoryOptions] = React.useState<
    readonly GenericItemCategoryOption[]
  >([]);
  const [categoryOptionsLoading, setCategoryOptionsLoading] = React.useState(true);
  const [categoryOptionsError, setCategoryOptionsError] = React.useState<string | null>(null);

  React.useEffect(() => {
    void listGenericItemCategories()
      .then((categories) => {
        setCategoryOptions(categories);
        setCategoryOptionsError(null);
      })
      .catch((loadError: unknown) => {
        setCategoryOptions([]);
        setCategoryOptionsError(errorMessage(pt, loadError, 'messages.categoryOptionsLoadError'));
      })
      .finally(() => {
        setCategoryOptionsLoading(false);
      });
  }, [pt]);

  return { categoryOptions, categoryOptionsError, categoryOptionsLoading };
};

export const useGenericItemsDetailLoader = ({
  contentId,
  methods,
  mode,
  pt,
  setStatus,
  onLoaded,
  onAccessLoaded,
  actingPrincipalType,
}: Readonly<{
  contentId?: string;
  methods: UseFormReturn<GenericItemsDetailFormValues>;
  mode: 'create' | 'edit';
  pt: ReturnType<typeof usePluginTranslation>;
  setStatus: React.Dispatch<React.SetStateAction<StatusMessage | null>>;
  onLoaded?: (item: Awaited<ReturnType<typeof getGenericItemDetail>>['data']) => void;
  onAccessLoaded?: (access: Readonly<Record<string, boolean>>) => void;
  actingPrincipalType: MainserverPrincipalType;
}>) => {
  const [loading, setLoading] = React.useState(mode === 'edit');
  const loadedContentIdRef = React.useRef<string | undefined>(undefined);

  React.useEffect(() => {
    if (mode !== 'edit' || !contentId) {
      loadedContentIdRef.current = undefined;
      return;
    }

    let active = true;
    const refreshesAccessOnly = loadedContentIdRef.current === contentId;
    if (!refreshesAccessOnly) setLoading(true);

    void getGenericItemDetail(contentId, actingPrincipalType)
      .then((detail) => {
        if (active) {
          onAccessLoaded?.(detail.access);
          if (refreshesAccessOnly) return;
          const item = detail.data;
          methods.reset(mapGenericItemToDetailFormValues(item));
          onLoaded?.(item);
          loadedContentIdRef.current = contentId;
        }
      })
      .catch((error) => {
        if (active) {
          if (refreshesAccessOnly) onAccessLoaded?.({});
          else
            setStatus({ kind: 'error', text: errorMessage(pt, error, 'messages.missingContent') });
        }
      })
      .finally(() => {
        if (active && !refreshesAccessOnly) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [actingPrincipalType, contentId, methods, mode, onAccessLoaded, onLoaded, pt, setStatus]);

  return loading;
};

export const useGenericItemsDetailActions = ({
  contentId,
  mode,
  navigate,
  onDeleted,
  pt,
  setStatus,
  actingPrincipalType,
}: Readonly<{
  contentId?: string;
  mode: 'create' | 'edit';
  navigate: NavigateFn;
  onDeleted: () => void;
  pt: ReturnType<typeof usePluginTranslation>;
  setStatus: React.Dispatch<React.SetStateAction<StatusMessage | null>>;
  actingPrincipalType: MainserverPrincipalType;
}>) => {
  const [deleting, setDeleting] = React.useState(false);
  const [deleteNavigationFailed, setDeleteNavigationFailed] = React.useState(false);

  const handleDelete = React.useCallback(async () => {
    if (!contentId || deleting || mode !== 'edit') {
      return;
    }
    setDeleting(true);

    try {
      await deleteGenericItem(contentId, actingPrincipalType);
    } catch (error) {
      setStatus({ kind: 'error', text: errorMessage(pt, error, 'messages.deleteError') });
      setDeleting(false);
      return;
    }

    onDeleted();
    try {
      await navigate({
        ...genericItemsListNavigationTarget,
        state: (previous) =>
          addStudioDestructiveNavigationFeedback(previous, 'generic-items', contentId),
      });
    } catch {
      setDeleteNavigationFailed(true);
    } finally {
      setDeleting(false);
    }
  }, [actingPrincipalType, contentId, deleting, mode, navigate, onDeleted, pt, setStatus]);

  const [activeTab, setActiveTab] = React.useState<GenericItemsDetailTabId>('basis');

  return { activeTab, deleting, deleteNavigationFailed, handleDelete, setActiveTab };
};
