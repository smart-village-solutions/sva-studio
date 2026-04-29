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
    const response = await requestMainserverJson<{
      readonly data: readonly PoiSelectItem[];
      readonly pagination: EventListResult['pagination'];
    }>({
      url: buildMainserverListUrl('/api/v1/mainserver/poi', { page, pageSize: 100 }),
      errorFactory: (code, message) => new EventsApiError(code, message),
    });
    items.push(...response.data.map((item) => ({ id: item.id, name: item.name })));
    hasNextPage = response.pagination.hasNextPage;
    page += 1;
  }

  return items;
};
