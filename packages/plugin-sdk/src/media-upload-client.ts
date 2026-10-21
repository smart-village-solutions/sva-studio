import { getHostMediaAsset } from './media-picker-client.js';
import { requestJson, type FetchLike } from './http-client.js';

export type HostMediaUploadVisibility = 'public' | 'protected';
export type HostMediaUploadContext = 'library' | 'content-save';

export type InitializeHostMediaUploadInput = Readonly<{
  mediaType?: 'image';
  mimeType: string;
  byteSize: number;
  visibility?: HostMediaUploadVisibility;
  instanceId?: string;
  uploadContext?: HostMediaUploadContext;
  contentSaveOperationId?: string;
  draftId?: string;
}>;

export type InitializeHostMediaUploadResult = Readonly<{
  assetId: string;
  uploadSessionId: string;
  uploadUrl: string;
  method: string;
  headers: Readonly<Record<string, string>>;
  expiresAt: string;
  status: string;
  initializedAt: string;
}>;

export type CompleteHostMediaUploadResult = Readonly<{
  assetId: string;
  uploadSessionId: string;
  status: string;
  previewUrl?: string | null;
}>;

export type UploadHostMediaFileResult = Readonly<{
  assetId: string;
  uploadSessionId: string;
  previewUrl?: string | null;
}>;

export const initializeHostMediaUpload = async (input: {
  readonly fetch: FetchLike;
  readonly payload: InitializeHostMediaUploadInput;
}): Promise<InitializeHostMediaUploadResult> => {
  const response = await requestJson<{ data: InitializeHostMediaUploadResult }>({
    fetch: input.fetch,
    url: '/api/v1/iam/media/upload-sessions',
    errorFactory: (failingResponse) => failingResponse.status === 413
      ? Object.assign(new Error('media_upload_http_413'), { code: 'upload_size_exceeded' })
      : new Error(`media_upload_http_${failingResponse.status}`),
    init: {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify(input.payload),
    },
  });
  return response.data;
};

export const completeHostMediaUpload = async (input: {
  readonly fetch: FetchLike;
  readonly uploadSessionId: string;
  readonly instanceId?: string;
}): Promise<CompleteHostMediaUploadResult> => {
  const searchParams = new URLSearchParams();
  if (input.instanceId) {
    searchParams.set('instanceId', input.instanceId);
  }
  const response = await requestJson<{ data: CompleteHostMediaUploadResult }>({
    fetch: input.fetch,
    url: `/api/v1/iam/media/upload-sessions/${input.uploadSessionId}/complete${
      searchParams.size > 0 ? `?${searchParams.toString()}` : ''
    }`,
    errorFactory: (failingResponse) => new Error(`media_upload_http_${failingResponse.status}`),
    init: {
      method: 'POST',
      headers: {
        'X-Requested-With': 'XMLHttpRequest',
      },
    },
  });
  return response.data;
};

// Bound both status polling and each status request; a timeout never starts another upload/job.
export const waitForHostMediaUpload = async (input: {
  readonly fetch: FetchLike;
  readonly assetId: string;
  readonly instanceId?: string;
  readonly signal?: AbortSignal;
}): Promise<void> => {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    input.signal?.throwIfAborted();
    let asset: Awaited<ReturnType<typeof getHostMediaAsset>>;
    try {
      const timeout = AbortSignal.timeout(deadline - Date.now());
      asset = await getHostMediaAsset({
        ...input,
        signal: input.signal ? AbortSignal.any([input.signal, timeout]) : timeout,
      });
    } catch (error) {
      if (Date.now() >= deadline) break;
      throw error;
    }
    if (asset.uploadStatus === 'processed' && asset.processingStatus === 'ready') return;
    if (
      asset.processingStatus === 'failed' ||
      asset.uploadStatus === 'failed' ||
      asset.uploadStatus === 'blocked'
    ) {
      const failure = asset.technical?.lastError;
      const code = typeof failure === 'object' && failure !== null && 'code' in failure && failure.code === 'media_scan_infected'
        ? 'media_scan_infected' : 'media_processing_failed';
      throw Object.assign(new Error(code), {
        code,
      });
    }
    await new Promise<void>((resolve) =>
      setTimeout(resolve, Math.min(1000, deadline - Date.now()))
    );
  }
  throw Object.assign(new Error('media_processing_timeout'), { code: 'media_processing_timeout' });
};

const putFileToSignedUrl = async (input: {
  readonly fetch: FetchLike;
  readonly uploadUrl: string;
  readonly method: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly file: File;
}): Promise<void> => {
  const response = await input.fetch(input.uploadUrl, {
    method: input.method,
    headers: input.headers,
    body: input.file,
  });
  if (!response.ok) {
    throw new Error(`media_upload_put_failed:${response.status}`);
  }
};

export const uploadHostMediaFile = async (input: {
  readonly fetch: FetchLike;
  readonly file: File;
  readonly visibility?: HostMediaUploadVisibility;
  readonly mediaType?: 'image';
  readonly instanceId?: string;
  readonly uploadContext?: HostMediaUploadContext;
  readonly contentSaveOperationId?: string;
  readonly draftId?: string;
}): Promise<UploadHostMediaFileResult> => {
  const initialized = await initializeHostMediaUpload({
    fetch: input.fetch,
    payload: {
      mediaType: input.mediaType,
      mimeType: input.file.type,
      byteSize: input.file.size,
      visibility: input.visibility,
      instanceId: input.instanceId,
      uploadContext: input.uploadContext,
      contentSaveOperationId: input.contentSaveOperationId,
      draftId: input.draftId,
    },
  });

  await putFileToSignedUrl({
    fetch: input.fetch,
    uploadUrl: initialized.uploadUrl,
    method: initialized.method,
    headers: initialized.headers,
    file: input.file,
  });

  const completed = await completeHostMediaUpload({
    fetch: input.fetch,
    uploadSessionId: initialized.uploadSessionId,
    instanceId: input.instanceId,
  });

  if (completed.status !== 'processed') {
    await waitForHostMediaUpload({
      fetch: input.fetch,
      assetId: completed.assetId,
      instanceId: input.instanceId,
    });
  }

  return {
    assetId: completed.assetId,
    uploadSessionId: completed.uploadSessionId,
    previewUrl: completed.previewUrl,
  };
};
