import type { ApiItemResponse, StudioJobDetail, StudioJobResponse } from '@sva/plugin-sdk';
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

export const requestWasteManagementResponse = async <T>(input: {
  readonly url: string;
  readonly init?: RequestInit;
}): Promise<T> =>
  await requestMainserverJson<T, WasteManagementApiError>({
    url: input.url,
    init: input.init,
    errorFactory: createWasteManagementApiError,
  });

export const requestWasteManagementItem = async <T>(input: {
  readonly url: string;
  readonly init?: RequestInit;
}): Promise<T> => {
  const response = await requestWasteManagementResponse<ApiItemResponse<T>>(input);

  return response.data;
};

export const requestWasteManagementJobDetail = async (
  jobId: string,
  init?: RequestInit
): Promise<StudioJobDetail> =>
  requestWasteManagementItem<StudioJobDetail>({
    url: `/api/v1/plugin-operations/jobs/${encodeURIComponent(jobId)}`,
    init,
  });

export const requestWasteManagementMutation = <T>(
  url: string,
  body?: Readonly<Record<string, unknown>>,
  method = 'POST'
) =>
  requestWasteManagementItem<T>({
    url,
    init: {
      method,
      headers: createMainserverJsonRequestHeaders(),
      body: body === undefined ? undefined : JSON.stringify(body),
    },
  });

export const requestWasteManagementMutationResponse = <T>(
  url: string,
  body?: Readonly<Record<string, unknown>>,
  method = 'POST'
) =>
  requestWasteManagementResponse<T>({
    url,
    init: {
      method,
      headers: createMainserverJsonRequestHeaders(),
      body: body === undefined ? undefined : JSON.stringify(body),
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
