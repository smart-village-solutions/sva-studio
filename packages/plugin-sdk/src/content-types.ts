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

export type StudioContentTypeDefinition = {
  readonly description?: string;
  readonly icon?: string;
  readonly requiredReadAction: string;
  readonly requiredCreateAction: string;
  readonly createPath: string;
  readonly detailPath: string;
};

export type RegisteredStudioContentType = StudioContentTypeDefinition & {
  readonly contentType: string;
  readonly displayName: string;
};

export type ContentTypeDefinition = {
  readonly contentType: string;
  readonly displayName: string;
  readonly studioContentType?: StudioContentTypeDefinition;
  readonly editorFields?: readonly ContentTypeEditorFieldDefinition[];
  readonly listColumns?: readonly ContentTypeListColumnDefinition[];
  readonly actions?: readonly ContentTypeActionDefinition[];
  readonly validatePayload?: (payload: ContentJsonValue) => readonly string[];
};

const contentTypeDefinitionAllowedKeys = new Set([
  'contentType',
  'displayName',
  'studioContentType',
  'editorFields',
  'listColumns',
  'actions',
  'validatePayload',
] as const);
const contentTypeActionDefinitionAllowedKeys = new Set(['key', 'label', 'domainCapability'] as const);
const studioContentTypeDefinitionAllowedKeys = new Set([
  'description',
  'icon',
  'requiredReadAction',
  'requiredCreateAction',
  'createPath',
  'detailPath',
] as const);

const normalizeStudioContentTypeDefinition = (
  definition: StudioContentTypeDefinition
): StudioContentTypeDefinition => ({
  description: definition.description?.trim() || undefined,
  icon: definition.icon?.trim() || undefined,
  requiredReadAction: normalizePluginIdentifier(definition.requiredReadAction),
  requiredCreateAction: normalizePluginIdentifier(definition.requiredCreateAction),
  createPath: definition.createPath.trim(),
  detailPath: definition.detailPath.trim(),
});

const normalizeContentTypeDefinition = (definition: ContentTypeDefinition): ContentTypeDefinition => ({
  ...definition,
  contentType: normalizePluginIdentifier(definition.contentType),
  displayName: definition.displayName.trim(),
  studioContentType: definition.studioContentType
    ? normalizeStudioContentTypeDefinition(definition.studioContentType)
    : undefined,
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
      action,
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

const validateStudioContentTypeDefinition = (
  contentType: string,
  studioContentType: StudioContentTypeDefinition
): void => {
  assertPluginContributionAllowedKeys(
    studioContentType,
    studioContentTypeDefinitionAllowedKeys,
    normalizePluginIdentifier(contentType).split('.')[0] ?? 'host',
    `${normalizePluginIdentifier(contentType)}.studioContentType`
  );

  if (studioContentType.requiredReadAction.length === 0 || studioContentType.requiredCreateAction.length === 0) {
    throw new Error(`invalid_studio_content_type_action:${contentType}`);
  }
  if (studioContentType.createPath.startsWith('/') === false || studioContentType.createPath.length === 0) {
    throw new Error(`invalid_studio_content_type_create_path:${contentType}`);
  }
  if (
    studioContentType.detailPath.startsWith('/') === false ||
    studioContentType.detailPath.length === 0 ||
    studioContentType.detailPath.includes('$id') === false
  ) {
    throw new Error(`invalid_studio_content_type_detail_path:${contentType}`);
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
      definition,
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
    if (definition.studioContentType) {
      validateStudioContentTypeDefinition(definition.contentType, definition.studioContentType);
    }

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
      definition,
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
    if (normalizedDefinition.studioContentType) {
      validateStudioContentTypeDefinition(normalizedType, normalizedDefinition.studioContentType);
    }
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

export const collectRegisteredStudioContentTypes = (
  definitions: readonly ContentTypeDefinition[]
): readonly RegisteredStudioContentType[] =>
  definitions.flatMap((definition) =>
    definition.studioContentType
      ? [
          {
            contentType: definition.contentType,
            displayName: definition.displayName,
            ...definition.studioContentType,
          },
        ]
      : []
  );

export const resolveStudioContentDetailPath = (
  definition: Pick<RegisteredStudioContentType, 'detailPath'>,
  contentId: string
): string => definition.detailPath.replace('$id', encodeURIComponent(contentId));
