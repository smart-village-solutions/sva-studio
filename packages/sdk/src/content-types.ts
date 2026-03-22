import type { ContentJsonValue } from '@sva/core';

const GENERIC_CONTENT_TYPE = 'generic';

export type ContentTypeEditorFieldKind = 'json' | 'text' | 'textarea' | 'datetime';

export type ContentTypeEditorFieldDefinition = {
  readonly key: string;
  readonly label: string;
  readonly kind: ContentTypeEditorFieldKind;
  readonly description?: string;
};

export type ContentTypeListColumnDefinition = {
  readonly key: string;
  readonly label: string;
};

export type ContentTypeActionDefinition = {
  readonly key: string;
  readonly label: string;
};

export type ContentTypeDefinition = {
  readonly contentType: string;
  readonly displayName: string;
  readonly editorFields?: readonly ContentTypeEditorFieldDefinition[];
  readonly listColumns?: readonly ContentTypeListColumnDefinition[];
  readonly actions?: readonly ContentTypeActionDefinition[];
  readonly validatePayload?: (payload: ContentJsonValue) => readonly string[];
};

export const genericContentTypeDefinition: ContentTypeDefinition = {
  contentType: GENERIC_CONTENT_TYPE,
  displayName: 'Generischer Inhalt',
  editorFields: [
    {
      key: 'payload',
      label: 'Payload',
      kind: 'json',
      description: 'Rohes JSON-Feld für generische Inhalte.',
    },
  ],
};

export const createContentTypeRegistry = (
  definitions: readonly ContentTypeDefinition[]
): ReadonlyMap<string, ContentTypeDefinition> => {
  const registry = new Map<string, ContentTypeDefinition>();

  for (const definition of definitions) {
    const normalizedType = definition.contentType.trim();
    const normalizedName = definition.displayName.trim();
    if (normalizedType.length === 0 || normalizedName.length === 0) {
      throw new Error('invalid_content_type_definition');
    }
    if (registry.has(normalizedType)) {
      throw new Error(`duplicate_content_type:${normalizedType}`);
    }
    registry.set(normalizedType, {
      ...definition,
      contentType: normalizedType,
      displayName: normalizedName,
    });
  }

  return registry;
};

export const getContentTypeDefinition = (
  registry: ReadonlyMap<string, ContentTypeDefinition>,
  contentType: string
): ContentTypeDefinition | undefined => registry.get(contentType.trim());
