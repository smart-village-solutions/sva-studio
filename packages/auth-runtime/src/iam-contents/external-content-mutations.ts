import type { ContentJsonValue, IamContentAuthorDisplayMode, IamContentStatus } from '@sva/core';

import { withInstanceScopedDb } from '../iam-account-management/shared.js';
import {
  insertExternalContentReference,
  loadExternalContentReferenceBySourceEntity,
  updateExternalContentCore,
} from './external-content-references.js';
import { insertContentHistory } from './repository-shared.js';
import {
  emitContentCreatedActivity,
  insertContentRow,
  updateContentRevisionRefs,
} from './repository-write-helpers.js';

export type SuccessfulExternalContentMutation = Readonly<{
  instanceId: string;
  actorAccountId: string;
  actorDisplayName: string;
  mutationRef: string;
  operation: 'create' | 'update';
  sourceSystem: string;
  sourceEntityType: string;
  sourceEntityId: string;
  contentType: string;
  organizationId?: string;
  title: string;
  payload: ContentJsonValue;
  status: IamContentStatus;
  publishedAt?: string;
  authorDisplayMode: IamContentAuthorDisplayMode;
  authorDisplayName: string;
}>;

const updateExistingContent = async (
  input: SuccessfulExternalContentMutation,
  contentId: string
): Promise<string> => {
  await updateExternalContentCore({
    instanceId: input.instanceId,
    actorAccountId: input.actorAccountId,
    actorDisplayName: input.actorDisplayName,
    mutationRef: input.mutationRef,
    contentId,
    title: input.title,
    payload: input.payload,
    status: input.status,
    publishedAt: input.publishedAt,
    authorDisplayMode: input.authorDisplayMode,
    authorDisplayName: input.authorDisplayName,
  });
  return contentId;
};

const createBoundContent = async (
  input: SuccessfulExternalContentMutation
): Promise<{ readonly contentId: string; readonly created: boolean }> =>
  withInstanceScopedDb(input.instanceId, async (client) => {
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2));', [
      `${input.sourceSystem}:${input.sourceEntityType}`,
      input.sourceEntityId,
    ]);
    const concurrentReference = await loadExternalContentReferenceBySourceEntity(input);
    if (concurrentReference) return { contentId: concurrentReference.contentId, created: false };

    const contentId = await insertContentRow(client, input);
    const historyId = await insertContentHistory(client, {
      ...input,
      contentId,
      action: input.operation === 'create' ? 'created' : 'updated',
      changedFields: ['title', 'payload', 'status', ...(input.publishedAt ? ['publishedAt'] : [])],
      nextStatus: input.status,
      summary: input.operation === 'create' ? 'Inhalt erstellt' : 'Inhalt aktualisiert',
      snapshot: input.payload,
    });
    await updateContentRevisionRefs(client, input.instanceId, contentId, historyId);
    await emitContentCreatedActivity(client, input, contentId);
    const reference = await insertExternalContentReference(client, {
      instanceId: input.instanceId,
      contentId,
      sourceSystem: input.sourceSystem,
      sourceEntityType: input.sourceEntityType,
      operationExternalId: input.mutationRef,
    });
    await client.query(
      `UPDATE iam.external_content_references
       SET source_entity_id = $3, reconciliation_status = 'bound', updated_at = NOW()
       WHERE instance_id = $1 AND id = $2::uuid;`,
      [input.instanceId, reference.id, input.sourceEntityId]
    );
    return { contentId, created: true };
  });

export const recordSuccessfulExternalContentMutation = async (
  input: SuccessfulExternalContentMutation
): Promise<string> => {
  const existingReference = await loadExternalContentReferenceBySourceEntity(input);
  if (existingReference) return updateExistingContent(input, existingReference.contentId);

  const resolved = await createBoundContent(input);
  return resolved.created ? resolved.contentId : updateExistingContent(input, resolved.contentId);
};
