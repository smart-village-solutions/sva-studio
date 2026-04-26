import {
  GENERIC_CONTENT_TYPE,
  resolveIamContentCapabilityMapping,
  type ContentJsonValue,
  type IamContentDomainCapability,
} from '@sva/core';
import { assertPluginContributionAllowedKeys } from './guardrails.js';
import {
  isReservedPluginNamespace,
  normalizePluginIdentifier,
  normalizePluginNamespace,
  parseNamespacedPluginIdentifier,
} from './plugin-identifiers.js';

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
  readonly domainCapability: IamContentDomainCapability;
};

export type ContentTypeDefinition = {
  readonly contentType: string;
  readonly displayName: string;
  readonly editorFields?: readonly ContentTypeEditorFieldDefinition[];
  readonly listColumns?: readonly ContentTypeListColumnDefinition[];
  readonly actions?: readonly ContentTypeActionDefinition[];
  readonly validatePayload?: (payload: ContentJsonValue) => readonly string[];
};

const contentTypeDefinitionAllowedKeys = new Set([
  'contentType',
  'displayName',
  'editorFields',
  'listColumns',
  'actions',
  'validatePayload',
] as const);
const contentTypeActionDefinitionAllowedKeys = new Set(['key', 'label', 'domainCapability'] as const);

const normalizeContentTypeDefinition = (definition: ContentTypeDefinition): ContentTypeDefinition => ({
  ...definition,
  contentType: normalizePluginIdentifier(definition.contentType),
  displayName: definition.displayName.trim(),
  ...(definition.actions
    ? {
        actions: definition.actions.map((action) => ({
          ...action,
          key: action.key.trim(),
          label: action.label.trim(),
        })),
      }
    : {}),
});

const validateContentTypeActions = (definition: ContentTypeDefinition): void => {
  for (const action of definition.actions ?? []) {
    assertPluginContributionAllowedKeys(
      action as unknown as Record<string, unknown>,
      contentTypeActionDefinitionAllowedKeys,
      normalizePluginIdentifier(definition.contentType).split('.')[0] ?? 'host',
      `${normalizePluginIdentifier(definition.contentType)}.${action.key.trim()}`
    );

    if (action.key.trim().length === 0 || action.label.trim().length === 0) {
      throw new Error('invalid_content_type_action_definition');
    }

    const mapping = resolveIamContentCapabilityMapping(action.domainCapability);
    if (!mapping.ok) {
      throw new Error(`${mapping.reasonCode}:${definition.contentType}:${action.key.trim()}`);
    }
  }
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

export const definePluginContentTypes = <const TDefinitions extends readonly ContentTypeDefinition[]>(
  namespace: string,
  definitions: TDefinitions
): TDefinitions => {
  const normalizedNamespace = normalizePluginNamespace(namespace);
  if (isReservedPluginNamespace(normalizedNamespace)) {
    throw new Error(`reserved_plugin_namespace:${normalizedNamespace}`);
  }

  for (const definition of definitions) {
    assertPluginContributionAllowedKeys(
      definition as unknown as Record<string, unknown>,
      contentTypeDefinitionAllowedKeys,
      normalizedNamespace,
      normalizePluginIdentifier(definition.contentType)
    );
  }

  const normalizedDefinitions = definitions.map((definition) =>
    normalizeContentTypeDefinition(definition)
  ) as unknown as TDefinitions;

  for (const definition of normalizedDefinitions) {
    if (definition.contentType.length === 0 || definition.displayName.length === 0) {
      throw new Error('invalid_content_type_definition');
    }
    validateContentTypeActions(definition);

    const parsed = parseNamespacedPluginIdentifier(definition.contentType);
    if (parsed === undefined) {
      throw new Error(`invalid_plugin_content_type:${definition.contentType}`);
    }
    if (parsed.namespace !== normalizedNamespace) {
      throw new Error(
        `plugin_content_type_namespace_mismatch:${normalizedNamespace}:${parsed.namespace}:${definition.contentType}`
      );
    }
  }

  return normalizedDefinitions;
};

export const createContentTypeRegistry = (
  definitions: readonly ContentTypeDefinition[]
): ReadonlyMap<string, ContentTypeDefinition> => {
  const registry = new Map<string, ContentTypeDefinition>();

  for (const definition of definitions) {
    assertPluginContributionAllowedKeys(
      definition as unknown as Record<string, unknown>,
      contentTypeDefinitionAllowedKeys,
      normalizePluginIdentifier(definition.contentType).split('.')[0] ?? 'host',
      normalizePluginIdentifier(definition.contentType)
    );
    const normalizedDefinition = normalizeContentTypeDefinition(definition);
    const normalizedType = normalizedDefinition.contentType;
    const normalizedName = normalizedDefinition.displayName;
    if (normalizedType.length === 0 || normalizedName.length === 0) {
      throw new Error('invalid_content_type_definition');
    }
    validateContentTypeActions(normalizedDefinition);
    if (registry.has(normalizedType)) {
      throw new Error(`duplicate_content_type:${normalizedType}`);
    }
    registry.set(normalizedType, normalizedDefinition);
  }

  return registry;
};

export const getContentTypeDefinition = (
  registry: ReadonlyMap<string, ContentTypeDefinition>,
  contentType: string
): ContentTypeDefinition | undefined => registry.get(contentType.trim());
