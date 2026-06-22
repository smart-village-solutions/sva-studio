type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export type HostMediaUploadVisibility = 'public' | 'protected';

export type InitializeHostMediaUploadInput = Readonly<{
  mediaType?: 'image';
  mimeType: string;
  byteSize: number;
  visibility?: HostMediaUploadVisibility;
  instanceId?: string;
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
}>;

export type UploadHostMediaFileResult = Readonly<{
  assetId: string;
  uploadSessionId: string;
}>;

const mergeHeaders = (...headersList: Array<HeadersInit | undefined>): Headers => {
  const merged = new Headers();
  for (const headers of headersList) {
    if (!headers) {
      continue;
    }
    for (const [key, value] of new Headers(headers).entries()) {
      merged.set(key, value);
    }
  }
  return merged;
};

const requestJson = async <T>(input: {
  readonly fetch: FetchLike;
  readonly url: string;
  readonly init?: RequestInit;
}): Promise<T> => {
  const response = await input.fetch(input.url, {
    credentials: 'include',
    ...input.init,
    headers: mergeHeaders({ Accept: 'application/json' }, input.init?.headers),
  });
  if (!response.ok) {
    throw new Error(`media_upload_http_${response.status}`);
  }
  return (await response.json()) as T;
};

export const initializeHostMediaUpload = async (input: {
  readonly fetch: FetchLike;
  readonly payload: InitializeHostMediaUploadInput;
}): Promise<InitializeHostMediaUploadResult> => {
  const response = await requestJson<{ data: InitializeHostMediaUploadResult }>({
    fetch: input.fetch,
    url: '/api/v1/iam/media/upload-sessions',
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
    init: {
      method: 'POST',
      headers: {
        'X-Requested-With': 'XMLHttpRequest',
      },
    },
  });
  return response.data;
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
}): Promise<UploadHostMediaFileResult> => {
  const initialized = await initializeHostMediaUpload({
    fetch: input.fetch,
    payload: {
      mediaType: input.mediaType,
      mimeType: input.file.type,
      byteSize: input.file.size,
      visibility: input.visibility,
      instanceId: input.instanceId,
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

  return {
    assetId: completed.assetId,
    uploadSessionId: completed.uploadSessionId,
  };
};
