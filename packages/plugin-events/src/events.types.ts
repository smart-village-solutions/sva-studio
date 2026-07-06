export type EventDate = {
  readonly dateStart?: string;
  readonly dateEnd?: string;
  readonly timeStart?: string;
  readonly timeEnd?: string;
  readonly timeDescription?: string;
  readonly weekday?: string;
  readonly useOnlyTimeDescription?: boolean;
};

export type EventAddress = {
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

export type EventContact = {
  readonly firstName?: string;
  readonly lastName?: string;
  readonly phone?: string;
  readonly fax?: string;
  readonly email?: string;
  readonly webUrls?: readonly EventWebUrl[];
};

export type EventWebUrl = {
  readonly url: string;
  readonly description?: string;
};

export type EventMediaContent = {
  readonly captionText?: string;
  readonly copyright?: string;
  readonly height?: number;
  readonly width?: number;
  readonly contentType?: string;
  readonly sourceUrl?: EventWebUrl;
};

export type EventOrganizer = {
  readonly name?: string;
  readonly address?: EventAddress;
  readonly contact?: EventContact;
};

export type EventPriceInformation = {
  readonly name?: string;
  readonly amount?: number;
  readonly description?: string;
  readonly category?: string;
};

export type EventAccessibilityInformation = {
  readonly description?: string;
  readonly types?: string;
  readonly urls?: readonly EventWebUrl[];
};

export type EventCategory = {
  readonly name: string;
  readonly payload?: Readonly<Record<string, unknown>>;
  readonly children?: readonly EventCategory[];
};

export type EventCategoryOption = {
  readonly id?: string;
  readonly name: string;
};

export type EventListQuery = {
  readonly page: number;
  readonly pageSize: number;
};

export type EventPagination = {
  readonly page: number;
  readonly pageSize: number;
  readonly hasNextPage: boolean;
  readonly total?: number;
};

export type EventListResult = {
  readonly data: readonly EventContentItem[];
  readonly pagination: EventPagination;
};

export type EventFormInput = {
  readonly title: string;
  readonly description?: string;
  readonly externalId?: string;
  readonly keywords?: string;
  readonly categoryName?: string;
  readonly categories?: readonly EventCategory[];
  readonly dates?: readonly EventDate[];
  readonly addresses?: readonly EventAddress[];
  readonly contacts?: readonly EventContact[];
  readonly urls?: readonly EventWebUrl[];
  readonly mediaContents?: readonly EventMediaContent[];
  readonly organizer?: EventOrganizer;
  readonly priceInformations?: readonly EventPriceInformation[];
  readonly accessibilityInformation?: EventAccessibilityInformation;
  readonly tags?: readonly string[];
  readonly pointOfInterestId?: string;
  readonly repeat?: boolean;
  readonly recurring?: string;
  readonly recurringType?: string;
  readonly recurringInterval?: string;
  readonly recurringWeekdays?: readonly string[];
  readonly pushNotification?: boolean;
  readonly visible?: boolean;
};

export type EventContentItem = EventFormInput & {
  readonly id: string;
  readonly contentType: string;
  readonly status: 'published';
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type PoiSelectItem = {
  readonly id: string;
  readonly name: string;
};
