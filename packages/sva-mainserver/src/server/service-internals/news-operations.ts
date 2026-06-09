import type {
  SvaMainserverConnectionInput,
  SvaMainserverInstanceConfig,
  SvaMainserverListResult,
  SvaMainserverNewsListInput,
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
  type SvaMainserverNewsListQuery as SvaMainserverNewsListResponse,
} from '../../generated/news.js';

import { mapNewsItem, mapOptionalNewsItem } from './news-mappers.js';
import { assertPublishedAt, toSvaMainserverError, type GraphqlExecutor } from './shared.js';
import { listVisibleRecordsWithConfig } from './visible-list.js';

type SvaMainserverNewsListRequest = SvaMainserverConnectionInput & SvaMainserverNewsListInput;

const deriveEditorialStatusForList = (
  item: Pick<SvaMainserverNewsItemFragment, 'visible' | 'publishedAt'>,
  nowIso: string
): 'draft' | 'scheduled' | 'published' => {
  if (item.visible === false) {
    return 'draft';
  }

  return new Date(item.publishedAt).getTime() > new Date(nowIso).getTime() ? 'scheduled' : 'published';
};

const matchesNewsListFilters = (
  item: Pick<SvaMainserverNewsItemFragment, 'visible' | 'publishedAt'>,
  input: SvaMainserverNewsListRequest,
  nowIso: string
) => {
  const matchesVisibility =
    input.visibilityFilter === 'hidden'
      ? item.visible === false
      : input.visibilityFilter === 'visible'
        ? item.visible !== false
        : input.includeInvisible === true
          ? true
          : item.visible !== false;
  const editorialStatus = deriveEditorialStatusForList(item, nowIso);
  const matchesEditorialStatus =
    input.editorialStatusFilter && input.editorialStatusFilter !== 'all'
      ? editorialStatus === input.editorialStatusFilter
      : true;

  return matchesVisibility && matchesEditorialStatus;
};

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
    input: SvaMainserverNewsListRequest,
    config: SvaMainserverInstanceConfig
  ): Promise<SvaMainserverListResult<SvaMainserverNewsItem>> => {
    const nowIso = new Date().toISOString();

    return listVisibleRecordsWithConfig<
      SvaMainserverNewsListResponse,
      SvaMainserverNewsItemFragment,
      SvaMainserverNewsItem
    >(
      input,
      config,
      executeGraphqlWithConfig,
      {
        document: svaMainserverNewsListDocument,
        operationName: 'SvaMainserverNewsList',
        order: 'publishedAt_DESC',
        readItems: (response) => response.newsItems ?? [],
        isVisible: (item) => matchesNewsListFilters(item, input, nowIso),
        mapItem: mapNewsItem,
      }
    );
  },

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
