import {
  createMainserverCrudClient,
  createMainserverJsonRequestHeaders,
  requestMainserverJson,
} from '@sva/plugin-sdk';

import { mapNewsDetailFormValuesToMutation } from './news.detail-form.js';
import type {
  NewsCategoryOption,
  NewsContentItem,
  NewsDetailFormValues,
  NewsFormInput,
  NewsListQuery,
  NewsListResult,
} from './news.types.js';

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

const toNewsContent = (item: NewsContentItem): NewsContentItem => item;

const toMutationBody = (input: NewsFormInput, options: { readonly includePushNotification: boolean }) => {
  const { pushNotification, ...body } = input;
  return {
    ...body,
    ...(options.includePushNotification && pushNotification !== undefined ? { pushNotification } : {}),
  };
};

const pickMutationFields = <TKey extends keyof NewsFormInput>(
  input: NewsFormInput,
  keys: readonly TKey[]
): Pick<NewsFormInput, TKey> =>
  keys.reduce<Pick<NewsFormInput, TKey>>((result, key) => {
    if (key in input) {
      result[key] = input[key];
    }
    return result;
  }, {} as Pick<NewsFormInput, TKey>);

const newsClient = createMainserverCrudClient<NewsContentItem, NewsFormInput, NewsListResult, NewsListResult, NewsApiError>({
  basePath: '/api/v1/mainserver/news',
  errorFactory: (code, message) => new NewsApiError(code, message),
  mapItem: toNewsContent,
  mapListResponse: (response, mapItem) => ({
    data: response.data.map(mapItem),
    pagination: response.pagination,
  }),
  createBody: (input) => toMutationBody(input, { includePushNotification: true }),
  updateBody: (input) => toMutationBody(input, { includePushNotification: false }),
  createHeaders: () =>
    createMainserverJsonRequestHeaders({
      'Idempotency-Key': createIdempotencyKey(),
    }),
});

export const listNews = async (query: NewsListQuery): Promise<NewsListResult> => newsClient.list(query);

export const listNewsCategories = async (): Promise<readonly NewsCategoryOption[]> => {
  const response = await requestMainserverJson<{ readonly data: readonly NewsCategoryOption[] }, NewsApiError>({
    url: '/api/v1/mainserver/categories',
    errorFactory: (code, message) => new NewsApiError(code, message),
  });
  return response.data;
};

export const getNews = async (contentId: string): Promise<NewsContentItem> => newsClient.get(contentId);

export const createNews = async (input: NewsFormInput): Promise<NewsContentItem> => newsClient.create(input);

export const updateNews = async (contentId: string, input: NewsFormInput): Promise<NewsContentItem> =>
  newsClient.update(contentId, input);

export const deleteNews = async (contentId: string): Promise<void> => newsClient.remove(contentId);

export const setNewsVisibility = async (contentId: string, visible: boolean): Promise<void> => {
  await requestMainserverJson<{ readonly status: string }, NewsApiError>({
    url: `/api/v1/mainserver/news/${encodeURIComponent(contentId)}/visibility`,
    errorFactory: (code, message) => new NewsApiError(code, message),
    init: {
      method: 'PATCH',
      body: JSON.stringify({ visible }),
      headers: createMainserverJsonRequestHeaders(),
    },
  });
};

export const updateNewsPartial = async (
  contentId: string,
  input: Partial<NewsFormInput>
): Promise<NewsContentItem> => newsClient.update(contentId, input as NewsFormInput);

export const saveNewsEditorItem = async (input: {
  readonly contentId?: string;
  readonly values: NewsDetailFormValues;
  readonly existingItem?: NewsContentItem | null;
  readonly now?: () => string;
}, dependencies?: {
  readonly createNews?: typeof createNews;
  readonly updateNews?: typeof updateNews;
}): Promise<NewsContentItem> => {
  const operations = {
    createNews: dependencies?.createNews ?? createNews,
    updateNews: dependencies?.updateNews ?? updateNews,
  };
  const visible = input.values.publicationMode !== 'draft';
  const mutation = {
    ...mapNewsDetailFormValuesToMutation(input.values, input.contentId ? 'edit' : 'create'),
    visible,
  } satisfies NewsFormInput;
  const saved = input.contentId
    ? await operations.updateNews(input.contentId, mutation)
    : await operations.createNews(mutation);

  return {
    ...saved,
    title: mutation.title,
    author: mutation.author ?? saved.author,
    categories: mutation.categories ?? saved.categories,
    sourceUrl: mutation.sourceUrl ?? saved.sourceUrl,
    contentBlocks: mutation.contentBlocks ?? saved.contentBlocks,
    publishedAt: mutation.publishedAt,
    publicationDate: mutation.publicationDate,
    visible,
  };
};

export const buildNewsBasisMutation = (values: NewsDetailFormValues): Partial<NewsFormInput> =>
  pickMutationFields(mapNewsDetailFormValuesToMutation(values, 'edit'), [
    'title',
    'author',
    'keywords',
    'categories',
  ]);

export const buildNewsContentMutation = (values: NewsDetailFormValues): Partial<NewsFormInput> =>
  pickMutationFields(mapNewsDetailFormValuesToMutation(values, 'edit'), [
    'sourceUrl',
    'address',
    'contentBlocks',
    'pointOfInterestId',
  ]);

export const buildNewsReleaseMutation = (values: NewsDetailFormValues): Partial<NewsFormInput> =>
  pickMutationFields(mapNewsDetailFormValuesToMutation(values, 'edit'), [
    'publishedAt',
    'publicationDate',
    'showPublishDate',
  ]);

export const buildNewsSettingsMutation = (values: NewsDetailFormValues): Partial<NewsFormInput> =>
  pickMutationFields(mapNewsDetailFormValuesToMutation(values, 'edit'), [
    'externalId',
    'fullVersion',
    'charactersToBeShown',
    'newsType',
  ]);
