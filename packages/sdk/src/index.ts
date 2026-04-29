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
  HostMediaAssetListItem,
  HostMediaFieldOption,
  HostMediaReferenceSelection,
  MainserverCrudClientOptions,
  MainserverErrorFactory,
  MainserverListQuery,
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
  PluginPermissionDefinition,
  PluginPermissionRegistryEntry,
  PluginRouteDefinition,
  PluginRouteGuard,
  StandardContentAdminResourceOptions,
  StandardContentPluginActionIds,
  StandardContentPluginActionName,
  StandardContentPluginActionOptions,
  StandardContentPluginContributionOptions,
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
  compactOptionalString,
  definePluginAdminResources,
  findHostMediaReferenceAssetId,
  fromDatetimeLocalValue,
  mergeAdminResourceDefinitions,
  toDatetimeLocalValue,
  toHostMediaFieldOptions,
} from '@sva/plugin-sdk';
export {
  buildMainserverListUrl,
  createMainserverCrudClient,
  createMainserverJsonRequestHeaders,
  createPluginActionRegistry,
  createPluginAuditEventRegistry,
  createPluginPermissionRegistry,
  createPluginRegistry,
  definePluginActions,
  definePluginAuditEvents,
  definePluginPermissions,
  mergePluginAdminResourceDefinitions,
  mergePluginAuditEventDefinitions,
  mergePluginActions,
  mergePluginContentTypes,
  mergePluginNavigationItems,
  mergePluginPermissions,
  mergePluginRouteDefinitions,
  mergePluginTranslations,
  listHostMediaAssets,
  listHostMediaReferencesByTarget,
  MainserverApiError,
  replaceHostMediaReferences,
  requestMainserverJson,
} from '@sva/plugin-sdk';
export type {
  PluginTranslationResolver,
  PluginTranslationVariables,
} from '@sva/plugin-sdk';
export {
  createStandardContentAdminResource,
  createStandardContentModuleIamContract,
  createStandardContentPluginActionIds,
  createStandardContentPluginActions,
  createStandardContentPluginContribution,
  createStandardContentPluginPermissions,
  createStandardContentPluginSystemRoles,
  createStandardContentTypeDefinition,
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
