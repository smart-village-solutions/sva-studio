import { assertPluginContributionAllowedKeys } from './guardrails.js';
import {
  isReservedPluginNamespace,
  normalizePluginIdentifier,
  normalizePluginNamespace,
  parseNamespacedPluginIdentifier,
} from './plugin-identifiers.js';
import type {
  PluginAuditEventDefinition,
  PluginModuleIamContract,
  PluginModuleIamSystemRoleDefinition,
  PluginPermissionDefinition,
} from './plugin-definition-types.js';

export const permissionDefinitionAllowedKeys = new Set([
  'id',
  'titleKey',
  'descriptionKey',
] as const);

export const auditEventDefinitionAllowedKeys = new Set(['eventType', 'titleKey'] as const);
const moduleIamContractAllowedKeys = new Set(['moduleId', 'permissionIds', 'systemRoles'] as const);
const moduleIamSystemRoleAllowedKeys = new Set(['roleName', 'permissionIds'] as const);

export const normalizePluginPermissionDefinition = (
  permission: PluginPermissionDefinition
): PluginPermissionDefinition => ({
  ...permission,
  id: normalizePluginIdentifier(permission.id),
  titleKey: normalizePluginIdentifier(permission.titleKey),
  descriptionKey: normalizePluginIdentifier(permission.descriptionKey ?? '') || undefined,
});

export const normalizePluginAuditEventDefinition = (
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
