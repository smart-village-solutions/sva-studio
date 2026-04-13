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

export type PluginTranslations = Readonly<Record<string, Readonly<Record<string, unknown>>>>;

export type PluginDefinition = {
  readonly id: string;
  readonly displayName: string;
  readonly routes: readonly PluginRouteDefinition[];
  readonly navigation?: readonly PluginNavigationItem[];
  readonly contentTypes?: readonly ContentTypeDefinition[];
  readonly translations?: PluginTranslations;
};

const normalizeIdentifier = (value: string) => value.trim();

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

export const mergePluginContentTypes = (
  plugins: readonly PluginDefinition[]
): readonly ContentTypeDefinition[] => plugins.flatMap((plugin) => plugin.contentTypes ?? []);

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
