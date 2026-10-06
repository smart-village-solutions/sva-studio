import type { UiAccessRequirement } from '@sva/iam-core';
import type {
  PluginActionDefinition,
  PluginDefinition,
  PluginPermissionDefinition,
} from './plugin-definition-types.js';
import { trimTrailingSlashes } from './guardrails.js';
import {
  isReservedPluginNamespace,
  normalizePluginIdentifier,
  normalizePluginNamespace,
  parseNamespacedPluginIdentifier,
} from './plugin-identifiers.js';
import {
  PLUGIN_PLATFORM_ADMIN_ROLE,
  type PluginExtensionTier,
} from './plugin-platform/contracts.js';
import {
  assertPluginActionDefinitionAllowedKeys,
  normalizePluginActionDefinition,
} from './plugin-platform/plugin-actions.js';

export const resolvePluginActionDefinition = (
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

export const assertPluginPermissionReference = (
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

const assertPlatformAccessRequirement = (
  requirement: Extract<UiAccessRequirement, { kind: 'platform' }>,
  pluginNamespace: string,
  source: string,
  legacyRequiredAction: string | undefined,
  extensionTier: PluginExtensionTier,
  allowPlatform: boolean
): void => {
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
};

export const assertPluginAccessRequirement = (
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
    assertPlatformAccessRequirement(
      requirement,
      pluginNamespace,
      source,
      legacyRequiredAction,
      extensionTier,
      allowPlatform
    );
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

export const isStandardCrudPluginRoute = (pluginNamespace: string, path: string): boolean => {
  const normalizedPath = trimTrailingSlashes(path.trim()) || '/';
  const pluginRoot = `/plugins/${pluginNamespace}`;

  if (normalizedPath === pluginRoot || normalizedPath === `${pluginRoot}/new`) {
    return true;
  }

  // fallow-ignore-next-line security-sink -- pluginNamespace is constrained by PLUGIN_NAMESPACE_PATTERN before registry routes reach this function.
  const detailPattern = new RegExp(`^${pluginRoot.replace('/', '\\/')}/\\$[a-zA-Z][a-zA-Z0-9]*$`);
  return detailPattern.test(normalizedPath);
};

export const pluginUsesStandardContentAdminResource = (plugin: PluginDefinition): boolean =>
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

export const assertOwnedPluginActionReference = (
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
