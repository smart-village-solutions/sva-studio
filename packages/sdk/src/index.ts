import { coreVersion } from '@sva/core';

export const sdkVersion = coreVersion;
export type { RouteFactory } from '@sva/core';
export type {
  ContentTypeActionDefinition,
  ContentTypeDefinition,
  ContentTypeEditorFieldDefinition,
  ContentTypeEditorFieldKind,
  ContentTypeListColumnDefinition,
} from './content-types.js';
export {
  createContentTypeRegistry,
  genericContentTypeDefinition,
  getContentTypeDefinition,
} from './content-types.js';
export type {
  RuntimeProfile,
  RuntimeProfileAuthMode,
  RuntimeProfileDefinition,
  RuntimeProfileEnvValidationResult,
} from './runtime-profile.js';
export {
  RUNTIME_PROFILES,
  getRuntimeProfileDefinition,
  getRuntimeProfileFromEnv,
  getRuntimeProfileRequiredEnvKeys,
  isMockAuthRuntimeProfile,
  parseRuntimeProfile,
  validateRuntimeProfileEnv,
} from './runtime-profile.js';
export type {
  BrowserLogEntry,
  BrowserLogLevel,
  BrowserLogMeta,
  BrowserLogger,
  BrowserLoggerOptions,
} from './logging.js';
export {
  createBrowserLogger,
  isBrowserConsoleCaptureSuppressed,
  redactLogMeta,
  redactLogString,
  registerBrowserLogSink,
  serializeAndRedactLogValue,
} from './logging.js';
