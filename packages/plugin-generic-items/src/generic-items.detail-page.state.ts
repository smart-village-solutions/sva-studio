import { listHostMediaAssets, uploadHostMediaFile, usePluginTranslation, type HostMediaAssetListItem } from '@sva/plugin-sdk';
import { type NavigateFn } from '@tanstack/react-router';
import React from 'react';
import type { UseFormReturn } from 'react-hook-form';

import {
  createGenericItem,
  deleteGenericItem,
  GenericItemsApiError,
  getGenericItem,
  listGenericItemCategories,
  updateGenericItem,
} from './generic-items.api.js';
import type { GenericItemCategoryOption } from './generic-items.api-types.js';
import {
  mapGenericItemsDetailFormValuesToInput,
  mapGenericItemToDetailFormValues,
} from './generic-items.detail-form.js';
import type { GenericItemsDetailTabId } from './generic-items.detail-tabs.js';
import type { GenericItemsDetailFormValues } from './generic-items.validation.js';

export type StatusMessage = Readonly<{
  kind: 'success' | 'error';
  text: string;
}>;

const errorMessage = (
  pt: ReturnType<typeof usePluginTranslation>,
  error: unknown,
  fallbackKey: string
) => (error instanceof GenericItemsApiError ? error.message : pt(fallbackKey));

export const useGenericItemsMediaAssets = () => {
  const [mediaAssets, setMediaAssets] = React.useState<readonly HostMediaAssetListItem[]>([]);

  const refreshMediaAssets = React.useCallback(async () => {
    try {
      const assets = await listHostMediaAssets({ fetch: globalThis.fetch.bind(globalThis), visibility: 'public' });
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
  const [categoryOptions, setCategoryOptions] = React.useState<readonly GenericItemCategoryOption[]>([]);
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
}: Readonly<{
  contentId?: string;
  methods: UseFormReturn<GenericItemsDetailFormValues>;
  mode: 'create' | 'edit';
  pt: ReturnType<typeof usePluginTranslation>;
  setStatus: React.Dispatch<React.SetStateAction<StatusMessage | null>>;
}>) => {
  const [loading, setLoading] = React.useState(mode === 'edit');

  React.useEffect(() => {
    if (mode !== 'edit' || !contentId) {
      return;
    }

    let active = true;
    setLoading(true);

    void getGenericItem(contentId)
      .then((item) => {
        if (active) {
          methods.reset(mapGenericItemToDetailFormValues(item));
        }
      })
      .catch((error) => {
        if (active) {
          setStatus({ kind: 'error', text: errorMessage(pt, error, 'messages.missingContent') });
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [contentId, methods, mode, pt, setStatus]);

  return loading;
};

export const useGenericItemsDetailActions = ({
  contentId,
  methods,
  mode,
  navigate,
  pt,
  setStatus,
}: Readonly<{
  contentId?: string;
  methods: UseFormReturn<GenericItemsDetailFormValues>;
  mode: 'create' | 'edit';
  navigate: NavigateFn;
  pt: ReturnType<typeof usePluginTranslation>;
  setStatus: React.Dispatch<React.SetStateAction<StatusMessage | null>>;
}>) => {
  const handleDelete = React.useCallback(async () => {
    if (!contentId || mode !== 'edit') {
      return;
    }
    if (globalThis.confirm(pt('actions.deleteConfirm')) === false) {
      return;
    }

    try {
      await deleteGenericItem(contentId);
      await navigate({ to: '/admin/generic-items' });
    } catch (error) {
      setStatus({ kind: 'error', text: errorMessage(pt, error, 'messages.deleteError') });
    }
  }, [contentId, mode, navigate, pt, setStatus]);

  const onSubmit = methods.handleSubmit(async (values) => {
    setStatus(null);

    try {
      const input = mapGenericItemsDetailFormValuesToInput(values);
      if (mode === 'create') {
        await createGenericItem(input);
        setStatus({ kind: 'success', text: pt('messages.createSuccess') });
        return;
      }

      if (contentId) {
        await updateGenericItem(contentId, input);
        setStatus({ kind: 'success', text: pt('messages.updateSuccess') });
      }
    } catch (error) {
      setStatus({ kind: 'error', text: errorMessage(pt, error, 'messages.saveError') });
    }
  });

  const [activeTab, setActiveTab] = React.useState<GenericItemsDetailTabId>('basis');

  return { activeTab, handleDelete, onSubmit, setActiveTab };
};
