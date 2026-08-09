import type { ContentTypeDefinition } from './content-types.js';

export const validateMainserverGenericType = (definition: ContentTypeDefinition): void => {
  if (definition.mainserverGenericType === undefined) return;
  if (
    definition.mainserverGenericType.length === 0 ||
    definition.mainserverGenericType.trim() !== definition.mainserverGenericType
  ) {
    throw new Error(`invalid_mainserver_generic_type:${definition.contentType}`);
  }
};

export const createMainserverGenericTypeRegistry = (
  definitions: readonly ContentTypeDefinition[]
): ReadonlyMap<string, string> => {
  const registry = new Map<string, string>();
  for (const definition of definitions) {
    const genericType = definition.mainserverGenericType;
    if (genericType === undefined) continue;
    validateMainserverGenericType(definition);
    const existingContentType = registry.get(genericType);
    if (existingContentType) {
      throw new Error(
        `duplicate_mainserver_generic_type:${genericType}:${existingContentType}:${definition.contentType}`
      );
    }
    registry.set(genericType, definition.contentType);
  }
  return registry;
};

export const resolveMainserverGenericItemContentType = (
  registry: ReadonlyMap<string, string>,
  genericType: string,
  fallbackContentType: string
): string => registry.get(genericType) ?? fallbackContentType;
