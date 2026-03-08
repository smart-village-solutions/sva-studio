import { randomUUID } from 'node:crypto';
import { runWithWorkspaceContext } from '../observability/context.server';
import type { WorkspaceContext } from '../observability/context.server';

const HEADER_ID_MAX_LENGTH = 128;
const SAFE_CONTEXT_ID_PATTERN = /^[A-Za-z0-9._:-]+$/;
const TRACE_ID_PATTERN = /^[0-9a-f]{32}$/i;

const readFirstHeaderValue = (value: string | string[] | undefined): string | undefined => {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (typeof candidate !== 'string') {
    return undefined;
  }
  const normalized = candidate.trim();
  return normalized.length > 0 ? normalized : undefined;
};

const sanitizeHeaderContextValue = (
  value: string | undefined,
  options?: { maxLength?: number; pattern?: RegExp }
): string | undefined => {
  if (!value) {
    return undefined;
  }
  const maxLength = options?.maxLength ?? HEADER_ID_MAX_LENGTH;
  if (value.length > maxLength) {
    return undefined;
  }
  const pattern = options?.pattern ?? SAFE_CONTEXT_ID_PATTERN;
  return pattern.test(value) ? value : undefined;
};

/**
 * Extrahiert Headers aus verschiedenen Request-Formaten
 */
export const getHeadersFromRequest = (
  request: Request | { headers?: Headers | Record<string, string | string[] | undefined> }
): Record<string, string | string[] | undefined> => {
  if (request instanceof Request) {
    const headers: Record<string, string | string[] | undefined> = {};
    request.headers.forEach((value, key) => {
      headers[key.toLowerCase()] = value;
    });
    return headers;
  }

  if (request.headers instanceof Headers) {
    const headers: Record<string, string | string[] | undefined> = {};
    request.headers.forEach((value, key) => {
      headers[key.toLowerCase()] = value;
    });
    return headers;
  }

  if (request.headers && typeof request.headers === 'object') {
    const normalized: Record<string, string | string[] | undefined> = {};
    Object.entries(request.headers).forEach(([key, value]) => {
      normalized[key.toLowerCase()] = value;
    });
    return normalized;
  }

  return {};
};

/**
 * Extrahiert workspace_id aus Request-Headers
 */
export const extractWorkspaceIdFromHeaders = (
  headers: Record<string, string | string[] | undefined>,
  headerNames: string[] = ['x-workspace-id', 'x-sva-workspace-id']
): string | undefined => {
  for (const headerName of headerNames) {
    const value = headers[headerName.toLowerCase()];
    if (Array.isArray(value)) {
      if (value.length > 0 && value[0]) {
        return value[0];
      }
      continue;
    }
    if (value) {
      return value;
    }
  }
  return undefined;
};

/**
 * Extrahiert request_id aus Request-Headers.
 */
export const extractRequestIdFromHeaders = (
  headers: Record<string, string | string[] | undefined>,
  headerNames: string[] = ['x-request-id', 'x-correlation-id']
): string | undefined => {
  for (const headerName of headerNames) {
    const rawValue = headers[headerName.toLowerCase()];
    const value = sanitizeHeaderContextValue(readFirstHeaderValue(rawValue));
    if (value) {
      return value;
    }
  }
  return undefined;
};

/**
 * Extrahiert trace_id aus W3C traceparent oder Fallback-Headern.
 */
export const extractTraceIdFromHeaders = (
  headers: Record<string, string | string[] | undefined>,
  fallbackHeaderNames: string[] = ['x-trace-id']
): string | undefined => {
  const traceparentRaw =
    headers['traceparent'] ??
    headers['Traceparent'] ??
    headers['TRACEPARENT'] ??
    Object.entries(headers).find(([key]) => key.toLowerCase() === 'traceparent')?.[1];
  const traceparent = readFirstHeaderValue(traceparentRaw);
  if (traceparent) {
    const match = /^00-([0-9a-f]{32})-[0-9a-f]{16}-[0-9a-f]{2}$/i.exec(traceparent);
    if (match?.[1]) {
      return match[1];
    }
  }

  for (const headerName of fallbackHeaderNames) {
    const rawValue = headers[headerName.toLowerCase()];
    const value = sanitizeHeaderContextValue(readFirstHeaderValue(rawValue), {
      pattern: TRACE_ID_PATTERN,
      maxLength: 32,
    });
    if (value) {
      return value;
    }
  }
  return undefined;
};

export interface RequestContextOptions {
  /** Request-Objekt (Web Request API oder TanStack Start) */
  request?: Request | { headers?: Headers | Record<string, string | string[] | undefined> };
  /** Optionale workspace_id (überschreibt Header) */
  workspaceId?: string;
  /** Optionale request_id (wird generiert wenn nicht angegeben) */
  requestId?: string;
  /** Optionale trace_id (überschreibt Header) */
  traceId?: string;
  /** Header-Namen für workspace_id Extraktion */
  workspaceIdHeaders?: string[];
  /** Fallback workspace_id für Single-Tenant oder Development */
  fallbackWorkspaceId?: string;
}

/**
 * Führt eine Funktion mit Request-Context aus (workspace_id, request_id)
 * 
 * @example
 * ```typescript
 * // In TanStack Start Server Function:
 * const getUser = createServerFn().handler(async () => {
 *   return withRequestContext({ request: getWebRequest() }, async () => {
 *     // Logger hat automatisch workspace_id + request_id
 *     logger.info('Fetching user', { operation: 'get_user' });
 *     return { name: 'John' };
 *   });
 * });
 * ```
 */
export const withRequestContext = async <T>(
  options: RequestContextOptions,
  fn: () => T | Promise<T>
): Promise<T> => {
  const context: WorkspaceContext = {};
  const headers = options.request ? getHeadersFromRequest(options.request) : {};
  const requestIdFromHeader = extractRequestIdFromHeaders(headers);
  const traceIdFromHeader = extractTraceIdFromHeaders(headers);

  // Request-ID übernehmen oder generieren.
  context.requestId = options.requestId ?? requestIdFromHeader ?? randomUUID();
  context.traceId = options.traceId ?? traceIdFromHeader;

  // Workspace-ID aus verschiedenen Quellen
  if (options.workspaceId) {
    context.workspaceId = options.workspaceId;
  } else if (options.request) {
    const workspaceId = extractWorkspaceIdFromHeaders(
      headers,
      options.workspaceIdHeaders ?? ['x-workspace-id', 'x-sva-workspace-id']
    );
    context.workspaceId = workspaceId ?? options.fallbackWorkspaceId;
  } else {
    context.workspaceId = options.fallbackWorkspaceId;
  }

  // In AsyncLocalStorage ausführen
  return runWithWorkspaceContext(context, fn);
};
