import type { AdminResourceDefinition } from './admin-resources.js';
import type { UiAccessRequirement } from '@sva/iam-core';
import type { ContentTypeDefinition } from './content-types.js';
import {
  assertPluginContributionAllowedKeys,
  assertPluginRoutePathAllowed,
  createPluginGuardrailError,
} from './guardrails.js';
import {
  isReservedPluginNamespace,
  normalizePluginIdentifier,
  normalizePluginNamespace,
  parseNamespacedPluginIdentifier,
} from './plugin-identifiers.js';
import type { PluginExternalInterfaceTypeDefinition } from './external-interfaces.js';
import { definePluginExternalInterfaceTypes } from './external-interfaces.js';
import type {
  PluginExportProfileDefinition,
  PluginImportProfileDefinition,
  PluginJobTypeDefinition,
} from './plugin-operations.js';
import {
  definePluginExportProfiles,
  definePluginImportProfiles,
  definePluginJobTypes,
} from './plugin-operations.js';
import type { PluginTenantLifecycleDefinition } from './plugin-tenant-lifecycle.js';
import { definePluginTenantLifecycle } from './plugin-tenant-lifecycle.js';
import {
  hasMatchingPluginAccessRequirement,
  normalizePluginAccessRequirement,
} from './plugin-platform/access-requirements.js';
import {
  PLUGIN_PLATFORM_ADMIN_ROLE,
  type PluginExtensionTier,
} from './plugin-platform/contracts.js';
import {
  assertPluginActionDefinitionAllowedKeys,
  buildPluginActionRegistry,
  normalizePluginActionDefinition,
} from './plugin-platform/plugin-actions.js';
import { assertPluginRouteDocumentation, type RouteDocumentation } from './route-documentation.js';

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

const trimTrailingSlashes = (value: string): string => {
  let endIndex = value.length;
  while (endIndex > 0 && value[endIndex - 1] === '/') {
    endIndex -= 1;
  }
  return value.slice(0, endIndex);
};

const pluginDefinitionAllowedKeys = new Set([
  'id',
  'displayName',
  'routes',
  'navigation',
  'actions',
  'serverHandlers',
  'permissions',
  'contentTypes',
  'adminResources',
  'auditEvents',
  'moduleIam',
  'jobTypes',
  'importProfiles',
  'exportProfiles',
  'externalInterfaceTypes',
  'tenantLifecycle',
  'contentHistory',
  'translations',
] as const);

const routeDefinitionAllowedKeys = new Set([
  'id',
  'path',
  'documentation',
  'guard',
  'actionId',
  'serverHandlerId',
  'accessRequirement',
  'validateSearch',
  'component',
] as const);
const serverHandlerDefinitionAllowedKeys = new Set([
  'id',
  'path',
  'method',
  'actionId',
  'accessRequirement',
] as const);
const navigationItemAllowedKeys = new Set([
  'id',
  'to',
  'titleKey',
  'section',
  'actionId',
  'requiredAction',
  'accessRequirement',
] as const);
const permissionDefinitionAllowedKeys = new Set(['id', 'titleKey', 'descriptionKey'] as const);
const contentTypeDefinitionAllowedKeys = new Set([
  'contentType',
  'displayName',
  'titleKey',
  'mainserverGenericType',
  'studioContentType',
  'editorFields',
  'listColumns',
  'actions',
  'validatePayload',
] as const);
const adminResourceDefinitionAllowedKeys = new Set([
  'resourceId',
  'basePath',
  'titleKey',
  'guard',
  'moduleId',
  'views',
  'permissions',
  'capabilities',
  'contentUi',
  'accessRequirements',
] as const);
const auditEventDefinitionAllowedKeys = new Set(['eventType', 'titleKey'] as const);
const moduleIamContractAllowedKeys = new Set(['moduleId', 'permissionIds', 'systemRoles'] as const);
const moduleIamSystemRoleAllowedKeys = new Set(['roleName', 'permissionIds'] as const);
const contentHistoryContractAllowedKeys = new Set(['mode', 'coverage', 'reasonCode'] as const);

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
};

export type PluginAccessTransitionDiagnostic = Readonly<{
  pluginId: string;
  contributionType: 'action' | 'route' | 'navigation' | 'adminResource';
  contributionId: string;
  code: 'missing_access_requirement';
}>;

export const collectPluginAccessTransitionDiagnostics = (
  plugins: readonly PluginDefinition[]
): readonly PluginAccessTransitionDiagnostic[] =>
  plugins.flatMap((plugin) => {
    const pluginId = normalizePluginNamespace(plugin.id);
    const diagnostics: PluginAccessTransitionDiagnostic[] = [];
    for (const action of plugin.actions ?? []) {
      if (!action.accessRequirement) {
        diagnostics.push({
          pluginId,
          contributionType: 'action',
          contributionId: action.id,
          code: 'missing_access_requirement',
        });
      }
    }
    for (const route of plugin.routes) {
      if ((route.guard || route.actionId || route.serverHandlerId) && !route.accessRequirement) {
        diagnostics.push({
          pluginId,
          contributionType: 'route',
          contributionId: route.id,
          code: 'missing_access_requirement',
        });
      }
    }
    for (const navigationItem of plugin.navigation ?? []) {
      if (
        (navigationItem.requiredAction || navigationItem.actionId) &&
        !navigationItem.accessRequirement
      ) {
        diagnostics.push({
          pluginId,
          contributionType: 'navigation',
          contributionId: navigationItem.id,
          code: 'missing_access_requirement',
        });
      }
    }
    for (const resource of plugin.adminResources ?? []) {
      for (const [view, permissionIds] of Object.entries(resource.permissions ?? {})) {
        if (permissionIds === undefined) {
          continue;
        }
        if (!resource.accessRequirements?.[view as keyof typeof resource.accessRequirements]) {
          diagnostics.push({
            pluginId,
            contributionType: 'adminResource',
            contributionId: `${resource.resourceId}.${view}`,
            code: 'missing_access_requirement',
          });
        }
      }
    }
    return diagnostics;
  });

const normalizePluginPermissionDefinition = (
  permission: PluginPermissionDefinition
): PluginPermissionDefinition => ({
  ...permission,
  id: normalizePluginIdentifier(permission.id),
  titleKey: normalizePluginIdentifier(permission.titleKey),
  descriptionKey: normalizePluginIdentifier(permission.descriptionKey ?? '') || undefined,
});

const normalizePluginAuditEventDefinition = (
  event: PluginAuditEventDefinition
): PluginAuditEventDefinition => ({
  ...event,
  eventType: normalizePluginIdentifier(event.eventType),
  titleKey: normalizePluginIdentifier(event.titleKey ?? '') || undefined,
});

