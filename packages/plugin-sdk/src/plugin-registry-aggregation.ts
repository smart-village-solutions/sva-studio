import { trimTrailingSlashes, assertPluginContributionAllowedKeys } from './guardrails.js';
import { normalizePluginAccessRequirement } from './plugin-platform/access-requirements.js';
import {
  definePluginModuleIamContract,
  permissionDefinitionAllowedKeys,
  auditEventDefinitionAllowedKeys,
  normalizePluginPermissionDefinition,
  normalizePluginAuditEventDefinition,
} from './plugin-iam-definitions.js';
import type { ContentTypeDefinition } from './content-types.js';
import {
  isReservedPluginNamespace,
  normalizePluginIdentifier,
  normalizePluginNamespace,
  parseNamespacedPluginIdentifier,
} from './plugin-identifiers.js';
import { buildPluginActionRegistry } from './plugin-platform/plugin-actions.js';

import type {
  PluginActionRegistryEntry,
  PluginServerHandlerRegistryEntry,
  PluginAuditEventRegistryEntry,
  PluginPermissionRegistryEntry,
  PluginModuleIamRegistryEntry,
} from './plugin-registry-types.js';
import type {
  PluginRouteDefinition,
  PluginNavigationItem,
  PluginActionDefinition,
  PluginPermissionDefinition,
  PluginAuditEventDefinition,
  PluginAdminResourceDefinition,
  PluginDefinition,
} from './plugin-definition-types.js';
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
