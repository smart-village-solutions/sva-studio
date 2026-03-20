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
export type { LoggerOptions } from './logger/index.server.js';
export { createSdkLogger, redactObject } from './logger/index.server.js';

// ============================================================================
// Request Context Middleware
// ============================================================================
export type { RequestContextOptions } from './middleware/request-context.server.js';
export {
  getHeadersFromRequest,
  extractWorkspaceIdFromHeaders,
  extractRequestIdFromHeaders,
  extractTraceIdFromHeaders,
  withRequestContext
} from './middleware/request-context.server.js';

// ============================================================================
// HTTP Response Utilities
// ============================================================================
export type { JsonErrorResponseOptions } from './server/json-error-response.server.js';
export { toJsonErrorResponse } from './server/json-error-response.server.js';

// ============================================================================
// Observability Context (AsyncLocalStorage)
// ============================================================================
export type {
  WorkspaceContext,
  WorkspaceMiddlewareOptions,
  WorkspaceMiddleware
} from './observability/context.server.js';
export {
  runWithWorkspaceContext,
  getWorkspaceContext,
  setWorkspaceContext,
  MissingWorkspaceIdError,
  extractWorkspaceId,
  createWorkspaceContextMiddleware
} from './observability/context.server.js';

// ============================================================================
// Server Bootstrap (OTEL SDK Init & Graceful Shutdown)
// ============================================================================
export { initializeOtelSdk } from './server/bootstrap.server.js';

// ============================================================================
// Instance-Konfiguration (Multi-Host / Allowlist)
// ============================================================================
export type { InstanceConfig } from './instance/config.server.js';
export {
  getInstanceConfig,
  resetInstanceConfigCache,
  parseInstanceIdFromHost,
  isCanonicalAuthHost,
} from './instance/config.server.js';
