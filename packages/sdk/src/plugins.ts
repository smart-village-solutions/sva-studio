import type { ContentTypeDefinition } from './content-types.js';

export type PluginRouteGuard = 'content.read' | 'content.create' | 'content.write';

export type PluginNavigationSection = 'dataManagement' | 'applications' | 'system';

export type PluginRouteDefinition = {
  readonly id: string;
  readonly path: string;
  readonly guard?: PluginRouteGuard;
  readonly component: (...args: never[]) => unknown;
};

export type PluginNavigationItem = {
  readonly id: string;
  readonly to: string;
  readonly titleKey: string;
  readonly section: PluginNavigationSection;
  readonly requiredAction?: PluginRouteGuard;
};

export type PluginActionDefinition = {
  readonly id: string;
  readonly titleKey: string;
  readonly requiredAction?: PluginRouteGuard;
  readonly featureFlag?: string;
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
const ACTION_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*(?:\.[a-z0-9]+(?:-[a-z0-9]+)*)+$/;
const RESERVED_ACTION_NAMESPACES = ['core'] as const;

export type PluginActionRegistryEntry = {
  readonly actionId: string;
  readonly namespace: string;
  readonly actionName: string;
  readonly ownerPluginId: string;
  readonly titleKey: string;
  readonly requiredAction?: PluginRouteGuard;
  readonly featureFlag?: string;
};

const parseActionSegments = (actionId: string): { namespace: string; actionName: string } | undefined => {
  if (ACTION_ID_PATTERN.test(actionId) === false) {
    return undefined;
  }

  const separatorIndex = actionId.indexOf('.');
  if (separatorIndex <= 0 || separatorIndex >= actionId.length - 1) {
    return undefined;
  }

  return {
    namespace: actionId.slice(0, separatorIndex),
    actionName: actionId.slice(separatorIndex + 1),
  };
};

const isReservedNamespace = (namespace: string): boolean =>
  RESERVED_ACTION_NAMESPACES.includes(namespace as (typeof RESERVED_ACTION_NAMESPACES)[number]);

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

  for (const action of actions) {
    const normalizedActionId = normalizeIdentifier(action.id);
    const parsed = parseActionSegments(normalizedActionId);
    if (parsed === undefined) {
      throw new Error(`invalid_plugin_action_id:${normalizedActionId}`);
    }
    if (parsed.namespace !== normalizedNamespace) {
      throw new Error(
        `plugin_action_namespace_mismatch:${normalizedNamespace}:${parsed.namespace}:${normalizedActionId}`
      );
    }
  }

  return actions;
};

export const createPluginActionRegistry = (
  plugins: readonly PluginDefinition[]
): ReadonlyMap<string, PluginActionRegistryEntry> => {
  const registry = new Map<string, PluginActionRegistryEntry>();

  for (const plugin of plugins) {
    const pluginNamespace = normalizeIdentifier(plugin.id);
    if (pluginNamespace.length === 0) {
      throw new Error('invalid_plugin_definition');
    }
    if (isReservedNamespace(pluginNamespace)) {
      throw new Error(`reserved_plugin_action_namespace:${pluginNamespace}`);
    }

    for (const action of plugin.actions ?? []) {
      const actionId = normalizeIdentifier(action.id);
      const actionTitleKey = normalizeIdentifier(action.titleKey);
      if (actionTitleKey.length === 0) {
        throw new Error(`invalid_plugin_action_definition:${actionId}`);
      }
      const parsed = parseActionSegments(actionId);
      if (parsed === undefined) {
        throw new Error(`invalid_plugin_action_id:${actionId}`);
      }

      if (parsed.namespace !== pluginNamespace) {
        throw new Error(`plugin_action_owner_mismatch:${pluginNamespace}:${actionId}`);
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
        requiredAction: action.requiredAction,
        featureFlag: action.featureFlag ? normalizeIdentifier(action.featureFlag) : undefined,
      });
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
