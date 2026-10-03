import type {
  ContentJsonValue,
  IamContentAuthorDisplayMode,
  IamContentOwnerPrincipal,
  IamContentStatus,
} from '@sva/core';

import { withInstanceScopedDb } from '../iam-account-management/shared.js';
import {
  insertExternalContentReference,
  loadExternalContentReferenceBySourceEntity,
  updateExternalContentCore,
} from './external-content-references.js';
import { insertContentHistory } from './repository-shared.js';
import {
  emitContentCreatedActivity,
  emitContentOwnershipTransferredActivity,
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
  ownershipPrincipal?: IamContentOwnerPrincipal;
  preserveExistingContentState?: boolean;
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
  const preserveExistingContentState =
    Boolean(input.ownershipPrincipal) || input.preserveExistingContentState === true;
  await updateExternalContentCore({
    instanceId: input.instanceId,
    actorAccountId: input.actorAccountId,
    actorDisplayName: input.actorDisplayName,
    mutationRef: input.mutationRef,
    contentId,
    confirmedExternalOwner: input.ownershipPrincipal,
    preserveExistingContentState,
    ...(preserveExistingContentState
      ? {}
      : {
          title: input.title,
          payload: input.payload,
          status: input.status,
          publishedAt: input.publishedAt,
        }),
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
): Promise<{ readonly contentId: string; readonly created: boolean; readonly skipUpdate?: boolean }> =>
  withInstanceScopedDb(input.instanceId, async (client) => {
    const project = input.contentType === 'projects.project';
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2));', [
      `${input.sourceSystem}:${project ? 'projects.project' : input.sourceEntityType}`,
      input.sourceEntityId,
    ]);
    const sourceEntityTypes = project
      ? input.ownershipPrincipal
        ? ['GenericItem', 'projects.project']
        : ['projects.project', 'GenericItem']
      : [input.sourceEntityType];
    const concurrentReference = await client.query<{
      readonly content_id: string;
      readonly source_entity_type: string;
    }>(
      `SELECT content_id::text, source_entity_type
       FROM iam.external_content_references
       WHERE instance_id = $1 AND source_system = $2
         AND source_entity_type = ANY($3::text[]) AND source_entity_id = $4
       ORDER BY array_position($3::text[], source_entity_type)
       LIMIT 1;`,
      [input.instanceId, input.sourceSystem, sourceEntityTypes, input.sourceEntityId]
    );
    const concurrent = concurrentReference.rows[0];
    if (concurrent) return {
      contentId: concurrent.content_id,
      created: false,
      skipUpdate: project && !input.ownershipPrincipal && concurrent.source_entity_type === 'GenericItem',
    };

    const contentId = await insertContentRow(
      client,
      input.ownershipPrincipal
        ? {
            ...input,
            organizationId:
              input.ownershipPrincipal.type === 'organization'
                ? input.ownershipPrincipal.id
                : undefined,
            confirmedExternalOwner: input.ownershipPrincipal,
          }
        : input
    );
    const changedFields = [
      'title',
      'payload',
      'status',
      ...(input.ownershipPrincipal ? ['organizationId', 'ownerUserId', 'ownerOrganizationId'] : []),
      ...(input.publishedAt ? ['publishedAt'] : []),
    ];
    const historyId = await insertContentHistory(client, {
      ...input,
      contentId,
      action: input.operation === 'create' ? 'created' : 'updated',
      changedFields,
      nextStatus: input.status,
      summary: input.ownershipPrincipal
        ? 'Inhaber übertragen'
        : input.operation === 'create' ? 'Inhalt erstellt' : 'Inhalt aktualisiert',
      snapshot: input.payload,
    });
    await updateContentRevisionRefs(client, input.instanceId, contentId, historyId);
    if (input.ownershipPrincipal) {
      await emitContentOwnershipTransferredActivity(client, {
        instanceId: input.instanceId,
        actorAccountId: input.actorAccountId,
        contentId,
        contentType: input.contentType,
        targetPrincipal: input.ownershipPrincipal,
      });
    } else if (input.operation === 'create') {
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
  if (input.contentType === 'projects.project' && input.ownershipPrincipal) {
    const references = await Promise.all(
      (['GenericItem', 'projects.project'] as const).map((sourceEntityType) =>
        loadExternalContentReferenceBySourceEntity({
          ...input,
          sourceEntityType,
          exactSourceEntityType: true,
        })
      )
    );
    const contentIds = [...new Set(references.flatMap((reference) =>
      reference ? [reference.contentId] : []
    ))];
    const primaryContentId = contentIds[0];
    if (primaryContentId) {
      for (const contentId of contentIds) await updateExistingContent(input, contentId);
      return primaryContentId;
    }
  }
  const mutation =
    input.contentType === 'projects.project' && input.ownershipPrincipal
      ? { ...input, sourceEntityType: 'GenericItem' }
      : input;
  const existingReference =
    (await loadExternalContentReferenceBySourceEntity({
      ...mutation,
      exactSourceEntityType: input.contentType === 'projects.project' && !input.ownershipPrincipal,
    })) ??
    (mutation !== input ? await loadExternalContentReferenceBySourceEntity(input) : undefined);
  if (existingReference) return updateExistingContent(mutation, existingReference.contentId);
  if (input.contentType === 'projects.project' && !input.ownershipPrincipal) {
    const canonicalReference = await loadExternalContentReferenceBySourceEntity({
      ...input,
      sourceEntityType: 'GenericItem',
    });
    if (canonicalReference) {
      if (input.operation === 'create' &&
          canonicalReference.operationExternalId === input.mutationRef) {
        return canonicalReference.contentId;
      }
      const coreUpdated = await withInstanceScopedDb(input.instanceId, async (client) => {
        const result = await client.query<{ updated: boolean }>(
          `SELECT completed_steps ? 'project_core_updated' AS updated
           FROM iam.mainserver_mutation_journal
           WHERE instance_id = $1 AND operation_external_id = $2
             AND provider_outcome = 'succeeded' LIMIT 1;`,
          [input.instanceId, input.mutationRef]
        );
        return result.rows[0]?.updated === true;
      });
      if (!coreUpdated) throw new Error('project_core_full_update_unverified');
      return canonicalReference.contentId;
    }
  }
  if (mutation.preserveExistingContentState) {
    throw new Error('external_content_core_reference_required_for_owner_only_replay');
  }

  const resolved = await createBoundContent(mutation);
  return resolved.created || resolved.skipUpdate
    ? resolved.contentId
    : updateExistingContent(mutation, resolved.contentId);
};

