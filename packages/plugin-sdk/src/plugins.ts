import type { AdminResourceDefinition } from './admin-resources.js';
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

export type PluginRouteGuard = string;

export type PluginNavigationSection = 'dataManagement' | 'applications' | 'system';

export type PluginRouteDefinition = {
  readonly id: string;
  readonly path: string;
  readonly guard?: PluginRouteGuard;
  readonly actionId?: string;
  readonly component: (...args: never[]) => unknown;
};

export type PluginNavigationItem = {
  readonly id: string;
  readonly to: string;
  readonly titleKey: string;
  readonly section: PluginNavigationSection;
  readonly actionId?: string;
  readonly requiredAction?: PluginRouteGuard;
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

export type PluginAdminResourceDefinition = AdminResourceDefinition;

export type PluginDefinition = {
  readonly id: string;
  readonly displayName: string;
  readonly routes: readonly PluginRouteDefinition[];
  readonly navigation?: readonly PluginNavigationItem[];
  readonly actions?: readonly PluginActionDefinition[];
  readonly permissions?: readonly PluginPermissionDefinition[];
  readonly contentTypes?: readonly ContentTypeDefinition[];
  readonly adminResources?: readonly PluginAdminResourceDefinition[];
  readonly auditEvents?: readonly PluginAuditEventDefinition[];
  readonly moduleIam?: PluginModuleIamContract;
  readonly translations?: PluginTranslations;
};

const LEGACY_ACTION_ALIAS_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const pluginDefinitionAllowedKeys = new Set([
  'id',
  'displayName',
  'routes',
  'navigation',
  'actions',
  'permissions',
  'contentTypes',
  'adminResources',
  'auditEvents',
  'moduleIam',
  'translations',
] as const);

const routeDefinitionAllowedKeys = new Set(['id', 'path', 'guard', 'actionId', 'component'] as const);
const navigationItemAllowedKeys = new Set(['id', 'to', 'titleKey', 'section', 'actionId', 'requiredAction'] as const);
const actionDefinitionAllowedKeys = new Set([
  'id',
  'titleKey',
  'requiredAction',
  'featureFlag',
  'legacyAliases',
] as const);
const permissionDefinitionAllowedKeys = new Set(['id', 'titleKey', 'descriptionKey'] as const);
const contentTypeDefinitionAllowedKeys = new Set([
  'contentType',
  'displayName',
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
] as const);
const auditEventDefinitionAllowedKeys = new Set(['eventType', 'titleKey'] as const);
const moduleIamContractAllowedKeys = new Set(['moduleId', 'permissionIds', 'systemRoles'] as const);
const moduleIamSystemRoleAllowedKeys = new Set(['roleName', 'permissionIds'] as const);

export type PluginActionRegistryEntry = {
  readonly actionId: string;
  readonly namespace: string;
  readonly actionName: string;
  readonly ownerPluginId: string;
  readonly titleKey: string;
  readonly requiredAction?: PluginRouteGuard;
  readonly featureFlag?: string;
  readonly legacyAliases?: readonly string[];
  readonly deprecatedAlias?: string;
};

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

const normalizeLegacyAliases = (
  actionId: string,
  aliases: readonly string[] | undefined
): readonly string[] | undefined => {
  if (!aliases || aliases.length === 0) {
    return undefined;
  }

  const normalizedAliases = aliases.map((alias) => normalizePluginIdentifier(alias));
  if (normalizedAliases.some((alias) => alias.length === 0 || LEGACY_ACTION_ALIAS_PATTERN.test(alias) === false)) {
    throw new Error(`invalid_plugin_action_alias:${actionId}`);
  }
  if (normalizedAliases.some((alias) => alias === actionId)) {
    throw new Error(`duplicate_plugin_action_alias:${actionId}:${actionId}`);
  }

  const uniqueAliases = [...new Set(normalizedAliases)];
  if (uniqueAliases.length !== normalizedAliases.length) {
    const duplicateAlias = normalizedAliases.find((alias, index) => normalizedAliases.indexOf(alias) !== index);
    throw new Error(`duplicate_plugin_action_alias:${actionId}:${duplicateAlias}`);
  }

  return uniqueAliases;
};

const normalizePluginActionDefinition = (action: PluginActionDefinition): PluginActionDefinition => {
  const actionId = normalizePluginIdentifier(action.id);
  const titleKey = normalizePluginIdentifier(action.titleKey);

  return {
    ...action,
    id: actionId,
    titleKey,
    featureFlag: normalizePluginIdentifier(action.featureFlag ?? '') || undefined,
    legacyAliases: normalizeLegacyAliases(actionId, action.legacyAliases),
  };
};

const normalizePluginPermissionDefinition = (permission: PluginPermissionDefinition): PluginPermissionDefinition => ({
  ...permission,
  id: normalizePluginIdentifier(permission.id),
  titleKey: normalizePluginIdentifier(permission.titleKey),
  descriptionKey: normalizePluginIdentifier(permission.descriptionKey ?? '') || undefined,
});

const normalizePluginAuditEventDefinition = (event: PluginAuditEventDefinition): PluginAuditEventDefinition => ({
  ...event,
  eventType: normalizePluginIdentifier(event.eventType),
  titleKey: normalizePluginIdentifier(event.titleKey ?? '') || undefined,
});

const normalizePluginModuleIamSystemRoleDefinition = (
  definition: PluginModuleIamSystemRoleDefinition
): PluginModuleIamSystemRoleDefinition => ({
  roleName: normalizePluginIdentifier(definition.roleName),
  permissionIds: definition.permissionIds.map((permissionId) => normalizePluginIdentifier(permissionId)),
});

const normalizePluginModuleIamContract = (contract: PluginModuleIamContract): PluginModuleIamContract => ({
  moduleId: normalizePluginIdentifier(contract.moduleId),
  permissionIds: contract.permissionIds.map((permissionId) => normalizePluginIdentifier(permissionId)),
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
  plugin.permissions?.find((permission) => normalizePluginIdentifier(permission.id) === permissionId);

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
    throw new Error(`legacy_content_plugin_permission_guard:${pluginNamespace}:${source}:${normalizedPermissionId}`);
  }

  const parsed = parseNamespacedPluginIdentifier(normalizedPermissionId);
  if (parsed === undefined) {
    throw new Error(`invalid_plugin_permission_reference:${pluginNamespace}:${source}:${normalizedPermissionId}`);
  }
  if (parsed.namespace !== pluginNamespace) {
    throw new Error(
      `plugin_permission_reference_namespace_mismatch:${pluginNamespace}:${source}:${parsed.namespace}:${normalizedPermissionId}`
    );
  }
  if (!resolvePluginPermissionDefinition(plugin, normalizedPermissionId)) {
    throw new Error(`plugin_permission_reference_missing:${pluginNamespace}:${source}:${normalizedPermissionId}`);
  }
};

const isStandardCrudPluginRoute = (pluginNamespace: string, path: string): boolean => {
  const normalizedPath = path.trim();
  const pluginRoot = `/plugins/${pluginNamespace}`;

  if (normalizedPath === pluginRoot || normalizedPath === `${pluginRoot}/new`) {
    return true;
  }

  const detailPattern = new RegExp(`^${pluginRoot.replace('/', '\\/')}/\\$[a-zA-Z][a-zA-Z0-9]*$`);
  return detailPattern.test(normalizedPath);
};

const pluginUsesStandardContentAdminResource = (plugin: PluginDefinition): boolean =>
  (plugin.adminResources ?? []).some((resource) => resource.guard === 'content' && resource.contentUi);

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
    assertPluginContributionAllowedKeys(
      action as unknown as Record<string, unknown>,
      actionDefinitionAllowedKeys,
      normalizedNamespace,
      normalizePluginIdentifier(action.id)
    );
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
      throw new Error(`plugin_action_namespace_mismatch:${normalizedNamespace}:${parsed.namespace}:${action.id}`);
    }
  }

  return normalizedActions;
};