const normalizePluginModuleIamSystemRoleDefinition = (
  definition: PluginModuleIamSystemRoleDefinition
): PluginModuleIamSystemRoleDefinition => ({
  roleName: normalizePluginIdentifier(definition.roleName),
  permissionIds: definition.permissionIds.map((permissionId) =>
    normalizePluginIdentifier(permissionId)
  ),
});

const normalizePluginModuleIamContract = (
  contract: PluginModuleIamContract
): PluginModuleIamContract => ({
  moduleId: normalizePluginIdentifier(contract.moduleId),
  permissionIds: contract.permissionIds.map((permissionId) =>
    normalizePluginIdentifier(permissionId)
  ),
  systemRoles: contract.systemRoles.map(normalizePluginModuleIamSystemRoleDefinition),
});

const resolvePluginActionDefinition = (
  plugin: PluginDefinition,
  actionId: string
): PluginActionDefinition | undefined =>
  plugin.actions?.find((action) => normalizePluginIdentifier(action.id) === actionId);

const resolvePluginPermissionDefinition = (
  plugin: PluginDefinition,
  permissionId: string
): PluginPermissionDefinition | undefined =>
  plugin.permissions?.find(
    (permission) => normalizePluginIdentifier(permission.id) === permissionId
  );

const assertPluginPermissionReference = (
  plugin: PluginDefinition,
  pluginNamespace: string,
  source: string,
  permissionId: string | undefined
): void => {
  const normalizedPermissionId = normalizePluginIdentifier(permissionId ?? '');
  if (!normalizedPermissionId) {
    return;
  }

  if (normalizedPermissionId.startsWith('content.')) {
    throw new Error(
      `legacy_content_plugin_permission_guard:${pluginNamespace}:${source}:${normalizedPermissionId}`
    );
  }

  const parsed = parseNamespacedPluginIdentifier(normalizedPermissionId);
  if (parsed === undefined) {
    throw new Error(
      `invalid_plugin_permission_reference:${pluginNamespace}:${source}:${normalizedPermissionId}`
    );
  }
  if (parsed.namespace !== pluginNamespace) {
    throw new Error(
      `plugin_permission_reference_namespace_mismatch:${pluginNamespace}:${source}:${parsed.namespace}:${normalizedPermissionId}`
    );
  }
  if (!resolvePluginPermissionDefinition(plugin, normalizedPermissionId)) {
    throw new Error(
      `plugin_permission_reference_missing:${pluginNamespace}:${source}:${normalizedPermissionId}`
    );
  }
};

const assertPluginAccessRequirementMode = (
  mode: unknown,
  pluginNamespace: string,
  source: string,
  field: 'actions' | 'roles'
): void => {
  if (mode !== 'allOf' && mode !== 'anyOf') {
    throw new Error(
      `plugin_access_requirement_mode_invalid:${pluginNamespace}:${source}:${field}:${String(mode)}`
    );
  }
};

const assertPluginAccessRequirement = (
  plugin: PluginDefinition,
  pluginNamespace: string,
  source: string,
  requirement: UiAccessRequirement | undefined,
  legacyRequiredAction: string | undefined,
  extensionTier: PluginExtensionTier,
  allowPlatform: boolean,
  requiredReference?: string
): void => {
  if (!requirement) {
    const missingReference = legacyRequiredAction ?? requiredReference;
    if (missingReference) {
      throw new Error(
        `plugin_access_requirement_missing:${pluginNamespace}:${source}:${missingReference}`
      );
    }
    return;
  }
  if (requirement.kind === 'platform') {
    if (!allowPlatform || (extensionTier !== 'admin' && extensionTier !== 'platform')) {
      throw new Error(
        `plugin_platform_access_tier_forbidden:${pluginNamespace}:${source}:${extensionTier}`
      );
    }
    if (legacyRequiredAction) {
      throw new Error(
        `plugin_platform_access_legacy_guard_forbidden:${pluginNamespace}:${source}:${legacyRequiredAction}`
      );
    }
    assertPluginAccessRequirementMode(requirement.roles.mode, pluginNamespace, source, 'roles');
    if (requirement.roles.values.length === 0) {
      throw new Error(`plugin_platform_access_roles_missing:${pluginNamespace}:${source}`);
    }
    for (const role of requirement.roles.values) {
      if (role !== PLUGIN_PLATFORM_ADMIN_ROLE) {
        throw new Error(`plugin_platform_access_role_invalid:${pluginNamespace}:${source}:${role}`);
      }
    }
    return;
  }
  if (requirement.kind !== 'tenant') {
    throw new Error(
      `plugin_access_requirement_scope_invalid:${pluginNamespace}:${source}:${requirement.kind}`
    );
  }
  if ('resourceCapability' in requirement) {
    throw new Error(`plugin_resource_capability_forbidden:${pluginNamespace}:${source}`);
  }
  if (requirement.moduleId !== pluginNamespace) {
    throw new Error(
      `plugin_access_requirement_module_mismatch:${pluginNamespace}:${source}:${requirement.moduleId ?? 'missing'}`
    );
  }
  assertPluginAccessRequirementMode(requirement.actions.mode, pluginNamespace, source, 'actions');
  if (requirement.actions.values.length === 0) {
    throw new Error(`plugin_access_requirement_actions_missing:${pluginNamespace}:${source}`);
  }
  for (const action of requirement.actions.values) {
    assertPluginPermissionReference(plugin, pluginNamespace, source, action);
  }
  if (legacyRequiredAction && !requirement.actions.values.includes(legacyRequiredAction)) {
    throw new Error(
      `plugin_access_requirement_legacy_mismatch:${pluginNamespace}:${source}:${legacyRequiredAction}`
    );
  }
};

const isStandardCrudPluginRoute = (pluginNamespace: string, path: string): boolean => {
  const normalizedPath = trimTrailingSlashes(path.trim()) || '/';
  const pluginRoot = `/plugins/${pluginNamespace}`;

  if (normalizedPath === pluginRoot || normalizedPath === `${pluginRoot}/new`) {
    return true;
  }

  const detailPattern = new RegExp(`^${pluginRoot.replace('/', '\\/')}/\\$[a-zA-Z][a-zA-Z0-9]*$`);
  return detailPattern.test(normalizedPath);
};

const pluginUsesStandardContentAdminResource = (plugin: PluginDefinition): boolean =>
  (plugin.adminResources ?? []).some(
    (resource) => resource.guard === 'content' && resource.contentUi
  );

