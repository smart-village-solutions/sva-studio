import React from 'react';

import {
  asIamError,
  completeMediaUpload,
  getMedia,
  getMediaDelivery,
  getMediaUsage,
  initializeMediaUpload,
  IamHttpError,
  listMedia,
  deleteMedia as deleteMediaRequest,
  getMediaLibraryItemKey,
  isRegisteredMediaAsset,
  updateMedia,
  registerBucketMedia,
  type IamMediaAsset,
  type IamMediaDelivery,
  type IamRegisteredMediaAsset,
  type IamUnregisteredMediaAsset,
  type IamMediaUsageImpact,
  type InitializeMediaUploadPayload,
  type InitializeMediaUploadResponse,
  type MediaListQuery,
  type RegisterBucketMediaPayload,
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
  readonly usageByAssetId: Readonly<Record<string, number | null>>;
  readonly usageStatusByAssetId: Readonly<Record<string, 'loading' | 'ready' | 'unavailable'>>;
  readonly isUsageLoading: boolean;
  readonly isLoading: boolean;
  readonly error: IamHttpError | null;
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
  readonly refetch: () => Promise<void>;
};

type UseCreateMediaUploadResult = {
  readonly mutationError: IamHttpError | null;
  readonly clearMutationError: () => void;
  readonly initializeUpload: (payload: InitializeMediaUploadPayload) => Promise<InitializeMediaUploadResponse | null>;
};

export type SingleFileUploadPhase = 'idle' | 'initializing' | 'uploading' | 'finalizing' | 'success' | 'error';

type UseSingleFileMediaUploadResult = {
  readonly phase: SingleFileUploadPhase;
  readonly error: IamHttpError | Error | null;
  readonly assetId: string | null;
  readonly uploadSessionId: string | null;
  readonly uploadFile: (file: File) => Promise<{ assetId: string } | null>;
  readonly reset: () => void;
};

type UseRegisterBucketMediaResult = {
  readonly mutationError: IamHttpError | null;
  readonly clearMutationError: () => void;
  readonly registerMedia: (payload: RegisterBucketMediaPayload) => Promise<IamRegisteredMediaAsset | null>;
};

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

const putFileToSignedUrl = async (input: {
  readonly uploadUrl: string;
  readonly method: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly file: File;
}) => {
  const response = await fetch(input.uploadUrl, {
    method: input.method,
    headers: input.headers,
    body: input.file,
  });

  if (!response.ok) {
    throw new Error(`media_upload_put_failed:${response.status}`);
  }
};

