import {
  deriveIamRuntimeDiagnostics,
  type IamRuntimeDiagnosticClassification,
  type IamRuntimeDiagnosticStatus,
  type IamRuntimeRecommendedAction,
  type IamRuntimeSafeDetails,
} from '@sva/core';
import { createBrowserLogger } from '@sva/monitoring-client/logging';
import { isDevelopmentBrowserEnv } from './browser-env';
import {
  readErrorCodeFromPayload,
  readErrorMessageFromPayload,
  readRequestIdFromResponse,
  readRuntimeDiagnostics,
  readSafeDiagnosticDetails,
  type IamErrorPayload,
} from './iam-api-runtime-diagnostics';

export const IAM_HEADERS = {
  'Content-Type': 'application/json',
  'X-Requested-With': 'XMLHttpRequest',
} as const;

export const LEGAL_ACCEPTANCE_REQUIRED_EVENT = 'sva:legal-acceptance-required';
export const DEFAULT_IAM_REQUEST_TIMEOUT_MS = 10_000;
export const HEALTH_REQUEST_TIMEOUT_MS = 5_000;
export const HEAVY_IAM_REQUEST_TIMEOUT_MS = 20_000;

const browserLogger = createBrowserLogger({
  component: 'iam-api',
});

export class IamHttpError extends Error {
  readonly status: number;
  readonly code: string;
  readonly requestId?: string;
  readonly classification?: IamRuntimeDiagnosticClassification;
  readonly diagnosticStatus?: IamRuntimeDiagnosticStatus;
  readonly recommendedAction?: IamRuntimeRecommendedAction;
  readonly safeDetails?: IamRuntimeSafeDetails;

  constructor(input: {
    status: number;
    code: string;
    message: string;
    requestId?: string;
    classification?: IamRuntimeDiagnosticClassification;
    diagnosticStatus?: IamRuntimeDiagnosticStatus;
    recommendedAction?: IamRuntimeRecommendedAction;
    safeDetails?: IamRuntimeSafeDetails;
  }) {
    super(input.message);
    this.name = 'IamHttpError';
    this.status = input.status;
    this.code = input.code;
    this.requestId = input.requestId;
    this.classification = input.classification;
    this.diagnosticStatus = input.diagnosticStatus;
    this.recommendedAction = input.recommendedAction;
    this.safeDetails = input.safeDetails;
  }
}

const logDevelopmentApiError = (input: {
  requestId?: string;
  status: number;
  code: string;
  details?: IamRuntimeSafeDetails;
}) => {
  if (!isDevelopmentBrowserEnv()) {
    return;
  }

  browserLogger.error('IAM API request failed', {
    request_id: input.requestId,
    status: input.status,
    code: input.code,
    ...(input.details ? { details: input.details } : {}),
  });
};

export const asIamError = (error: unknown): IamHttpError =>
  error instanceof IamHttpError
    ? error
    : (() => {
        const diagnostics = deriveIamRuntimeDiagnostics({
          code: 'internal_error',
          status: 500,
        });
        return new IamHttpError({
          status: 500,
          code: 'internal_error',
          message: error instanceof Error ? error.message : String(error),
          classification: diagnostics.classification,
          diagnosticStatus: diagnostics.status,
          recommendedAction: diagnostics.recommendedAction,
          safeDetails: diagnostics.safeDetails,
        });
      })();

export type IamRequestOptions = Readonly<{
  signal?: AbortSignal;
  timeoutMs?: number;
}>;

const isAbortLikeError = (error: unknown): boolean =>
  error instanceof DOMException
    ? error.name === 'AbortError' || error.name === 'TimeoutError'
    : error instanceof Error && error.name === 'AbortError';

const mergeAbortSignals = (input: {
  readonly signal?: AbortSignal;
  readonly timeoutMs: number;
}): {
  readonly signal: AbortSignal;
  readonly cleanup: () => void;
  readonly didTimeout: () => boolean;
} => {
  const controller = new AbortController();
  let timeoutTriggered = false;
  let timeoutId: ReturnType<typeof globalThis.setTimeout> | null = null;
  let removeAbortListener: (() => void) | undefined;

  const abortFromExternal = () => {
    controller.abort(
      input.signal?.reason ?? new DOMException('IAM-Anfrage wurde abgebrochen.', 'AbortError')
    );
  };

  if (input.signal) {
    if (input.signal.aborted) {
      abortFromExternal();
    } else {
      input.signal.addEventListener('abort', abortFromExternal, { once: true });
      removeAbortListener = () => {
        input.signal?.removeEventListener('abort', abortFromExternal);
      };
    }
  }

  timeoutId = globalThis.setTimeout(() => {
    timeoutTriggered = true;
    controller.abort(new DOMException('IAM-Anfrage hat das Timeout erreicht.', 'TimeoutError'));
  }, input.timeoutMs);

  return {
    signal: controller.signal,
    cleanup: () => {
      if (timeoutId !== null) {
        globalThis.clearTimeout(timeoutId);
      }
      removeAbortListener?.();
    },
    didTimeout: () => timeoutTriggered,
  };
};

const createIdempotencyKey = () => crypto.randomUUID();

