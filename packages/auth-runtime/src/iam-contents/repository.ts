import type { IamContentOwnershipTransferResult, IamContentPrimitiveAction } from '@sva/core';
import { withInstanceScopedDb } from '../iam-account-management/shared.js';
import {
  assertActiveOwnershipTarget,
  ContentOwnershipTransferError,
  resolveCurrentOwnerPrincipal,
} from './repository-ownership.js';
import {
  insertContentHistory,
  isContentMutationFinalized,
  loadCurrentContentRow,
  resolveContentMutationMetadata,
} from './repository-shared.js';
import { resolveNextContentState } from './repository-state.js';
import type {
  ContentRow,
  CreateContentInput,
  DeleteContentInput,
  UpdateContentInput,
  TransferContentOwnershipInput,
} from './repository-types.js';
import {
  emitContentCreatedActivity,
  emitContentDeletedActivity,
  emitContentUpdatedActivity,
  emitContentOwnershipTransferredActivity,
  insertContentRow,
  persistContentUpdateHistory,
  resolveUpdateAuthorDisplay,
  updateContentRevisionRefs,
  updateContentRow,
  validatePublicationWindow,
} from './repository-write-helpers.js';

export { ContentOwnershipTransferError } from './repository-ownership.js';
export type { ContentOwnershipTransferErrorCode } from './repository-ownership.js';
export {
  loadContentListScopes,
  loadContentListItems,
  loadContentById,
  loadContentRowById,
  loadContentHistory,
  loadContentDetail,
} from './repository-read.js';
export { loadContentOwnershipTargets } from './repository-ownership-targets.js';

const resolveAuditAction = (input: {
  readonly changedFields: readonly string[];
  readonly previousStatus: string;
  readonly nextStatus: string;
}): IamContentPrimitiveAction => {
  if (input.previousStatus !== input.nextStatus) {
    if (input.nextStatus === 'published') {
      return 'content.publish';
    }
    if (input.nextStatus === 'archived') {
      return 'content.archive';
    }
    if (input.previousStatus === 'archived') {
      return 'content.restore';
    }
    return 'content.changeStatus';
  }
  return input.changedFields.includes('payload')
    ? 'content.updatePayload'
    : 'content.updateMetadata';
};

const hasAuthorDisplayAffectingChange = (current: ContentRow, input: UpdateContentInput): boolean =>
  input.confirmedExternalOwner !== undefined ||
  input.authorDisplayMode !== undefined ||
  input.authorDisplayName !== undefined ||
  (input.organizationId !== undefined && input.organizationId !== current.organization_id);

export const createContent = async (input: CreateContentInput): Promise<string> =>
  withInstanceScopedDb(input.instanceId, async (client) => {
    validatePublicationWindow(input);
    const contentId = await insertContentRow(client, input);
    const historyId = await insertContentHistory(client, {
      instanceId: input.instanceId,
      contentId,
      actorAccountId: input.actorAccountId,
      actorDisplayName: input.actorDisplayName,
      action: 'created',
      changedFields: [
        'contentType',
        'title',
        'payload',
        'status',
        ...(input.publishedAt ? ['publishedAt'] : []),
      ],
      nextStatus: input.status,
      summary: 'Inhalt erstellt',
      snapshot: input.payload,
    });
    await updateContentRevisionRefs(client, input.instanceId, contentId, historyId);
    await emitContentCreatedActivity(client, input, contentId);
    return contentId;
  });

export const updateContent = async (input: UpdateContentInput): Promise<string | undefined> =>
  withInstanceScopedDb(input.instanceId, async (client) => {
    const mutationFinalized = input.mutationRef
      ? await isContentMutationFinalized(client, {
        instanceId: input.instanceId,
        contentId: input.contentId,
        mutationRef: input.mutationRef,
      })
      : false;
    if (mutationFinalized && !input.confirmedExternalOwner) {
      return input.contentId;
    }
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2));', [
      input.instanceId,
      input.contentId,
    ]);
    const current = await loadCurrentContentRow(client, input.instanceId, input.contentId);
    if (!current) {
      return undefined;
    }
    const owner = resolveCurrentOwnerPrincipal(current);
    if (
      mutationFinalized && input.confirmedExternalOwner &&
      owner?.type === input.confirmedExternalOwner.type &&
      owner.id === input.confirmedExternalOwner.id
    ) return input.contentId;
    if ('expectedSourcePrincipal' in input) {
      const sourcePrincipal = resolveCurrentOwnerPrincipal(current);
      const expectedSourcePrincipal = input.expectedSourcePrincipal ?? undefined;
      if (
        sourcePrincipal?.type !== expectedSourcePrincipal?.type ||
        sourcePrincipal?.id !== expectedSourcePrincipal?.id
      ) {
        throw new ContentOwnershipTransferError('ownership_source_changed');
      }
    }
    const stateInput = hasAuthorDisplayAffectingChange(current, input)
      ? {
          ...input,
          ...(await resolveUpdateAuthorDisplay(client, current, input)),
        }
      : input;
    const {
      changedFields,
      nextOrganizationId,
      nextOwnerUserId,
      nextOwnerOrganizationId,
      nextAuthorDisplayMode,
      nextAuthorDisplayName,
      nextPayload,
      nextPublishedAt,
      nextPublishFrom,
      nextPublishUntil,
      nextStatus,
      nextTitle,
      nextValidationState,
    } = resolveNextContentState(current, stateInput);
    await updateContentRow(client, input, {
      organizationId: nextOrganizationId,
      authorDisplayMode: nextAuthorDisplayMode,
      authorDisplayName: nextAuthorDisplayName,
      title: nextTitle,
      payloadJson: JSON.stringify(nextPayload),
      status: nextStatus,
      validationState: nextValidationState,
      publishedAt: nextPublishedAt,
      publishFrom: nextPublishFrom,
      publishUntil: nextPublishUntil,
      ownerUserId: nextOwnerUserId,
      ownerOrganizationId: nextOwnerOrganizationId,
    });
    const { activityEventType, historyAction, historySummary } = resolveContentMutationMetadata(
      current.status,
      nextStatus
    );
    await persistContentUpdateHistory(client, input, current, {
      changedFields,
      status: nextStatus,
      payload: nextPayload,
      historyAction,
      historySummary,
      mutationFinalized,
    });
    await emitContentUpdatedActivity(client, stateInput, current, {
      eventType: activityEventType,
      action: resolveAuditAction({ changedFields, previousStatus: current.status, nextStatus }),
      changedFields,
      nextStatus,
      nextTitle,
      nextOwnerUserId,
      nextOwnerOrganizationId,
      nextAuthorDisplayMode,
      nextAuthorDisplayName,
    });
    return input.contentId;
  });

