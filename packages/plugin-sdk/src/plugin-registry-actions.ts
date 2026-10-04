import type {
  PluginDefinition,
  PluginServerHandlerDefinition,
  PluginTechnicalServiceAccessRequirement,
} from './plugin-definition-types.js';
import { assertPluginContributionAllowedKeys, trimTrailingSlashes } from './guardrails.js';
import {
  isReservedPluginNamespace,
  normalizePluginIdentifier,
  normalizePluginNamespace,
  parseNamespacedPluginIdentifier,
} from './plugin-identifiers.js';
import { hasMatchingPluginAccessRequirement } from './plugin-platform/access-requirements.js';
import { type PluginExtensionTier } from './plugin-platform/contracts.js';
import { assertPluginActionDefinitionAllowedKeys } from './plugin-platform/plugin-actions.js';
import {
  assertOwnedPluginActionReference,
  assertPluginAccessRequirement,
  assertPluginPermissionReference,
} from './plugin-definition-validation.js';

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
const serverHandlerDefinitionAllowedKeys = new Set([
  'id',
  'path',
  'method',
  'actionId',
  'accessRequirement',
] as const);
export type PluginRegistryValidationContext = {
  readonly plugin: PluginDefinition;
  readonly pluginNamespace: string;
  readonly displayName: string;
  readonly extensionTier: PluginExtensionTier;
};

export const createPluginRegistryValidationContext = (
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

export const assertPluginRegistryActions = ({
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

export const assertPluginRegistryServerHandlers = ({
  plugin,
  pluginNamespace,
  extensionTier,
}: PluginRegistryValidationContext): void => {
  const supportedMethods = new Set<string>(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);
  const handlerIds = new Set<string>();
  const userPathPrefix = `/api/v1/plugins/${pluginNamespace}`;
  const domainPathPrefix = `/api/v1/${pluginNamespace}`;
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
      : normalizedPath === userPathPrefix ||
        normalizedPath.startsWith(`${userPathPrefix}/`) ||
        normalizedPath === domainPathPrefix ||
        normalizedPath.startsWith(`${domainPathPrefix}/`);
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
