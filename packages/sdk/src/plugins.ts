import type { ContentTypeDefinition } from './content-types.js';

export type PluginRouteGuard = 'content.read' | 'content.create' | 'content.write';

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

export type PluginTranslations = Readonly<Record<string, Readonly<Record<string, unknown>>>>;

export type PluginDefinition = {
  readonly id: string;
  readonly displayName: string;
  readonly routes: readonly PluginRouteDefinition[];
  readonly navigation?: readonly PluginNavigationItem[];
  readonly actions?: readonly PluginActionDefinition[];
  readonly contentTypes?: readonly ContentTypeDefinition[];
  readonly translations?: PluginTranslations;
};

const normalizeIdentifier = (value: string) => value.trim();
const ACTION_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*\.[a-z0-9]+(?:-[a-z0-9]+)*$/;
const LEGACY_ACTION_ALIAS_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
/**
 * Reserved namespaces that are not owned by plugins.
 *
 * Plugin actions must use plugin-owned namespaces. Core/host actions follow the
 * same fully-qualified naming model, but their namespaces are governed outside
 * of the plugin SDK.
 */
const RESERVED_ACTION_NAMESPACES = ['content', 'iam', 'core'] as const;

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

const parseActionSegments = (actionId: string): { namespace: string; actionName: string } | undefined => {
  if (ACTION_ID_PATTERN.test(actionId) === false) {
    return undefined;
  }

  const separatorIndex = actionId.indexOf('.');

  return {
    namespace: actionId.slice(0, separatorIndex),
    actionName: actionId.slice(separatorIndex + 1),
  };
};

const isReservedNamespace = (namespace: string): boolean =>
  RESERVED_ACTION_NAMESPACES.includes(namespace as (typeof RESERVED_ACTION_NAMESPACES)[number]);

const normalizeLegacyAliases = (
  actionId: string,
  aliases: readonly string[] | undefined
): readonly string[] | undefined => {
  if (!aliases || aliases.length === 0) {
    return undefined;
  }

  const normalizedAliases = aliases.map((alias) => normalizeIdentifier(alias));
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
  const actionId = normalizeIdentifier(action.id);
  const titleKey = normalizeIdentifier(action.titleKey);

  return {
    ...action,
    id: actionId,
    titleKey,
    featureFlag: normalizeIdentifier(action.featureFlag ?? '') || undefined,
    legacyAliases: normalizeLegacyAliases(actionId, action.legacyAliases),
  };
};

const resolvePluginActionDefinition = (
  plugin: PluginDefinition,
  actionId: string
): PluginActionDefinition | undefined => plugin.actions?.find((action) => normalizeIdentifier(action.id) === actionId);

export const createPluginRegistry = (
  plugins: readonly PluginDefinition[]
): ReadonlyMap<string, PluginDefinition> => {
  const registry = new Map<string, PluginDefinition>();

  for (const plugin of plugins) {
    const id = normalizeIdentifier(plugin.id);
    const displayName = plugin.displayName.trim();

    if (id.length === 0 || displayName.length === 0) {
      throw new Error('invalid_plugin_definition');
    }

    if (registry.has(id)) {
      throw new Error(`duplicate_plugin:${id}`);
    }

    for (const route of plugin.routes) {
      const routeActionId = normalizeIdentifier(route.actionId ?? '');
      if (!routeActionId) {
        continue;
      }

      const parsed = parseActionSegments(routeActionId);
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

    for (const navigationItem of plugin.navigation ?? []) {
      const navigationActionId = normalizeIdentifier(navigationItem.actionId ?? '');
      if (!navigationActionId) {
        continue;
      }

      const parsed = parseActionSegments(navigationActionId);
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

export const mergePluginContentTypes = (
  plugins: readonly PluginDefinition[]
): readonly ContentTypeDefinition[] => plugins.flatMap((plugin) => plugin.contentTypes ?? []);

export const definePluginActions = <const TActions extends readonly PluginActionDefinition[]>(
  namespace: string,
  actions: TActions
): TActions => {
  const normalizedNamespace = normalizeIdentifier(namespace);
  if (normalizedNamespace.length === 0) {
    throw new Error('invalid_plugin_action_namespace');
  }
  if (isReservedNamespace(normalizedNamespace)) {
    throw new Error(`reserved_plugin_action_namespace:${normalizedNamespace}`);
  }

  const normalizedActions = actions.map((action) => normalizePluginActionDefinition(action)) as TActions;

  for (const action of normalizedActions) {
    const normalizedActionId = action.id;
    const normalizedTitleKey = action.titleKey;
    const parsed = parseActionSegments(normalizedActionId);
    if (parsed === undefined) {
      throw new Error(`invalid_plugin_action_id:${normalizedActionId}`);
    }
    if (normalizedTitleKey.length === 0) {
      throw new Error(`invalid_plugin_action_definition:${normalizedActionId}`);
    }
    if (parsed.namespace !== normalizedNamespace) {
      throw new Error(
        `plugin_action_namespace_mismatch:${normalizedNamespace}:${parsed.namespace}:${normalizedActionId}`
      );
    }
  }

  return normalizedActions;
};

export const createPluginActionRegistry = (
  plugins: readonly PluginDefinition[]
): ReadonlyMap<string, PluginActionRegistryEntry> => {
  const registry = new Map<string, PluginActionRegistryEntry>();
  const pluginNamespaces = new Set<string>();

  for (const plugin of plugins) {
    const pluginNamespace = normalizeIdentifier(plugin.id);
    const pluginDisplayName = normalizeIdentifier(plugin.displayName);
    if (pluginNamespace.length === 0 || pluginDisplayName.length === 0) {
      throw new Error('invalid_plugin_definition');
    }
    if (isReservedNamespace(pluginNamespace)) {
      throw new Error(`reserved_plugin_action_namespace:${pluginNamespace}`);
    }
    if (pluginNamespaces.has(pluginNamespace)) {
      throw new Error(`duplicate_plugin:${pluginNamespace}`);
    }

    pluginNamespaces.add(pluginNamespace);

    for (const action of plugin.actions ?? []) {
      const normalizedAction = normalizePluginActionDefinition(action);
      const actionId = normalizedAction.id;
      const actionTitleKey = normalizedAction.titleKey;
      const legacyAliases = normalizedAction.legacyAliases;
      if (actionTitleKey.length === 0) {
        throw new Error(`invalid_plugin_action_definition:${actionId}`);
      }
      const parsed = parseActionSegments(actionId);
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
        actionName: parsed.actionName,
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
          actionName: parsed.actionName,
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

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && Array.isArray(value) === false;

const mergeTranslationNode = (
  target: Record<string, unknown>,
  source: Readonly<Record<string, unknown>>
): Record<string, unknown> => {
  for (const [key, value] of Object.entries(source)) {
    if (isRecord(value) && isRecord(target[key])) {
      target[key] = mergeTranslationNode(
        { ...(target[key] as Record<string, unknown>) },
        value
      );
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
