import {
  recordSuccessfulExternalContentDeletion,
  recordSuccessfulExternalContentMutation,
  withInstanceScopedDb,
} from '@sva/auth-runtime/server';
import { createSdkLogger } from '@sva/server-runtime';
import { getSvaMainserverGenericItem } from '@sva/sva-mainserver/server';

import { isMainserverContentType, normalizeApiErrorCode } from './iam-content-list-api.shared.js';
import { mapGenericItem } from './iam-content-list-mainserver.js';
import type {
  ContentProjectionSyncTarget,
  MainserverProjectionMutationOperation,
  MainserverProjectionRowInput,
} from './iam-content-list-projection-model.server.js';
import {
  buildMainserverSyncScopeKey,
  buildProjectionLogContext,
  countProjectedRowsForScopeWithClient,
  deleteMainserverProjectionRowByEntity,
  markMainserverProjectionSyncSucceeded,
  markProjectionSyncFailed,
  markProjectionSyncStarted,
  upsertSingleMainserverProjectionRow,
} from './iam-content-list-projection-repository.server.js';
import {
  GENERIC_ITEMS_CONTENT_TYPE,
  enrichMutationProjectionRowWithBinding,
  loadMainserverProjectionMutationRow,
  requireMutationProjectionPrincipalContext,
  resolveGenericItemProjectionContentType,
  toMutationProjectionConnectionContext,
} from './iam-content-list-projection-source.server.js';
import {
  enqueueProjectionWork,
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
  if (!target.actorAccountId || !target.actorDisplayName || !target.mutationRef) return;
  await recordSuccessfulExternalContentDeletion({
    instanceId: target.instanceId,
    actorAccountId: target.actorAccountId,
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
    const leader = await client.query<{ refresh_run_id?: string | null }>(
      `SELECT refresh_run_id::text FROM iam.content_list_projection_sync_state
       WHERE instance_id = $1 AND source_system = 'mainserver' AND content_type = $2
         AND sync_scope_key = $3 FOR UPDATE;`,
      [input.target.instanceId, input.target.contentType, buildMainserverSyncScopeKey(input.target)]
    );
    if (leader.rows[0]?.refresh_run_id !== refreshRunId) return;
    await deleteMainserverProjectionRowByEntity(client, input.target, input.entityId);
    const projectedCount = await countProjectedRowsForScopeWithClient(client, input.target);
    await markMainserverProjectionSyncSucceeded(client, input.target, projectedCount);
  });
};

const recordMutationAudit = async (
  input: MutationRefreshInput,
  row: MainserverProjectionRowInput
): Promise<void> => {
  const { target } = input;
  if (!target.actorAccountId || !target.actorDisplayName || !target.mutationRef) return;
  if (input.operation !== 'create' && input.operation !== 'update') return;
  await recordSuccessfulExternalContentMutation({
    instanceId: target.instanceId,
    actorAccountId: target.actorAccountId,
    actorDisplayName: target.actorDisplayName,
    mutationRef: target.mutationRef,
    operation: input.operation,
    sourceSystem: 'mainserver',
    sourceEntityType: target.contentType,
    sourceEntityId: input.entityId,
    contentType: target.contentType,
    ...(row.organizationId ? { organizationId: row.organizationId } : {}),
    title: row.title,
    payload: row.payload,
    status: row.status,
    ...(row.publishedAt ? { publishedAt: row.publishedAt } : {}),
    authorDisplayMode: row.authorDisplayMode,
    authorDisplayName: row.author,
  });
};

