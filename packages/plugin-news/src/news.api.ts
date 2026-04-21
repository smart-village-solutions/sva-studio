import type { NewsContentItem, NewsPayload, NewsStatus } from './news.types.js';
import { NEWS_CONTENT_TYPE } from './news.constants.js';

const LEGACY_NEWS_CONTENT_TYPES = ['news'] as const;

type ApiItemResponse<T> = {
  readonly data: T;
};

type ApiListResponse<T> = {
  readonly data: readonly T[];
};

export type NewsFormInput = {
  readonly title: string;
  readonly status: NewsStatus;
  readonly publishedAt?: string;
  readonly payload: NewsPayload;
};

const IAM_HEADERS = {
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
    throw new Error(`http_${response.status}`);
  }

  return (await response.json()) as T;
};

const toNewsContent = (item: {
  id: string;
  title: string;
  contentType: string;
  payload: NewsPayload;
  status: NewsStatus;
  author: string;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
}): NewsContentItem => item;

export const listNews = async (): Promise<readonly NewsContentItem[]> => {
  const response = await requestJson<ApiListResponse<NewsContentItem>>('/api/v1/iam/contents');
  return response.data
    .filter((item) => item.contentType === NEWS_CONTENT_TYPE || LEGACY_NEWS_CONTENT_TYPES.includes(item.contentType as 'news'))
    .map(toNewsContent);
};

export const getNews = async (contentId: string): Promise<NewsContentItem> => {
  const response = await requestJson<ApiItemResponse<NewsContentItem>>(`/api/v1/iam/contents/${contentId}`);
  return toNewsContent(response.data);
};

export const createNews = async (input: NewsFormInput): Promise<NewsContentItem> => {
  const response = await requestJson<ApiItemResponse<NewsContentItem>>('/api/v1/iam/contents', {
    method: 'POST',
    headers: {
      ...IAM_HEADERS,
      'Idempotency-Key': createIdempotencyKey(),
    },
    body: JSON.stringify({
      title: input.title,
      contentType: NEWS_CONTENT_TYPE,
      status: input.status,
      publishedAt: input.publishedAt,
      payload: input.payload,
    }),
  });

  return toNewsContent(response.data);
};

export const updateNews = async (contentId: string, input: NewsFormInput): Promise<NewsContentItem> => {
  const response = await requestJson<ApiItemResponse<NewsContentItem>>(`/api/v1/iam/contents/${contentId}`, {
    method: 'PATCH',
    headers: IAM_HEADERS,
    body: JSON.stringify({
      title: input.title,
      status: input.status,
      publishedAt: input.publishedAt,
      payload: input.payload,
    }),
  });

  return toNewsContent(response.data);
};

export const deleteNews = async (contentId: string): Promise<void> => {
  await requestJson<ApiItemResponse<{ id: string }>>(`/api/v1/iam/contents/${contentId}`, {
    method: 'DELETE',
    headers: IAM_HEADERS,
  });
};
