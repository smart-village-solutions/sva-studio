import {
  createMainserverCrudClient,
  createMainserverJsonRequestHeaders,
} from '@sva/plugin-sdk';

import type { NewsContentItem, NewsFormInput, NewsListQuery, NewsListResult } from './news.types.js';

export class NewsApiError extends Error {
  public constructor(
    public readonly code: string,
    message = code
  ) {
    super(message);
    this.name = 'NewsApiError';
  }
}

const createIdempotencyKey = () => crypto.randomUUID();
const DEFAULT_LIST_QUERY: NewsListQuery = { page: 1, pageSize: 25 };

const toNewsContent = (item: NewsContentItem): NewsContentItem => item;

const toMutationBody = (input: NewsFormInput, options: { readonly includePushNotification: boolean }) => {
  const { pushNotification, ...body } = input;
  return {
    ...body,
    ...(options.includePushNotification && pushNotification !== undefined ? { pushNotification } : {}),
  };
};

const newsClient = createMainserverCrudClient<
  NewsContentItem,
  NewsFormInput,
  Readonly<{ data: readonly NewsContentItem[]; pagination?: NewsListResult['pagination'] }>,
  NewsListResult,
  NewsApiError
>({
  basePath: '/api/v1/mainserver/news',
  errorFactory: (code, message) => new NewsApiError(code, message),
  mapItem: toNewsContent,
  mapListResponse: (response, mapItem, query) => ({
    data: response.data.map(mapItem),
    pagination: response.pagination ?? {
      page: query.page,
      pageSize: query.pageSize,
      hasNextPage: false,
    },
  }),
  createBody: (input) => toMutationBody(input, { includePushNotification: true }),
  updateBody: (input) => toMutationBody(input, { includePushNotification: false }),
  createHeaders: () =>
    createMainserverJsonRequestHeaders({
      'Idempotency-Key': createIdempotencyKey(),
    }),
});

export const listNews = async (query: NewsListQuery = DEFAULT_LIST_QUERY): Promise<NewsListResult> => newsClient.list(query);

export const getNews = async (contentId: string): Promise<NewsContentItem> => newsClient.get(contentId);

export const createNews = async (input: NewsFormInput): Promise<NewsContentItem> => newsClient.create(input);

export const updateNews = async (contentId: string, input: NewsFormInput): Promise<NewsContentItem> =>
  newsClient.update(contentId, input);

export const deleteNews = async (contentId: string): Promise<void> => newsClient.remove(contentId);
