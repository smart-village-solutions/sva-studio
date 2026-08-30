import {
  normalizePluginIdentifier,
  parseNamespacedPluginIdentifier,
} from '../plugin-identifiers.js';

export const assertOwnedNamespacedIdentifier = (
  pluginNamespace: string,
  identifier: string,
  invalidCode: string,
  mismatchCode: string
): string => {
  const normalizedIdentifier = normalizePluginIdentifier(identifier);
  const parsed = parseNamespacedPluginIdentifier(normalizedIdentifier);
  if (!parsed) throw new Error(`${invalidCode}:${normalizedIdentifier}`);
  if (parsed.namespace !== pluginNamespace) {
    throw new Error(
      `${mismatchCode}:${pluginNamespace}:${parsed.namespace}:${normalizedIdentifier}`
    );
  }
  return normalizedIdentifier;
};