export const definePluginActions = <const TActions extends readonly PluginActionDefinition[]>(
  namespace: string,
  actions: TActions
): TActions => {
  const trimmedNamespace = namespace.trim();
  if (trimmedNamespace.length === 0) {
    throw new Error('invalid_plugin_action_namespace');
  }

  const normalizedNamespace = normalizePluginNamespace(trimmedNamespace);
  if (isReservedPluginNamespace(normalizedNamespace)) {
    throw new Error(`reserved_plugin_action_namespace:${normalizedNamespace}`);
  }

  for (const action of actions) {
    assertPluginActionDefinitionAllowedKeys(action, normalizedNamespace);
  }

  const normalizedActions = actions.map((action) =>
    normalizePluginActionDefinition(action)
  ) as unknown as TActions;

  for (const action of normalizedActions) {
    const parsed = parseNamespacedPluginIdentifier(action.id);
    if (parsed === undefined) {
      throw new Error(`invalid_plugin_action_id:${action.id}`);
    }
    if (action.titleKey.length === 0) {
      throw new Error(`invalid_plugin_action_definition:${action.id}`);
    }
    if (parsed.namespace !== normalizedNamespace) {
      throw new Error(
        `plugin_action_namespace_mismatch:${normalizedNamespace}:${parsed.namespace}:${action.id}`
      );
    }
  }

  return normalizedActions;
};

export const definePluginPermissions = <
  const TPermissions extends readonly PluginPermissionDefinition[],
>(
  namespace: string,
  permissions: TPermissions
): TPermissions => {
  const normalizedNamespace = normalizePluginNamespace(namespace);
  if (isReservedPluginNamespace(normalizedNamespace)) {
    throw new Error(`reserved_plugin_permission_namespace:${normalizedNamespace}`);
  }

  for (const permission of permissions) {
    assertPluginContributionAllowedKeys(
      permission,
      permissionDefinitionAllowedKeys,
      normalizedNamespace,
      normalizePluginIdentifier(permission.id)
    );
  }

  const normalizedPermissions = permissions.map((permission) =>
    normalizePluginPermissionDefinition(permission)
  ) as unknown as TPermissions;
  const seen = new Set<string>();

  for (const permission of normalizedPermissions) {
    const parsed = parseNamespacedPluginIdentifier(permission.id);
    if (parsed === undefined) {
      throw new Error(`invalid_plugin_permission_id:${permission.id}`);
    }
    if (permission.titleKey.length === 0) {
      throw new Error(`invalid_plugin_permission_definition:${permission.id}`);
    }
    if (parsed.namespace !== normalizedNamespace) {
      throw new Error(
        `plugin_permission_namespace_mismatch:${normalizedNamespace}:${parsed.namespace}:${permission.id}`
      );
    }
    if (seen.has(permission.id)) {
      throw new Error(`duplicate_plugin_permission:${permission.id}`);
    }
    seen.add(permission.id);
  }

  return normalizedPermissions;
};

export const definePluginAuditEvents = <
  const TEvents extends readonly PluginAuditEventDefinition[],
>(
  namespace: string,
  events: TEvents
): TEvents => {
  const normalizedNamespace = normalizePluginNamespace(namespace);
  if (isReservedPluginNamespace(normalizedNamespace)) {
    throw new Error(`reserved_plugin_namespace:${normalizedNamespace}`);
  }

  for (const event of events) {
    assertPluginContributionAllowedKeys(
      event,
      auditEventDefinitionAllowedKeys,
      normalizedNamespace,
      normalizePluginIdentifier(event.eventType)
    );
  }

  const normalizedEvents = events.map((event) =>
    normalizePluginAuditEventDefinition(event)
  ) as unknown as TEvents;

  for (const event of normalizedEvents) {
    const parsed = parseNamespacedPluginIdentifier(event.eventType);
    if (parsed === undefined) {
      throw new Error(`invalid_plugin_audit_event_type:${event.eventType}`);
    }
    if (parsed.namespace !== normalizedNamespace) {
      throw new Error(
        `plugin_audit_event_namespace_mismatch:${normalizedNamespace}:${parsed.namespace}:${event.eventType}`
      );
    }
  }

  return normalizedEvents;
};

export const definePluginModuleIamContract = <const TContract extends PluginModuleIamContract>(
  namespace: string,
  contract: TContract
): TContract => {
  const normalizedNamespace = normalizePluginNamespace(namespace);
  if (isReservedPluginNamespace(normalizedNamespace)) {
    throw new Error(`reserved_plugin_namespace:${normalizedNamespace}`);
  }

  assertPluginContributionAllowedKeys(
    contract,
    moduleIamContractAllowedKeys,
    normalizedNamespace,
    normalizePluginIdentifier(contract.moduleId)
  );
  for (const systemRole of contract.systemRoles) {
    assertPluginContributionAllowedKeys(
      systemRole,
      moduleIamSystemRoleAllowedKeys,
      normalizedNamespace,
      normalizePluginIdentifier(systemRole.roleName)
    );
  }

  const normalizedContract = normalizePluginModuleIamContract(contract) as TContract;
  if (normalizedContract.moduleId !== normalizedNamespace) {
    throw new Error(
      `plugin_module_iam_module_id_mismatch:${normalizedNamespace}:${normalizedContract.moduleId}`
    );
  }

  for (const permissionId of normalizedContract.permissionIds) {
    const parsed = parseNamespacedPluginIdentifier(permissionId);
    if (parsed === undefined) {
      throw new Error(`invalid_plugin_module_iam_permission:${permissionId}`);
    }
    if (parsed.namespace !== normalizedNamespace) {
      throw new Error(
        `plugin_module_iam_permission_namespace_mismatch:${normalizedNamespace}:${parsed.namespace}:${permissionId}`
      );
    }
  }

  for (const systemRole of normalizedContract.systemRoles) {
    if (!systemRole.roleName) {
      throw new Error(`invalid_plugin_module_iam_role_name:${normalizedNamespace}`);
    }
    for (const permissionId of systemRole.permissionIds) {
      const parsed = parseNamespacedPluginIdentifier(permissionId);
      if (parsed === undefined) {
        throw new Error(`invalid_plugin_module_iam_permission:${permissionId}`);
      }
      if (parsed.namespace !== normalizedNamespace) {
        throw new Error(
          `plugin_module_iam_permission_namespace_mismatch:${normalizedNamespace}:${parsed.namespace}:${permissionId}`
        );
      }
    }
  }

  return normalizedContract;
};

type PluginRegistryValidationContext = {
  readonly plugin: PluginDefinition;
  readonly pluginNamespace: string;
  readonly displayName: string;
  readonly extensionTier: PluginExtensionTier;
};

