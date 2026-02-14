/**
 * Server-only exports für @sva/monitoring-client
 *
 * Dieses Modul enthält OpenTelemetry SDK-Initialisierung für Node.js.
 * Wird importiert via: import { ... } from '@sva/monitoring-client/server'
 *
 * WICHTIG: Nie in Client-Code importieren! Nutzt @opentelemetry/sdk-node.
 */

export type { OtelConfig } from './otel.server';
export { createOtelSdk, startOtelSdk } from './otel.server';
export {
  setGlobalLoggerProvider,
  getGlobalLoggerProvider,
  hasLoggerProvider
} from './logger-provider.server';
