type NewsPayload = {
  readonly teaser?: string;
  readonly body?: string;
  readonly imageUrl?: string;
  readonly externalUrl?: string;
  readonly category?: string;
};

type NewsStatus = 'published';

export type NewsWebUrl = {
  readonly url: string;
  readonly description?: string;
};

type NewsGeoLocation = {
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

type NewsMediaContent = {
  readonly captionText?: string;
  readonly copyright?: string;
  readonly contentType?: string;
  readonly height?: number | string;
  readonly width?: number | string;
  readonly sourceUrl?: NewsWebUrl;
};

export type NewsMediaContentFormValue = {
  captionText: string;
  copyright: string;
  contentType: string;
  height: string;
  width: string;
  sourceUrl: NewsWebUrl;
};

export type NewsContentBlock = {
  readonly title?: string;
  readonly intro?: string;
  readonly body?: string;
  readonly mediaContents?: readonly NewsMediaContent[];
};

export type NewsContentBlockFormValue = {
  title: string;
  intro: string;
  body: string;
  mediaContents: NewsMediaContentFormValue[];
};

type NewsDataProvider = {
  readonly id?: string;
  readonly name?: string;
};

type NewsSetting = {
  readonly alwaysRecreateOnImport?: string;
  readonly displayOnlySummary?: string;
  readonly onlySummaryLinkText?: string;
};

type NewsAnnouncementSummary = {
  readonly id?: string;
  readonly title?: string;
};

export type NewsListQuery = {
  readonly page: number;
  readonly pageSize: number;
  readonly includeInvisible?: boolean;
  readonly visibilityFilter?: 'all' | 'visible' | 'hidden';
  readonly editorialStatusFilter?: 'all' | 'draft' | 'scheduled' | 'published';
};

type NewsPagination = {
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
  readonly categories?: readonly NewsCategory[];
  readonly sourceUrl?: NewsWebUrl;
  readonly address?: NewsAddress;
  readonly contentBlocks?: readonly NewsContentBlock[];
  readonly pointOfInterestId?: string;
  readonly pushNotification?: boolean;
  readonly visible?: boolean;
};

export type NewsAuthorControl =
  | { readonly kind: 'fixed'; readonly value: string }
  | {
      readonly kind: 'selectable';
      readonly value: string;
      readonly options: readonly { readonly value: string; readonly label: string }[];
    };

export type NewsDetailTabId = 'basis' | 'content' | 'settings' | 'history';

type NewsPublicationMode = 'draft' | 'immediate' | 'scheduled';

type NewsEditorialStatus = 'draft' | 'scheduled' | 'published';

type NewsLegacyCompatibilitySnapshot = {
  readonly visible?: boolean;
  readonly keywords?: string;
  readonly externalId?: string;
  readonly fullVersion?: boolean;
  readonly charactersToBeShown?: number | string;
  readonly newsType?: string;
  readonly publishedAt?: string;
  readonly publicationDate?: string;
  readonly showPublishDate?: boolean;
  readonly address?: {
    readonly street?: string;
    readonly zip?: string;
    readonly city?: string;
  };
  readonly pointOfInterestId?: string;
  readonly pushNotificationsSentAt?: string;
  readonly legacyContentBlocks?: NewsContentBlockFormValue[];
};

export type NewsDetailCompatibilityField =
  | 'keywords'
  | 'publishedAt'
  | 'publicationDate'
  | 'externalId'
  | 'newsType'
  | 'charactersToBeShown'
  | 'fullVersion'
  | 'showPublishDate'
  | 'pushNotification'
  | 'contentBlocks'
  | 'address'
  | 'pointOfInterestId';

type NewsDetailCompatibilityTouchedState = Partial<Record<NewsDetailCompatibilityField, true>>;

type NewsDetailEditorialFormFields = {
  title: string;
  author: string;
  categories: string[];
  contentTeaser: string;
  contentBody: string;
  contentMedia: NewsMediaContentFormValue[];
  sourceUrl: NewsWebUrl;
  sourceUrlDescription: string;
  pushNotificationEnabled: boolean;
  publicationMode: NewsPublicationMode;
  scheduledPublicationAt: string;
};

export type NewsDetailEditorialFormValues = NewsDetailEditorialFormFields & {
  __legacySnapshot?: NewsLegacyCompatibilitySnapshot;
  __compatibilityTouched?: NewsDetailCompatibilityTouchedState;
};

type NewsDetailCompatibilityAliases = {
  // Internal compatibility aliases for still-unported page/tab code.
  readonly keywords?: string;
  readonly publishedAt?: string;
  readonly publicationDate?: string;
  readonly externalId?: string;
  readonly newsType?: string;
  readonly charactersToBeShown?: string;
  readonly fullVersion?: boolean;
  readonly showPublishDate?: boolean;
  readonly pushNotification?: boolean;
  readonly contentBlocks?: NewsContentBlockFormValue[];
  readonly address?: {
    readonly street?: string;
    readonly zip?: string;
    readonly city?: string;
  };
  readonly pointOfInterestId?: string;
};

export type NewsDetailFormValues = NewsDetailEditorialFormValues & NewsDetailCompatibilityAliases;

export type NewsSavePlan = {
  readonly mutation: NewsFormInput;
  readonly visible: boolean;
  readonly editorialStatus: NewsEditorialStatus;
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

export type NewsCategoryOption = {
  readonly id?: string;
  readonly name: string;
};
