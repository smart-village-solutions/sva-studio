export type SvaMainserverProviderKey = 'sva_mainserver';

export type SvaMainserverErrorCode =
  | 'config_not_found'
  | 'integration_disabled'
  | 'invalid_config'
  | 'database_unavailable'
  | 'identity_provider_unavailable'
  | 'missing_credentials'
  | 'token_request_failed'
  | 'unauthorized'
  | 'forbidden'
  | 'network_error'
  | 'graphql_error'
  | 'invalid_response'
  | 'not_found';

export type SvaMainserverInstanceConfig = {
  readonly instanceId: string;
  readonly providerKey: SvaMainserverProviderKey;
  readonly graphqlBaseUrl: string;
  readonly oauthTokenUrl: string;
  readonly enabled: boolean;
  readonly lastVerifiedAt?: string;
  readonly lastVerifiedStatus?: string;
};

export type SvaMainserverConnectionStatus = {
  readonly status: 'connected' | 'error';
  readonly checkedAt: string;
  readonly config?: SvaMainserverInstanceConfig;
  readonly queryRootTypename?: string;
  readonly mutationRootTypename?: string;
  readonly errorCode?: SvaMainserverErrorCode;
  readonly errorMessage?: string;
};

export type SvaMainserverConnectionInput = {
  readonly instanceId: string;
  readonly keycloakSubject: string;
};

export type SvaMainserverNewsPayload = {
  readonly teaser?: string;
  readonly body?: string;
  readonly imageUrl?: string;
  readonly externalUrl?: string;
  readonly category?: string;
};

export type SvaMainserverWebUrl = {
  readonly id?: string;
  readonly url: string;
  readonly description?: string;
};

export type SvaMainserverWebUrlInput = {
  readonly url: string;
  readonly description?: string;
};

export type SvaMainserverGeoLocation = {
  readonly latitude?: number;
  readonly longitude?: number;
};

export type SvaMainserverAddress = {
  readonly id?: string;
  readonly addition?: string;
  readonly street?: string;
  readonly zip?: string;
  readonly city?: string;
  readonly kind?: string;
  readonly geoLocation?: SvaMainserverGeoLocation;
};

export type SvaMainserverAddressInput = Omit<SvaMainserverAddress, 'id'> & {
  readonly id?: number;
};

export type SvaMainserverCategoryInput = {
  readonly name: string;
  readonly payload?: unknown;
  readonly children?: readonly SvaMainserverCategoryInput[];
};

export type SvaMainserverCategory = {
  readonly id?: string;
  readonly name: string;
  readonly iconName?: string;
  readonly position?: number;
  readonly tagList?: string;
  readonly createdAt?: string;
  readonly updatedAt?: string;
  readonly children: readonly SvaMainserverCategory[];
};

export type SvaMainserverMediaContentInput = {
  readonly captionText?: string;
  readonly copyright?: string;
  readonly height?: number | string;
  readonly width?: number | string;
  readonly contentType?: string;
  readonly sourceUrl?: SvaMainserverWebUrlInput;
};

export type SvaMainserverMediaContent = Omit<SvaMainserverMediaContentInput, 'sourceUrl'> & {
  readonly id?: string;
  readonly height?: number;
  readonly width?: number;
  readonly sourceUrl?: SvaMainserverWebUrl;
};

export type SvaMainserverContentBlockInput = {
  readonly title?: string;
  readonly intro?: string;
  readonly body?: string;
  readonly mediaContents?: readonly SvaMainserverMediaContentInput[];
};

export type SvaMainserverContentBlock = {
  readonly id?: string;
  readonly title?: string;
  readonly intro?: string;
  readonly body?: string;
  readonly mediaContents: readonly SvaMainserverMediaContent[];
  readonly createdAt?: string;
  readonly updatedAt?: string;
};

export type SvaMainserverDataProvider = {
  readonly id?: string;
  readonly name?: string;
  readonly dataType?: string;
  readonly description?: string;
  readonly notice?: string;
  readonly logo?: SvaMainserverWebUrl;
  readonly address?: SvaMainserverAddress;
};

export type SvaMainserverSetting = {
  readonly alwaysRecreateOnImport?: string;
  readonly displayOnlySummary?: string;
  readonly onlySummaryLinkText?: string;
};

export type SvaMainserverAnnouncementSummary = {
  readonly id?: string;
  readonly title?: string;
  readonly description?: string;
  readonly dateStart?: string;
  readonly dateEnd?: string;
  readonly timeStart?: string;
  readonly timeEnd?: string;
  readonly likeCount: number;
  readonly likedByMe: boolean;
};

export type SvaMainserverNewsItem = {
  readonly id: string;
  readonly title: string;
  readonly contentType: 'news.article';
  readonly payload: SvaMainserverNewsPayload;
  readonly status: 'published';
  readonly author: string;
  readonly keywords?: string;
  readonly externalId?: string;
  readonly fullVersion?: boolean;
  readonly charactersToBeShown?: number;
  readonly newsType?: string;
  readonly publicationDate?: string;
  readonly showPublishDate?: boolean;
  readonly categoryName?: string;
  readonly categories: readonly SvaMainserverCategory[];
  readonly sourceUrl?: SvaMainserverWebUrl;
  readonly address?: SvaMainserverAddress;
  readonly contentBlocks: readonly SvaMainserverContentBlock[];
  readonly dataProvider?: SvaMainserverDataProvider;
  readonly settings?: SvaMainserverSetting;
  readonly announcements: readonly SvaMainserverAnnouncementSummary[];
  readonly likeCount: number;
  readonly likedByMe: boolean;
  readonly pushNotificationsSentAt?: string;
  readonly visible: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly publishedAt: string;
};

export type SvaMainserverNewsInput = {
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
  readonly categories?: readonly SvaMainserverCategoryInput[];
  readonly sourceUrl?: SvaMainserverWebUrlInput;
  readonly address?: SvaMainserverAddressInput;
  readonly contentBlocks?: readonly SvaMainserverContentBlockInput[];
  readonly pointOfInterestId?: string;
  readonly pushNotification?: boolean;
};
