import type {
  GenericItemAccessibilityInformation,
  GenericItemAddress,
  GenericItemCategory,
  GenericItemContact,
  GenericItemContentBlock,
  GenericItemDate,
  GenericItemLocation,
  GenericItemMediaContent,
  GenericItemOpeningHour,
  GenericItemPriceInformation,
  GenericItemWebUrl,
} from './generic-items.content-types.js';

export type GenericItemCategoryOption = {
  readonly id?: string;
  readonly name: string;
};

export type GenericItemListQuery = {
  readonly page: number;
  readonly pageSize: number;
};

export type GenericItemPagination = {
  readonly page: number;
  readonly pageSize: number;
  readonly hasNextPage: boolean;
  readonly total?: number;
};

export type GenericItemFormInput = {
  readonly title: string;
  readonly genericType: string;
  readonly teaser?: string;
  readonly visible?: boolean;
  readonly author?: string;
  readonly keywords?: string;
  readonly externalId?: string;
  readonly publicationDate?: string;
  readonly publishedAt?: string;
  readonly categoryName?: string;
  readonly payload?: unknown;
  readonly categories?: readonly GenericItemCategory[];
  readonly contacts?: readonly GenericItemContact[];
  readonly webUrls?: readonly GenericItemWebUrl[];
  readonly addresses?: readonly GenericItemAddress[];
  readonly contentBlocks?: readonly GenericItemContentBlock[];
  readonly openingHours?: readonly GenericItemOpeningHour[];
  readonly mediaContents?: readonly GenericItemMediaContent[];
  readonly locations?: readonly GenericItemLocation[];
  readonly dates?: readonly GenericItemDate[];
  readonly accessibilityInformations?: readonly GenericItemAccessibilityInformation[];
  readonly priceInformations?: readonly GenericItemPriceInformation[];
};

export type GenericItemContentItem = GenericItemFormInput & {
  readonly id: string;
  readonly contentType: string;
  readonly status: 'published';
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly description?: string;
};

export type GenericItemListResult = {
  readonly data: readonly GenericItemContentItem[];
  readonly pagination: GenericItemPagination;
};
