import type {
  PoiAccessibilityInformation,
  PoiAddress,
  PoiCertificate,
  PoiContact,
  PoiLocation,
  PoiMediaContent,
  PoiOpeningHour,
  PoiOperatingCompany,
  PoiPriceInformation,
  PoiWebUrl,
} from './poi.content.types.js';

export type PoiListQuery = {
  readonly page: number;
  readonly pageSize: number;
};

export type PoiPagination = {
  readonly page: number;
  readonly pageSize: number;
  readonly hasNextPage: boolean;
  readonly total?: number;
};

export type PoiListResult = {
  readonly data: readonly PoiContentItem[];
  readonly pagination: PoiPagination;
};

export type PoiFormInput = {
  readonly name: string;
  readonly description?: string;
  readonly mobileDescription?: string;
  readonly active?: boolean;
  readonly categoryName?: string;
  readonly payload?: Record<string, unknown>;
  readonly addresses?: readonly PoiAddress[];
  readonly contact?: PoiContact;
  readonly location?: PoiLocation;
  readonly openingHours?: readonly PoiOpeningHour[];
  readonly operatingCompany?: PoiOperatingCompany;
  readonly priceInformations?: readonly PoiPriceInformation[];
  readonly webUrls?: readonly PoiWebUrl[];
  readonly mediaContents?: readonly PoiMediaContent[];
  readonly certificates?: readonly PoiCertificate[];
  readonly accessibilityInformation?: PoiAccessibilityInformation;
  readonly tags?: readonly string[];
};

export type PoiContentItem = PoiFormInput & {
  readonly id: string;
  readonly contentType: string;
  readonly status: 'published';
  readonly visible?: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
};
