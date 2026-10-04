import { randomUUID } from 'node:crypto';

import {
  deferMainserverMutationProjection,
  loadMainserverMutationJournal,
  recordSuccessfulExternalContentDeletion,
  recordSuccessfulExternalContentMutation,
  withInstanceScopedDb,
} from '@sva/auth-runtime/server';
import { createSdkLogger } from '@sva/server-runtime';

import { isMainserverContentType, normalizeApiErrorCode } from './iam-content-list-api.shared.js';
import type {
  ContentProjectionSyncTarget,
  MainserverProjectionMutationOperation,
  MainserverProjectionRowInput,
} from './iam-content-list-projection-model.server.js';
import {
  buildProjectionLogContext,
  countProjectedRowsForScopeWithClient,
  deleteMainserverProjectionRowByEntity,
  invalidateOtherMainserverProjectionSnapshots,
  lockMainserverProjectionType,
  loadProjectionRefreshLeader,
  loadProjectionSyncStateSchemaMode,
  markMainserverGlobalMutationSucceeded,
  markMainserverProjectionSyncSucceeded,
  markProjectionSyncFailed,
  markProjectionSyncStarted,
  upsertSingleMainserverProjectionRow,
} from './iam-content-list-projection-repository.server.js';
import {
  GENERIC_ITEMS_CONTENT_TYPE,
  assertVerifiedTransferOwner,
  assertProjectionCredentialsReady,
  buildGenericItemSiblingRow,
  enrichMutationProjectionRowWithBinding,
  loadGenericItemForSiblingRefresh,
  loadMainserverProjectionMutationRow,
  resolveGenericItemProjectionContentType,
} from './iam-content-list-projection-source.server.js';
import {
  computeProjectionSyncStates,
  enqueueProjectionWork,
  isDurableCredentialErrorCode,
  isProjectionRefreshDue,
  triggerMainserverProjectionRefresh,
} from './iam-content-list-projection-sync.server.js';
import { studioMainserverGenericTypeRegistry } from './mainserver-generic-type-registry.server.js';

const contentProjectionLogger = createSdkLogger({
  component: 'iam-content-list-projection',
  level: 'info',
});

type MutationRefreshInput = Readonly<{
  target: ContentProjectionSyncTarget;
  operation: MainserverProjectionMutationOperation;
  entityId: string;
  row?: MainserverProjectionRowInput;
}>;

const recordDeletionAudit = async (input: MutationRefreshInput): Promise<void> => {
  const { target, entityId } = input;
  const auditActorAccountId = target.auditActorAccountId ?? target.actorAccountId;
  if (!auditActorAccountId || !target.actorDisplayName || !target.mutationRef) return;
  await recordSuccessfulExternalContentDeletion({
    instanceId: target.instanceId,
    actorAccountId: auditActorAccountId,
    actorDisplayName: target.actorDisplayName,
    mutationRef: target.mutationRef,
    sourceSystem: 'mainserver',
    sourceEntityType: target.contentType,
    sourceEntityId: entityId,
  });
};

const deleteProjectionMutation = async (
  input: MutationRefreshInput,
  refreshRunId: string
): Promise<void> => {
  await recordDeletionAudit(input);
  await withInstanceScopedDb(input.target.instanceId, async (client) => {
    await lockMainserverProjectionType(client, input.target);
    const leader = await loadProjectionRefreshLeader(
      client,
      input.target,
      await loadProjectionSyncStateSchemaMode(client, input.target.instanceId)
    );
    await deleteMainserverProjectionRowByEntity(client, input.target, input.entityId);
    await markMainserverGlobalMutationSucceeded(client, input.target);
    if (leader?.refresh_run_id !== refreshRunId) return;
    const projectedCount = await countProjectedRowsForScopeWithClient(client, input.target);
    await markMainserverProjectionSyncSucceeded(client, input.target, projectedCount);
  });
};

const recordMutationAudit = async (
  input: MutationRefreshInput,
  row: MainserverProjectionRowInput
): Promise<void> => {
  const { target } = input;
  const auditActorAccountId = target.auditActorAccountId ?? target.actorAccountId;
  if (!auditActorAccountId || !target.actorDisplayName || !target.mutationRef) return;
  if (input.operation !== 'create' && input.operation !== 'update') return;
  const isPersonalAuthor = target.actingPrincipalType === 'user' || !row.organizationId;
  await recordSuccessfulExternalContentMutation({
    instanceId: target.instanceId,
    actorAccountId: auditActorAccountId,
    actorDisplayName: target.actorDisplayName,
    mutationRef: target.mutationRef,
    operation: input.operation,
    sourceSystem: 'mainserver',
    sourceEntityType: target.contentType,
    sourceEntityId: input.entityId,
    contentType: target.contentType,
    ...(target.ownershipPrincipal ? { ownershipPrincipal: target.ownershipPrincipal } : {}),
    ...(target.preserveExistingContentState ? { preserveExistingContentState: true } : {}),
    ...(row.organizationId ? { organizationId: row.organizationId } : {}),
    title: row.title,
    payload: row.payload,
    status: row.status,
    ...(row.publishedAt ? { publishedAt: row.publishedAt } : {}),
    authorDisplayMode: isPersonalAuthor ? 'user' : row.authorDisplayMode,
    authorDisplayName:
      isPersonalAuthor && !target.ownershipPrincipal ? target.actorDisplayName : row.author,
  });
};

