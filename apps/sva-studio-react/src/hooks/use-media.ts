import React from 'react';

import {
  asIamError,
  getMedia,
  getMediaDelivery,
  getMediaUsage,
  initializeMediaUpload,
  IamHttpError,
  listMedia,
  deleteMedia as deleteMediaRequest,
  updateMedia,
  type IamMediaAsset,
  type IamMediaDelivery,
  type IamMediaUsageImpact,
  type InitializeMediaUploadPayload,
  type InitializeMediaUploadResponse,
  type UpdateMediaPayload,
} from '../lib/iam-api';
import {
  createOperationLogger,
  logBrowserOperationFailure,
  logBrowserOperationStart,
  logBrowserOperationSuccess,
} from '../lib/browser-operation-logging';
import { useAuth } from '../providers/auth-provider';

type UseMediaLibraryResult = {
  readonly assets: readonly IamMediaAsset[];
  readonly isLoading: boolean;
  readonly error: IamHttpError | null;
  readonly refetch: () => Promise<void>;
};

type UseCreateMediaUploadResult = {
  readonly mutationError: IamHttpError | null;
  readonly clearMutationError: () => void;
  readonly initializeUpload: (payload: InitializeMediaUploadPayload) => Promise<InitializeMediaUploadResponse | null>;
};

type UseMediaDetailResult = {
  readonly asset: IamMediaAsset | null;
  readonly usage: IamMediaUsageImpact | null;
  readonly delivery: IamMediaDelivery | null;
  readonly isLoading: boolean;
  readonly error: IamHttpError | null;
  readonly mutationError: IamHttpError | null;
  readonly refetch: () => Promise<void>;
  readonly clearMutationError: () => void;
  readonly updateMedia: (payload: UpdateMediaPayload) => Promise<boolean>;
  readonly resolveDelivery: () => Promise<IamMediaDelivery | null>;
  readonly deleteMedia: () => Promise<boolean>;
};

const mediaLogger = createOperationLogger('media-hook', 'debug');

