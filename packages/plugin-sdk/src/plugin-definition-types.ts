import type { AdminResourceDefinition } from './admin-resources.js';
import type { UiAccessRequirement } from '@sva/iam-core';
import type { ContentTypeDefinition } from './content-types.js';
import type { PluginExternalInterfaceTypeDefinition } from './external-interfaces.js';
import type {
  PluginExportProfileDefinition,
  PluginImportProfileDefinition,
  PluginJobTypeDefinition,
} from './plugin-operations.js';
import type { PluginTenantLifecycleDefinition } from './plugin-tenant-lifecycle.js';
import type { RouteDocumentation } from './route-documentation.js';

export type PluginRouteGuard = string;

export type PluginNavigationSection = 'dataManagement' | 'applications' | 'system';

export type PluginRouteDefinition = {
  readonly id: string;
  readonly path: string;
  readonly documentation?: RouteDocumentation;
  readonly guard?: PluginRouteGuard;
  readonly actionId?: string;
  readonly serverHandlerId?: string;
  readonly accessRequirement?: UiAccessRequirement;
  readonly validateSearch?: (search: Record<string, unknown>) => unknown;
  readonly component: (...args: never[]) => unknown;
};

export type PluginServerHandlerDefinition = {
  readonly id: string;
  readonly path: string;
  readonly method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  readonly actionId: string;
  readonly accessRequirement: PluginServerHandlerAccessRequirement;
};

export type PluginTechnicalServiceAccessRequirement = Readonly<{
  kind: 'service';
  serviceId: string;
  tenantBinding: Readonly<{
    kind: 'header';
    headerName: string;
  }>;
}>;

export type PluginServerHandlerAccessRequirement =
  UiAccessRequirement | PluginTechnicalServiceAccessRequirement;

export type PluginNavigationItem = {
  readonly id: string;
  readonly to: string;
  readonly titleKey: string;
  readonly section: PluginNavigationSection;
  readonly actionId?: string;
  readonly requiredAction?: PluginRouteGuard;
  readonly accessRequirement?: UiAccessRequirement;
};

export type PluginActionDefinition = {
  /**
   * Fully-qualified plugin action id in the format `<pluginNamespace>.<actionName>`.
   *
   * Plugins may only declare actions in their own namespace. Reserved core
   * namespaces are not available to plugins unless an explicit bridge contract
   * exists outside of this SDK contract.
   */
  readonly id: string;
  readonly titleKey: string;
  readonly requiredAction?: PluginRouteGuard;
  readonly accessRequirement?: UiAccessRequirement;
  readonly featureFlag?: string;
  readonly legacyAliases?: readonly string[];
};

export type PluginPermissionDefinition = {
  readonly id: string;
  readonly titleKey: string;
  readonly descriptionKey?: string;
};

export type PluginAuditEventDefinition = {
  readonly eventType: string;
  readonly titleKey?: string;
};

export type PluginModuleIamSystemRoleDefinition = {
  readonly roleName: string;
  readonly permissionIds: readonly string[];
};

export type PluginModuleIamContract = {
  readonly moduleId: string;
  readonly permissionIds: readonly string[];
  readonly systemRoles: readonly PluginModuleIamSystemRoleDefinition[];
};

export type PluginTranslations = Readonly<Record<string, Readonly<Record<string, unknown>>>>;

export type PluginContentHistoryContract =
  | Readonly<{
      mode: 'host';
      coverage: 'studio_mutations';
    }>
  | Readonly<{
      mode: 'domain';
      reasonCode: 'domain_history';
    }>
  | Readonly<{
      mode: 'none';
      reasonCode: 'no_editorial_records' | 'infrastructure_only' | 'selection_values_only';
    }>;

export type PluginAdminResourceDefinition = AdminResourceDefinition;

export type PluginDefinition = {
  readonly id: string;
  readonly displayName: string;
  readonly routes: readonly PluginRouteDefinition[];
  readonly navigation?: readonly PluginNavigationItem[];
  readonly actions?: readonly PluginActionDefinition[];
  readonly serverHandlers?: readonly PluginServerHandlerDefinition[];
  readonly permissions?: readonly PluginPermissionDefinition[];
  readonly contentTypes?: readonly ContentTypeDefinition[];
  readonly adminResources?: readonly PluginAdminResourceDefinition[];
  readonly auditEvents?: readonly PluginAuditEventDefinition[];
  readonly moduleIam?: PluginModuleIamContract;
  readonly jobTypes?: readonly PluginJobTypeDefinition[];
  readonly importProfiles?: readonly PluginImportProfileDefinition[];
  readonly exportProfiles?: readonly PluginExportProfileDefinition[];
  readonly externalInterfaceTypes?: readonly PluginExternalInterfaceTypeDefinition[];
  readonly tenantLifecycle?: PluginTenantLifecycleDefinition;
  readonly contentHistory?: PluginContentHistoryContract;
  readonly translations?: PluginTranslations;
};
