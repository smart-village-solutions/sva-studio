export const pluginSdkVersion = '0.0.1';

export type PluginSdkPackageRole = 'plugin-contracts' | 'admin-resources' | 'content-types' | 'plugin-i18n';

export const pluginSdkPackageRoles = [
  'plugin-contracts',
  'admin-resources',
  'content-types',
  'plugin-i18n',
] as const satisfies readonly PluginSdkPackageRole[];

export type {
  AdminResourceDefinition,
  AdminResourceGuard,
  AdminResourceViewDefinition,
  AdminResourceViews,
  BuildTimeRegistry,
  BuildTimeRegistryInput,
  ContentTypeActionDefinition,
  ContentTypeDefinition,
  ContentTypeEditorFieldDefinition,
  ContentTypeEditorFieldKind,
  ContentTypeListColumnDefinition,
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
  PluginTranslationResolver,
  PluginTranslationVariables,
  RouteFactory,
} from '@sva/sdk';

export {
  createAdminResourceRegistry,
  createBuildTimeRegistry,
  createContentTypeRegistry,
  createPluginActionRegistry,
  createPluginAuditEventRegistry,
  createPluginRegistry,
  definePluginActions,
  definePluginAdminResources,
  definePluginAuditEvents,
  definePluginContentTypes,
  genericContentTypeDefinition,
  getContentTypeDefinition,
  mergeAdminResourceDefinitions,
  mergePluginActions,
  mergePluginAdminResourceDefinitions,
  mergePluginAuditEventDefinitions,
  mergePluginContentTypes,
  mergePluginNavigationItems,
  mergePluginRouteDefinitions,
  mergePluginTranslations,
  registerPluginTranslationResolver,
  translatePluginKey,
  usePluginTranslation,
} from '@sva/sdk';
