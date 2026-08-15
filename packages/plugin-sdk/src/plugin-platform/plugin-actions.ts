/**
 * Internal validation and materialization phases for plugin action registries.
 *
 * The exported package facade remains in `plugins.ts`; this module owns the pure,
 * deterministic action validation order and registry entry construction.
 */
import { assertPluginContributionAllowedKeys } from '../guardrails.js';
import {
  isReservedPluginNamespace,
  normalizePluginIdentifier,
  parseNamespacedPluginIdentifier,
} from '../plugin-identifiers.js';
import type {
  PluginActionDefinition,
  PluginActionRegistryEntry,
  PluginDefinition,
} from '../plugins.js';

const LEGACY_ACTION_ALIAS_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const actionDefinitionAllowedKeys = new Set([
  'id',
  'titleKey',
  'requiredAction',
  'accessRequirement',
  'featureFlag',
  'legacyAliases',
] as const);

export const assertPluginActionDefinitionAllowedKeys = (
  action: PluginActionDefinition,
  pluginNamespace: string
): void => {
  assertPluginContributionAllowedKeys(
    action,
    actionDefinitionAllowedKeys,
    pluginNamespace,
    normalizePluginIdentifier(action.id)
  );
};

const normalizeLegacyAliases = (
  actionId: string,
  aliases: readonly string[] | undefined
): readonly string[] | undefined => {
  if (!aliases || aliases.length === 0) {
    return undefined;
  }

  const normalizedAliases = aliases.map((alias) => normalizePluginIdentifier(alias));
  if (
    normalizedAliases.some(
      (alias) => alias.length === 0 || LEGACY_ACTION_ALIAS_PATTERN.test(alias) === false
    )
  ) {
    throw new Error(`invalid_plugin_action_alias:${actionId}`);
  }
  if (normalizedAliases.some((alias) => alias === actionId)) {
    throw new Error(`duplicate_plugin_action_alias:${actionId}:${actionId}`);
  }

  const uniqueAliases = [...new Set(normalizedAliases)];
  if (uniqueAliases.length !== normalizedAliases.length) {
    const duplicateAlias = normalizedAliases.find(
      (alias, index) => normalizedAliases.indexOf(alias) !== index
    );
    throw new Error(`duplicate_plugin_action_alias:${actionId}:${duplicateAlias}`);
  }

  return uniqueAliases;
};

export const normalizePluginActionDefinition = (
  action: PluginActionDefinition
): PluginActionDefinition => {
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

const createRegistryEntry = (
  action: PluginActionDefinition,
  pluginNamespace: string,
  parsedAction: Readonly<{ namespace: string; name: string }>
): PluginActionRegistryEntry => ({
  actionId: action.id,
  namespace: parsedAction.namespace,
  actionName: parsedAction.name,
  ownerPluginId: pluginNamespace,
  titleKey: action.titleKey,
  requiredAction: action.requiredAction,
  accessRequirement: action.accessRequirement,
  featureFlag: action.featureFlag,
  legacyAliases: action.legacyAliases,
});

const registerAction = (
  registry: Map<string, PluginActionRegistryEntry>,
  pluginNamespace: string,
  action: PluginActionDefinition
): void => {
  assertPluginActionDefinitionAllowedKeys(action, pluginNamespace);
  const normalizedAction = normalizePluginActionDefinition(action);
  const actionId = normalizedAction.id;
  if (normalizedAction.titleKey.length === 0) {
    throw new Error(`invalid_plugin_action_definition:${actionId}`);
  }

  const parsedAction = parseNamespacedPluginIdentifier(actionId);
  if (parsedAction === undefined) {
    throw new Error(`invalid_plugin_action_id:${actionId}`);
  }
  if (parsedAction.namespace !== pluginNamespace) {
    throw new Error(
      `plugin_action_namespace_mismatch:${pluginNamespace}:${parsedAction.namespace}:${actionId}`
    );
  }
  if (registry.has(actionId)) {
    throw new Error(`duplicate_plugin_action:${actionId}`);
  }

  const registryEntry = createRegistryEntry(normalizedAction, pluginNamespace, parsedAction);
  registry.set(actionId, registryEntry);

  for (const legacyAlias of normalizedAction.legacyAliases ?? []) {
    if (registry.has(legacyAlias)) {
      throw new Error(`duplicate_plugin_action:${legacyAlias}`);
    }
    registry.set(legacyAlias, {
      ...registryEntry,
      deprecatedAlias: legacyAlias,
    });
  }
};

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
      registerAction(registry, pluginNamespace, action);
    }
  }

  return registry;
};
