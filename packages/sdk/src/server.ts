/**
 * Server-only exports für @sva/sdk
 *
 * Dieses Modul enthält alle server-seitigen SDK-Funktionen.
 * Wird importiert via: import { ... } from '@sva/sdk/server'
 *
 * WICHTIG: Nie in Client-Code importieren! Enthält Node.js APIs.
 */

// ============================================================================
// Logger
// ============================================================================
export type { LoggerOptions } from './logger/index.server';
export { createSdkLogger, redactObject } from './logger/index.server';

// ============================================================================
// Request Context Middleware
// ============================================================================
export type { RequestContextOptions } from './middleware/request-context.server';
export {
  getHeadersFromRequest,
  extractWorkspaceIdFromHeaders,
  extractRequestIdFromHeaders,
  extractTraceIdFromHeaders,
  withRequestContext
} from './middleware/request-context.server';

// ============================================================================
// HTTP Response Utilities
// ============================================================================
export type { JsonErrorResponseOptions } from './server/json-error-response.server';
export { toJsonErrorResponse } from './server/json-error-response.server';

// ============================================================================
// Observability Context (AsyncLocalStorage)
// ============================================================================
export type {
  WorkspaceContext,
  WorkspaceMiddlewareOptions,
  WorkspaceMiddleware
} from './observability/context.server';
export {
  runWithWorkspaceContext,
  getWorkspaceContext,
  setWorkspaceContext,
  MissingWorkspaceIdError,
  extractWorkspaceId,
  createWorkspaceContextMiddleware
} from './observability/context.server';

// ============================================================================
// Server Bootstrap (OTEL SDK Init & Graceful Shutdown)
// ============================================================================
export { initializeOtelSdk } from './server/bootstrap.server';
