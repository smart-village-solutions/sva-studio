import type { IamContentStatus } from '@sva/core';
import { assertPluginContributionAllowedKeys } from './guardrails.js';
import { parseNamespacedPluginIdentifier } from './plugin-identifiers.js';
import type { ContentTypeDefinition } from './content-types.js';

const contentMutationOperations = ['delete', 'status'] as const;
const contentMutationStatuses: readonly IamContentStatus[] = [
  'draft',
  'in_review',
  'approved',
  'published',
  'archived',
];

const isMutationObject = (value: unknown): value is object =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const validateMutationCapability = (
  definition: ContentTypeDefinition,
  operation: (typeof contentMutationOperations)[number],
  namespace: string
): void => {
  const capability = definition.mutations?.[operation];
  if (capability === undefined) return;
  if (!isMutationObject(capability)) {
    throw new Error(`invalid_content_mutation:${definition.contentType}:${operation}`);
  }

  assertPluginContributionAllowedKeys(
    capability,
    new Set([
      'requiredAction',
      'requiresMainserverMutationAction',
      'execute',
      ...(operation === 'status' ? ['supportedStatuses'] : []),
    ]),
    namespace,
    `${definition.contentType}.${operation}`
  );

  const expectedAction = `${namespace}.${operation === 'delete' ? 'delete' : 'update'}`;
  if (
    typeof capability.requiredAction !== 'string' ||
    parseNamespacedPluginIdentifier(capability.requiredAction)?.namespace !== namespace ||
    capability.requiredAction !== expectedAction ||
    typeof capability.execute !== 'function' ||
    (capability.requiresMainserverMutationAction !== undefined &&
      capability.requiresMainserverMutationAction !== true)
  ) {
    throw new Error(`invalid_content_mutation:${definition.contentType}:${operation}`);
  }
};

const hasValidSupportedStatuses = (statuses: unknown): statuses is readonly IamContentStatus[] =>
  Array.isArray(statuses) &&
  statuses.length > 0 &&
  new Set(statuses).size === statuses.length &&
  statuses.every((status) => contentMutationStatuses.includes(status));

export const validateContentTypeMutations = (definition: ContentTypeDefinition): void => {
  const mutations = definition.mutations;
  if (mutations === undefined) return;
  if (!isMutationObject(mutations)) {
    throw new Error(`invalid_content_mutation:${definition.contentType}`);
  }

  const namespace = definition.contentType.split('.')[0] ?? 'host';
  assertPluginContributionAllowedKeys(
    mutations,
    new Set(contentMutationOperations),
    namespace,
    `${definition.contentType}.mutations`
  );
  contentMutationOperations.forEach((operation) =>
    validateMutationCapability(definition, operation, namespace)
  );

  const statuses = mutations.status?.supportedStatuses;
  if (mutations.status && !hasValidSupportedStatuses(statuses)) {
    throw new Error(`invalid_content_mutation_statuses:${definition.contentType}`);
  }
};
