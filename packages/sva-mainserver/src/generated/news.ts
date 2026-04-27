export type SvaMainserverNewsItemFragment = {
  readonly id?: string | null;
  readonly title?: string | null;
  readonly author?: string | null;
  readonly keywords?: string | null;
  readonly externalId?: string | null;
  readonly fullVersion?: boolean | null;
  readonly charactersToBeShown?: string | null;
  readonly newsType?: string | null;
  readonly payload?: unknown;
  readonly publicationDate?: string | null;
  readonly publishedAt?: string | null;
  readonly showPublishDate?: boolean | null;
  readonly sourceUrl?: SvaMainserverWebUrlFragment | null;
  readonly address?: SvaMainserverAddressFragment | null;
  readonly categories?: readonly SvaMainserverCategoryFragment[] | null;
  readonly contentBlocks?: readonly SvaMainserverContentBlockFragment[] | null;
  readonly dataProvider?: SvaMainserverDataProviderFragment | null;
  readonly settings?: SvaMainserverSettingFragment | null;
  readonly announcements?: readonly SvaMainserverAnnouncementFragment[] | null;
  readonly likeCount?: number | null;
  readonly likedByMe?: boolean | null;
  readonly pushNotificationsSentAt?: string | null;
  readonly createdAt?: string | null;
  readonly updatedAt?: string | null;
  readonly visible?: boolean | null;
};

export type SvaMainserverWebUrlFragment = {
  readonly id?: string | null;
  readonly url?: string | null;
  readonly description?: string | null;
};

export type SvaMainserverGeoLocationFragment = {
  readonly latitude?: number | string | null;
  readonly longitude?: number | string | null;
};

export type SvaMainserverAddressFragment = {
  readonly id?: string | null;
  readonly addition?: string | null;
  readonly street?: string | null;
  readonly zip?: string | null;
  readonly city?: string | null;
  readonly kind?: string | null;
  readonly geoLocation?: SvaMainserverGeoLocationFragment | null;
};

export type SvaMainserverCategoryFragment = {
  readonly id?: string | null;
  readonly name?: string | null;
  readonly iconName?: string | null;
  readonly position?: number | null;
  readonly tagList?: string | null;
  readonly createdAt?: string | null;
  readonly updatedAt?: string | null;
  readonly children?: readonly SvaMainserverCategoryFragment[] | null;
};

export type SvaMainserverMediaContentFragment = {
  readonly id?: string | null;
  readonly captionText?: string | null;
  readonly copyright?: string | null;
  readonly height?: number | null;
  readonly width?: number | null;
  readonly contentType?: string | null;
  readonly sourceUrl?: SvaMainserverWebUrlFragment | null;
};

export type SvaMainserverContentBlockFragment = {
  readonly id?: string | null;
  readonly title?: string | null;
  readonly intro?: string | null;
  readonly body?: string | null;
  readonly mediaContents?: readonly SvaMainserverMediaContentFragment[] | null;
  readonly createdAt?: string | null;
  readonly updatedAt?: string | null;
};

export type SvaMainserverDataProviderFragment = {
  readonly id?: string | null;
  readonly name?: string | null;
  readonly dataType?: string | null;
  readonly description?: string | null;
  readonly notice?: string | null;
  readonly logo?: SvaMainserverWebUrlFragment | null;
  readonly address?: SvaMainserverAddressFragment | null;
};

export type SvaMainserverSettingFragment = {
  readonly alwaysRecreateOnImport?: string | null;
  readonly displayOnlySummary?: string | null;
  readonly onlySummaryLinkText?: string | null;
};

export type SvaMainserverAnnouncementFragment = {
  readonly id?: string | null;
  readonly title?: string | null;
  readonly description?: string | null;
  readonly dateStart?: string | null;
  readonly dateEnd?: string | null;
  readonly timeStart?: string | null;
  readonly timeEnd?: string | null;
  readonly likeCount?: number | null;
  readonly likedByMe?: boolean | null;
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

const webUrlFields = `
  id
  url
  description
`;

const geoLocationFields = `
  latitude
  longitude
`;

const addressFields = `
  id
  addition
  street
  zip
  city
  kind
  geoLocation {
    ${geoLocationFields}
  }
`;

const categoryFields = `
  id
  name
  iconName
  position
  tagList
  createdAt
  updatedAt
  children {
    id
    name
    iconName
    position
    tagList
  }
`;

const mediaContentFields = `
  id
  captionText
  copyright
  height
  width
  contentType
  sourceUrl {
    ${webUrlFields}
  }
`;

const contentBlockFields = `
  id
  title
  intro
  body
  mediaContents {
    ${mediaContentFields}
  }
  createdAt
  updatedAt
`;

const newsItemFields = `
  id
  title
  author
  keywords
  externalId
  fullVersion
  charactersToBeShown
  newsType
  payload
  publicationDate
  publishedAt
  showPublishDate
  sourceUrl {
    ${webUrlFields}
  }
  address {
    ${addressFields}
  }
  categories {
    ${categoryFields}
  }
  contentBlocks {
    ${contentBlockFields}
  }
  dataProvider {
    id
    name
    dataType
    description
    notice
    logo {
      ${webUrlFields}
    }
    address {
      ${addressFields}
    }
  }
  settings {
    alwaysRecreateOnImport
    displayOnlySummary
    onlySummaryLinkText
  }
  announcements {
    id
    title
    description
    dateStart
    dateEnd
    timeStart
    timeEnd
    likeCount(likeType: "Shout")
    likedByMe(likeType: "Shout")
  }
  likeCount(likeType: "NewsItem")
  likedByMe(likeType: "NewsItem")
  pushNotificationsSentAt
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
    $pushNotification: Boolean
    $author: String
    $keywords: String
    $externalId: String
    $fullVersion: Boolean
    $charactersToBeShown: Int
    $newsType: String
    $publicationDate: String
    $publishedAt: String
    $showPublishDate: Boolean
    $categoryName: String
    $categories: [CategoryInput!]
    $sourceUrl: WebUrlInput
    $address: AddressInput
    $contentBlocks: [ContentBlockInput!]
    $pointOfInterestId: ID
  ) {
    createNewsItem(
      id: $id
      forceCreate: $forceCreate
      title: $title
      pushNotification: $pushNotification
      author: $author
      keywords: $keywords
      externalId: $externalId
      fullVersion: $fullVersion
      charactersToBeShown: $charactersToBeShown
      newsType: $newsType
      publicationDate: $publicationDate
      publishedAt: $publishedAt
      showPublishDate: $showPublishDate
      categoryName: $categoryName
      categories: $categories
      sourceUrl: $sourceUrl
      address: $address
      contentBlocks: $contentBlocks
      pointOfInterestId: $pointOfInterestId
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