const upsertProjectionMutation = async (
  input: MutationRefreshInput,
  refreshRunId: string
): Promise<void> => {
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const loadedRow =
        input.row ?? (await loadMainserverProjectionMutationRow(input.target, input.entityId));
      const row = await enrichMutationProjectionRowWithBinding(input.target, loadedRow);
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

export const refreshMainserverProjectionForMutation = async (
  input: MutationRefreshInput
): Promise<void> => {
  const { target } = input;
  const refreshRunId = randomUUID();
  await enqueueProjectionWork(target, async () => {
    await markProjectionSyncStarted(target, refreshRunId, 'hot');
    try {
      await (input.operation === 'delete'
        ? deleteProjectionMutation(input, refreshRunId)
        : upsertProjectionMutation(input, refreshRunId));
    } catch (error) {
      await finalizeFailedMutation(input, refreshRunId, error);
    }
  });
};

const genericItemProjectionContentTypes = [
  GENERIC_ITEMS_CONTENT_TYPE,
  ...new Set(studioMainserverGenericTypeRegistry.values()),
].filter(isMainserverContentType);

const deleteStaleGenericItemSiblingProjection = async (
  target: ContentProjectionSyncTarget,
  entityId: string
): Promise<void> => {
  await enqueueProjectionWork(target, () =>
    withInstanceScopedDb(target.instanceId, async (client) => {
      await deleteMainserverProjectionRowByEntity(client, target, entityId);
    })
  );
};

const refreshGenericItemProjectionSnapshots = async (
  target: ContentProjectionSyncTarget
): Promise<void> => {
  for (const contentType of genericItemProjectionContentTypes) {
    await triggerMainserverProjectionRefresh(
      { ...target, contentType },
      { force: true, awaitCompletion: true, trigger: 'mutation_follow_up' }
    );
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
  if (
    input.operation !== 'delete' ||
    !target.actorAccountId ||
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
      actorAccountId: target.actorAccountId,
      actorDisplayName: target.actorDisplayName,
      mutationRef: target.mutationRef,
      sourceSystem: 'mainserver',
      sourceEntityType,
      sourceEntityId: input.entityId,
    });
  }
};

const loadGenericItemForSiblingRefresh = async (input: GenericItemSiblingRefreshInput) => {
  if (input.operation === 'delete') return { failed: false, item: undefined } as const;
  try {
    return {
      failed: false,
      item: await getSvaMainserverGenericItem({
        activeOrganizationId: input.target.organizationId,
        ...toMutationProjectionConnectionContext(input.target),
        genericItemId: input.entityId,
        instanceId: input.target.instanceId,
        keycloakSubject: input.target.keycloakSubject,
      }),
    } as const;
  } catch {
    return { failed: true, item: undefined } as const;
  }
};

const buildGenericItemSiblingRow = (
  target: ContentProjectionSyncTarget,
  item: Awaited<ReturnType<typeof getSvaMainserverGenericItem>>
): MainserverProjectionRowInput => {
  const principal = requireMutationProjectionPrincipalContext(target);
  return {
    ...mapGenericItem(item, target.instanceId, []),
    contentType: target.contentType,
    ...(target.organizationId ? { organizationId: target.organizationId } : {}),
    credentialSource: principal.actingPrincipalType,
    credentialFingerprint: principal.credentialFingerprint,
    authorizationMode: principal.authorizationMode,
    sourceEntityType: target.contentType,
    sourceEntityId: item.id,
  };
};

const refreshGenericItemSibling = async (input: {
  readonly mutation: GenericItemSiblingRefreshInput;
  readonly contentType: ContentProjectionSyncTarget['contentType'];
  readonly resolvedContentType: string | undefined;
  readonly item: Awaited<ReturnType<typeof getSvaMainserverGenericItem>> | undefined;
}): Promise<void> => {
  const target = { ...input.mutation.target, contentType: input.contentType };
  if (input.contentType !== input.resolvedContentType || !input.item) {
    await deleteStaleGenericItemSiblingProjection(target, input.mutation.entityId);
    return;
  }
  await refreshMainserverProjectionForMutation({
    target,
    operation: input.mutation.operation,
    entityId: input.mutation.entityId,
    row: buildGenericItemSiblingRow(target, input.item),
  });
};

export const refreshGenericItemSiblingProjections = async (
  input: GenericItemSiblingRefreshInput
): Promise<void> => {
  await recordGenericItemDeletionAudit(input);
  const loadedItem = await loadGenericItemForSiblingRefresh(input);
  if (loadedItem.failed) {
    await refreshGenericItemProjectionSnapshots(input.target);
    return;
  }
  const resolvedContentType = loadedItem.item
    ? resolveGenericItemProjectionContentType(loadedItem.item.genericType)
    : undefined;

  for (const contentType of genericItemProjectionContentTypes) {
    await refreshGenericItemSibling({
      mutation: input,
      contentType,
      resolvedContentType,
      item: loadedItem.item,
    });
  }
};

import { randomUUID } from 'node:crypto';
