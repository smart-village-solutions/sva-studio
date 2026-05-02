import {
  buildMainserverListUrl,
  createMainserverCrudClient,
  requestMainserverJson,
} from '@sva/plugin-sdk';

import type { EventContentItem, EventFormInput, EventListQuery, EventListResult, PoiSelectItem } from './events.types.js';

const DEFAULT_LIST_QUERY: EventListQuery = { page: 1, pageSize: 25 };
const DEFAULT_LIST_PAGINATION: EventListResult['pagination'] = {
  page: DEFAULT_LIST_QUERY.page,
  pageSize: DEFAULT_LIST_QUERY.pageSize,
  hasNextPage: false,
};
const MAX_POI_SELECTION_PAGES = 101;

export class EventsApiError extends Error {
  public constructor(
    public readonly code: string,
    message = code
  ) {
    super(message);
    this.name = 'EventsApiError';
  }
}

const eventsClient = createMainserverCrudClient<
  EventContentItem,
  EventFormInput,
  Readonly<{ data: readonly EventContentItem[]; pagination?: EventListResult['pagination'] }>,
  EventListResult,
  EventsApiError
>({
  basePath: '/api/v1/mainserver/events',
  errorFactory: (code, message) => new EventsApiError(code, message),
  mapListResponse: (response) => ({
    data: response.data,
    pagination: response.pagination ?? DEFAULT_LIST_PAGINATION,
  }),
});

export const listEvents = async (query: EventListQuery = DEFAULT_LIST_QUERY): Promise<EventListResult> => eventsClient.list(query);

export const getEvent = async (contentId: string): Promise<EventContentItem> => eventsClient.get(contentId);

export const createEvent = async (input: EventFormInput): Promise<EventContentItem> => eventsClient.create(input);

export const updateEvent = async (contentId: string, input: EventFormInput): Promise<EventContentItem> =>
  eventsClient.update(contentId, input);

export const deleteEvent = async (contentId: string): Promise<void> => eventsClient.remove(contentId);

export const listPoiForEventSelection = async (): Promise<readonly PoiSelectItem[]> => {
  const items: PoiSelectItem[] = [];
  let page = 1;
  let hasNextPage = true;

  while (hasNextPage) {
    if (page > MAX_POI_SELECTION_PAGES) {
      throw new EventsApiError(
        'poi_selection_page_limit_exceeded',
        'Die POI-Auswahl überschreitet das erlaubte Pagination-Limit.'
      );
    }

    const response = await requestMainserverJson<{
      readonly data: readonly PoiSelectItem[];
      readonly pagination?: EventListResult['pagination'];
    }, EventsApiError>({
      url: buildMainserverListUrl('/api/v1/mainserver/poi', { page, pageSize: 100 }),
      errorFactory: (code, message) => new EventsApiError(code, message),
    });
    const pageItems = response.data.map((item) => ({ id: item.id, name: item.name }));
    items.push(...pageItems);
    hasNextPage = response.pagination?.hasNextPage === true && pageItems.length > 0;
    page += 1;
  }

  return items;
};
