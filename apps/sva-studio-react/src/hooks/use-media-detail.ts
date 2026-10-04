import React from 'react';

import {
  asIamError,
  deleteMedia as deleteMediaRequest,
  getMedia,
  getMediaDelivery,
  getMediaUsage,
  IamHttpError,
  updateMedia,
  type IamMediaDelivery,
  type IamMediaUsageImpact,
  type IamRegisteredMediaAsset,
  type UpdateMediaPayload,
} from '../lib/iam-api';
import {
  createOperationLogger,
  logBrowserOperationFailure,
  logBrowserOperationStart,
  logBrowserOperationSuccess,
} from '../lib/browser-operation-logging';
import { useAuth } from '../providers/auth-provider';

type UseMediaDetailResult = {
  readonly asset: IamRegisteredMediaAsset | null;
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

const shouldAutoResolveMediaDelivery = (
  asset: IamRegisteredMediaAsset | null,
  delivery: IamMediaDelivery | null,
  autoResolvedDeliveryAssetId: string | null
): asset is IamRegisteredMediaAsset =>
  Boolean(
    asset &&
    !delivery &&
    autoResolvedDeliveryAssetId !== asset.id &&
    asset.mimeType.startsWith('image/')
  );

export const useMediaDetail = (assetId: string | null): UseMediaDetailResult => {
  const { refreshSession } = useAuth();
  const [asset, setAsset] = React.useState<IamRegisteredMediaAsset | null>(null);
  const [usage, setUsage] = React.useState<IamMediaUsageImpact | null>(null);
  const [delivery, setDelivery] = React.useState<IamMediaDelivery | null>(null);
  const [autoResolvedDeliveryAssetId, setAutoResolvedDeliveryAssetId] = React.useState<
    string | null
  >(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<IamHttpError | null>(null);
  const [mutationError, setMutationError] = React.useState<IamHttpError | null>(null);

  const refetch = React.useCallback(async () => {
    if (!assetId) {
      setAsset(null);
      setUsage(null);
      setDelivery(null);
      setAutoResolvedDeliveryAssetId(null);
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
      const [assetResponse, usageResponse] = await Promise.all([
        getMedia(assetId),
        getMediaUsage(assetId),
      ]);
      setAsset(assetResponse.data);
      setUsage(usageResponse.data);
      setDelivery(null);
      setAutoResolvedDeliveryAssetId(null);
      logBrowserOperationSuccess(mediaLogger, 'media_detail_refetch_succeeded', {
        operation: 'get_media_detail',
        asset_id: assetId,
        reference_count: usageResponse.data.totalReferences,
      });
    } catch (cause) {
      const resolvedError = asIamError(cause);
      if (resolvedError.status === 401) {
        await refreshSession();
      }
      setAsset(null);
      setUsage(null);
      setDelivery(null);
      setAutoResolvedDeliveryAssetId(null);
      setError(resolvedError);
      logBrowserOperationFailure(mediaLogger, 'media_detail_refetch_failed', resolvedError, {
        operation: 'get_media_detail',
        asset_id: assetId,
      });
    } finally {
      setIsLoading(false);
    }
  }, [assetId, refreshSession]);

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
        if (resolvedError.status === 401) {
          await refreshSession();
        }
        setMutationError(resolvedError);
        logBrowserOperationFailure(mediaLogger, 'media_update_failed', resolvedError, {
          operation: 'update_media',
          asset_id: assetId,
        });
        return false;
      }
    },
    [assetId, refreshSession, refetch]
  );

  const resolveDelivery = React.useCallback(
    async (options?: { readonly suppressErrorState?: boolean }) => {
      if (!assetId) {
        return null;
      }
      if (!options?.suppressErrorState) {
        setMutationError(null);
      }
      try {
        const response = await getMediaDelivery(assetId);
        setDelivery(response.data);
        return response.data;
      } catch (cause) {
        const resolvedError = asIamError(cause);
        if (resolvedError.status === 401) {
          await refreshSession();
        }
        if (!options?.suppressErrorState) {
          setMutationError(resolvedError);
        }
        return null;
      }
    },
    [assetId, refreshSession]
  );

  const resolveDeliveryRef = React.useRef<typeof resolveDelivery | null>(null);
  resolveDeliveryRef.current = resolveDelivery;

  React.useEffect(() => {
    if (!shouldAutoResolveMediaDelivery(asset, delivery, autoResolvedDeliveryAssetId)) {
      return;
    }

    setAutoResolvedDeliveryAssetId(asset.id);
    void (async () => {
      await resolveDeliveryRef.current?.({ suppressErrorState: true });
    })();
  }, [asset, autoResolvedDeliveryAssetId, delivery]);

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
      if (resolvedError.status === 401) {
        await refreshSession();
      }
      setMutationError(resolvedError);
      return false;
    }
  }, [assetId, refreshSession]);

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
