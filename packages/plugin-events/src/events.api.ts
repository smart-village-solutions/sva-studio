import type {
  EventContentItem,
  EventFormInput,
  EventListQuery,
  EventListResult,
  PoiSelectItem,
} from './events.types.js';

type ApiItemResponse<T> = {
  readonly data: T;
};

type ApiErrorResponse = {
  readonly error?: string;
  readonly message?: string;
};

type PaginatedResponse<TItem> = {
  readonly data: readonly TItem[];
  readonly pagination: {
    readonly page: number;
    readonly pageSize: number;
    readonly hasNextPage: boolean;
    readonly total?: number;
  };
};

export class EventsApiError extends Error {
  public constructor(
    public readonly code: string,
    message = code
  ) {
    super(message);
    this.name = 'EventsApiError';
  }
}

const REQUEST_HEADERS = {
  'Content-Type': 'application/json',
  'X-Requested-With': 'XMLHttpRequest',
} as const;
const MAX_POI_SELECTION_PAGES = 101;

const requestJson = async <T>(input: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(input, {
    credentials: 'include',
    ...init,
    headers: {
      Accept: 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    let errorCode = `http_${response.status}`;
    let message = errorCode;
    try {
      const body = (await response.json()) as ApiErrorResponse;
      errorCode = typeof body.error === 'string' && body.error.length > 0 ? body.error : errorCode;
      message = typeof body.message === 'string' && body.message.length > 0 ? body.message : errorCode;
    } catch {
      // Deterministic fallback for non-JSON upstream errors.
    }
    throw new EventsApiError(errorCode, message);
  }

  return (await response.json()) as T;
};

const buildListUrl = (basePath: string, query: EventListQuery): string =>
  `${basePath}?page=${encodeURIComponent(String(query.page))}&pageSize=${encodeURIComponent(String(query.pageSize))}`;

export const listEvents = async (query: EventListQuery): Promise<EventListResult> => {
  return requestJson<EventListResult>(buildListUrl('/api/v1/mainserver/events', query));
};

export const getEvent = async (contentId: string): Promise<EventContentItem> => {
  const response = await requestJson<ApiItemResponse<EventContentItem>>(`/api/v1/mainserver/events/${contentId}`);
  return response.data;
};

export const createEvent = async (input: EventFormInput): Promise<EventContentItem> => {
  const response = await requestJson<ApiItemResponse<EventContentItem>>('/api/v1/mainserver/events', {
    method: 'POST',
    headers: REQUEST_HEADERS,
    body: JSON.stringify(input),
  });
  return response.data;
};

export const updateEvent = async (contentId: string, input: EventFormInput): Promise<EventContentItem> => {
  const response = await requestJson<ApiItemResponse<EventContentItem>>(`/api/v1/mainserver/events/${contentId}`, {
    method: 'PATCH',
    headers: REQUEST_HEADERS,
    body: JSON.stringify(input),
  });
  return response.data;
};

export const deleteEvent = async (contentId: string): Promise<void> => {
  await requestJson<ApiItemResponse<{ id: string }>>(`/api/v1/mainserver/events/${contentId}`, {
    method: 'DELETE',
    headers: REQUEST_HEADERS,
  });
};

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

    const response = await requestJson<PaginatedResponse<PoiSelectItem>>(buildListUrl('/api/v1/mainserver/poi', { page, pageSize: 100 }));
    items.push(...response.data.map((item) => ({ id: item.id, name: item.name })));
    hasNextPage = response.pagination.hasNextPage && response.data.length > 0;
    page += 1;
  }

  return items;
};