const createPluginRegistryValidationContext = (
  plugin: PluginDefinition,
  registry: ReadonlyMap<string, PluginDefinition>,
  extensionTiers: ReadonlyMap<string, PluginExtensionTier> | undefined
): PluginRegistryValidationContext => {
  const contributionId = normalizePluginIdentifier(plugin.id);
  assertPluginContributionAllowedKeys(
    plugin,
    pluginDefinitionAllowedKeys,
    contributionId,
    contributionId
  );

  const trimmedId = plugin.id.trim();
  if (trimmedId.length === 0) {
    throw new Error('invalid_plugin_definition');
  }

  const pluginNamespace = normalizePluginNamespace(trimmedId);
  const displayName = plugin.displayName.trim();

  if (pluginNamespace.length === 0 || displayName.length === 0) {
    throw new Error('invalid_plugin_definition');
  }
  if (isReservedPluginNamespace(pluginNamespace)) {
    throw new Error(`reserved_plugin_namespace:${pluginNamespace}`);
  }
  if (registry.has(pluginNamespace)) {
    throw new Error(`duplicate_plugin:${pluginNamespace}`);
  }

  return {
    plugin,
    pluginNamespace,
    displayName,
    extensionTier: extensionTiers?.get(pluginNamespace) ?? 'feature',
  };
};

const assertPluginRegistryActions = ({
  plugin,
  pluginNamespace,
  extensionTier,
}: PluginRegistryValidationContext): void => {
  for (const action of plugin.actions ?? []) {
    assertPluginActionDefinitionAllowedKeys(action, pluginNamespace);
    assertPluginPermissionReference(plugin, pluginNamespace, action.id, action.requiredAction);
    assertPluginAccessRequirement(
      plugin,
      pluginNamespace,
      action.id,
      action.accessRequirement,
      action.requiredAction,
      extensionTier,
      true,
      action.id
    );
  }
};

const assertPluginServerHandlerActionOwned = (
  pluginNamespace: string,
  handlerId: string,
  actionId: string
): void => {
  const parsedActionId = parseNamespacedPluginIdentifier(actionId);
  if (!parsedActionId) {
    throw new Error(
      `invalid_plugin_server_handler_action_id:${pluginNamespace}:${handlerId}:${actionId}`
    );
  }
  if (parsedActionId.namespace !== pluginNamespace) {
    throw new Error(
      `plugin_server_handler_action_owner_mismatch:${pluginNamespace}:${handlerId}:${actionId}`
    );
  }
};

const assertPluginTechnicalServiceHandler = (input: {
  accessRequirement: PluginTechnicalServiceAccessRequirement;
  method: PluginServerHandlerDefinition['method'];
  handlerId: string;
  pluginNamespace: string;
  extensionTier: PluginExtensionTier;
}): void => {
  if (input.extensionTier !== 'admin' && input.extensionTier !== 'platform') {
    throw new Error(
      `plugin_service_access_tier_forbidden:${input.pluginNamespace}:${input.handlerId}:${input.extensionTier}`
    );
  }
  const serviceId = normalizePluginIdentifier(input.accessRequirement.serviceId);
  const headerName = input.accessRequirement.tenantBinding.headerName.trim();
  if (!serviceId) {
    throw new Error(`plugin_service_access_id_missing:${input.pluginNamespace}:${input.handlerId}`);
  }
  if (input.method !== 'GET') {
    throw new Error(
      `plugin_service_access_method_forbidden:${input.pluginNamespace}:${input.handlerId}:${input.method}`
    );
  }
  if (
    input.accessRequirement.tenantBinding.kind !== 'header' ||
    !/^[A-Za-z0-9-]+$/u.test(headerName)
  ) {
    throw new Error(
      `plugin_service_tenant_binding_invalid:${input.pluginNamespace}:${input.handlerId}`
    );
  }
};

const assertPluginRegistryServerHandlers = ({
  plugin,
  pluginNamespace,
  extensionTier,
}: PluginRegistryValidationContext): void => {
  const supportedMethods = new Set<string>(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);
  const handlerIds = new Set<string>();
  const userPathPrefix = `/api/v1/plugins/${pluginNamespace}`;
  const servicePathPrefix = `/internal/plugins/${pluginNamespace}/`;
  for (const handler of plugin.serverHandlers ?? []) {
    const handlerId = normalizePluginIdentifier(handler.id);
    assertPluginContributionAllowedKeys(
      handler,
      serverHandlerDefinitionAllowedKeys,
      pluginNamespace,
      handlerId
    );
    const parsedHandlerId = parseNamespacedPluginIdentifier(handlerId);
    if (!parsedHandlerId || parsedHandlerId.namespace !== pluginNamespace) {
      throw new Error(`plugin_server_handler_namespace_mismatch:${pluginNamespace}:${handlerId}`);
    }
    if (handlerIds.has(handlerId)) {
      throw new Error(`duplicate_plugin_server_handler:${handlerId}`);
    }
    handlerIds.add(handlerId);
    const normalizedPath = trimTrailingSlashes(handler.path.trim());
    const isServiceHandler = handler.accessRequirement?.kind === 'service';
    const hasAllowedPath = isServiceHandler
      ? normalizedPath.startsWith(servicePathPrefix)
      : normalizedPath === userPathPrefix || normalizedPath.startsWith(`${userPathPrefix}/`);
    if (!hasAllowedPath) {
      throw new Error(`plugin_server_handler_path_invalid:${pluginNamespace}:${handlerId}`);
    }
    if (!supportedMethods.has(handler.method)) {
      throw new Error(
        `plugin_server_handler_method_invalid:${pluginNamespace}:${handlerId}:${String(handler.method)}`
      );
    }
    if (!handler.accessRequirement) {
      throw new Error(
        `plugin_server_handler_access_requirement_missing:${pluginNamespace}:${handlerId}`
      );
    }
    const actionId = normalizePluginIdentifier(handler.actionId);
    assertPluginServerHandlerActionOwned(pluginNamespace, handlerId, actionId);
    if (handler.accessRequirement.kind === 'service') {
      assertPluginTechnicalServiceHandler({
        accessRequirement: handler.accessRequirement,
        method: handler.method,
        handlerId,
        pluginNamespace,
        extensionTier,
      });
      continue;
    }
    assertPluginAccessRequirement(
      plugin,
      pluginNamespace,
      handlerId,
      handler.accessRequirement,
      undefined,
      extensionTier,
      true
    );
    const action = assertOwnedPluginActionReference(
      plugin,
      pluginNamespace,
      actionId,
      `invalid_plugin_server_handler_action_id:${pluginNamespace}:${handlerId}:${actionId}`,
      `plugin_server_handler_action_owner_mismatch:${pluginNamespace}:${handlerId}:${actionId}`,
      `plugin_server_handler_action_missing:${pluginNamespace}:${handlerId}:${actionId}`
    );
    if (!hasMatchingPluginAccessRequirement(handler.accessRequirement, action.accessRequirement)) {
      throw new Error(
        `plugin_server_handler_action_access_requirement_mismatch:${pluginNamespace}:${handlerId}:${actionId}`
      );
    }
  }
};