export const useMediaLibrary = (query: MediaListQuery = {}): UseMediaLibraryResult => {
  const { invalidatePermissions } = useAuth();
  const [assets, setAssets] = React.useState<readonly IamMediaAsset[]>([]);
  const [usageByAssetId, setUsageByAssetId] = React.useState<Readonly<Record<string, number | null>>>({});
  const [usageStatusByAssetId, setUsageStatusByAssetId] = React.useState<
    Readonly<Record<string, 'loading' | 'ready' | 'unavailable'>>
  >({});
  const [isUsageLoading, setIsUsageLoading] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<IamHttpError | null>(null);
  const [page, setPage] = React.useState(query.page ?? 1);
  const [pageSize, setPageSize] = React.useState(query.pageSize ?? 25);
  const [total, setTotal] = React.useState(0);
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
        response.data.map((asset) => [
          getMediaLibraryItemKey(asset),
          isRegisteredMediaAsset(asset) ? 'loading' : 'unavailable',
        ] as const)
      );
      setAssets(response.data);
      setUsageByAssetId(initialUsageByAssetId);
      setUsageStatusByAssetId(initialUsageStatusByAssetId);
      setPage(response.pagination.page);
      setPageSize(response.pagination.pageSize);
      setTotal(response.pagination.total);
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
            if (
              (resolvedError.status === 401 || resolvedError.status === 403) &&
              !protectedUsageFailureHandled
            ) {
              protectedUsageFailureHandled = true;
              await invalidatePermissions();
            }

            logBrowserOperationFailure(mediaLogger, 'media_library_usage_load_failed', resolvedError, {
              operation: 'get_media_usage',
            });

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
      if (resolvedError.status === 401 || resolvedError.status === 403) {
        await invalidatePermissions();
      }
      setAssets([]);
      setUsageByAssetId({});
      setUsageStatusByAssetId({});
      setIsUsageLoading(false);
      setTotal(0);
      setError(resolvedError);
      setIsLoading(false);
      logBrowserOperationFailure(mediaLogger, 'media_library_refetch_failed', resolvedError, {
        operation: 'list_media',
      });
    }
  }, [invalidatePermissions, query.page, query.pageSize, query.search, query.visibility]);

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
    page,
    pageSize,
    total,
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
        if (resolvedError.status === 401 || resolvedError.status === 403) {
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

export const useSingleFileMediaUpload = (): UseSingleFileMediaUploadResult => {
  const { invalidatePermissions } = useAuth();
  const [phase, setPhase] = React.useState<SingleFileUploadPhase>('idle');
  const [error, setError] = React.useState<IamHttpError | Error | null>(null);
  const [assetId, setAssetId] = React.useState<string | null>(null);
  const [uploadSessionId, setUploadSessionId] = React.useState<string | null>(null);

  const reset = React.useCallback(() => {
    setPhase('idle');
    setError(null);
    setAssetId(null);
    setUploadSessionId(null);
  }, []);

  const uploadFile = React.useCallback(
    async (file: File) => {
      let currentPhase: SingleFileUploadPhase = 'initializing';
      let currentAssetId: string | null = null;
      let currentUploadSessionId: string | null = null;
      setPhase('initializing');
      setError(null);
      setAssetId(null);
      setUploadSessionId(null);
      logBrowserOperationStart(mediaLogger, 'media_upload_initialize_started', {
        operation: 'initialize_media_upload',
        mime_type: file.type || 'application/octet-stream',
      });

      try {
        const initialized = await initializeMediaUpload({
          mediaType: file.type.startsWith('image/') ? 'image' : undefined,
          mimeType: file.type || 'application/octet-stream',
          byteSize: file.size,
          visibility: 'public',
        });

        const nextAssetId = initialized.data.assetId;
        const nextUploadSessionId = initialized.data.uploadSessionId;
        currentAssetId = nextAssetId;
        currentUploadSessionId = nextUploadSessionId;
        setAssetId(nextAssetId);
        setUploadSessionId(nextUploadSessionId);
        logBrowserOperationSuccess(mediaLogger, 'media_upload_initialize_succeeded', {
          operation: 'initialize_media_upload',
          asset_id: nextAssetId,
          upload_session_id: nextUploadSessionId,
        });

        currentPhase = 'uploading';
        setPhase('uploading');
        logBrowserOperationStart(mediaLogger, 'media_upload_put_started', {
          operation: 'put_media_upload',
          asset_id: nextAssetId,
          upload_session_id: nextUploadSessionId,
        });
        await putFileToSignedUrl({
          uploadUrl: initialized.data.uploadUrl,
          method: initialized.data.method,
          headers: initialized.data.headers,
          file,
        });
        logBrowserOperationSuccess(mediaLogger, 'media_upload_put_succeeded', {
          operation: 'put_media_upload',
          asset_id: nextAssetId,
          upload_session_id: nextUploadSessionId,
        });

        currentPhase = 'finalizing';
        setPhase('finalizing');
        logBrowserOperationStart(mediaLogger, 'media_upload_complete_started', {
          operation: 'complete_media_upload',
          asset_id: nextAssetId,
          upload_session_id: nextUploadSessionId,
        });
        const completed = await completeMediaUpload(nextUploadSessionId);
        setPhase('success');
        logBrowserOperationSuccess(mediaLogger, 'media_upload_complete_succeeded', {
          operation: 'complete_media_upload',
          asset_id: completed.data.assetId,
          upload_session_id: completed.data.uploadSessionId,
          status: completed.data.status,
        });
        return { assetId: completed.data.assetId };
      } catch (cause) {
        const resolvedError = asIamError(cause);
        if (resolvedError.status === 401 || resolvedError.status === 403) {
          await invalidatePermissions();
        }

        const currentError = cause instanceof Error ? cause : resolvedError;
        setError(currentError);
        setPhase('error');

        if (currentPhase === 'initializing') {
          logBrowserOperationFailure(mediaLogger, 'media_upload_initialize_failed', currentError, {
            operation: 'initialize_media_upload',
          });
        } else if (currentPhase === 'uploading') {
          logBrowserOperationFailure(mediaLogger, 'media_upload_put_failed', currentError, {
            operation: 'put_media_upload',
            asset_id: currentAssetId,
            upload_session_id: currentUploadSessionId,
          });
        } else {
          logBrowserOperationFailure(mediaLogger, 'media_upload_complete_failed', currentError, {
            operation: 'complete_media_upload',
            asset_id: currentAssetId,
            upload_session_id: currentUploadSessionId,
          });
        }
        return null;
      }
    },
    [invalidatePermissions]
  );

  return {
    phase,
    error,
    assetId,
    uploadSessionId,
    uploadFile,
    reset,
  };
};

export const useRegisterBucketMedia = (): UseRegisterBucketMediaResult => {
  const { invalidatePermissions } = useAuth();
  const [mutationError, setMutationError] = React.useState<IamHttpError | null>(null);

  const runMutation = React.useCallback(
    async (payload: RegisterBucketMediaPayload) => {
      setMutationError(null);
      try {
        const response = await registerBucketMedia(payload);
        return response.data;
      } catch (cause) {
        const resolvedError = asIamError(cause);
        if (resolvedError.status === 401 || resolvedError.status === 403) {
          await invalidatePermissions();
        }
        setMutationError(resolvedError);
        return null;
      }
    },
    [invalidatePermissions]
  );

  return {
    mutationError,
    clearMutationError: () => setMutationError(null),
    registerMedia: runMutation,
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

export const useMediaDetail = (assetId: string | null): UseMediaDetailResult => {
  const { invalidatePermissions } = useAuth();
  const [asset, setAsset] = React.useState<IamRegisteredMediaAsset | null>(null);
  const [usage, setUsage] = React.useState<IamMediaUsageImpact | null>(null);
  const [delivery, setDelivery] = React.useState<IamMediaDelivery | null>(null);
  const [autoResolvedDeliveryAssetId, setAutoResolvedDeliveryAssetId] = React.useState<string | null>(null);
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
      const [assetResponse, usageResponse] = await Promise.all([getMedia(assetId), getMediaUsage(assetId)]);
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
      if (resolvedError.status === 401 || resolvedError.status === 403) {
        await invalidatePermissions();
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
        if (resolvedError.status === 401 || resolvedError.status === 403) {
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

  const resolveDelivery = React.useCallback(async (options?: { readonly suppressErrorState?: boolean }) => {
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
      if (resolvedError.status === 401 || resolvedError.status === 403) {
        await invalidatePermissions();
      }
      if (!options?.suppressErrorState) {
        setMutationError(resolvedError);
      }
      return null;
    }
  }, [assetId, invalidatePermissions]);

  const resolveDeliveryRef = React.useRef<typeof resolveDelivery | null>(null);
  resolveDeliveryRef.current = resolveDelivery;

  React.useEffect(() => {
    if (!asset || delivery || autoResolvedDeliveryAssetId === asset.id || !asset.mimeType.startsWith('image/')) {
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
      if (resolvedError.status === 401 || resolvedError.status === 403) {
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
