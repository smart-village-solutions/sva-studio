import type { NewsContentItem, NewsFormInput } from './news.types.js';

type ApiItemResponse<T> = {
  readonly data: T;
};

type ApiListResponse<T> = {
  readonly data: readonly T[];
};

type ApiErrorResponse = {
  readonly error?: string;
  readonly message?: string;
};

export class NewsApiError extends Error {
  public constructor(
    public readonly code: string,
    message = code
  ) {
    super(message);
    this.name = 'NewsApiError';
  }
}

const REQUEST_HEADERS = {
  'Content-Type': 'application/json',
  'X-Requested-With': 'XMLHttpRequest',
} as const;

const createIdempotencyKey = () => crypto.randomUUID();

const requestJson = async <T>(input: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(input, {
    credentials: 'include',
    ...init,
    headers: {
      Accept: 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    let errorCode = `http_${response.status}`;
    let message = errorCode;
    try {
      const body = (await response.json()) as ApiErrorResponse;
      errorCode = typeof body.error === 'string' && body.error.length > 0 ? body.error : errorCode;
      message = typeof body.message === 'string' && body.message.length > 0 ? body.message : errorCode;
    } catch {
      // Keep the deterministic HTTP fallback when the server returns no JSON error envelope.
    }
    throw new NewsApiError(errorCode, message);
  }

  return (await response.json()) as T;
};

const toNewsContent = (item: NewsContentItem): NewsContentItem => item;

const toMutationBody = (input: NewsFormInput, options: { readonly includePushNotification: boolean }) => {
  const { pushNotification, ...body } = input;
  return {
    ...body,
    ...(options.includePushNotification && pushNotification !== undefined ? { pushNotification } : {}),
  };
};

export const listNews = async (): Promise<readonly NewsContentItem[]> => {
  const response = await requestJson<ApiListResponse<NewsContentItem>>('/api/v1/mainserver/news');
  return response.data.map(toNewsContent);
};

export const getNews = async (contentId: string): Promise<NewsContentItem> => {
  const response = await requestJson<ApiItemResponse<NewsContentItem>>(`/api/v1/mainserver/news/${contentId}`);
  return toNewsContent(response.data);
};

export const createNews = async (input: NewsFormInput): Promise<NewsContentItem> => {
  const response = await requestJson<ApiItemResponse<NewsContentItem>>('/api/v1/mainserver/news', {
    method: 'POST',
    headers: {
      ...REQUEST_HEADERS,
      'Idempotency-Key': createIdempotencyKey(),
    },
    body: JSON.stringify(toMutationBody(input, { includePushNotification: true })),
  });

  return toNewsContent(response.data);
};

export const updateNews = async (contentId: string, input: NewsFormInput): Promise<NewsContentItem> => {
  const response = await requestJson<ApiItemResponse<NewsContentItem>>(`/api/v1/mainserver/news/${contentId}`, {
    method: 'PATCH',
    headers: REQUEST_HEADERS,
    body: JSON.stringify(toMutationBody(input, { includePushNotification: false })),
  });

  return toNewsContent(response.data);
};

export const deleteNews = async (contentId: string): Promise<void> => {
  await requestJson<ApiItemResponse<{ id: string }>>(`/api/v1/mainserver/news/${contentId}`, {
    method: 'DELETE',
    headers: REQUEST_HEADERS,
  });
};
