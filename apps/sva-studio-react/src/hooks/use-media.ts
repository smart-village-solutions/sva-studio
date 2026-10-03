import React from 'react';

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

const mediaLogger = createOperationLogger('media-hook', 'debug');

export const useMediaLibrary = (query: MediaListQuery = {}): UseMediaLibraryResult => {
  const { refreshSession } = useAuth();
  const [assets, setAssets] = React.useState<readonly IamMediaAsset[]>([]);
  const [usageByAssetId, setUsageByAssetId] = React.useState<
    Readonly<Record<string, number | null>>
  >({});
  const [usageStatusByAssetId, setUsageStatusByAssetId] = React.useState<
    Readonly<Record<string, 'loading' | 'ready' | 'unavailable'>>
  >({});
  const [isUsageLoading, setIsUsageLoading] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<IamHttpError | null>(null);
  const [limit, setLimit] = React.useState(query.limit ?? 25);
  const [nextCursor, setNextCursor] = React.useState<string | null>(null);
  const [hasNextPage, setHasNextPage] = React.useState(false);
  const latestRequestRef = React.useRef(0);

  const refetch = React.useCallback(async () => {
    const requestId = latestRequestRef.current + 1;
    latestRequestRef.current = requestId;
    logBrowserOperationStart(mediaLogger, 'media_library_refetch_started', {
      operation: 'list_media',
      search: query.search ?? null,
      visibility: query.visibility ?? null,
    });
    setIsLoading(true);
    setIsUsageLoading(false);
    setUsageStatusByAssetId({});
    setError(null);

    try {
      const response = await listMedia(query);
      if (requestId !== latestRequestRef.current) {
        return;
      }
      const registeredAssets = response.data.filter(isRegisteredMediaAsset);
      const initialUsageByAssetId = Object.fromEntries(
        response.data.map((asset) => [getMediaLibraryItemKey(asset), null] as const)
      );
      const initialUsageStatusByAssetId = Object.fromEntries(
        response.data.map(
          (asset) =>
            [
              getMediaLibraryItemKey(asset),
              isRegisteredMediaAsset(asset) ? 'loading' : 'unavailable',
            ] as const
        )
      );
      setAssets(response.data);
      setUsageByAssetId(initialUsageByAssetId);
      setUsageStatusByAssetId(initialUsageStatusByAssetId);
      setLimit(response.pagination.limit);
      setNextCursor(response.pagination.nextCursor);
      setHasNextPage(response.pagination.hasNextPage);
      setIsLoading(false);
      setIsUsageLoading(registeredAssets.length > 0);
      logBrowserOperationSuccess(mediaLogger, 'media_library_refetch_succeeded', {
        operation: 'list_media',
        item_count: response.data.length,
      });

      if (registeredAssets.length === 0) {
        return;
      }

      let remainingUsageRequests = registeredAssets.length;
      let protectedUsageFailureHandled = false;

      for (const asset of registeredAssets) {
        void getMediaUsage(asset.id)
          .then((usageResponse) => {
            if (requestId !== latestRequestRef.current) {
              return;
            }

            setUsageByAssetId((current) => ({
              ...current,
              [getMediaLibraryItemKey(asset)]: usageResponse.data.totalReferences,
            }));
            setUsageStatusByAssetId((current) => ({
              ...current,
              [getMediaLibraryItemKey(asset)]: 'ready',
            }));
          })
          .catch(async (cause) => {
            const resolvedError = asIamError(cause);
            if (resolvedError.status === 401 && !protectedUsageFailureHandled) {
              protectedUsageFailureHandled = true;
              await refreshSession();
            }

            logBrowserOperationFailure(
              mediaLogger,
              'media_library_usage_load_failed',
              resolvedError,
              {
                operation: 'get_media_usage',
              }
            );

            if (requestId !== latestRequestRef.current) {
              return;
            }

            setUsageStatusByAssetId((current) => ({
              ...current,
              [getMediaLibraryItemKey(asset)]: 'unavailable',
            }));
          })
          .finally(() => {
            if (requestId !== latestRequestRef.current) {
              return;
            }

            remainingUsageRequests -= 1;
            if (remainingUsageRequests === 0) {
              setIsUsageLoading(false);
            }
          });
      }
    } catch (cause) {
      const resolvedError = asIamError(cause);
      if (requestId !== latestRequestRef.current) {
        return;
      }
      if (resolvedError.status === 401) {
        await refreshSession();
      }
      setAssets([]);
      setUsageByAssetId({});
      setUsageStatusByAssetId({});
      setIsUsageLoading(false);
      setNextCursor(null);
      setHasNextPage(false);
      setError(resolvedError);
      setIsLoading(false);
      logBrowserOperationFailure(mediaLogger, 'media_library_refetch_failed', resolvedError, {
        operation: 'list_media',
      });
    }
  }, [refreshSession, query.cursor, query.limit, query.search, query.visibility]);

  React.useEffect(() => {
    void refetch();
  }, [refetch]);

  return {
    assets,
    usageByAssetId,
    usageStatusByAssetId,
    isUsageLoading,
    isLoading,
    error,
    limit,
    nextCursor,
    hasNextPage,
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
