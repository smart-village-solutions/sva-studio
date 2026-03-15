const DEFAULT_SERVER_FN_BASE = '/_server/';

export const SERVER_FN_HTML_ROUTER_FALLBACK_MESSAGE = 'Only HTML requests are supported here';

export type ServerFunctionBranchDecision = 'server_fn_matched' | 'fell_through_to_html_router' | 'not_server_fn_request';

export type ServerFunctionRequestDiagnostics = {
  readonly method: string;
  readonly path: string;
  readonly serverFnBase: string;
  readonly requestId: string;
  readonly accept: string | null;
  readonly contentType: string | null;
  readonly isServerFnRequest: boolean;
};

export const normalizeServerFnBase = (value: string | undefined): string => {
  const trimmedValue = value?.trim();
  if (!trimmedValue) {
    return DEFAULT_SERVER_FN_BASE;
  }

  const withLeadingSlash = trimmedValue.startsWith('/') ? trimmedValue : `/${trimmedValue}`;
  return withLeadingSlash.endsWith('/') ? withLeadingSlash : `${withLeadingSlash}/`;
};

export const createServerFunctionRequestDiagnostics = (input: {
  readonly request: Request;
  readonly requestId: string;
  readonly serverFnBase: string;
}): ServerFunctionRequestDiagnostics => {
  const url = new URL(input.request.url);
  const serverFnBase = normalizeServerFnBase(input.serverFnBase);

  return {
    method: input.request.method.toUpperCase(),
    path: url.pathname,
    serverFnBase,
    requestId: input.requestId,
    accept: input.request.headers.get('accept'),
    contentType: input.request.headers.get('content-type'),
    isServerFnRequest: url.pathname.startsWith(serverFnBase),
  };
};

export const resolveServerFunctionBranchDecision = (input: {
  readonly diagnostics: ServerFunctionRequestDiagnostics;
  readonly responseStatus: number;
  readonly responseBody: string | null;
}): ServerFunctionBranchDecision => {
  if (!input.diagnostics.isServerFnRequest) {
    return 'not_server_fn_request';
  }

  if (input.responseStatus >= 500 && input.responseBody?.includes(SERVER_FN_HTML_ROUTER_FALLBACK_MESSAGE)) {
    return 'fell_through_to_html_router';
  }

  return 'server_fn_matched';
};

export const readServerFunctionResponseBodyForDiagnostics = async (response: Response): Promise<string | null> => {
  const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
  const shouldReadBody = contentType.includes('application/json') || contentType.includes('text/plain');

  if (!shouldReadBody) {
    return null;
  }

  try {
    return await response.clone().text();
  } catch {
    return null;
  }
};