const assertOwnedPluginActionReference = (
  plugin: PluginDefinition,
  pluginNamespace: string,
  actionId: string,
  invalidError: string,
  ownerMismatchError: string,
  missingError: string
): PluginActionDefinition => {
  const parsed = parseNamespacedPluginIdentifier(actionId);
  if (parsed === undefined) {
    throw new Error(invalidError);
  }
  if (parsed.namespace !== pluginNamespace) {
    throw new Error(ownerMismatchError);
  }

  const action = resolvePluginActionDefinition(plugin, actionId);
  if (!action) {
    throw new Error(missingError);
  }

  return action;
};

const assertPluginRegistryRoutes = ({
  plugin,
  pluginNamespace,
  extensionTier,
}: PluginRegistryValidationContext): void => {
  for (const route of plugin.routes) {
    assertPluginContributionAllowedKeys(
      route,
      routeDefinitionAllowedKeys,
      pluginNamespace,
      normalizePluginIdentifier(route.id)
    );
    assertPluginRoutePathAllowed(pluginNamespace, normalizePluginIdentifier(route.id), route.path);
    assertPluginPermissionReference(plugin, pluginNamespace, route.id, route.guard);
    assertPluginAccessRequirement(
      plugin,
      pluginNamespace,
      route.id,
      route.accessRequirement,
      route.guard,
      extensionTier,
      true
    );

    const routeActionId = normalizePluginIdentifier(route.actionId ?? '');
    if (routeActionId) {
      const action = assertOwnedPluginActionReference(
        plugin,
        pluginNamespace,
        routeActionId,
        `invalid_plugin_route_action_id:${pluginNamespace}:${route.id}:${routeActionId}`,
        `plugin_route_action_owner_mismatch:${pluginNamespace}:${route.id}:${routeActionId}`,
        `plugin_route_action_missing:${pluginNamespace}:${route.id}:${routeActionId}`
      );
      if (!route.accessRequirement) {
        throw new Error(
          `plugin_access_requirement_missing:${pluginNamespace}:${route.id}:${routeActionId}`
        );
      }
      if (route.guard !== action.requiredAction) {
        throw new Error(
          `plugin_route_action_guard_mismatch:${pluginNamespace}:${route.id}:${routeActionId}`
        );
      }
      if (!hasMatchingPluginAccessRequirement(route.accessRequirement, action.accessRequirement)) {
        throw new Error(
          `plugin_route_action_access_requirement_mismatch:${pluginNamespace}:${route.id}:${routeActionId}`
        );
      }
    }
    const serverHandlerId = normalizePluginIdentifier(route.serverHandlerId ?? '');
    if (serverHandlerId) {
      const serverHandler = plugin.serverHandlers?.find(
        (handler) => normalizePluginIdentifier(handler.id) === serverHandlerId
      );
      if (!serverHandler) {
        throw new Error(
          `plugin_route_server_handler_missing:${pluginNamespace}:${route.id}:${serverHandlerId}`
        );
      }
      if (serverHandler.accessRequirement.kind === 'service') {
        throw new Error(
          `plugin_route_service_handler_forbidden:${pluginNamespace}:${route.id}:${serverHandlerId}`
        );
      }
      if (!route.accessRequirement) {
        throw new Error(
          `plugin_access_requirement_missing:${pluginNamespace}:${route.id}:${serverHandlerId}`
        );
      }
      if (
        !hasMatchingPluginAccessRequirement(
          route.accessRequirement,
          serverHandler.accessRequirement
        )
      ) {
        throw new Error(
          `plugin_route_server_handler_access_requirement_mismatch:${pluginNamespace}:${route.id}:${serverHandlerId}`
        );
      }
    }
  }
};

const normalizePluginRegistryRouteDocumentation = ({
  plugin,
  pluginNamespace,
}: PluginRegistryValidationContext): readonly PluginRouteDefinition[] =>
  plugin.routes.map((route) => ({
    ...route,
    documentation: assertPluginRouteDocumentation(pluginNamespace, route.id, route.documentation),
  }));

const assertPluginRegistryStandardContentRouteGuardrails = ({
  plugin,
  pluginNamespace,
}: PluginRegistryValidationContext): void => {
  if (pluginUsesStandardContentAdminResource(plugin) === false) {
    return;
  }

  for (const route of plugin.routes) {
    if (isStandardCrudPluginRoute(pluginNamespace, route.path)) {
      throw createPluginGuardrailError({
        code: 'plugin_guardrail_route_bypass',
        pluginNamespace,
        contributionId: normalizePluginIdentifier(route.id),
        fieldOrReason: 'path',
      });
    }
  }
};

const assertPluginRegistryNavigation = ({
  plugin,
  pluginNamespace,
  extensionTier,
}: PluginRegistryValidationContext): void => {
  for (const navigationItem of plugin.navigation ?? []) {
    assertPluginContributionAllowedKeys(
      navigationItem,
      navigationItemAllowedKeys,
      pluginNamespace,
      normalizePluginIdentifier(navigationItem.id)
    );
    assertPluginPermissionReference(
      plugin,
      pluginNamespace,
      navigationItem.id,
      navigationItem.requiredAction
    );
    assertPluginAccessRequirement(
      plugin,
      pluginNamespace,
      navigationItem.id,
      navigationItem.accessRequirement,
      navigationItem.requiredAction,
      extensionTier,
      true
    );

    const navigationActionId = normalizePluginIdentifier(navigationItem.actionId ?? '');
    if (!navigationActionId) {
      continue;
    }

    const action = assertOwnedPluginActionReference(
      plugin,
      pluginNamespace,
      navigationActionId,
      `invalid_plugin_navigation_action_id:${pluginNamespace}:${navigationItem.id}:${navigationActionId}`,
      `plugin_navigation_action_owner_mismatch:${pluginNamespace}:${navigationItem.id}:${navigationActionId}`,
      `plugin_navigation_action_missing:${pluginNamespace}:${navigationItem.id}:${navigationActionId}`
    );
    if (!navigationItem.accessRequirement) {
      throw new Error(
        `plugin_access_requirement_missing:${pluginNamespace}:${navigationItem.id}:${navigationActionId}`
      );
    }
    if (
      navigationItem.requiredAction &&
      action.requiredAction &&
      navigationItem.requiredAction !== action.requiredAction
    ) {
      throw new Error(
        `plugin_navigation_action_guard_mismatch:${pluginNamespace}:${navigationItem.id}:${navigationActionId}`
      );
    }
    if (
      !hasMatchingPluginAccessRequirement(
        navigationItem.accessRequirement,
        action.accessRequirement
      )
    ) {
      throw new Error(
        `plugin_navigation_action_access_requirement_mismatch:${pluginNamespace}:${navigationItem.id}:${navigationActionId}`
      );
    }
  }
};

