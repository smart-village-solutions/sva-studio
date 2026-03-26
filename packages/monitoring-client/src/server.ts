/**
 * Server-only exports für @sva/monitoring-client
 *
 * Dieses Modul enthält OpenTelemetry SDK-Initialisierung für Node.js.
 * Wird importiert via: import { ... } from '@sva/monitoring-client/server'
 *
 * WICHTIG: Nie in Client-Code importieren! Nutzt @opentelemetry/sdk-node.
 */

export type { OtelConfig } from './otel.server.js';
export type { WorkspaceContext } from './otel.server.js';
export { createOtelSdk, setWorkspaceContextGetter, startOtelSdk } from './otel.server.js';
export {
  setGlobalLoggerProvider,
  getGlobalLoggerProvider,
  hasLoggerProvider
} from './logger-provider.server.js';
