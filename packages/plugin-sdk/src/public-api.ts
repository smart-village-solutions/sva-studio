export type { RouteFactory } from '@sva/core';
export type {
  BuildTimeRegistry,
  BuildTimeRegistryInput,
} from './build-time-registry.js';
export {
  createBuildTimeRegistry,
} from './build-time-registry.js';
export type {
  AdminResourceDefinition,
  AdminResourceGuard,
  AdminResourceViewDefinition,
  AdminResourceViews,
} from './admin-resources.js';
export {
  createAdminResourceRegistry,
  definePluginAdminResources,
  mergeAdminResourceDefinitions,
} from './admin-resources.js';
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
export {
  createPluginActionRegistry,
  createPluginAuditEventRegistry,
  createPluginRegistry,
  definePluginActions,
  definePluginAuditEvents,
  mergePluginActions,
  mergePluginAdminResourceDefinitions,
  mergePluginAuditEventDefinitions,
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
