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
  emitExternalContentUpdatedActivity,
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

type InstanceScopedClient = Parameters<Parameters<typeof withInstanceScopedDb>[1]>[0];

const removeExternalCoreFromIamProjection = (
  client: InstanceScopedClient,
  instanceId: string,
  contentId: string
): Promise<unknown> =>
  client.query(
    `DELETE FROM iam.content_list_projection
     WHERE instance_id = $1 AND source_system = 'iam'
       AND source_entity_type = 'iam.contents' AND source_entity_id = $2;`,
    [instanceId, contentId]
  );

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
  await withInstanceScopedDb(input.instanceId, (client) =>
    removeExternalCoreFromIamProjection(client, input.instanceId, contentId)
  );
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
    const concurrentReference = await client.query<{ readonly content_id: string }>(
      `SELECT content_id::text
       FROM iam.external_content_references
       WHERE instance_id = $1 AND source_system = $2
         AND source_entity_type = $3 AND source_entity_id = $4
       LIMIT 1;`,
      [input.instanceId, input.sourceSystem, input.sourceEntityType, input.sourceEntityId]
    );
    const concurrentContentId = concurrentReference.rows[0]?.content_id;
    if (concurrentContentId) return { contentId: concurrentContentId, created: false };

    const contentId = await insertContentRow(client, input);
    const changedFields = ['title', 'payload', 'status', ...(input.publishedAt ? ['publishedAt'] : [])];
    const historyId = await insertContentHistory(client, {
      ...input,
      contentId,
      action: input.operation === 'create' ? 'created' : 'updated',
      changedFields,
      nextStatus: input.status,
      summary: input.operation === 'create' ? 'Inhalt erstellt' : 'Inhalt aktualisiert',
      snapshot: input.payload,
    });
    await updateContentRevisionRefs(client, input.instanceId, contentId, historyId);
    if (input.operation === 'create') {
      await emitContentCreatedActivity(client, input, contentId);
    } else {
      await emitExternalContentUpdatedActivity(client, input, contentId, changedFields);
    }
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
    await removeExternalCoreFromIamProjection(client, input.instanceId, contentId);
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