const assertPluginRegistryPermissions = ({
  plugin,
  pluginNamespace,
}: PluginRegistryValidationContext): void => {
  for (const permission of plugin.permissions ?? []) {
    assertPluginContributionAllowedKeys(
      permission,
      permissionDefinitionAllowedKeys,
      pluginNamespace,
      normalizePluginIdentifier(permission.id)
    );
    const normalizedPermission = normalizePluginPermissionDefinition(permission);
    const parsed = parseNamespacedPluginIdentifier(normalizedPermission.id);
    if (parsed === undefined) {
      throw new Error(`invalid_plugin_permission_id:${normalizedPermission.id}`);
    }
    if (parsed.namespace !== pluginNamespace) {
      throw new Error(
        `plugin_permission_namespace_mismatch:${pluginNamespace}:${parsed.namespace}:${normalizedPermission.id}`
      );
    }
  }
};

const assertPluginRegistryContentTypes = ({
  plugin,
  pluginNamespace,
}: PluginRegistryValidationContext): void => {
  const pluginPermissionIds = new Set(
    (plugin.permissions ?? []).map((permission) => normalizePluginIdentifier(permission.id))
  );

  for (const contentTypeDefinition of plugin.contentTypes ?? []) {
    const contributionId = normalizePluginIdentifier(contentTypeDefinition.contentType);
    assertPluginContributionAllowedKeys(
      contentTypeDefinition,
      contentTypeDefinitionAllowedKeys,
      pluginNamespace,
      contributionId
    );
    const normalizedContentType = normalizePluginIdentifier(contentTypeDefinition.contentType);
    const parsed = parseNamespacedPluginIdentifier(normalizedContentType);
    if (parsed === undefined) {
      throw new Error(`invalid_plugin_content_type:${normalizedContentType}`);
    }
    if (parsed.namespace !== pluginNamespace) {
      throw new Error(
        `plugin_content_type_namespace_mismatch:${pluginNamespace}:${parsed.namespace}:${normalizedContentType}`
      );
    }

    const studioContentType = contentTypeDefinition.studioContentType;
    if (!studioContentType) {
      continue;
    }

    const requiredReadAction = normalizePluginIdentifier(studioContentType.requiredReadAction);
    const requiredCreateAction = normalizePluginIdentifier(studioContentType.requiredCreateAction);
    const requiredReadIdentifier = parseNamespacedPluginIdentifier(requiredReadAction);
    const requiredCreateIdentifier = parseNamespacedPluginIdentifier(requiredCreateAction);

    if (requiredReadIdentifier?.namespace !== pluginNamespace) {
      throw new Error(
        `plugin_content_type_read_action_namespace_mismatch:${pluginNamespace}:${requiredReadAction}:${normalizedContentType}`
      );
    }
    if (requiredCreateIdentifier?.namespace !== pluginNamespace) {
      throw new Error(
        `plugin_content_type_create_action_namespace_mismatch:${pluginNamespace}:${requiredCreateAction}:${normalizedContentType}`
      );
    }
    if (!pluginPermissionIds.has(requiredReadAction)) {
      throw new Error(
        `plugin_content_type_read_action_missing:${pluginNamespace}:${requiredReadAction}:${normalizedContentType}`
      );
    }
    if (!pluginPermissionIds.has(requiredCreateAction)) {
      throw new Error(
        `plugin_content_type_create_action_missing:${pluginNamespace}:${requiredCreateAction}:${normalizedContentType}`
      );
    }
  }
};

const assertPluginRegistryContentHistory = ({
  plugin,
  pluginNamespace,
}: PluginRegistryValidationContext): void => {
  const hasEditableContent = (plugin.contentTypes ?? []).some(
    (definition) => definition.studioContentType !== undefined
  );
  const contract = plugin.contentHistory;

  if (hasEditableContent && !contract) {
    throw new Error(`plugin_content_history_binding_missing:${pluginNamespace}`);
  }
  if (!contract) {
    return;
  }

  assertPluginContributionAllowedKeys(
    contract,
    contentHistoryContractAllowedKeys,
    pluginNamespace,
    `${pluginNamespace}.contentHistory`
  );

  if (hasEditableContent && contract.mode !== 'host') {
    throw new Error(`plugin_content_history_classification_invalid:${pluginNamespace}`);
  }

  if (contract.mode === 'host' && contract.coverage !== 'studio_mutations') {
    throw new Error(`invalid_plugin_content_history_coverage:${pluginNamespace}`);
  }
  if (contract.mode === 'domain' && contract.reasonCode !== 'domain_history') {
    throw new Error(`invalid_plugin_content_history_reason:${pluginNamespace}`);
  }
};

const assertPluginRegistryAdminResources = ({
  plugin,
  pluginNamespace,
  extensionTier,
}: PluginRegistryValidationContext): void => {
  for (const adminResource of plugin.adminResources ?? []) {
    const contributionId = normalizePluginIdentifier(adminResource.resourceId);
    assertPluginContributionAllowedKeys(
      adminResource,
      adminResourceDefinitionAllowedKeys,
      pluginNamespace,
      contributionId
    );
    const normalizedResourceId = normalizePluginIdentifier(adminResource.resourceId);
    const parsed = parseNamespacedPluginIdentifier(normalizedResourceId);
    if (parsed === undefined) {
      throw new Error(`invalid_plugin_admin_resource:${normalizedResourceId}`);
    }
    if (parsed.namespace !== pluginNamespace) {
      throw new Error(
        `plugin_admin_resource_namespace_mismatch:${pluginNamespace}:${parsed.namespace}:${normalizedResourceId}`
      );
    }
    for (const [view, permissionIds] of Object.entries(adminResource.permissions ?? {})) {
      if (permissionIds === undefined) {
        continue;
      }
      if (
        !adminResource.accessRequirements?.[view as keyof typeof adminResource.accessRequirements]
      ) {
        throw new Error(
          `plugin_access_requirement_missing:${pluginNamespace}:${normalizedResourceId}.${view}:${permissionIds[0] ?? 'missing'}`
        );
      }
    }
    for (const [view, requirement] of Object.entries(adminResource.accessRequirements ?? {})) {
      assertPluginAccessRequirement(
        plugin,
        pluginNamespace,
        `${normalizedResourceId}.${view}`,
        requirement,
        adminResource.permissions?.[view as keyof typeof adminResource.permissions]?.[0],
        extensionTier,
        false
      );
    }
  }
};

