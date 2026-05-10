import type { ApiItemResponse, StudioJobResponse } from '@sva/core';
import { createMainserverJsonRequestHeaders, requestMainserverJson } from '@sva/plugin-sdk';

export class WasteManagementApiError extends Error {
  public constructor(
    public readonly code: string,
    message = code
  ) {
    super(message);
    this.name = 'WasteManagementApiError';
  }
}

const createWasteManagementApiError = (code: string, message: string) => new WasteManagementApiError(code, message);

const createIdempotencyKey = () => crypto.randomUUID();

export const requestWasteManagementItem = async <T>(input: {
  readonly url: string;
  readonly init?: RequestInit;
}): Promise<T> => {
  const response = await requestMainserverJson<ApiItemResponse<T>, WasteManagementApiError>({
    url: input.url,
    init: input.init,
    errorFactory: createWasteManagementApiError,
  });

  return response.data;
};

export const requestWasteManagementMutation = <T>(url: string, body: Readonly<Record<string, unknown>>, method = 'POST') =>
  requestWasteManagementItem<T>({
    url,
    init: {
      method,
      headers: createMainserverJsonRequestHeaders(),
      body: JSON.stringify(body),
    },
  });

export const requestWasteManagementJob = async (
  url: string,
  body: Readonly<Record<string, unknown>>
): Promise<StudioJobResponse['data']> =>
  requestWasteManagementItem<StudioJobResponse['data']>({
    url,
    init: {
      method: 'POST',
      headers: createMainserverJsonRequestHeaders({
        'Idempotency-Key': createIdempotencyKey(),
      }),
      body: JSON.stringify(body),
    },
  });
