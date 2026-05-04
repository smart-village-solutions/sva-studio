import {
  buildMainserverListUrl,
  createMainserverCrudClient,
  requestMainserverJson,
} from '@sva/plugin-sdk';

import type { EventContentItem, EventFormInput, EventListQuery, EventListResult, PoiSelectItem } from './events.types.js';

export class EventsApiError extends Error {
  public constructor(
    public readonly code: string,
    message = code
  ) {
    super(message);
    this.name = 'EventsApiError';
  }
}

const MAX_POI_SELECTION_PAGE = 101;

const eventsClient = createMainserverCrudClient<EventContentItem, EventFormInput, EventListResult, EventListResult, EventsApiError>({
  basePath: '/api/v1/mainserver/events',
  errorFactory: (code, message) => new EventsApiError(code, message),
  mapListResponse: (response) => response,
});

export const listEvents = async (query: EventListQuery): Promise<EventListResult> => eventsClient.list(query);

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
    if (page > MAX_POI_SELECTION_PAGE) {
      throw new EventsApiError(
        'poi_selection_page_limit_exceeded',
        'Die POI-Auswahlliste überschreitet das erlaubte Pagination-Budget.'
      );
    }

    const response = await requestMainserverJson<{
      readonly data: readonly PoiSelectItem[];
      readonly pagination: EventListResult['pagination'];
    }>({
      url: buildMainserverListUrl('/api/v1/mainserver/poi', { page, pageSize: 100 }),
      errorFactory: (code, message) => new EventsApiError(code, message),
    });
    items.push(...response.data.map((item) => ({ id: item.id, name: item.name })));
    if (response.pagination.hasNextPage && response.data.length === 0) {
      throw new EventsApiError(
        'poi_selection_invalid_pagination',
        'Die POI-Auswahlliste liefert eine ungültige Pagination-Antwort.'
      );
    }
    hasNextPage = response.pagination.hasNextPage;
    page += 1;
  }

  return items;
};
