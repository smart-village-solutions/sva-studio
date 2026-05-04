export type EventDate = {
  readonly dateStart?: string;
  readonly dateEnd?: string;
  readonly timeStart?: string;
  readonly timeEnd?: string;
  readonly timeDescription?: string;
};

export type EventAddress = {
  readonly street?: string;
  readonly zip?: string;
  readonly city?: string;
};

export type EventContact = {
  readonly firstName?: string;
  readonly lastName?: string;
  readonly phone?: string;
  readonly email?: string;
};

export type EventWebUrl = {
  readonly url: string;
  readonly description?: string;
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
  readonly categoryName?: string;
  readonly dates?: readonly EventDate[];
  readonly addresses?: readonly EventAddress[];
  readonly contact?: EventContact;
  readonly urls?: readonly EventWebUrl[];
  readonly tags?: readonly string[];
  readonly pointOfInterestId?: string;
  readonly repeat?: boolean;
  readonly recurring?: string;
  readonly recurringType?: string;
  readonly recurringInterval?: string;
  readonly recurringWeekdays?: readonly string[];
};

export type EventContentItem = EventFormInput & {
  readonly id: string;
  readonly contentType: string;
  readonly contacts?: readonly EventContact[];
  readonly status: 'published';
  readonly visible?: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type PoiSelectItem = {
  readonly id: string;
  readonly name: string;
};
