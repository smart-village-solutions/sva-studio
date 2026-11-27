import React from 'react';
import { useStudioTableQuery } from '@sva/studio-ui-react';

import {
  asIamError,
  getMediaUsage,
  IamHttpError,
  listMedia,
  getMediaLibraryItemKey,
  isRegisteredMediaAsset,
  type IamMediaAsset,
  type IamUnregisteredMediaAsset,
  type MediaListQuery,
} from '../lib/iam-api';
import {
  createOperationLogger,
  logBrowserOperationFailure,
  logBrowserOperationStart,
  logBrowserOperationSuccess,
} from '../lib/browser-operation-logging';
import { useAuth } from '../providers/auth-provider';

export {
  useCreateMediaUpload,
  useSingleFileMediaUpload,
  useRegisterBucketMedia,
} from './use-media-upload';
export type { SingleFileUploadPhase } from './use-media-upload';
export { useMediaDetail } from './use-media-detail';

type UseMediaLibraryResult = {
  readonly assets: readonly IamMediaAsset[];
  readonly usageByAssetId: Readonly<Record<string, number | null>>;
  readonly usageStatusByAssetId: Readonly<Record<string, 'loading' | 'ready' | 'unavailable'>>;
  readonly isUsageLoading: boolean;
  readonly isLoading: boolean;
  readonly error: IamHttpError | null;
  readonly limit: number;
  readonly nextCursor: string | null;
  readonly hasNextPage: boolean;
  readonly refetch: () => Promise<void>;
};

const EMPTY_ASSETS: readonly IamMediaAsset[] = [];
const mediaLogger = createOperationLogger('media-hook', 'debug');

export const useMediaLibrary = (query: MediaListQuery = {}): UseMediaLibraryResult => {
  const { refreshSession } = useAuth();
  const [usageByAssetId, setUsageByAssetId] = React.useState<
    Readonly<Record<string, number | null>>
  >({});
  const [usageStatusByAssetId, setUsageStatusByAssetId] = React.useState<
    Readonly<Record<string, 'loading' | 'ready' | 'unavailable'>>
  >({});
  const [isUsageLoading, setIsUsageLoading] = React.useState(false);
  const list = useStudioTableQuery(['media', query], async (signal) => {
    logBrowserOperationStart(mediaLogger, 'media_library_refetch_started', {
      operation: 'list_media',
      has_search: Boolean(query.search?.trim()),
      has_tag_filter: Boolean(query.tag?.trim()),
      visibility: query.visibility ?? null,
    });
    try {
      const response = await listMedia(query);
      logBrowserOperationSuccess(mediaLogger, 'media_library_refetch_succeeded', {
        operation: 'list_media',
        item_count: response.data.length,
      });
      return response;
    } catch (cause) {
      if (signal.aborted) throw cause;
      const error = asIamError(cause);
      if (error.status === 401) await refreshSession();
      logBrowserOperationFailure(mediaLogger, 'media_library_refetch_failed', error, {
        operation: 'list_media',
      });
      throw error;
    }
  });

  const assets = list.data?.data ?? EMPTY_ASSETS;
  React.useEffect(() => {
    let active = true;
    const registeredAssets = assets.filter(isRegisteredMediaAsset);
    setUsageByAssetId(
      Object.fromEntries(assets.map((asset) => [getMediaLibraryItemKey(asset), null]))
    );
    setUsageStatusByAssetId(
      Object.fromEntries(
        assets.map((asset) => [
          getMediaLibraryItemKey(asset),
          isRegisteredMediaAsset(asset) ? 'loading' : 'unavailable',
        ])
      )
    );
    setIsUsageLoading(registeredAssets.length > 0);

    let protectedUsageFailureHandled = false;
    void Promise.all(
      registeredAssets.map(async (asset) => {
        const key = getMediaLibraryItemKey(asset);
        try {
          const usage = await getMediaUsage(asset.id);
          if (!active) return;
          setUsageByAssetId((current) => ({ ...current, [key]: usage.data.totalReferences }));
          setUsageStatusByAssetId((current) => ({ ...current, [key]: 'ready' }));
        } catch (cause) {
          if (!active) return;
          const error = asIamError(cause);
          if (error.status === 401 && !protectedUsageFailureHandled) {
            protectedUsageFailureHandled = true;
            await refreshSession();
          }
          logBrowserOperationFailure(mediaLogger, 'media_library_usage_load_failed', error, {
            operation: 'get_media_usage',
          });
          if (active) setUsageStatusByAssetId((current) => ({ ...current, [key]: 'unavailable' }));
        }
      })
    ).then(() => {
      if (active) setIsUsageLoading(false);
    });
    return () => {
      active = false;
    };
  }, [assets, list.dataUpdatedAt, refreshSession]);

  const refetch = React.useCallback(async () => {
    await list.refresh(true);
  }, [list.refresh]);

  return {
    assets,
    usageByAssetId,
    usageStatusByAssetId,
    isUsageLoading,
    isLoading: list.state === 'loading',
    error: list.error as IamHttpError | null,
    limit: list.data?.pagination.limit ?? query.limit ?? 25,
    nextCursor: list.data?.pagination.nextCursor ?? null,
    hasNextPage: list.data?.pagination.hasNextPage ?? false,
    refetch,
  };
};

export const deriveMimeTypeFromUnregisteredMedia = (asset: IamUnregisteredMediaAsset): string => {
  const extension = asset.fileName.split('.').pop()?.trim().toLowerCase();

  switch (extension) {
    case 'avif':
      return 'image/avif';
    case 'gif':
      return 'image/gif';
    case 'jpeg':
    case 'jpg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'svg':
      return 'image/svg+xml';
    case 'webp':
      return 'image/webp';
    case 'pdf':
      return 'application/pdf';
    default:
      return 'application/octet-stream';
  }
};