export const readIamErrorResponse = async (response: Response): Promise<IamHttpError> => {
  const payload = (await response.json().catch(() => null)) as IamErrorPayload | null;
  const code = readErrorCodeFromPayload(payload) ?? 'internal_error';
  const requestId = readRequestIdFromResponse(response, payload ?? undefined);
  const safeDetails = readSafeDiagnosticDetails(payload);
  const diagnostics = readRuntimeDiagnostics(payload, response.status, code, safeDetails);

  logDevelopmentApiError({
    requestId,
    status: response.status,
    code,
    details: diagnostics.safeDetails,
  });

  if (code === 'legal_acceptance_required' && globalThis.window !== undefined) {
    globalThis.dispatchEvent(
      new CustomEvent(LEGAL_ACCEPTANCE_REQUIRED_EVENT, { detail: diagnostics.safeDetails })
    );
  }

  return new IamHttpError({
    status: response.status,
    code,
    message: readErrorMessageFromPayload(payload, response.status),
    requestId,
    classification: diagnostics.classification,
    diagnosticStatus: diagnostics.diagnosticStatus,
    recommendedAction: diagnostics.recommendedAction,
    safeDetails: diagnostics.safeDetails,
  });
};

export const fetchWithRequestTimeout = async (
  input: string,
  init?: RequestInit,
  options: IamRequestOptions = {}
): Promise<Response> => {
  const { headers: initHeaders, signal: initSignal, ...restInit } = init ?? {};
  const mergedSignal = mergeAbortSignals({
    signal: options.signal ?? initSignal ?? undefined,
    timeoutMs: options.timeoutMs ?? DEFAULT_IAM_REQUEST_TIMEOUT_MS,
  });

  try {
    return await fetch(input, {
      credentials: 'include',
      ...restInit,
      signal: mergedSignal.signal,
      headers: initHeaders,
    });
  } catch (error) {
    if (mergedSignal.signal.aborted || isAbortLikeError(error)) {
      const didTimeout = mergedSignal.didTimeout();
      throw new IamHttpError({
        status: 0,
        code: didTimeout ? 'timeout' : 'aborted',
        message: didTimeout ? 'request_timeout' : 'request_aborted',
        classification: 'unknown',
        diagnosticStatus: 'degradiert',
        recommendedAction: 'erneut_versuchen',
      });
    }
    throw error;
  } finally {
    mergedSignal.cleanup();
  }
};

const createNonJsonResponseError = (input: {
  response: Response;
  contentType: string;
  requestId?: string;
  mode: 'expected_json' | 'error_json';
}): IamHttpError => {
  const { response, contentType, requestId, mode } = input;
  return new IamHttpError({
    status: response.status,
    code: 'non_json_response',
    message:
      mode === 'error_json'
        ? `Server antwortete mit ${response.status} (${contentType || 'unbekannter Content-Type'}) statt JSON.`
        : `Erwartete JSON-Antwort, erhielt ${contentType || 'unbekannten Content-Type'}.`,
    requestId,
    classification: 'unknown',
    diagnosticStatus: 'degradiert',
    recommendedAction: 'erneut_versuchen',
  });
};

const readNonJsonRequestError = (response: Response, contentType: string): IamHttpError => {
  const requestId = response.headers.get('X-Request-Id') ?? undefined;
  logDevelopmentApiError({
    requestId,
    status: response.status,
    code: 'non_json_response',
  });
  return createNonJsonResponseError({
    response,
    contentType,
    requestId,
    mode: 'error_json',
  });
};

const throwJsonRequestError = async (response: Response, contentType: string): Promise<never> => {
  if (!contentType.includes('application/json')) {
    throw readNonJsonRequestError(response, contentType);
  }

  throw await readIamErrorResponse(response);
};

export const requestJson = async <T>(
  input: string,
  init?: RequestInit,
  options: IamRequestOptions = {}
): Promise<T> => {
  const { headers: initHeaders, ...restInit } = init ?? {};
  const response = await fetchWithRequestTimeout(
    input,
    {
      ...restInit,
      headers: { Accept: 'application/json', ...initHeaders },
    },
    options
  );

  const contentType = response.headers.get('content-type') ?? '';
  if (!response.ok) {
    await throwJsonRequestError(response, contentType);
  }

  if (!contentType.includes('application/json')) {
    throw createNonJsonResponseError({
      response,
      contentType,
      mode: 'expected_json',
    });
  }

  return (await response.json()) as T;
};

export const requestJsonOrText = async <T>(
  input: string,
  init?: RequestInit,
  options: IamRequestOptions = {}
): Promise<T | { data: string }> => {
  const { headers: initHeaders, ...restInit } = init ?? {};
  const response = await fetchWithRequestTimeout(
    input,
    {
      ...restInit,
      headers: {
        Accept: 'application/json, text/plain, text/csv, application/xml',
        ...initHeaders,
      },
    },
    options
  );

  const contentType = response.headers.get('content-type') ?? '';
  if (!response.ok) {
    await throwJsonRequestError(response, contentType);
  }

  if (contentType.includes('application/json')) {
    return (await response.json()) as T;
  }

  return { data: await response.text() };
};

export const createMutationHeaders = (input?: { idempotent?: boolean }): HeadersInit => ({
  ...IAM_HEADERS,
  ...(input?.idempotent ? { 'Idempotency-Key': createIdempotencyKey() } : {}),
});

export const createJsonMutationRequestInit = <TPayload>(
  method: 'PATCH' | 'POST' | 'PUT',
  payload: TPayload,
  options?: { idempotent?: boolean }
): RequestInit => ({
  method,
  headers: createMutationHeaders(options),
  body: JSON.stringify(payload),
});

export const patchJson = async <TResponse, TPayload>(path: string, payload: TPayload) =>
  requestJson<TResponse>(path, createJsonMutationRequestInit('PATCH', payload));

export const putJson = async <TResponse, TPayload>(path: string, payload: TPayload) =>
  requestJson<TResponse>(path, createJsonMutationRequestInit('PUT', payload));

export const postJson = async <TResponse, TPayload>(
  path: string,
  payload: TPayload,
  idempotent = false
) =>
  requestJson<TResponse>(
    path,
    createJsonMutationRequestInit('POST', payload, { idempotent })
  );
