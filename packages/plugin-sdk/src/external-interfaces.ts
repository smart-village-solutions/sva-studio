import { assertPluginContributionAllowedKeys } from './guardrails.js';
import { normalizePluginIdentifier, normalizePluginNamespace, parseNamespacedPluginIdentifier } from './plugin-identifiers.js';
import type { PluginDefinition } from './plugins.js';

export type PluginExternalInterfaceTypeDefinition = Readonly<{
  typeKey: string;
  displayName: string;
  category: 'api' | 'object_storage' | 'database' | 'feed';
  publicSchema: Readonly<Record<string, unknown>>;
  secretSchema: Readonly<Record<string, unknown>>;
  statusCheckKind: string;
  enabled?: boolean;
}>;

export type PluginExternalInterfaceTypeRegistryEntry = PluginExternalInterfaceTypeDefinition &
  Readonly<{
    namespace: string;
    ownerPluginId: string;
  }>;

const externalInterfaceTypeAllowedKeys = new Set([
  'typeKey',
  'displayName',
  'category',
  'publicSchema',
  'secretSchema',
  'statusCheckKind',
  'enabled',
] as const);

const normalizeExternalInterfaceTypeDefinition = (
  definition: PluginExternalInterfaceTypeDefinition
): PluginExternalInterfaceTypeDefinition => ({
  ...definition,
  typeKey: normalizePluginIdentifier(definition.typeKey),
  displayName: definition.displayName.trim(),
  statusCheckKind: normalizePluginIdentifier(definition.statusCheckKind),
  enabled: definition.enabled ?? true,
});

export const definePluginExternalInterfaceTypes = <
  const TExternalInterfaceTypes extends readonly PluginExternalInterfaceTypeDefinition[],
>(
  namespace: string,
  externalInterfaceTypes: TExternalInterfaceTypes
): TExternalInterfaceTypes => {
  const normalizedNamespace = normalizePluginNamespace(namespace);

  const normalized = externalInterfaceTypes.map((definition) => {
    assertPluginContributionAllowedKeys(
      definition,
      externalInterfaceTypeAllowedKeys,
      normalizedNamespace,
      normalizePluginIdentifier(definition.typeKey)
    );

    const normalizedDefinition = normalizeExternalInterfaceTypeDefinition(definition);
    const parsed = parseNamespacedPluginIdentifier(normalizedDefinition.typeKey);
    if (!parsed) {
      throw new Error(`invalid_plugin_external_interface_type:${normalizedDefinition.typeKey}`);
    }
    if (parsed.namespace !== normalizedNamespace) {
      throw new Error(
        `plugin_external_interface_type_namespace_mismatch:${normalizedNamespace}:${parsed.namespace}:${normalizedDefinition.typeKey}`
      );
    }
    if (normalizedDefinition.displayName.length === 0 || normalizedDefinition.statusCheckKind.length === 0) {
      throw new Error(`invalid_plugin_external_interface_type:${normalizedDefinition.typeKey}`);
    }

    return normalizedDefinition;
  });

  return normalized as unknown as TExternalInterfaceTypes;
};

export const mergePluginExternalInterfaceTypes = (
  plugins: readonly PluginDefinition[]
): readonly PluginExternalInterfaceTypeDefinition[] => plugins.flatMap((plugin) => plugin.externalInterfaceTypes ?? []);

export const createPluginExternalInterfaceTypeRegistry = (
  plugins: readonly PluginDefinition[]
): ReadonlyMap<string, PluginExternalInterfaceTypeRegistryEntry> => {
  const registry = new Map<string, PluginExternalInterfaceTypeRegistryEntry>();

  for (const plugin of plugins) {
    const namespace = normalizePluginNamespace(plugin.id);
    for (const definition of plugin.externalInterfaceTypes ?? []) {
      if (registry.has(definition.typeKey)) {
        throw new Error(`duplicate_plugin_external_interface_type:${definition.typeKey}`);
      }

      registry.set(definition.typeKey, {
        ...definition,
        namespace,
        ownerPluginId: plugin.id,
      });
    }
  }

  return registry;
};