const upsertProjectionMutation = async (
  input: MutationRefreshInput,
  refreshRunId: string
): Promise<void> => {
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      await assertProjectionCredentialsReady(input.target);
      const loadedRow =
        input.row ?? (await loadMainserverProjectionMutationRow(input.target, input.entityId));
      const row = await enrichMutationProjectionRowWithBinding(input.target, loadedRow);
      assertVerifiedTransferOwner(input.target, row);
      await upsertSingleMainserverProjectionRow(
        input.target,
        input.target.actorAccountId,
        row,
        refreshRunId
      );
      await recordMutationAudit(input, row);
      return;
    } catch (error) {
      lastError = error;
      const errorCode =
        error && typeof error === 'object' && 'code' in error
          ? (error as { code?: unknown }).code
          : undefined;
      if (typeof errorCode === 'string' && isDurableCredentialErrorCode(errorCode)) {
        throw error;
      }
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error('Mainserver mutation follow-up refresh failed.');
};

const finalizeFailedMutation = async (
  input: MutationRefreshInput,
  refreshRunId: string,
  error: unknown
): Promise<void> => {
  const errorCode = normalizeApiErrorCode(
    error && typeof error === 'object' && 'code' in error
      ? (error as { code?: unknown }).code
      : undefined
  );
  const errorMessage =
    error instanceof Error
      ? error.message
      : 'Mainserver-Mutationsprojektion konnte nicht nachgeladen werden.';
  contentProjectionLogger.warn('mainserver_projection_mutation_refresh_failed', {
    ...buildProjectionLogContext(input.target, 'mutation_follow_up'),
    entity_id: input.entityId,
    error_code: errorCode,
    error_message: errorMessage,
    operation: input.operation,
  });
  await markProjectionSyncFailed(input.target, refreshRunId, errorCode, errorMessage);
};

const isMutationFollowUpDue = async (target: ContentProjectionSyncTarget): Promise<boolean> => {
  const [syncState] = await computeProjectionSyncStates([target]);
  return isProjectionRefreshDue({
    state: syncState,
    options: { force: true, awaitCompletion: true, trigger: 'mutation_follow_up' },
  });
};

const deferMutationHistory = async (
  input: MutationRefreshInput,
  strict = false
): Promise<true | undefined> => {
  if (
    (input.operation !== 'create' && input.operation !== 'update') ||
    !(input.target.auditActorAccountId ?? input.target.actorAccountId) ||
    !input.target.actorDisplayName ||
    !input.target.mutationRef
  )
    return undefined;
  const deferred = await deferMainserverMutationProjection({
    instanceId: input.target.instanceId,
    operationExternalId: input.target.mutationRef,
  });
  if (!deferred && strict && input.target.ownershipPrincipal) {
    const journal = await loadMainserverMutationJournal({
      instanceId: input.target.instanceId,
      operationExternalId: input.target.mutationRef,
    });
    if (!journal?.completedSteps.includes('projection_history_reconciled')) {
      throw new Error('content_transfer_projection_reconciliation_unavailable');
    }
  }
  return deferred ? true : undefined;
};

export const refreshMainserverProjectionForMutation = async (
  input: MutationRefreshInput
): Promise<true | undefined> => {
  const { target } = input;
  const refreshRunId = randomUUID();
  return enqueueProjectionWork(target, async () => {
    if (input.operation !== 'delete' && !(await isMutationFollowUpDue(target))) {
      return deferMutationHistory(input, true);
    }
    await markProjectionSyncStarted(target, refreshRunId, 'hot');
    try {
      await (input.operation === 'delete'
        ? deleteProjectionMutation(input, refreshRunId)
        : upsertProjectionMutation(input, refreshRunId));
    } catch (error) {
      await finalizeFailedMutation(input, refreshRunId, error);
      const errorCode =
        error && typeof error === 'object' && 'code' in error
          ? (error as { code?: unknown }).code
          : undefined;
      if (
        target.ownershipPrincipal ||
        (typeof errorCode === 'string' && isDurableCredentialErrorCode(errorCode))
      ) {
        await deferMutationHistory(input);
      }
      throw error;
    }
    return undefined;
  });
};