export const recordSuccessfulExternalContentDeletion = async (
  input: Readonly<{
    instanceId: string;
    actorAccountId: string;
    actorDisplayName: string;
    mutationRef: string;
    sourceSystem: string;
    sourceEntityType: string;
    sourceEntityId: string;
  }>
): Promise<boolean> => {
  const reference = await loadExternalContentReferenceBySourceEntity({
    ...input,
    exactSourceEntityType: true,
  });
  if (!reference) return false;

  return withInstanceScopedDb(input.instanceId, async (client) => {
    const content = await client.query<{
      readonly payload_json: ContentJsonValue;
      readonly status: IamContentStatus;
    }>(
      `SELECT payload_json, status
       FROM iam.contents
       WHERE instance_id = $1 AND id = $2::uuid
       FOR UPDATE;`,
      [input.instanceId, reference.contentId]
    );
    const current = content.rows[0];
    if (!current) return false;

    const historyId = await insertContentHistory(client, {
      instanceId: input.instanceId,
      contentId: reference.contentId,
      actorAccountId: input.actorAccountId,
      actorDisplayName: input.actorDisplayName,
      action: 'status_changed',
      changedFields: ['status'],
      previousStatus: current.status,
      nextStatus: 'archived',
      summary: 'Inhalt im Mainserver gelöscht',
      snapshot: current.payload_json,
      mutationRef: input.mutationRef,
    });
    await client.query(
      `UPDATE iam.contents
       SET status = 'archived', updater_account_id = $3::uuid, updated_at = NOW()
       WHERE instance_id = $1 AND id = $2::uuid;`,
      [input.instanceId, reference.contentId, input.actorAccountId]
    );
    await updateContentRevisionRefs(client, input.instanceId, reference.contentId, historyId);
    await removeExternalCoreFromIamProjection(client, input.instanceId, reference.contentId);
    return true;
  });
};
