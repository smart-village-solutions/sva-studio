import type {
  SvaMainserverAddress,
  SvaMainserverAddressInput,
  SvaMainserverNewsPayload,
  SvaMainserverWebUrl,
  SvaMainserverWebUrlInput,
} from './types.js';

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

export type SvaMainserverCategoriesListItem = Omit<SvaMainserverCategory, 'id' | 'children'> & {
  readonly id: string;
  readonly dataTypes: readonly string[];
  readonly parent?: {
    readonly name: string;
  };
};

export type SvaMainserverCategoryManagementItem = {
  readonly id: string;
  readonly name: string;
  readonly active: boolean;
  readonly parent?: { readonly id: string; readonly name: string };
  readonly children: readonly { readonly id: string }[];
  readonly position?: number;
  readonly iconName?: string;
  readonly email?: string;
  readonly dataTypes: readonly string[];
  readonly createdAt?: string;
  readonly updatedAt?: string;
};
export type SvaMainserverSaveCategoryInput = {
  readonly id?: string;
  readonly name: string;
  readonly active: boolean;
  readonly parentId: string | null;
  readonly position: number | null;
  readonly iconName: string | null;
  readonly email: string | null;
  readonly dataTypes: readonly string[];
};
export type SvaMainserverCategoryMutationError = {
  readonly code: string;
  readonly field?: string;
  readonly message: string;
};
export type SvaMainserverCategoryUsage = {
  readonly children: number;
  readonly resourceAssignments: number;
  readonly externalServiceAssignments: number;
  readonly dataResourceSettings: number;
  readonly notificationConfigurations: number;
};
export type SvaMainserverSaveCategoryResult = {
  readonly category?: SvaMainserverCategoryManagementItem;
  readonly affectedDescendantIds: readonly string[];
  readonly errors: readonly SvaMainserverCategoryMutationError[];
};
export type SvaMainserverDeleteCategoryResult = {
  readonly deletedCategoryId?: string;
  readonly usage: SvaMainserverCategoryUsage;
  readonly errors: readonly SvaMainserverCategoryMutationError[];
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

export type SvaMainserverDataProviderIdentity = Readonly<{
  dataProvider: Readonly<{
    id: string;
    name?: string;
  }>;
}>;

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
  readonly payload?: SvaMainserverNewsPayload;
};
