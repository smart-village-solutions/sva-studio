import {
  createSdkLogger,
  extractRequestIdFromHeaders,
  extractTraceIdFromHeaders,
  extractWorkspaceIdFromHeaders,
  getHeadersFromRequest,
  getWorkspaceContext,
} from '@sva/server-runtime';

import { createRoutingDiagnosticsLogger, registerServerFallbackLogger } from './diagnostics.js';

export type RoutingRequestDiagnosticsContext = {
  readonly request_id?: string;
  readonly trace_id?: string;
  readonly workspace_id?: string;
};

const routingServerLogger = createSdkLogger({ component: 'routing', level: 'debug' });
registerServerFallbackLogger(routingServerLogger);

export const defaultServerRoutingDiagnostics = createRoutingDiagnosticsLogger(routingServerLogger);

export const readRoutingDiagnosticsContextFromRequest = (request: Request): RoutingRequestDiagnosticsContext => {
  const headers = getHeadersFromRequest(request);
  const context = getWorkspaceContext();
  const url = new URL(request.url);
  const workspaceIdFromQuery = url.searchParams.get('instanceId');
  const workspaceId =
    extractWorkspaceIdFromHeaders(headers, ['x-workspace-id', 'x-sva-workspace-id', 'x-instance-id']) ??
    (typeof workspaceIdFromQuery === 'string' && workspaceIdFromQuery.trim().length > 0
      ? workspaceIdFromQuery.trim()
      : context.workspaceId ?? 'default');

  return {
    request_id: extractRequestIdFromHeaders(headers) ?? context.requestId,
    trace_id: extractTraceIdFromHeaders(headers) ?? context.traceId,
    workspace_id: workspaceId,
  };
};