const assertPluginRegistryAuditEvents = ({
  plugin,
  pluginNamespace,
}: PluginRegistryValidationContext): void => {
  for (const eventDefinition of plugin.auditEvents ?? []) {
    const contributionId = normalizePluginIdentifier(eventDefinition.eventType);
    assertPluginContributionAllowedKeys(
      eventDefinition,
      auditEventDefinitionAllowedKeys,
      pluginNamespace,
      contributionId
    );
    const normalizedEventType = normalizePluginIdentifier(eventDefinition.eventType);
    const parsed = parseNamespacedPluginIdentifier(normalizedEventType);
    if (parsed === undefined) {
      throw new Error(`invalid_plugin_audit_event_type:${normalizedEventType}`);
    }
    if (parsed.namespace !== pluginNamespace) {
      throw new Error(
        `plugin_audit_event_namespace_mismatch:${pluginNamespace}:${parsed.namespace}:${normalizedEventType}`
      );
    }
  }
};

const assertPluginRegistryModuleIam = ({
  plugin,
  pluginNamespace,
}: PluginRegistryValidationContext): void => {
  if (plugin.moduleIam) {
    definePluginModuleIamContract(pluginNamespace, plugin.moduleIam);
  }
};

const normalizePluginRegistryOperations = ({
  plugin,
  pluginNamespace,
}: PluginRegistryValidationContext): Pick<
  PluginDefinition,
  'jobTypes' | 'importProfiles' | 'exportProfiles' | 'externalInterfaceTypes' | 'tenantLifecycle'
> => ({
  jobTypes: plugin.jobTypes
    ? definePluginJobTypes(pluginNamespace, plugin.jobTypes)
    : plugin.jobTypes,
  importProfiles: plugin.importProfiles
    ? definePluginImportProfiles(pluginNamespace, plugin.importProfiles)
    : plugin.importProfiles,
  exportProfiles: plugin.exportProfiles
    ? definePluginExportProfiles(pluginNamespace, plugin.exportProfiles)
    : plugin.exportProfiles,
  externalInterfaceTypes: plugin.externalInterfaceTypes
    ? definePluginExternalInterfaceTypes(pluginNamespace, plugin.externalInterfaceTypes)
    : plugin.externalInterfaceTypes,
  tenantLifecycle: plugin.tenantLifecycle
    ? definePluginTenantLifecycle(pluginNamespace, plugin.tenantLifecycle, plugin.jobTypes ?? [])
    : plugin.tenantLifecycle,
});

export const createPluginRegistry = (
  plugins: readonly PluginDefinition[],
  options: {
    readonly extensionTiers?: ReadonlyMap<string, PluginExtensionTier>;
  } = {}
): ReadonlyMap<string, PluginDefinition> => {
  const registry = new Map<string, PluginDefinition>();

  for (const plugin of plugins) {
    const context = createPluginRegistryValidationContext(plugin, registry, options.extensionTiers);
    const normalizedOperations = normalizePluginRegistryOperations(context);

    assertPluginRegistryActions(context);
    assertPluginRegistryServerHandlers(context);
    assertPluginRegistryRoutes(context);
    assertPluginRegistryStandardContentRouteGuardrails(context);
    assertPluginRegistryNavigation(context);
    assertPluginRegistryPermissions(context);
    assertPluginRegistryContentTypes(context);
    assertPluginRegistryContentHistory(context);
    assertPluginRegistryAdminResources(context);
    assertPluginRegistryAuditEvents(context);
    assertPluginRegistryModuleIam(context);
    const normalizedRoutes = normalizePluginRegistryRouteDocumentation(context);

    registry.set(context.pluginNamespace, {
      ...plugin,
      id: context.pluginNamespace,
      displayName: context.displayName,
      routes: normalizedRoutes,
      ...normalizedOperations,
    });
  }

  return registry;
};

export const mergePluginRouteDefinitions = (
  plugins: readonly PluginDefinition[]
): readonly PluginRouteDefinition[] => plugins.flatMap((plugin) => plugin.routes);

export const mergePluginNavigationItems = (
  plugins: readonly PluginDefinition[]
): readonly PluginNavigationItem[] => plugins.flatMap((plugin) => plugin.navigation ?? []);

export const mergePluginActions = (
  plugins: readonly PluginDefinition[]
): readonly PluginActionDefinition[] => plugins.flatMap((plugin) => plugin.actions ?? []);

export const createPluginServerHandlerRegistry = (
  plugins: readonly PluginDefinition[]
): ReadonlyMap<string, PluginServerHandlerRegistryEntry> => {
  const registry = new Map<string, PluginServerHandlerRegistryEntry>();
  for (const plugin of plugins) {
    for (const handler of plugin.serverHandlers ?? []) {
      const handlerId = normalizePluginIdentifier(handler.id);
      if (registry.has(handlerId)) {
        throw new Error(`duplicate_plugin_server_handler:${handlerId}`);
      }
      registry.set(handlerId, {
        ...handler,
        id: handlerId,
        path: trimTrailingSlashes(handler.path.trim()),
        actionId: normalizePluginIdentifier(handler.actionId),
        accessRequirement:
          handler.accessRequirement.kind === 'service'
            ? {
                kind: 'service',
                serviceId: normalizePluginIdentifier(handler.accessRequirement.serviceId),
                tenantBinding: {
                  kind: 'header',
                  headerName: handler.accessRequirement.tenantBinding.headerName.trim(),
                },
              }
            : (normalizePluginAccessRequirement(handler.accessRequirement) ??
              handler.accessRequirement),
        ownerPluginId: normalizePluginNamespace(plugin.id),
      });
    }
  }
  return registry;
};

export const mergePluginPermissions = (
  plugins: readonly PluginDefinition[]
): readonly PluginPermissionDefinition[] => plugins.flatMap((plugin) => plugin.permissions ?? []);

export const mergePluginContentTypes = (
  plugins: readonly PluginDefinition[]
): readonly ContentTypeDefinition[] => plugins.flatMap((plugin) => plugin.contentTypes ?? []);

export const mergePluginAdminResourceDefinitions = (
  plugins: readonly PluginDefinition[]
): readonly PluginAdminResourceDefinition[] =>
  plugins.flatMap((plugin) => plugin.adminResources ?? []);