export const transferContentOwnership = async (
  input: TransferContentOwnershipInput
): Promise<IamContentOwnershipTransferResult> =>
  withInstanceScopedDb(input.instanceId, async (client) => {
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2));', [
      input.instanceId,
      input.contentId,
    ]);

    const current = await loadCurrentContentRow(client, input.instanceId, input.contentId);
    if (!current) {
      throw new ContentOwnershipTransferError('content_not_found');
    }

    const sourcePrincipal = resolveCurrentOwnerPrincipal(current);
    if (
      sourcePrincipal?.type !== input.expectedSourcePrincipal?.type ||
      sourcePrincipal?.id !== input.expectedSourcePrincipal?.id
    ) {
      throw new ContentOwnershipTransferError('ownership_source_changed');
    }
    if (
      sourcePrincipal?.type === input.targetPrincipal.type &&
      sourcePrincipal.id === input.targetPrincipal.id
    ) {
      throw new ContentOwnershipTransferError('ownership_target_unchanged');
    }

    await assertActiveOwnershipTarget(client, input.instanceId, input.targetPrincipal);

    const targetOwnerUserId =
      input.targetPrincipal.type === 'account' ? input.targetPrincipal.id : null;
    const targetOwnerOrganizationId =
      input.targetPrincipal.type === 'organization' ? input.targetPrincipal.id : null;
    const targetOrganizationId = targetOwnerOrganizationId;

    await client.query(
      `UPDATE iam.contents
       SET organization_id = $3::uuid,
           owner_user_id = $4::uuid,
           owner_organization_id = $5::uuid,
           updater_account_id = $6::uuid,
           updated_at = NOW()
       WHERE instance_id = $1
         AND id = $2::uuid;`,
      [
        input.instanceId,
        input.contentId,
        targetOrganizationId,
        targetOwnerUserId,
        targetOwnerOrganizationId,
        input.actorAccountId,
      ]
    );

    const historyId = await insertContentHistory(client, {
      instanceId: input.instanceId,
      contentId: input.contentId,
      actorAccountId: input.actorAccountId,
      actorDisplayName: input.actorDisplayName,
      action: 'updated',
      changedFields: ['ownerUserId', 'ownerOrganizationId', 'organizationId'],
      previousStatus: current.status,
      nextStatus: current.status,
      summary: 'Inhaber übertragen',
      snapshot: current.payload_json,
    });
    await updateContentRevisionRefs(client, input.instanceId, input.contentId, historyId);
    await emitContentOwnershipTransferredActivity(client, {
      instanceId: input.instanceId,
      actorAccountId: input.actorAccountId,
      requestId: input.requestId,
      traceId: input.traceId,
      contentId: input.contentId,
      contentType: current.content_type,
      sourcePrincipal,
      targetPrincipal: input.targetPrincipal,
    });

    return {
      contentId: input.contentId,
      sourcePrincipal,
      targetPrincipal: input.targetPrincipal,
      authorDisplayName: current.author_display_name,
    };
  });

export const deleteContent = async (input: DeleteContentInput): Promise<string | undefined> =>
  withInstanceScopedDb(input.instanceId, async (client) => {
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2));', [
      input.instanceId,
      input.contentId,
    ]);
    const current = await loadCurrentContentRow(client, input.instanceId, input.contentId);
    if (!current) {
      return undefined;
    }
    if ('expectedSourcePrincipal' in input) {
      const sourcePrincipal = resolveCurrentOwnerPrincipal(current);
      const expectedSourcePrincipal = input.expectedSourcePrincipal ?? undefined;
      if (
        sourcePrincipal?.type !== expectedSourcePrincipal?.type ||
        sourcePrincipal?.id !== expectedSourcePrincipal?.id
      ) {
        throw new ContentOwnershipTransferError('ownership_source_changed');
      }
    }
    await emitContentDeletedActivity(client, input, current);
    await client.query(
      `
DELETE FROM iam.contents
WHERE instance_id = $1
  AND id = $2::uuid;
      `,
      [input.instanceId, input.contentId]
    );
    return input.contentId;
  });
