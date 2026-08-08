import {
  buildMainserverListUrl,
  createMainserverCrudClient,
  requestMainserverJson,
} from '@sva/plugin-sdk';
import type { MainserverActingPrincipalType } from '@sva/plugin-sdk';

import type {
  EventCategoryOption,
  EventContentItem,
  EventFormInput,
  EventListQuery,
  EventListResult,
  PoiSelectItem,
} from './events.types.js';

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

const eventsClient = createMainserverCrudClient<
  EventContentItem,
  EventFormInput,
  EventListResult,
  EventListResult,
  EventsApiError
>({
  basePath: '/api/v1/mainserver/events',
  errorFactory: (code, message) => new EventsApiError(code, message),
  mapListResponse: (response) => response,
});

export const listEvents = async (query: EventListQuery): Promise<EventListResult> =>
  eventsClient.list(query);

export const getEvent = async (contentId: string): Promise<EventContentItem> =>
  eventsClient.get(contentId);
export const getEventDetail = async (contentId: string) => eventsClient.getDetail(contentId);

export const createEvent = async (
  input: EventFormInput,
  actingPrincipalType: MainserverActingPrincipalType
): Promise<EventContentItem> => eventsClient.create(input, actingPrincipalType);

export const updateEvent = async (
  contentId: string,
  input: EventFormInput,
  actingPrincipalType: MainserverActingPrincipalType
): Promise<EventContentItem> => eventsClient.update(contentId, input, actingPrincipalType);

export const deleteEvent = async (
  contentId: string,
  actingPrincipalType: MainserverActingPrincipalType
): Promise<void> => eventsClient.remove(contentId, actingPrincipalType);

export const listEventCategories = async (): Promise<readonly EventCategoryOption[]> => {
  const response = await requestMainserverJson<
    { readonly data: readonly EventCategoryOption[] },
    EventsApiError
  >({
    url: '/api/v1/mainserver/categories',
    errorFactory: (code, message) => new EventsApiError(code, message),
  });
  return response.data;
};

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
