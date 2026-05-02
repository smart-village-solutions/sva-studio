export type PoiAddress = {
  readonly street?: string;
  readonly zip?: string;
  readonly city?: string;
};

export type PoiContact = {
  readonly firstName?: string;
  readonly lastName?: string;
  readonly phone?: string;
  readonly email?: string;
};

export type PoiWebUrl = {
  readonly url: string;
  readonly description?: string;
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
  readonly timeFrom?: string;
  readonly timeTo?: string;
  readonly open?: boolean;
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
  readonly openingHours?: readonly PoiOpeningHour[];
  readonly webUrls?: readonly PoiWebUrl[];
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
