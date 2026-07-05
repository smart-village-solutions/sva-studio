export const serverRuntimeVersion = '0.0.1';

export type ServerRuntimePackageRole =
  | 'request-context'
  | 'json-errors'
  | 'logging'
  | 'observability'
  | 'external-data-sources';

export const serverRuntimePackageRoles = [
  'request-context',
  'json-errors',
  'logging',
  'observability',
  'external-data-sources',
] as const satisfies readonly ServerRuntimePackageRole[];

export type ServerRuntimeLogger = {
  debug: (message: string, meta?: unknown) => void;
  info: (message: string, meta?: unknown) => void;
  isLevelEnabled: (level: string) => boolean;
  warn: (message: string, meta?: unknown) => void;
  error: (message: string, meta?: unknown) => void;
};

export type { LoggerOptions } from './logger/index.server.js';
export { redactObject } from './logger/index.server.js';
import { createSdkLogger as createSdkLoggerInternal } from './logger/index.server.js';
export type {
  LoggingRuntimeConfig,
  OtelInitializationResult,
} from './logger/logging-runtime.server.js';
export {
  getLoggingRuntimeConfig,
  getOtelInitializationResult,
} from './logger/logging-runtime.server.js';
export type { RequestContextOptions } from './middleware/request-context.server.js';
export {
  extractRequestIdFromHeaders,
  extractTraceIdFromHeaders,
  extractWorkspaceIdFromHeaders,
  getHeadersFromRequest,
  withRequestContext,
} from './middleware/request-context.server.js';
export type { InstanceConfig } from './instance/config.server.js';
export {
  getInstanceConfig,
  isCanonicalAuthHost,
  parseInstanceIdFromHost,
  resetInstanceConfigCache,
} from './instance/config.server.js';
export type {
  ExternalInterfaceRecord,
  ExternalInterfaceSettingsRecord,
  ResolvedExternalInterface,
} from '@sva/core';
export type { ResolvedWasteDataSource, WasteRuntimeErrorCode } from './waste/data-source.server.js';
export {
  buildExternalInterfaceSecretConfigAad,
  ExternalInterfaceRuntimeError,
  resolveExternalInterface,
  runExternalInterfaceConnectionCheck,
  sanitizeExternalInterfaceRecord,
} from './external-interfaces.server.js';
export {
  resolveWasteDataSource,
  runWasteConnectionCheck,
  WasteRuntimeError,
} from './waste/data-source.server.js';
export type { JsonErrorResponseOptions } from './server/json-error-response.server.js';
export { toJsonErrorResponse } from './server/json-error-response.server.js';
export type {
  AuthorizedMutation,
  IdempotentMutation,
  MutationErrorState,
  MutationExecutionResult,
  MutationWorkflowContext,
  MutationWorkflowDefinition,
  ParsedMutation,
  PreparedMutation,
} from './server/mutation-workflow.server.js';
export { createMutationWorkflow } from './server/mutation-workflow.server.js';
export type {
  WorkspaceContext,
  WorkspaceMiddleware,
  WorkspaceMiddlewareOptions,
} from './observability/context.server.js';
export {
  createWorkspaceContextMiddleware,
  extractWorkspaceId,
  getWorkspaceContext,
  MissingWorkspaceIdError,
  runWithWorkspaceContext,
  setWorkspaceContext,
} from './observability/context.server.js';
export { initializeOtelSdk } from './server/bootstrap.server.js';

export const createSdkLogger = (
  ...args: Parameters<typeof createSdkLoggerInternal>
): ServerRuntimeLogger => createSdkLoggerInternal(...args) as ServerRuntimeLogger;
