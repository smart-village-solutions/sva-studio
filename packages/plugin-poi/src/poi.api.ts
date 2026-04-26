import type { PoiContentItem, PoiFormInput } from './poi.types.js';

type ApiItemResponse<T> = { readonly data: T };
type ApiListResponse<T> = { readonly data: readonly T[] };
type ApiErrorResponse = { readonly error?: string; readonly message?: string };

export class PoiApiError extends Error {
  public constructor(
    public readonly code: string,
    message = code
  ) {
    super(message);
    this.name = 'PoiApiError';
  }
}

const REQUEST_HEADERS = {
  'Content-Type': 'application/json',
  'X-Requested-With': 'XMLHttpRequest',
} as const;

const requestJson = async <T>(input: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(input, {
    credentials: 'include',
    ...init,
    headers: { Accept: 'application/json', ...(init?.headers ?? {}) },
  });

  if (!response.ok) {
    let errorCode = `http_${response.status}`;
    let message = errorCode;
    try {
      const body = (await response.json()) as ApiErrorResponse;
      errorCode = typeof body.error === 'string' && body.error.length > 0 ? body.error : errorCode;
      message = typeof body.message === 'string' && body.message.length > 0 ? body.message : errorCode;
    } catch {
      // Keep HTTP fallback.
    }
    throw new PoiApiError(errorCode, message);
  }

  return (await response.json()) as T;
};

export const listPoi = async (): Promise<readonly PoiContentItem[]> => {
  const response = await requestJson<ApiListResponse<PoiContentItem>>('/api/v1/mainserver/poi');
  return response.data;
};

export const getPoi = async (contentId: string): Promise<PoiContentItem> => {
  const response = await requestJson<ApiItemResponse<PoiContentItem>>(`/api/v1/mainserver/poi/${contentId}`);
  return response.data;
};

export const createPoi = async (input: PoiFormInput): Promise<PoiContentItem> => {
  const response = await requestJson<ApiItemResponse<PoiContentItem>>('/api/v1/mainserver/poi', {
    method: 'POST',
    headers: REQUEST_HEADERS,
    body: JSON.stringify(input),
  });
  return response.data;
};

export const updatePoi = async (contentId: string, input: PoiFormInput): Promise<PoiContentItem> => {
  const response = await requestJson<ApiItemResponse<PoiContentItem>>(`/api/v1/mainserver/poi/${contentId}`, {
    method: 'PATCH',
    headers: REQUEST_HEADERS,
    body: JSON.stringify(input),
  });
  return response.data;
};

export const deletePoi = async (contentId: string): Promise<void> => {
  await requestJson<ApiItemResponse<{ id: string }>>(`/api/v1/mainserver/poi/${contentId}`, {
    method: 'DELETE',
    headers: REQUEST_HEADERS,
  });
};