export const useMediaLibrary = (query: { readonly search?: string; readonly visibility?: 'all' | 'public' | 'protected' } = {}): UseMediaLibraryResult => {
  const { invalidatePermissions } = useAuth();
  const [assets, setAssets] = React.useState<readonly IamMediaAsset[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<IamHttpError | null>(null);

  const refetch = React.useCallback(async () => {
    logBrowserOperationStart(mediaLogger, 'media_library_refetch_started', {
      operation: 'list_media',
      search: query.search ?? null,
      visibility: query.visibility ?? null,
    });
    setIsLoading(true);
    setError(null);

    try {
      const response = await listMedia(query);
      setAssets(response.data);
      logBrowserOperationSuccess(mediaLogger, 'media_library_refetch_succeeded', {
        operation: 'list_media',
        item_count: response.data.length,
      });
    } catch (cause) {
      const resolvedError = asIamError(cause);
      if (resolvedError.status === 403) {
        await invalidatePermissions();
      }
      setAssets([]);
      setError(resolvedError);
      logBrowserOperationFailure(mediaLogger, 'media_library_refetch_failed', resolvedError, {
        operation: 'list_media',
      });
    } finally {
      setIsLoading(false);
    }
  }, [invalidatePermissions, query.search, query.visibility]);

  React.useEffect(() => {
    void refetch();
  }, [refetch]);

  return {
    assets,
    isLoading,
    error,
    refetch,
  };
};

export const useCreateMediaUpload = (): UseCreateMediaUploadResult => {
  const { invalidatePermissions } = useAuth();
  const [mutationError, setMutationError] = React.useState<IamHttpError | null>(null);

  const runMutation = React.useCallback(
    async (payload: InitializeMediaUploadPayload) => {
      setMutationError(null);
      logBrowserOperationStart(mediaLogger, 'media_upload_initialize_started', {
        operation: 'initialize_media_upload',
        mime_type: payload.mimeType,
      });

      try {
        const response = await initializeMediaUpload(payload);
        logBrowserOperationSuccess(mediaLogger, 'media_upload_initialize_succeeded', {
          operation: 'initialize_media_upload',
          asset_id: response.data.assetId,
        });
        return response.data;
      } catch (cause) {
        const resolvedError = asIamError(cause);
        if (resolvedError.status === 403) {
          await invalidatePermissions();
        }
        setMutationError(resolvedError);
        logBrowserOperationFailure(mediaLogger, 'media_upload_initialize_failed', resolvedError, {
          operation: 'initialize_media_upload',
        });
        return null;
      }
    },
    [invalidatePermissions]
  );

  return {
    mutationError,
    clearMutationError: () => setMutationError(null),
    initializeUpload: runMutation,
  };
};

export const useMediaDetail = (assetId: string | null): UseMediaDetailResult => {
  const { invalidatePermissions } = useAuth();
  const [asset, setAsset] = React.useState<IamMediaAsset | null>(null);
  const [usage, setUsage] = React.useState<IamMediaUsageImpact | null>(null);
  const [delivery, setDelivery] = React.useState<IamMediaDelivery | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<IamHttpError | null>(null);
  const [mutationError, setMutationError] = React.useState<IamHttpError | null>(null);

  const refetch = React.useCallback(async () => {
    if (!assetId) {
      setAsset(null);
      setUsage(null);
      setDelivery(null);
      setError(null);
      setIsLoading(false);
      return;
    }

    logBrowserOperationStart(mediaLogger, 'media_detail_refetch_started', {
      operation: 'get_media_detail',
      asset_id: assetId,
    });
    setIsLoading(true);
    setError(null);

    try {
      const [assetResponse, usageResponse] = await Promise.all([getMedia(assetId), getMediaUsage(assetId)]);
      setAsset(assetResponse.data);
      setUsage(usageResponse.data);
      logBrowserOperationSuccess(mediaLogger, 'media_detail_refetch_succeeded', {
        operation: 'get_media_detail',
        asset_id: assetId,
        reference_count: usageResponse.data.totalReferences,
      });
    } catch (cause) {
      const resolvedError = asIamError(cause);
      if (resolvedError.status === 403) {
        await invalidatePermissions();
      }
      setAsset(null);
      setUsage(null);
      setDelivery(null);
      setError(resolvedError);
      logBrowserOperationFailure(mediaLogger, 'media_detail_refetch_failed', resolvedError, {
        operation: 'get_media_detail',
        asset_id: assetId,
      });
    } finally {
      setIsLoading(false);
    }
  }, [assetId, invalidatePermissions]);

  React.useEffect(() => {
    void refetch();
  }, [refetch]);

  const runUpdate = React.useCallback(
    async (payload: UpdateMediaPayload) => {
      if (!assetId) {
        return false;
      }
      setMutationError(null);
      logBrowserOperationStart(mediaLogger, 'media_update_started', {
        operation: 'update_media',
        asset_id: assetId,
      });

      try {
        await updateMedia(assetId, payload);
        await refetch();
        logBrowserOperationSuccess(mediaLogger, 'media_update_succeeded', {
          operation: 'update_media',
          asset_id: assetId,
        });
        return true;
      } catch (cause) {
        const resolvedError = asIamError(cause);
        if (resolvedError.status === 403) {
          await invalidatePermissions();
        }
        setMutationError(resolvedError);
        logBrowserOperationFailure(mediaLogger, 'media_update_failed', resolvedError, {
          operation: 'update_media',
          asset_id: assetId,
        });
        return false;
      }
    },
    [assetId, invalidatePermissions, refetch]
  );

  const resolveDelivery = React.useCallback(async () => {
    if (!assetId) {
      return null;
    }
    setMutationError(null);

    try {
      const response = await getMediaDelivery(assetId);
      setDelivery(response.data);
      return response.data;
    } catch (cause) {
      const resolvedError = asIamError(cause);
      if (resolvedError.status === 403) {
        await invalidatePermissions();
      }
      setMutationError(resolvedError);
      return null;
    }
  }, [assetId, invalidatePermissions]);

  const deleteMedia = React.useCallback(async () => {
    if (!assetId) {
      return false;
    }
    setMutationError(null);

    try {
      await deleteMediaRequest(assetId);
      setAsset(null);
      setUsage(null);
      setDelivery(null);
      return true;
    } catch (cause) {
      const resolvedError = asIamError(cause);
      if (resolvedError.status === 403) {
        await invalidatePermissions();
      }
      setMutationError(resolvedError);
      return false;
    }
  }, [assetId, invalidatePermissions]);

  return {
    asset,
    usage,
    delivery,
    isLoading,
    error,
    mutationError,
    refetch,
    clearMutationError: () => setMutationError(null),
    updateMedia: runUpdate,
    resolveDelivery,
    deleteMedia,
  };
};
