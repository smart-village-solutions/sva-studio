import React from 'react';

import {
  asIamError,
  completeMediaUpload,
  initializeMediaUpload,
  IamHttpError,
  registerBucketMedia,
  type IamRegisteredMediaAsset,
  type InitializeMediaUploadPayload,
  type InitializeMediaUploadResponse,
  type RegisterBucketMediaPayload,
} from '../lib/iam-api';
import {
  createOperationLogger,
  logBrowserOperationFailure,
  logBrowserOperationStart,
  logBrowserOperationSuccess,
} from '../lib/browser-operation-logging';
import { useAuth } from '../providers/auth-provider';

type UseCreateMediaUploadResult = {
  readonly mutationError: IamHttpError | null;
  readonly clearMutationError: () => void;
  readonly initializeUpload: (
    payload: InitializeMediaUploadPayload
  ) => Promise<InitializeMediaUploadResponse | null>;
};

export type SingleFileUploadPhase =
  'idle' | 'initializing' | 'uploading' | 'finalizing' | 'success' | 'error';

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
  readonly registerMedia: (
    payload: RegisterBucketMediaPayload
  ) => Promise<IamRegisteredMediaAsset | null>;
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
export const useCreateMediaUpload = (): UseCreateMediaUploadResult => {
  const { refreshSession } = useAuth();
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
        if (resolvedError.status === 401) {
          await refreshSession();
        }
        setMutationError(resolvedError);
        logBrowserOperationFailure(mediaLogger, 'media_upload_initialize_failed', resolvedError, {
          operation: 'initialize_media_upload',
        });
        return null;
      }
    },
    [refreshSession]
  );

  return {
    mutationError,
    clearMutationError: () => setMutationError(null),
    initializeUpload: runMutation,
  };
};

export const useSingleFileMediaUpload = (): UseSingleFileMediaUploadResult => {
  const { refreshSession } = useAuth();
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
        if (resolvedError.status === 401) {
          await refreshSession();
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
    [refreshSession]
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
  const { refreshSession } = useAuth();
  const [mutationError, setMutationError] = React.useState<IamHttpError | null>(null);

  const runMutation = React.useCallback(
    async (payload: RegisterBucketMediaPayload) => {
      setMutationError(null);
      try {
        const response = await registerBucketMedia(payload);
        return response.data;
      } catch (cause) {
        const resolvedError = asIamError(cause);
        if (resolvedError.status === 401) {
          await refreshSession();
        }
        setMutationError(resolvedError);
        return null;
      }
    },
    [refreshSession]
  );

  return {
    mutationError,
    clearMutationError: () => setMutationError(null),
    registerMedia: runMutation,
  };
};
