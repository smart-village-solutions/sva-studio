export type PoiAddress = {
  readonly addition?: string;
  readonly street?: string;
  readonly zip?: string;
  readonly city?: string;
  readonly kind?: string;
  readonly geoLocation?: {
    readonly latitude?: number;
    readonly longitude?: number;
  };
};

export type PoiContact = {
  readonly firstName?: string;
  readonly lastName?: string;
  readonly phone?: string;
  readonly fax?: string;
  readonly email?: string;
  readonly webUrls?: readonly PoiWebUrl[];
};

export type PoiWebUrl = {
  readonly url: string;
  readonly description?: string;
};

export type PoiLocation = {
  readonly name?: string;
  readonly department?: string;
  readonly district?: string;
  readonly regionName?: string;
  readonly state?: string;
  readonly geoLocation?: {
    readonly latitude?: number;
    readonly longitude?: number;
  };
};

export type PoiOperatingCompany = {
  readonly name?: string;
  readonly address?: PoiAddress;
  readonly contact?: PoiContact;
};

export type PoiPriceInformation = {
  readonly name?: string;
  readonly amount?: number;
  readonly groupPrice?: boolean;
  readonly ageFrom?: number;
  readonly ageTo?: number;
  readonly minAdultCount?: number;
  readonly maxAdultCount?: number;
  readonly minChildrenCount?: number;
  readonly maxChildrenCount?: number;
  readonly description?: string;
  readonly category?: string;
};

export type PoiMediaContent = {
  readonly captionText?: string;
  readonly copyright?: string;
  readonly height?: number;
  readonly width?: number;
  readonly contentType?: string;
  readonly sourceUrl?: PoiWebUrl;
};

export type PoiCertificate = {
  readonly name: string;
};

export type PoiAccessibilityInformation = {
  readonly description?: string;
  readonly types?: string;
  readonly urls?: readonly PoiWebUrl[];
};

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

export type PoiOpeningHour = {
  readonly weekday?: string;
  readonly dateFrom?: string;
  readonly dateTo?: string;
  readonly timeFrom?: string;
  readonly timeTo?: string;
  readonly sortNumber?: number;
  readonly open?: boolean;
  readonly useYear?: boolean;
  readonly description?: string;
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
