import {
  createSdkLogger,
  extractRequestIdFromHeaders,
  extractTraceIdFromHeaders,
  extractWorkspaceIdFromHeaders,
  getHeadersFromRequest,
} from '@sva/server-runtime';

import { createRoutingDiagnosticsLogger, registerServerFallbackLogger } from './diagnostics.js';

export type RoutingRequestDiagnosticsContext = {
  readonly request_id?: string;
  readonly trace_id?: string;
  readonly workspace_id?: string;
};

const routingServerLogger = createSdkLogger({ component: 'routing', level: 'info' });
registerServerFallbackLogger(routingServerLogger);

export const defaultServerRoutingDiagnostics = createRoutingDiagnosticsLogger(routingServerLogger);

export const readRoutingDiagnosticsContextFromRequest = (request: Request): RoutingRequestDiagnosticsContext => {
  const headers = getHeadersFromRequest(request);
  const url = new URL(request.url);
  const workspaceIdFromQuery = url.searchParams.get('instanceId');
  const workspaceId =
    extractWorkspaceIdFromHeaders(headers, ['x-workspace-id', 'x-sva-workspace-id', 'x-instance-id']) ??
    (typeof workspaceIdFromQuery === 'string' && workspaceIdFromQuery.trim().length > 0
      ? workspaceIdFromQuery.trim()
      : 'default');

  return {
    request_id: extractRequestIdFromHeaders(headers),
    trace_id: extractTraceIdFromHeaders(headers),
    workspace_id: workspaceId,
  };
};