export const definePluginPermissions = <const TPermissions extends readonly PluginPermissionDefinition[]>(
  namespace: string,
  permissions: TPermissions
): TPermissions => {
  const normalizedNamespace = normalizePluginNamespace(namespace);
  if (isReservedPluginNamespace(normalizedNamespace)) {
    throw new Error(`reserved_plugin_permission_namespace:${normalizedNamespace}`);
  }

  for (const permission of permissions) {
    assertPluginContributionAllowedKeys(
      permission as unknown as Record<string, unknown>,
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

export const definePluginAuditEvents = <const TEvents extends readonly PluginAuditEventDefinition[]>(
  namespace: string,
  events: TEvents
): TEvents => {
  const normalizedNamespace = normalizePluginNamespace(namespace);
  if (isReservedPluginNamespace(normalizedNamespace)) {
    throw new Error(`reserved_plugin_namespace:${normalizedNamespace}`);
  }

  for (const event of events) {
    assertPluginContributionAllowedKeys(
      event as unknown as Record<string, unknown>,
      auditEventDefinitionAllowedKeys,
      normalizedNamespace,
      normalizePluginIdentifier(event.eventType)
    );
  }

  const normalizedEvents = events.map((event) => normalizePluginAuditEventDefinition(event)) as unknown as TEvents;

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
    contract as unknown as Record<string, unknown>,
    moduleIamContractAllowedKeys,
    normalizedNamespace,
    normalizePluginIdentifier(contract.moduleId)
  );
  for (const systemRole of contract.systemRoles) {
    assertPluginContributionAllowedKeys(
      systemRole as unknown as Record<string, unknown>,
      moduleIamSystemRoleAllowedKeys,
      normalizedNamespace,
      normalizePluginIdentifier(systemRole.roleName)
    );
  }

  const normalizedContract = normalizePluginModuleIamContract(contract) as TContract;
  if (normalizedContract.moduleId !== normalizedNamespace) {
    throw new Error(`plugin_module_iam_module_id_mismatch:${normalizedNamespace}:${normalizedContract.moduleId}`);
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

export const createPluginRegistry = (
  plugins: readonly PluginDefinition[]
): ReadonlyMap<string, PluginDefinition> => {
  const registry = new Map<string, PluginDefinition>();

  for (const plugin of plugins) {
    assertPluginContributionAllowedKeys(
      plugin as unknown as Record<string, unknown>,
      pluginDefinitionAllowedKeys,
      normalizePluginIdentifier(plugin.id),
      normalizePluginIdentifier(plugin.id)
    );

    const trimmedId = plugin.id.trim();
    if (trimmedId.length === 0) {
      throw new Error('invalid_plugin_definition');
    }

    const id = normalizePluginNamespace(trimmedId);
    const displayName = plugin.displayName.trim();

    if (id.length === 0 || displayName.length === 0) {
      throw new Error('invalid_plugin_definition');
    }
    if (isReservedPluginNamespace(id)) {
      throw new Error(`reserved_plugin_namespace:${id}`);
    }
    if (registry.has(id)) {
      throw new Error(`duplicate_plugin:${id}`);
    }

    for (const action of plugin.actions ?? []) {
      assertPluginContributionAllowedKeys(
        action as unknown as Record<string, unknown>,
        actionDefinitionAllowedKeys,
        id,
        normalizePluginIdentifier(action.id)
      );
      assertPluginPermissionReference(plugin, id, action.id, action.requiredAction);
    }

    for (const route of plugin.routes) {
      assertPluginContributionAllowedKeys(
        route as unknown as Record<string, unknown>,
        routeDefinitionAllowedKeys,
        id,
        normalizePluginIdentifier(route.id)
      );
      assertPluginRoutePathAllowed(id, normalizePluginIdentifier(route.id), route.path);
      assertPluginPermissionReference(plugin, id, route.id, route.guard);

      const routeActionId = normalizePluginIdentifier(route.actionId ?? '');
      if (!routeActionId) {
        continue;
      }

      const parsed = parseNamespacedPluginIdentifier(routeActionId);
      if (parsed === undefined) {
        throw new Error(`invalid_plugin_route_action_id:${id}:${route.id}:${routeActionId}`);
      }
      if (parsed.namespace !== id) {
        throw new Error(`plugin_route_action_owner_mismatch:${id}:${route.id}:${routeActionId}`);
      }

      const action = resolvePluginActionDefinition(plugin, routeActionId);
      if (!action) {
        throw new Error(`plugin_route_action_missing:${id}:${route.id}:${routeActionId}`);
      }
      if (route.guard !== action.requiredAction) {
        throw new Error(`plugin_route_action_guard_mismatch:${id}:${route.id}:${routeActionId}`);
      }
    }

    if (pluginUsesStandardContentAdminResource(plugin)) {
      for (const route of plugin.routes) {
        if (isStandardCrudPluginRoute(id, route.path)) {
          throw createPluginGuardrailError({
            code: 'plugin_guardrail_route_bypass',
            pluginNamespace: id,
            contributionId: normalizePluginIdentifier(route.id),
            fieldOrReason: 'path',
          });
        }
      }
    }

    for (const navigationItem of plugin.navigation ?? []) {
      assertPluginContributionAllowedKeys(
        navigationItem as unknown as Record<string, unknown>,
        navigationItemAllowedKeys,
        id,
        normalizePluginIdentifier(navigationItem.id)
      );
      assertPluginPermissionReference(plugin, id, navigationItem.id, navigationItem.requiredAction);

      const navigationActionId = normalizePluginIdentifier(navigationItem.actionId ?? '');
      if (!navigationActionId) {
        continue;
      }

      const parsed = parseNamespacedPluginIdentifier(navigationActionId);
      if (parsed === undefined) {
        throw new Error(`invalid_plugin_navigation_action_id:${id}:${navigationItem.id}:${navigationActionId}`);
      }
      if (parsed.namespace !== id) {
        throw new Error(`plugin_navigation_action_owner_mismatch:${id}:${navigationItem.id}:${navigationActionId}`);
      }

      const action = resolvePluginActionDefinition(plugin, navigationActionId);
      if (!action) {
        throw new Error(`plugin_navigation_action_missing:${id}:${navigationItem.id}:${navigationActionId}`);
      }
      if (
        navigationItem.requiredAction &&
        action.requiredAction &&
        navigationItem.requiredAction !== action.requiredAction
      ) {
        throw new Error(`plugin_navigation_action_guard_mismatch:${id}:${navigationItem.id}:${navigationActionId}`);
      }
    }

    for (const permission of plugin.permissions ?? []) {
      assertPluginContributionAllowedKeys(
        permission as unknown as Record<string, unknown>,
        permissionDefinitionAllowedKeys,
        id,
        normalizePluginIdentifier(permission.id)
      );
      const normalizedPermission = normalizePluginPermissionDefinition(permission);
      const parsed = parseNamespacedPluginIdentifier(normalizedPermission.id);
      if (parsed === undefined) {
        throw new Error(`invalid_plugin_permission_id:${normalizedPermission.id}`);
      }
      if (parsed.namespace !== id) {
        throw new Error(`plugin_permission_namespace_mismatch:${id}:${parsed.namespace}:${normalizedPermission.id}`);
      }
    }

    for (const contentTypeDefinition of plugin.contentTypes ?? []) {
      const contributionId = normalizePluginIdentifier(contentTypeDefinition.contentType);
      assertPluginContributionAllowedKeys(
        contentTypeDefinition as unknown as Record<string, unknown>,
        contentTypeDefinitionAllowedKeys,
        id,
        contributionId
      );
      const normalizedContentType = normalizePluginIdentifier(contentTypeDefinition.contentType);
      const parsed = parseNamespacedPluginIdentifier(normalizedContentType);
      if (parsed === undefined) {
        throw new Error(`invalid_plugin_content_type:${normalizedContentType}`);
      }
      if (parsed.namespace !== id) {
        throw new Error(`plugin_content_type_namespace_mismatch:${id}:${parsed.namespace}:${normalizedContentType}`);
      }
    }

    for (const adminResource of plugin.adminResources ?? []) {
      const contributionId = normalizePluginIdentifier(adminResource.resourceId);
      assertPluginContributionAllowedKeys(
        adminResource as unknown as Record<string, unknown>,
        adminResourceDefinitionAllowedKeys,
        id,
        contributionId
      );
      const normalizedResourceId = normalizePluginIdentifier(adminResource.resourceId);
      const parsed = parseNamespacedPluginIdentifier(normalizedResourceId);
      if (parsed === undefined) {
        throw new Error(`invalid_plugin_admin_resource:${normalizedResourceId}`);
      }
      if (parsed.namespace !== id) {
        throw new Error(`plugin_admin_resource_namespace_mismatch:${id}:${parsed.namespace}:${normalizedResourceId}`);
      }
    }

    for (const eventDefinition of plugin.auditEvents ?? []) {
      const contributionId = normalizePluginIdentifier(eventDefinition.eventType);
      assertPluginContributionAllowedKeys(
        eventDefinition as unknown as Record<string, unknown>,
        auditEventDefinitionAllowedKeys,
        id,
        contributionId
      );
      const normalizedEventType = normalizePluginIdentifier(eventDefinition.eventType);
      const parsed = parseNamespacedPluginIdentifier(normalizedEventType);
      if (parsed === undefined) {
        throw new Error(`invalid_plugin_audit_event_type:${normalizedEventType}`);
      }
      if (parsed.namespace !== id) {
        throw new Error(`plugin_audit_event_namespace_mismatch:${id}:${parsed.namespace}:${normalizedEventType}`);
      }
    }

    if (plugin.moduleIam) {
      definePluginModuleIamContract(id, plugin.moduleIam);
    }

    registry.set(id, {
      ...plugin,
      id,
      displayName,
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

export const mergePluginPermissions = (
  plugins: readonly PluginDefinition[]
): readonly PluginPermissionDefinition[] => plugins.flatMap((plugin) => plugin.permissions ?? []);

export const mergePluginContentTypes = (
  plugins: readonly PluginDefinition[]
): readonly ContentTypeDefinition[] => plugins.flatMap((plugin) => plugin.contentTypes ?? []);

export const mergePluginAdminResourceDefinitions = (
  plugins: readonly PluginDefinition[]
): readonly PluginAdminResourceDefinition[] => plugins.flatMap((plugin) => plugin.adminResources ?? []);

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
    const normalizedContract = definePluginModuleIamContract(normalizedPluginNamespace, plugin.moduleIam);
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
): ReadonlyMap<string, PluginActionRegistryEntry> => {
  const registry = new Map<string, PluginActionRegistryEntry>();
  const pluginNamespaces = new Set<string>();

  for (const plugin of plugins) {
    const pluginNamespace = normalizePluginIdentifier(plugin.id);
    const pluginDisplayName = normalizePluginIdentifier(plugin.displayName);
    if (pluginNamespace.length === 0 || pluginDisplayName.length === 0) {
      throw new Error('invalid_plugin_definition');
    }
    if (isReservedPluginNamespace(pluginNamespace)) {
      throw new Error(`reserved_plugin_action_namespace:${pluginNamespace}`);
    }
    if (pluginNamespaces.has(pluginNamespace)) {
      throw new Error(`duplicate_plugin:${pluginNamespace}`);
    }

    pluginNamespaces.add(pluginNamespace);

    for (const action of plugin.actions ?? []) {
      assertPluginContributionAllowedKeys(
        action as unknown as Record<string, unknown>,
        actionDefinitionAllowedKeys,
        pluginNamespace,
        normalizePluginIdentifier(action.id)
      );
      const normalizedAction = normalizePluginActionDefinition(action);
      const actionId = normalizedAction.id;
      const actionTitleKey = normalizedAction.titleKey;
      const legacyAliases = normalizedAction.legacyAliases;
      if (actionTitleKey.length === 0) {
        throw new Error(`invalid_plugin_action_definition:${actionId}`);
      }

      const parsed = parseNamespacedPluginIdentifier(actionId);
      if (parsed === undefined) {
        throw new Error(`invalid_plugin_action_id:${actionId}`);
      }
      if (parsed.namespace !== pluginNamespace) {
        throw new Error(`plugin_action_namespace_mismatch:${pluginNamespace}:${parsed.namespace}:${actionId}`);
      }
      if (registry.has(actionId)) {
        throw new Error(`duplicate_plugin_action:${actionId}`);
      }

      registry.set(actionId, {
        actionId,
        namespace: parsed.namespace,
        actionName: parsed.name,
        ownerPluginId: pluginNamespace,
        titleKey: actionTitleKey,
        requiredAction: normalizedAction.requiredAction,
        featureFlag: normalizedAction.featureFlag,
        legacyAliases,
      });

      for (const legacyAlias of legacyAliases ?? []) {
        if (registry.has(legacyAlias)) {
          throw new Error(`duplicate_plugin_action:${legacyAlias}`);
        }

        registry.set(legacyAlias, {
          actionId,
          namespace: parsed.namespace,
          actionName: parsed.name,
          ownerPluginId: pluginNamespace,
          titleKey: actionTitleKey,
          requiredAction: normalizedAction.requiredAction,
          featureFlag: normalizedAction.featureFlag,
          legacyAliases,
          deprecatedAlias: legacyAlias,
        });
      }
    }
  }

  return registry;
};

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
        permission as unknown as Record<string, unknown>,
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
        eventDefinition as unknown as Record<string, unknown>,
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
  source: Readonly<Record<string, unknown>>
): Record<string, unknown> => {
  for (const [key, value] of Object.entries(source)) {
    if (isRecord(value) && isRecord(target[key])) {
      target[key] = mergeTranslationNode({ ...(target[key] as Record<string, unknown>) }, value);
      continue;
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
      merged[locale] = mergeTranslationNode(currentLocaleResources, resources);
    }
  }

  return merged;
};
