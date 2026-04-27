const NAMESPACED_IDENTIFIER_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*\.[a-z0-9]+(?:-[a-z0-9]+)*$/;
const PLUGIN_NAMESPACE_PATTERN = /^[a-z][a-z0-9-]{1,30}$/;

export const RESERVED_PLUGIN_NAMESPACES = ['content', 'iam', 'admin', 'core', 'system', 'platform'] as const;

export const normalizePluginIdentifier = (value: string): string => value.trim();

export const normalizePluginNamespace = (value: string): string => {
  const normalized = value.trim();

  if (normalized.length === 0) {
    throw new Error('invalid_plugin_namespace');
  }
  if (PLUGIN_NAMESPACE_PATTERN.test(normalized) === false) {
    throw new Error(`invalid_plugin_namespace:${normalized}`);
  }

  return normalized;
};

export const parseNamespacedPluginIdentifier = (
  identifier: string
): { namespace: string; name: string } | undefined => {
  if (NAMESPACED_IDENTIFIER_PATTERN.test(identifier) === false) {
    return undefined;
  }

  const separatorIndex = identifier.indexOf('.');

  return {
    namespace: identifier.slice(0, separatorIndex),
    name: identifier.slice(separatorIndex + 1),
  };
};

export const isReservedPluginNamespace = (namespace: string): boolean =>
  RESERVED_PLUGIN_NAMESPACES.includes(namespace as (typeof RESERVED_PLUGIN_NAMESPACES)[number]);
