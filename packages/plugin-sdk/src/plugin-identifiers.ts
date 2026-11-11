const NAMESPACED_IDENTIFIER_PATTERN =
  /^[a-z0-9]+(?:-[a-z0-9]+)*\.[a-z][A-Za-z0-9]*(?:-[a-z0-9]+)*(?:\.[a-z][A-Za-z0-9]*(?:-[a-z0-9]+)*)*$/;
const PLUGIN_NAMESPACE_PATTERN = /^[a-z][a-z0-9-]{1,30}$/;

export const RESERVED_PLUGIN_NAMESPACES = [
  'content',
  'iam',
  'admin',
  'core',
  'system',
  'platform',
] as const;
const reservedPluginNamespaces = new Set<string>(RESERVED_PLUGIN_NAMESPACES);

export const normalizePluginIdentifier = (value: string): string => value.trim();

/**
 * Single source of the plugin namespace rule. Checks the exact value; use
 * `normalizePluginNamespace` to trim before validating.
 */
export const isValidPluginNamespace = (value: string): boolean =>
  PLUGIN_NAMESPACE_PATTERN.test(value);

export const normalizePluginNamespace = (value: string): string => {
  const normalized = value.trim();

  if (normalized.length === 0) {
    throw new Error('invalid_plugin_namespace');
  }
  if (isValidPluginNamespace(normalized) === false) {
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
  reservedPluginNamespaces.has(namespace);
