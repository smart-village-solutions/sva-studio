import type { UiAccessRequirement } from '@sva/iam-core';
import type {
  PluginModuleIamSystemRoleDefinition,
  PluginRouteGuard,
  PluginServerHandlerDefinition,
} from './plugin-definition-types.js';

export type PluginActionRegistryEntry = {
  readonly actionId: string;
  readonly namespace: string;
  readonly actionName: string;
  readonly ownerPluginId: string;
  readonly titleKey: string;
  readonly requiredAction?: PluginRouteGuard;
  readonly accessRequirement?: UiAccessRequirement;
  readonly featureFlag?: string;
  readonly legacyAliases?: readonly string[];
  readonly deprecatedAlias?: string;
};

export type PluginServerHandlerRegistryEntry = PluginServerHandlerDefinition & {
  readonly ownerPluginId: string;
};

type PluginUserServerHandlerExecutionContext = Readonly<{
  request: Request;
  pluginId: string;
  handlerId: string;
  scope: 'platform' | 'tenant';
  pathParams: Readonly<Record<string, string>>;
  activeOrganizationId?: string;
  actor: Readonly<{
    id: string;
    roles: readonly string[];
    instanceId?: string;
  }>;
}>;

export type PluginTechnicalServiceTenantContext = Readonly<{
  instanceId: string;
  displayName: string;
  timeZone: string;
  authorizationRevision: string;
}>;

type PluginServiceServerHandlerExecutionContext = Readonly<{
  request: Request;
  pluginId: string;
  handlerId: string;
  scope: 'service';
  service: Readonly<{
    id: string;
    subject: string;
    actionId: string;
  }>;
  tenant: PluginTechnicalServiceTenantContext;
}>;

export type PluginServerHandlerExecutionContext =
  PluginUserServerHandlerExecutionContext | PluginServiceServerHandlerExecutionContext;

export type PluginServerExecutionHandler = (
  context: PluginServerHandlerExecutionContext
) => Promise<Response> | Response;

export type PluginServerHandlerModuleFactory = () => Readonly<
  Record<string, PluginServerExecutionHandler>
>;

export type PluginAuditEventRegistryEntry = {
  readonly eventType: string;
  readonly namespace: string;
  readonly eventName: string;
  readonly ownerPluginId: string;
  readonly titleKey?: string;
};

export type PluginPermissionRegistryEntry = {
  readonly permissionId: string;
  readonly namespace: string;
  readonly permissionName: string;
  readonly ownerPluginId: string;
  readonly titleKey: string;
  readonly descriptionKey?: string;
};

export type PluginModuleIamRegistryEntry = {
  readonly moduleId: string;
  readonly namespace: string;
  readonly ownerPluginId: string;
  readonly permissionIds: readonly string[];
  readonly systemRoles: readonly PluginModuleIamSystemRoleDefinition[];
  readonly requiredTenantModuleIds: readonly string[];
};

export type PluginAccessTransitionDiagnostic = Readonly<{
  pluginId: string;
  contributionType: 'action' | 'route' | 'navigation' | 'adminResource';
  contributionId: string;
  code: 'missing_access_requirement';
}>;
