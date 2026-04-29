export type HostMediaAssetListItem = Readonly<{
  id: string;
  metadata?: Readonly<Record<string, unknown>>;
  visibility?: string;
  mimeType?: string;
}>;

export type HostMediaReferenceSelection = Readonly<{
  id?: string;
  assetId: string;
  role: string;
  sortOrder?: number;
}>;

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

const requestJson = async <T>(input: {
  readonly fetch: FetchLike;
  readonly url: string;
  readonly init?: RequestInit;
}): Promise<T> => {
  const response = await input.fetch(input.url, {
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      ...(input.init?.headers ?? {}),
    },
    ...input.init,
  });
  if (!response.ok) {
    throw new Error(`media_picker_http_${response.status}`);
  }
  return (await response.json()) as T;
};

export const listHostMediaAssets = async (input: {
  readonly fetch: FetchLike;
  readonly search?: string;
  readonly visibility?: 'public' | 'protected';
}): Promise<readonly HostMediaAssetListItem[]> => {
  const searchParams = new URLSearchParams();
  if (input.search) {
    searchParams.set('search', input.search);
  }
  if (input.visibility) {
    searchParams.set('visibility', input.visibility);
  }

  const response = await requestJson<{ data: readonly HostMediaAssetListItem[] }>({
    fetch: input.fetch,
    url: `/api/v1/iam/media${searchParams.size > 0 ? `?${searchParams.toString()}` : ''}`,
  });
  return response.data;
};

export const listHostMediaReferencesByTarget = async (input: {
  readonly fetch: FetchLike;
  readonly targetType: string;
  readonly targetId: string;
}): Promise<readonly HostMediaReferenceSelection[]> => {
  const searchParams = new URLSearchParams({
    targetType: input.targetType,
    targetId: input.targetId,
  });
  const response = await requestJson<{ data: readonly HostMediaReferenceSelection[] }>({
    fetch: input.fetch,
    url: `/api/v1/iam/media/references?${searchParams.toString()}`,
  });
  return response.data;
};

export const replaceHostMediaReferences = async (input: {
  readonly fetch: FetchLike;
  readonly targetType: string;
  readonly targetId: string;
  readonly references: readonly HostMediaReferenceSelection[];
}): Promise<{
  readonly targetType: string;
  readonly targetId: string;
  readonly references: readonly HostMediaReferenceSelection[];
}> => {
  const response = await requestJson<{
    data: {
      readonly targetType: string;
      readonly targetId: string;
      readonly references: readonly HostMediaReferenceSelection[];
    };
  }>({
    fetch: input.fetch,
    url: '/api/v1/iam/media/references',
    init: {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify({
        targetType: input.targetType,
        targetId: input.targetId,
        references: input.references,
      }),
    },
  });
  return response.data;
};
