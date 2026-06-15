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

type WasteManagementDebugEntry = Readonly<{
  readonly timestamp: string;
  readonly scope: 'api' | 'tour-delete';
  readonly phase: 'start' | 'success' | 'error';
  readonly url?: string;
  readonly method?: string;
  readonly hasBody?: boolean;
  readonly tourId?: string;
  readonly tourName?: string;
  readonly errorCode?: string;
  readonly errorMessage?: string;
}>;

type WasteManagementDebugGlobal = typeof globalThis & {
  __wasteManagementDebug?: WasteManagementDebugEntry[];
};

const isBrowserDebugRuntime = () => typeof window !== 'undefined';

const appendWasteManagementDebugEntry = (entry: WasteManagementDebugEntry): void => {
  if (!isBrowserDebugRuntime()) {
    return;
  }

  const debugGlobal = globalThis as WasteManagementDebugGlobal;
  const currentEntries = debugGlobal.__wasteManagementDebug ?? [];
  debugGlobal.__wasteManagementDebug = [...currentEntries, entry].slice(-50);
};

export const appendWasteManagementDebugLog = (
  entry: Omit<WasteManagementDebugEntry, 'timestamp'>
): void => {
  appendWasteManagementDebugEntry({
    timestamp: new Date().toISOString(),
    ...entry,
  });
};

const logWasteManagementRequest = (
  phase: 'start' | 'success' | 'error',
  input: {
    readonly url: string;
    readonly init?: RequestInit;
    readonly error?: unknown;
  }
) => {
  appendWasteManagementDebugLog({
    scope: 'api',
    phase,
    url: input.url,
    method: input.init?.method ?? 'GET',
    hasBody: input.init?.body !== undefined,
    errorCode:
      input.error instanceof WasteManagementApiError
        ? input.error.code
        : undefined,
    errorMessage:
      input.error instanceof Error
        ? input.error.message
        : input.error !== undefined
          ? String(input.error)
          : undefined,
  });
};

export const requestWasteManagementResponse = async <T>(input: {
  readonly url: string;
  readonly init?: RequestInit;
}): Promise<T> => {
  logWasteManagementRequest('start', input);

  try {
    const response = await requestMainserverJson<T, WasteManagementApiError>({
      url: input.url,
      init: input.init,
      errorFactory: createWasteManagementApiError,
    });
    logWasteManagementRequest('success', input);
    return response;
  } catch (error) {
    logWasteManagementRequest('error', {
      ...input,
      error,
    });
    throw error;
  }
};

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
