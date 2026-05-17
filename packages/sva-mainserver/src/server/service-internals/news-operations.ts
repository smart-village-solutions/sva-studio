import type {
  SvaMainserverConnectionInput,
  SvaMainserverInstanceConfig,
  SvaMainserverListResult,
  SvaMainserverNewsInput,
  SvaMainserverNewsItem,
} from '../../types.js';
import {
  svaMainserverCreateNewsDocument,
  svaMainserverDestroyNewsDocument,
  svaMainserverNewsDetailDocument,
  svaMainserverNewsListDocument,
  type SvaMainserverCreateNewsMutation,
  type SvaMainserverDestroyNewsMutation,
  type SvaMainserverNewsDetailQuery,
  type SvaMainserverNewsItemFragment,
  type SvaMainserverNewsListQuery,
} from '../../generated/news.js';

import { mapNewsItem, mapOptionalNewsItem } from './news-mappers.js';
import { assertPublishedAt, toSvaMainserverError, type GraphqlExecutor, type SvaMainserverListInput } from './shared.js';
import { listVisibleRecordsWithConfig } from './visible-list.js';

const buildNewsMutationVariables = (input: {
  readonly news: SvaMainserverNewsInput;
  readonly newsId?: string;
  readonly forceCreate?: boolean;
}) => ({
  ...(input.newsId ? { id: input.newsId } : {}),
  ...(input.forceCreate === undefined ? {} : { forceCreate: input.forceCreate }),
  title: input.news.title,
  ...(input.newsId ? {} : { pushNotification: input.news.pushNotification ?? false }),
  ...(input.news.author ? { author: input.news.author } : {}),
  ...(input.news.keywords ? { keywords: input.news.keywords } : {}),
  ...(input.news.externalId ? { externalId: input.news.externalId } : {}),
  ...(input.news.fullVersion === undefined ? {} : { fullVersion: input.news.fullVersion }),
  ...(input.news.charactersToBeShown === undefined ? {} : { charactersToBeShown: input.news.charactersToBeShown }),
  ...(input.news.newsType ? { newsType: input.news.newsType } : {}),
  publishedAt: input.news.publishedAt,
  publicationDate: input.news.publicationDate ?? input.news.publishedAt,
  ...(input.news.showPublishDate === undefined ? {} : { showPublishDate: input.news.showPublishDate }),
  ...(input.news.categoryName ? { categoryName: input.news.categoryName } : {}),
  ...(input.news.categories ? { categories: input.news.categories } : {}),
  ...(input.news.sourceUrl ? { sourceUrl: input.news.sourceUrl } : {}),
  ...(input.news.address ? { address: input.news.address } : {}),
  ...(input.news.contentBlocks ? { contentBlocks: input.news.contentBlocks } : {}),
  ...(input.news.pointOfInterestId ? { pointOfInterestId: input.news.pointOfInterestId } : {}),
});

export const createNewsOperations = (executeGraphqlWithConfig: GraphqlExecutor) => ({
  listNewsWithConfig: async (
    input: SvaMainserverListInput,
    config: SvaMainserverInstanceConfig
  ): Promise<SvaMainserverListResult<SvaMainserverNewsItem>> =>
    listVisibleRecordsWithConfig<SvaMainserverNewsListQuery, SvaMainserverNewsItemFragment, SvaMainserverNewsItem>(
      input,
      config,
      executeGraphqlWithConfig,
      {
        document: svaMainserverNewsListDocument,
        operationName: 'SvaMainserverNewsList',
        order: 'publishedAt_DESC',
        readItems: (response) => response.newsItems ?? [],
        isVisible: (item) => item.visible !== false,
        mapItem: mapNewsItem,
      }
    ),

  getNewsWithConfig: async (
    input: SvaMainserverConnectionInput & { readonly newsId: string },
    config: SvaMainserverInstanceConfig
  ): Promise<SvaMainserverNewsItem> => {
    const response = await executeGraphqlWithConfig<SvaMainserverNewsDetailQuery>(
      {
        ...input,
        document: svaMainserverNewsDetailDocument,
        operationName: 'SvaMainserverNewsDetail',
        variables: { id: input.newsId },
      },
      config
    );

    return mapOptionalNewsItem(response.newsItem);
  },

  writeNewsWithConfig: async (
    input: SvaMainserverConnectionInput & {
      readonly news: SvaMainserverNewsInput;
      readonly newsId?: string;
      readonly forceCreate?: boolean;
    },
    config: SvaMainserverInstanceConfig
  ): Promise<SvaMainserverNewsItem> => {
    assertPublishedAt(input.news.publishedAt);
    const response = await executeGraphqlWithConfig<SvaMainserverCreateNewsMutation>(
      {
        ...input,
        document: svaMainserverCreateNewsDocument,
        operationName: 'SvaMainserverCreateNews',
        variables: buildNewsMutationVariables(input),
      },
      config
    );

    return mapOptionalNewsItem(response.createNewsItem);
  },

  destroyNewsWithConfig: async (
    input: SvaMainserverConnectionInput & { readonly newsId: string },
    config: SvaMainserverInstanceConfig
  ): Promise<{ readonly id: string }> => {
    const response = await executeGraphqlWithConfig<SvaMainserverDestroyNewsMutation>(
      {
        ...input,
        document: svaMainserverDestroyNewsDocument,
        operationName: 'SvaMainserverDestroyNews',
        variables: { id: input.newsId, recordType: 'NewsItem' },
      },
      config
    );

    if (!response.destroyRecord || (response.destroyRecord.statusCode ?? 200) >= 400) {
      throw toSvaMainserverError({
        code: 'invalid_response',
        message: 'SVA-Mainserver konnte den News-Eintrag nicht löschen.',
        statusCode: 502,
      });
    }

    return { id: input.newsId };
  },
});
