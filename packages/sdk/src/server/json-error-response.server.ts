export type JsonErrorResponseOptions = {
  readonly headers?: HeadersInit;
  readonly requestId?: string;
  readonly requestIdHeaderName?: string;
};

type JsonErrorResponseBody = {
  readonly error: string;
  readonly message?: string;
  readonly requestId?: string;
};

const JSON_CONTENT_TYPE = 'application/json; charset=utf-8';
const DEFAULT_REQUEST_ID_HEADER = 'X-Request-Id';

export const toJsonErrorResponse = (
  status: number,
  code: string,
  publicMessage?: string,
  options?: JsonErrorResponseOptions
): Response => {
  const headers = new Headers(options?.headers);
  headers.set('Content-Type', JSON_CONTENT_TYPE);

  const requestIdHeaderName = options?.requestIdHeaderName ?? DEFAULT_REQUEST_ID_HEADER;
  const requestId = options?.requestId ?? headers.get(requestIdHeaderName) ?? undefined;
  if (requestId) {
    headers.set(requestIdHeaderName, requestId);
  }

  const body: JsonErrorResponseBody = {
    error: code,
    ...(publicMessage ? { message: publicMessage } : {}),
    ...(requestId ? { requestId } : {}),
  };

  return new Response(JSON.stringify(body), {
    status,
    headers,
  });
};
