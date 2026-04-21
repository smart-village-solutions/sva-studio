import { coreVersion } from '@sva/core';

export const sdkVersion = coreVersion;
export type { RouteFactory } from '@sva/core';
export type {
  BuildTimeRegistry,
  BuildTimeRegistryInput,
} from './build-time-registry.js';
export type {
  AdminResourceDefinition,
  AdminResourceGuard,
  AdminResourceViewDefinition,
  AdminResourceViews,
} from './admin-resources.js';
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
} from './plugins.js';
export type {
  ContentTypeActionDefinition,
  ContentTypeDefinition,
  ContentTypeEditorFieldDefinition,
  ContentTypeEditorFieldKind,
  ContentTypeListColumnDefinition,
} from './content-types.js';
export {
  createContentTypeRegistry,
  definePluginContentTypes,
  genericContentTypeDefinition,
  getContentTypeDefinition,
} from './content-types.js';
export {
  createBuildTimeRegistry,
} from './build-time-registry.js';
export {
  createAdminResourceRegistry,
  definePluginAdminResources,
  mergeAdminResourceDefinitions,
} from './admin-resources.js';
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
} from './plugins.js';
export type {
  PluginTranslationResolver,
  PluginTranslationVariables,
} from './plugin-translations.js';
export {
  registerPluginTranslationResolver,
  translatePluginKey,
  usePluginTranslation,
} from './plugin-translations.js';
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
