import {
  createSdkLogger as sdkCreateSdkLogger,
  createWorkspaceContextMiddleware as sdkCreateWorkspaceContextMiddleware,
  extractRequestIdFromHeaders as sdkExtractRequestIdFromHeaders,
  extractTraceIdFromHeaders as sdkExtractTraceIdFromHeaders,
  extractWorkspaceId as sdkExtractWorkspaceId,
  extractWorkspaceIdFromHeaders as sdkExtractWorkspaceIdFromHeaders,
  getHeadersFromRequest as sdkGetHeadersFromRequest,
  getInstanceConfig as sdkGetInstanceConfig,
  getLoggingRuntimeConfig as sdkGetLoggingRuntimeConfig,
  getOtelInitializationResult as sdkGetOtelInitializationResult,
  getWorkspaceContext as sdkGetWorkspaceContext,
  initializeOtelSdk as sdkInitializeOtelSdk,
  isCanonicalAuthHost as sdkIsCanonicalAuthHost,
  MissingWorkspaceIdError as SdkMissingWorkspaceIdError,
  parseInstanceIdFromHost as sdkParseInstanceIdFromHost,
  readDevelopmentLogEntries as sdkReadDevelopmentLogEntries,
  redactObject as sdkRedactObject,
  resetInstanceConfigCache as sdkResetInstanceConfigCache,
  runWithWorkspaceContext as sdkRunWithWorkspaceContext,
  setWorkspaceContext as sdkSetWorkspaceContext,
  toJsonErrorResponse as sdkToJsonErrorResponse,
  withRequestContext as sdkWithRequestContext,
} from '@sva/sdk/server';

export const serverRuntimeVersion = '0.0.1';

export type ServerRuntimePackageRole = 'request-context' | 'json-errors' | 'logging' | 'observability';

export const serverRuntimePackageRoles = [
  'request-context',
  'json-errors',
  'logging',
  'observability',
] as const satisfies readonly ServerRuntimePackageRole[];

export type ServerRuntimeLogger = {
  debug: (message: string, meta?: unknown) => void;
  info: (message: string, meta?: unknown) => void;
  warn: (message: string, meta?: unknown) => void;
  error: (message: string, meta?: unknown) => void;
};

export type {
  DevelopmentLogEntry,
  InstanceConfig,
  JsonErrorResponseOptions,
  LoggerOptions,
  LoggingRuntimeConfig,
  OtelInitializationResult,
  RequestContextOptions,
  WorkspaceContext,
  WorkspaceMiddleware,
  WorkspaceMiddlewareOptions,
} from '@sva/sdk/server';

export const createSdkLogger = (...args: Parameters<typeof sdkCreateSdkLogger>): ServerRuntimeLogger =>
  sdkCreateSdkLogger(...args) as ServerRuntimeLogger;
export const createWorkspaceContextMiddleware = sdkCreateWorkspaceContextMiddleware;
export const extractRequestIdFromHeaders = sdkExtractRequestIdFromHeaders;
export const extractTraceIdFromHeaders = sdkExtractTraceIdFromHeaders;
export const extractWorkspaceId = sdkExtractWorkspaceId;
export const extractWorkspaceIdFromHeaders = sdkExtractWorkspaceIdFromHeaders;
export const getHeadersFromRequest = sdkGetHeadersFromRequest;
export const getInstanceConfig = sdkGetInstanceConfig;
export const getLoggingRuntimeConfig = sdkGetLoggingRuntimeConfig;
export const getOtelInitializationResult = sdkGetOtelInitializationResult;
export const getWorkspaceContext = sdkGetWorkspaceContext;
export const initializeOtelSdk = sdkInitializeOtelSdk;
export const isCanonicalAuthHost = sdkIsCanonicalAuthHost;
export const MissingWorkspaceIdError = SdkMissingWorkspaceIdError;
export const parseInstanceIdFromHost = sdkParseInstanceIdFromHost;
export const readDevelopmentLogEntries = sdkReadDevelopmentLogEntries;
export const redactObject = sdkRedactObject;
export const resetInstanceConfigCache = sdkResetInstanceConfigCache;
export const runWithWorkspaceContext = sdkRunWithWorkspaceContext;
export const setWorkspaceContext = sdkSetWorkspaceContext;
export const toJsonErrorResponse = sdkToJsonErrorResponse;
export const withRequestContext = sdkWithRequestContext;
