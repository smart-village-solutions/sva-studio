import { randomUUID } from 'node:crypto';
import { runWithWorkspaceContext } from '../observability/context';
import type { WorkspaceContext } from '../observability/context';

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

export interface RequestContextOptions {
  /** Request-Objekt (Web Request API oder TanStack Start) */
  request?: Request | { headers?: Headers | Record<string, string | string[] | undefined> };
  /** Optionale workspace_id (überschreibt Header) */
  workspaceId?: string;
  /** Optionale request_id (wird generiert wenn nicht angegeben) */
  requestId?: string;
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

  // Request-ID generieren oder übernehmen
  context.requestId = options.requestId ?? randomUUID();

  // Workspace-ID aus verschiedenen Quellen
  if (options.workspaceId) {
    context.workspaceId = options.workspaceId;
  } else if (options.request) {
    const headers = getHeadersFromRequest(options.request);
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
