export type SvaMainserverNewsItemFragment = {
  readonly id?: string | null;
  readonly title?: string | null;
  readonly author?: string | null;
  readonly payload?: unknown;
  readonly publicationDate?: string | null;
  readonly publishedAt?: string | null;
  readonly createdAt?: string | null;
  readonly updatedAt?: string | null;
  readonly visible?: boolean | null;
};

export type SvaMainserverNewsListQuery = {
  readonly newsItems?: readonly SvaMainserverNewsItemFragment[] | null;
};

export type SvaMainserverNewsDetailQuery = {
  readonly newsItem?: SvaMainserverNewsItemFragment | null;
};

export type SvaMainserverCreateNewsMutation = {
  readonly createNewsItem?: SvaMainserverNewsItemFragment | null;
};

export type SvaMainserverDestroyNewsMutation = {
  readonly destroyRecord?: {
    readonly id?: number | null;
    readonly status?: string | null;
    readonly statusCode?: number | null;
  } | null;
};

const newsItemFields = `
  id
  title
  author
  payload
  publicationDate
  publishedAt
  createdAt
  updatedAt
  visible
`;

export const svaMainserverNewsListDocument = `
  query SvaMainserverNewsList($limit: Int, $skip: Int, $order: NewsItemsOrder) {
    newsItems(limit: $limit, skip: $skip, order: $order) {
      ${newsItemFields}
    }
  }
`;

export const svaMainserverNewsDetailDocument = `
  query SvaMainserverNewsDetail($id: ID!) {
    newsItem(id: $id) {
      ${newsItemFields}
    }
  }
`;

export const svaMainserverCreateNewsDocument = `
  mutation SvaMainserverCreateNews(
    $id: ID
    $forceCreate: Boolean
    $title: String
    $publicationDate: String
    $publishedAt: String
    $categoryName: String
    $payload: JSON
  ) {
    createNewsItem(
      id: $id
      forceCreate: $forceCreate
      title: $title
      publicationDate: $publicationDate
      publishedAt: $publishedAt
      categoryName: $categoryName
      payload: $payload
    ) {
      ${newsItemFields}
    }
  }
`;

export const svaMainserverDestroyNewsDocument = `
  mutation SvaMainserverDestroyNews($id: ID!, $recordType: String!) {
    destroyRecord(id: $id, recordType: $recordType) {
      id
      status
      statusCode
    }
  }
`;