export const mergePluginAuditEventDefinitions = (
  plugins: readonly PluginDefinition[]
): readonly PluginAuditEventDefinition[] => plugins.flatMap((plugin) => plugin.auditEvents ?? []);

export const mergePluginModuleIamContracts = (
  plugins: readonly PluginDefinition[]
): readonly PluginModuleIamRegistryEntry[] =>
  plugins.flatMap((plugin) => {
    if (!plugin.moduleIam) {
      return [];
    }

    const normalizedPluginNamespace = normalizePluginNamespace(plugin.id);
    const normalizedContract = definePluginModuleIamContract(
      normalizedPluginNamespace,
      plugin.moduleIam
    );
    return [
      {
        moduleId: normalizedContract.moduleId,
        namespace: normalizedPluginNamespace,
        ownerPluginId: normalizedPluginNamespace,
        permissionIds: normalizedContract.permissionIds,
        systemRoles: normalizedContract.systemRoles,
      },
    ];
  });

export const createPluginActionRegistry = (
  plugins: readonly PluginDefinition[]
): ReadonlyMap<string, PluginActionRegistryEntry> => buildPluginActionRegistry(plugins);

export const createPluginPermissionRegistry = (
  plugins: readonly PluginDefinition[]
): ReadonlyMap<string, PluginPermissionRegistryEntry> => {
  const registry = new Map<string, PluginPermissionRegistryEntry>();
  const pluginNamespaces = new Set<string>();

  for (const plugin of plugins) {
    const pluginNamespace = normalizePluginNamespace(plugin.id);
    if (isReservedPluginNamespace(pluginNamespace)) {
      throw new Error(`reserved_plugin_permission_namespace:${pluginNamespace}`);
    }
    if (pluginNamespaces.has(pluginNamespace)) {
      throw new Error(`duplicate_plugin:${pluginNamespace}`);
    }
    pluginNamespaces.add(pluginNamespace);

    for (const permission of plugin.permissions ?? []) {
      assertPluginContributionAllowedKeys(
        permission,
        permissionDefinitionAllowedKeys,
        pluginNamespace,
        normalizePluginIdentifier(permission.id)
      );
      const normalizedPermission = normalizePluginPermissionDefinition(permission);
      const parsed = parseNamespacedPluginIdentifier(normalizedPermission.id);
      if (parsed === undefined) {
        throw new Error(`invalid_plugin_permission_id:${normalizedPermission.id}`);
      }
      if (parsed.namespace !== pluginNamespace) {
        throw new Error(
          `plugin_permission_namespace_mismatch:${pluginNamespace}:${parsed.namespace}:${normalizedPermission.id}`
        );
      }
      if (registry.has(normalizedPermission.id)) {
        throw new Error(`duplicate_plugin_permission:${normalizedPermission.id}`);
      }

      registry.set(normalizedPermission.id, {
        permissionId: normalizedPermission.id,
        namespace: parsed.namespace,
        permissionName: parsed.name,
        ownerPluginId: pluginNamespace,
        titleKey: normalizedPermission.titleKey,
        descriptionKey: normalizedPermission.descriptionKey,
      });
    }
  }

  return registry;
};

export const createPluginAuditEventRegistry = (
  plugins: readonly PluginDefinition[]
): ReadonlyMap<string, PluginAuditEventRegistryEntry> => {
  const registry = new Map<string, PluginAuditEventRegistryEntry>();

  for (const plugin of plugins) {
    const pluginNamespace = normalizePluginIdentifier(plugin.id);
    if (pluginNamespace.length === 0) {
      throw new Error('invalid_plugin_definition');
    }
    if (isReservedPluginNamespace(pluginNamespace)) {
      throw new Error(`reserved_plugin_namespace:${pluginNamespace}`);
    }

    for (const eventDefinition of plugin.auditEvents ?? []) {
      assertPluginContributionAllowedKeys(
        eventDefinition,
        auditEventDefinitionAllowedKeys,
        pluginNamespace,
        normalizePluginIdentifier(eventDefinition.eventType)
      );
      const normalizedEvent = normalizePluginAuditEventDefinition(eventDefinition);
      const parsed = parseNamespacedPluginIdentifier(normalizedEvent.eventType);
      if (parsed === undefined) {
        throw new Error(`invalid_plugin_audit_event_type:${normalizedEvent.eventType}`);
      }
      if (parsed.namespace !== pluginNamespace) {
        throw new Error(
          `plugin_audit_event_namespace_mismatch:${pluginNamespace}:${parsed.namespace}:${normalizedEvent.eventType}`
        );
      }
      if (registry.has(normalizedEvent.eventType)) {
        throw new Error(`duplicate_plugin_audit_event:${normalizedEvent.eventType}`);
      }

      registry.set(normalizedEvent.eventType, {
        eventType: normalizedEvent.eventType,
        namespace: parsed.namespace,
        eventName: parsed.name,
        ownerPluginId: pluginNamespace,
        titleKey: normalizedEvent.titleKey,
      });
    }
  }

  return registry;
};

export const createPluginModuleIamRegistry = (
  plugins: readonly PluginDefinition[]
): ReadonlyMap<string, PluginModuleIamRegistryEntry> => {
  const registry = new Map<string, PluginModuleIamRegistryEntry>();

  for (const entry of mergePluginModuleIamContracts(plugins)) {
    if (registry.has(entry.moduleId)) {
      throw new Error(`duplicate_plugin_module_iam:${entry.moduleId}`);
    }

    registry.set(entry.moduleId, entry);
  }

  return registry;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && Array.isArray(value) === false;

const mergeTranslationNode = (
  target: Record<string, unknown>,
  source: Readonly<Record<string, unknown>>,
  locale: string,
  pathPrefix = ''
): Record<string, unknown> => {
  for (const [key, value] of Object.entries(source)) {
    const path = pathPrefix ? `${pathPrefix}.${key}` : key;
    const targetValue = target[key];
    if (isRecord(value) && isRecord(targetValue)) {
      target[key] = mergeTranslationNode({ ...targetValue }, value, locale, path);
      continue;
    }

    if (targetValue !== undefined) {
      throw new Error(`duplicate_plugin_translation_key:${locale}:${path}`);
    }

    target[key] = value;
  }

  return target;
};

export const mergePluginTranslations = (
  plugins: readonly PluginDefinition[]
): Readonly<Record<string, Readonly<Record<string, unknown>>>> => {
  const merged: Record<string, Record<string, unknown>> = {};

  for (const plugin of plugins) {
    for (const [locale, resources] of Object.entries(plugin.translations ?? {})) {
      const currentLocaleResources = merged[locale] ?? {};
      merged[locale] = mergeTranslationNode(currentLocaleResources, resources, locale);
    }
  }

  return merged;
};
