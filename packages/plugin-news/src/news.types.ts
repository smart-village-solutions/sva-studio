export type NewsPayload = {
  readonly teaser?: string;
  readonly body?: string;
  readonly imageUrl?: string;
  readonly externalUrl?: string;
  readonly category?: string;
};

export type NewsStatus = 'published';

export type NewsWebUrl = {
  readonly url: string;
  readonly description?: string;
};

export type NewsGeoLocation = {
  readonly latitude: number;
  readonly longitude: number;
};

export type NewsAddress = {
  readonly id?: number;
  readonly addition?: string;
  readonly street?: string;
  readonly zip?: string;
  readonly city?: string;
  readonly kind?: string;
  readonly geoLocation?: NewsGeoLocation;
};

export type NewsCategory = {
  readonly name: string;
  readonly payload?: Readonly<Record<string, unknown>>;
  readonly children?: readonly NewsCategory[];
};

export type NewsMediaContent = {
  readonly captionText?: string;
  readonly copyright?: string;
  readonly contentType?: string;
  readonly height?: number | string;
  readonly width?: number | string;
  readonly sourceUrl?: NewsWebUrl;
};

export type NewsContentBlock = {
  readonly title?: string;
  readonly intro?: string;
  readonly body?: string;
  readonly mediaContents?: readonly NewsMediaContent[];
};

export type NewsDataProvider = {
  readonly id?: string;
  readonly name?: string;
};

export type NewsSetting = {
  readonly alwaysRecreateOnImport?: string;
  readonly displayOnlySummary?: string;
  readonly onlySummaryLinkText?: string;
};

export type NewsAnnouncementSummary = {
  readonly id?: string;
  readonly title?: string;
};

export type NewsListQuery = {
  readonly page: number;
  readonly pageSize: number;
};

export type NewsPagination = {
  readonly page: number;
  readonly pageSize: number;
  readonly hasNextPage: boolean;
  readonly total?: number;
};

export type NewsListResult = {
  readonly data: readonly NewsContentItem[];
  readonly pagination: NewsPagination;
};

export type NewsFormInput = {
  readonly title: string;
  readonly author?: string;
  readonly keywords?: string;
  readonly externalId?: string;
  readonly fullVersion?: boolean;
  readonly charactersToBeShown?: number;
  readonly newsType?: string;
  readonly publicationDate?: string;
  readonly publishedAt: string;
  readonly showPublishDate?: boolean;
  readonly categoryName?: string;
  readonly categories?: readonly NewsCategory[];
  readonly sourceUrl?: NewsWebUrl;
  readonly address?: NewsAddress;
  readonly contentBlocks?: readonly NewsContentBlock[];
  readonly pointOfInterestId?: string;
  readonly pushNotification?: boolean;
};

export type NewsContentItem = {
  readonly id: string;
  readonly title: string;
  readonly contentType: string;
  readonly payload: NewsPayload;
  readonly status: NewsStatus;
  readonly author: string;
  readonly keywords?: string;
  readonly externalId?: string;
  readonly fullVersion?: boolean;
  readonly charactersToBeShown?: number | string;
  readonly newsType?: string;
  readonly publicationDate?: string;
  readonly showPublishDate?: boolean;
  readonly categoryName?: string;
  readonly categories?: readonly NewsCategory[];
  readonly sourceUrl?: NewsWebUrl;
  readonly address?: NewsAddress;
  readonly contentBlocks?: readonly NewsContentBlock[];
  readonly pointOfInterestId?: string;
  readonly dataProvider?: NewsDataProvider;
  readonly settings?: NewsSetting;
  readonly announcements?: readonly NewsAnnouncementSummary[];
  readonly likeCount?: number;
  readonly likedByMe?: boolean;
  readonly pushNotificationsSentAt?: string;
  readonly visible?: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly publishedAt: string;
};