const genericItemProjectionContentTypes = [
  GENERIC_ITEMS_CONTENT_TYPE,
  ...new Set(studioMainserverGenericTypeRegistry.values()),
].filter(isMainserverContentType);

const deleteStaleGenericItemSiblingProjection = async (
  target: ContentProjectionSyncTarget,
  entityId: string,
  operation: MainserverProjectionMutationOperation
): Promise<boolean> => {
  return enqueueProjectionWork(target, () =>
    withInstanceScopedDb(target.instanceId, async (client) => {
      await lockMainserverProjectionType(client, target);
      const removed = (await deleteMainserverProjectionRowByEntity(client, target, entityId)) > 0;
      if (removed || operation === 'delete')
        await markMainserverGlobalMutationSucceeded(client, target);
      return removed;
    })
  );
};

const refreshGenericItemProjectionSnapshots = async (
  target: ContentProjectionSyncTarget
): Promise<void> => {
  for (const contentType of genericItemProjectionContentTypes) {
    const result = await triggerMainserverProjectionRefresh(
      { ...target, contentType },
      { force: true, awaitCompletion: true, trigger: 'mutation_follow_up' }
    );
    if (!['completed', 'already_running', 'accepted'].includes(result.status))
      throw new Error('content_projection_refresh_incomplete');
  }
};

type GenericItemSiblingRefreshInput = Readonly<{
  target: ContentProjectionSyncTarget;
  operation: MainserverProjectionMutationOperation;
  entityId: string;
}>;

const recordGenericItemDeletionAudit = async (
  input: GenericItemSiblingRefreshInput
): Promise<void> => {
  const { target } = input;
  const auditActorAccountId = target.auditActorAccountId ?? target.actorAccountId;
  if (
    input.operation !== 'delete' ||
    !auditActorAccountId ||
    !target.actorDisplayName ||
    !target.mutationRef
  ) {
    return;
  }
  const sourceEntityTypes =
    target.contentType === 'projects.project'
      ? ['GenericItem', 'projects.project']
      : [target.contentType];
  for (const sourceEntityType of sourceEntityTypes) {
    await recordSuccessfulExternalContentDeletion({
      instanceId: target.instanceId,
      actorAccountId: auditActorAccountId,
      actorDisplayName: target.actorDisplayName,
      mutationRef: target.mutationRef,
      sourceSystem: 'mainserver',
      sourceEntityType,
      sourceEntityId: input.entityId,
    });
  }
};

export const refreshGenericItemSiblingProjections = async (
  input: GenericItemSiblingRefreshInput
): Promise<true | undefined> => {
  await recordGenericItemDeletionAudit(input);
  if (input.operation !== 'delete' && !(await isMutationFollowUpDue(input.target))) {
    return deferMutationHistory(input, true);
  }
  const loadedItem = await loadGenericItemForSiblingRefresh(
    input.target,
    input.operation,
    input.entityId
  );
  if (loadedItem.failed) {
    let deferred: true | undefined;
    if (input.target.ownershipPrincipal) {
      deferred = await deferMutationHistory(input, true);
      if (!deferred) return undefined;
    }
    await refreshGenericItemProjectionSnapshots(input.target);
    return deferred;
  }
  const resolvedContentType =
    loadedItem.item && resolveGenericItemProjectionContentType(loadedItem.item.genericType);
  const successor = genericItemProjectionContentTypes.find((type) => type === resolvedContentType);
  let removedStaleSibling = false;
  for (const contentType of genericItemProjectionContentTypes) {
    if (contentType === successor && loadedItem.item) continue;
    const removed = await deleteStaleGenericItemSiblingProjection(
      { ...input.target, contentType },
      input.entityId,
      input.operation
    );
    removedStaleSibling ||= removed;
  }
  if (input.operation === 'update' && successor && removedStaleSibling) {
    const successorTarget = { ...input.target, contentType: successor };
    await withInstanceScopedDb(successorTarget.instanceId, async (client) => {
      await lockMainserverProjectionType(client, successorTarget);
      await invalidateOtherMainserverProjectionSnapshots(client, successorTarget);
      await markMainserverGlobalMutationSucceeded(client, successorTarget);
    });
  }

  if (!successor || !loadedItem.item) return undefined;
  const successorTarget = { ...input.target, contentType: successor };
  return refreshMainserverProjectionForMutation({
    target: successorTarget,
    operation: input.operation,
    entityId: input.entityId,
    row: buildGenericItemSiblingRow(successorTarget, loadedItem.item),
  });
};
