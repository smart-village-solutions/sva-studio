import { coreVersion } from '@sva/core';

export const sdkVersion = coreVersion;
export type {
  BuildTimeRegistry,
  BuildTimeRegistryInput,
  RouteFactory,
} from '@sva/plugin-sdk';
export type {
  AdminResourceDefinition,
  AdminResourceGuard,
  AdminResourceViewDefinition,
  AdminResourceViews,
} from '@sva/plugin-sdk';
export type {
  PluginActionDefinition,
  PluginActionRegistryEntry,
  PluginAdminResourceDefinition,
  PluginAuditEventDefinition,
  PluginAuditEventRegistryEntry,
  PluginDefinition,
  PluginNavigationItem,
  PluginNavigationSection,
  PluginRouteDefinition,
  PluginRouteGuard,
  PluginTranslations,
} from '@sva/plugin-sdk';
export type {
  ContentTypeActionDefinition,
  ContentTypeDefinition,
  ContentTypeEditorFieldDefinition,
  ContentTypeEditorFieldKind,
  ContentTypeListColumnDefinition,
} from '@sva/plugin-sdk';
export {
  createContentTypeRegistry,
  definePluginContentTypes,
  genericContentTypeDefinition,
  getContentTypeDefinition,
} from '@sva/plugin-sdk';
export {
  createBuildTimeRegistry,
} from '@sva/plugin-sdk';
export {
  createAdminResourceRegistry,
  definePluginAdminResources,
  mergeAdminResourceDefinitions,
} from '@sva/plugin-sdk';
export {
  createPluginActionRegistry,
  createPluginAuditEventRegistry,
  createPluginRegistry,
  definePluginActions,
  definePluginAuditEvents,
  mergePluginAdminResourceDefinitions,
  mergePluginAuditEventDefinitions,
  mergePluginActions,
  mergePluginContentTypes,
  mergePluginNavigationItems,
  mergePluginRouteDefinitions,
  mergePluginTranslations,
} from '@sva/plugin-sdk';
export type {
  PluginTranslationResolver,
  PluginTranslationVariables,
} from '@sva/plugin-sdk';
export {
  registerPluginTranslationResolver,
  translatePluginKey,
  usePluginTranslation,
} from '@sva/plugin-sdk';
export type {
  RuntimeProfile,
  RuntimeProfileAuthMode,
  RuntimeProfileDefinition,
  RuntimeProfileEnvValidationResult,
} from './runtime-profile.js';
export {
  RUNTIME_PROFILES,
  getRuntimeProfileDerivedEnvKeys,
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
