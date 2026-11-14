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
  /** Mainserver id of a stored entry; lets the host keep source metadata with this entry. */
  readonly id?: string;
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
  // Mainserver price attributes without editor fields; carried through unchanged on save.
  readonly groupPrice?: boolean;
  readonly ageFrom?: number;
  readonly ageTo?: number;
  readonly minAdultCount?: number;
  readonly maxAdultCount?: number;
  readonly minChildrenCount?: number;
  readonly maxChildrenCount?: number;
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
  readonly registrationRequired?: boolean;
  /** `null` clears a stored participant limit. */
  readonly maximumAttendees?: number | null;
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
  // The editor writes strings; the host also accepts the Mainserver read shape below, so a read
  // event can be sent back unchanged (for example on a status change from the content list).
  readonly recurring?: string | boolean;
  readonly recurringType?: string | number;
  readonly recurringInterval?: string | number;
  readonly recurringWeekdays?: readonly (string | number)[];
  readonly visible?: boolean;
};

type MainserverReadShapeFields =
  'recurring' | 'recurringType' | 'recurringInterval' | 'recurringWeekdays' | 'maximumAttendees';

/** Event as the host returns it from the Mainserver. */
export type EventContentItem = Omit<EventFormInput, MainserverReadShapeFields> & {
  readonly recurring?: boolean;
  readonly recurringType?: number;
  readonly recurringInterval?: number;
  readonly recurringWeekdays?: readonly number[];
  readonly maximumAttendees?: number;
  readonly id: string;
  readonly contentType: string;
  readonly status: 'published';
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly dataProvider?: Readonly<{ id?: string; name?: string }>;
};

export type PoiSelectItem = {
  readonly id: string;
  readonly name: string;
};
