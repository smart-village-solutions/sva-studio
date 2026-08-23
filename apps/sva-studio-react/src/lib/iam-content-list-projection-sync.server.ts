import type { AuthenticatedRequestContext } from '@sva/auth-runtime/server';

import type {
  ContentProjectionSyncState,
  ContentProjectionSyncTarget,
  ProjectionRefreshTrigger,
  ProjectionSyncStateRow,
  TriggerProjectionRefreshResult,
} from './iam-content-list-projection-model.server.js';
import {
  buildProjectionLogContext,
  buildProjectionTargetKey,
  countProjectedRowsForScope,
  loadProjectionSyncState,
  resetProjectionRepositoryRuntimeState,
  toMainserverContentType,
} from './iam-content-list-projection-repository.server.js';
import {
  contentProjectionLogger,
  ensureContentProjectionSchedulerStarted,
  refreshMainserverProjectionBatch,
  registerProjectionTarget,
  resetProjectionSyncWorkerState,
  runningProjectionSyncs,
} from './iam-content-list-projection-sync-worker.server.js';

export { enqueueProjectionWork } from './iam-content-list-projection-sync-worker.server.js';

const MAIN_SERVER_SYNC_STALE_MS = 5 * 60 * 1000;

type NormalizedProjectionSyncStateRow = Required<ProjectionSyncStateRow>;

const emptyProjectionSyncStateRow: ProjectionSyncStateRow = {
  sync_scope_key: '',
  last_started_at: null,
  last_succeeded_at: null,
  last_failed_at: null,
  last_error_code: null,
  last_error_message: null,
  projected_count: 0,
};

const valueOrDefault = <T>(value: T | undefined, fallback: T): T => value ?? fallback;

const normalizeProjectionSyncStateRow = (
  row: ProjectionSyncStateRow | null
): NormalizedProjectionSyncStateRow => {
  const source = row ?? emptyProjectionSyncStateRow;
  return {
    sync_scope_key: source.sync_scope_key,
    last_started_at: source.last_started_at,
    last_succeeded_at: source.last_succeeded_at,
    last_failed_at: source.last_failed_at,
    last_error_code: source.last_error_code,
    last_error_message: source.last_error_message,
    projected_count: source.projected_count,
    snapshot_state: valueOrDefault(source.snapshot_state, 'empty'),
    refresh_run_id: valueOrDefault(source.refresh_run_id, null),
    refresh_phase: valueOrDefault(source.refresh_phase, null),
    completed_page: valueOrDefault(source.completed_page, 0),
    available_count: valueOrDefault(source.available_count, 0),
    is_total_final: valueOrDefault(source.is_total_final, false),
    skipped_invalid_count: valueOrDefault(source.skipped_invalid_count, 0),
  };
};

const deriveProjectionSyncState = (input: {
  readonly target: ContentProjectionSyncTarget;
  readonly row: NormalizedProjectionSyncStateRow;
  readonly hasSnapshot: boolean;
  readonly lastSucceededAtMs: number;
  readonly snapshotState: ContentProjectionSyncState['snapshotState'];
  readonly availableCount: number;
  readonly isTotalFinal: boolean;
}): ContentProjectionSyncState => {
  const optionalTimestamps = Object.fromEntries(
    Object.entries({
      lastStartedAt: input.row.last_started_at,
      lastSucceededAt: input.row.last_succeeded_at,
      lastFailedAt: input.row.last_failed_at,
      lastErrorCode: input.row.last_error_code,
      refreshPhase: input.row.refresh_phase,
    }).filter((entry): entry is [string, string] => typeof entry[1] === 'string')
  ) as Partial<
    Pick<
      ContentProjectionSyncState,
      'lastStartedAt' | 'lastSucceededAt' | 'lastFailedAt' | 'lastErrorCode' | 'refreshPhase'
    >
  >;

  return {
    contentType: input.target.contentType,
    ...optionalTimestamps,
    isStale:
      !input.hasSnapshot ||
      !Number.isFinite(input.lastSucceededAtMs) ||
      Date.now() - input.lastSucceededAtMs >= MAIN_SERVER_SYNC_STALE_MS,
    isSyncRunning: runningProjectionSyncs.has(buildProjectionTargetKey(input.target)),
    hasSnapshot: input.hasSnapshot,
    snapshotState: input.snapshotState,
    completedPage: input.row.completed_page,
    availableCount: input.availableCount,
    isTotalFinal: input.isTotalFinal,
    skippedInvalidCount: input.row.skipped_invalid_count,
  };
};

const resolveScopeSnapshotAvailability = async (
  target: ContentProjectionSyncTarget,
  syncState: NormalizedProjectionSyncStateRow,
  hasGlobalSnapshot: boolean
): Promise<boolean> => {
  const hasLegacyGlobalSnapshot = hasGlobalSnapshot && !syncState.sync_scope_key;
  const partialReadsEnabled =
    (process.env.SVA_CONTENT_PROJECTION_PARTIAL_READS_ENABLED ?? 'true') === 'true';
  if (hasLegacyGlobalSnapshot || (!hasGlobalSnapshot && !partialReadsEnabled)) {
    return hasGlobalSnapshot;
  }
  const projectedRowsForScope = await countProjectedRowsForScope(target);
  return projectedRowsForScope > 0 || (hasGlobalSnapshot && syncState.projected_count === 0);
};

export const resetContentProjectionRuntimeStateForTests = (): void => {
  resetProjectionSyncWorkerState();
  resetProjectionRepositoryRuntimeState();
};

const computeProjectionSyncState = async (
  target: ContentProjectionSyncTarget
): Promise<ContentProjectionSyncState> => {
  const loadedSyncState = await loadProjectionSyncState(target);
  const sourceSyncState = loadedSyncState ?? emptyProjectionSyncStateRow;
  const syncState = normalizeProjectionSyncStateRow(loadedSyncState);
  const lastSucceededAtMs = syncState.last_succeeded_at
    ? Date.parse(syncState.last_succeeded_at)
    : Number.NaN;
  const hasGlobalSnapshot = Number.isFinite(lastSucceededAtMs);
  const hasSnapshot = await resolveScopeSnapshotAvailability(target, syncState, hasGlobalSnapshot);

  return deriveProjectionSyncState({
    target,
    row: syncState,
    hasSnapshot,
    lastSucceededAtMs,
    snapshotState: valueOrDefault(
      sourceSyncState.snapshot_state,
      hasSnapshot ? 'complete_fresh' : 'empty'
    ),
    availableCount: valueOrDefault(sourceSyncState.available_count, syncState.projected_count),
    isTotalFinal: valueOrDefault(sourceSyncState.is_total_final, hasSnapshot),
  });
};

export const triggerMainserverProjectionRefresh = async (
  target: ContentProjectionSyncTarget,
  options: {
    readonly force: boolean;
    readonly awaitCompletion: boolean;
    readonly trigger: ProjectionRefreshTrigger;
  }
): Promise<TriggerProjectionRefreshResult> => {
  return triggerMainserverProjectionRefreshBatch([target], options);
};

type ProjectionRefreshOptions = Readonly<{
  force: boolean;
  awaitCompletion: boolean;
  trigger: ProjectionRefreshTrigger;
}>;

const partitionProjectionSyncs = (targets: readonly ContentProjectionSyncTarget[]) => {
  const pendingSyncs = new Map<string, Promise<Response | null>>();
  const idleTargets: ContentProjectionSyncTarget[] = [];
  for (const target of targets) {
    const targetKey = buildProjectionTargetKey(target);
    const runningSync = runningProjectionSyncs.get(targetKey);
    if (runningSync) pendingSyncs.set(targetKey, runningSync);
    else idleTargets.push(target);
  }
  return { pendingSyncs, idleTargets };
};

const registerProjectionBatch = (
  idleTargets: readonly ContentProjectionSyncTarget[],
  trigger: ProjectionRefreshTrigger,
  pendingSyncs: Map<string, Promise<Response | null>>
): Map<string, Promise<Response | null>> => {
  const hotSyncs = new Map<string, Promise<Response | null>>();
  if (idleTargets.length === 0) return hotSyncs;
  const batchRun = refreshMainserverProjectionBatch(idleTargets, trigger);

  for (const target of idleTargets) {
    const targetKey = buildProjectionTargetKey(target);
    const targetPromise = batchRun.completion
      .then((responses) => responses.get(targetKey) ?? null)
      .catch((error: unknown) => {
        contentProjectionLogger.warn('mainserver_projection_reconciliation_failed', {
          ...buildProjectionLogContext(target, trigger),
          error_message:
            error instanceof Error ? error.message : 'Mainserver-Reconciliation fehlgeschlagen.',
        });
        return new Response(null, { status: 500 });
      })
      .finally(() => {
        if (runningProjectionSyncs.get(targetKey) === targetPromise) {
          runningProjectionSyncs.delete(targetKey);
        }
      });
    runningProjectionSyncs.set(targetKey, targetPromise);
    pendingSyncs.set(targetKey, targetPromise);
    hotSyncs.set(
      targetKey,
      batchRun.hotCompletion.then((responses) => responses.get(targetKey) ?? null)
    );
  }
  return hotSyncs;
};

const markStatesRunning = (
  targets: readonly ContentProjectionSyncTarget[],
  targetsToRefresh: readonly ContentProjectionSyncTarget[],
  states: readonly ContentProjectionSyncState[]
): readonly ContentProjectionSyncState[] =>
  states.map((state, index) =>
    targetsToRefresh.includes(targets[index] as ContentProjectionSyncTarget)
      ? { ...state, isSyncRunning: true }
      : state
  );

const deriveCompletedRefreshStatus = (input: {
  readonly results: readonly (Response | null)[];
  readonly idleTargetCount: number;
  readonly usedHotCompletion: boolean;
}): TriggerProjectionRefreshResult['status'] => {
  if (input.results.some((result) => result !== null)) return 'failed';
  if (input.idleTargetCount === 0) return 'already_running';
  return input.usedHotCompletion ? 'accepted' : 'completed';
};

export const triggerMainserverProjectionRefreshBatch = async (
  targets: readonly ContentProjectionSyncTarget[],
  options: ProjectionRefreshOptions
): Promise<TriggerProjectionRefreshResult> => {
  if (targets.length === 0) {
    return { status: 'accepted', syncStates: [] };
  }

  for (const target of targets) {
    registerProjectionTarget(target);
  }
  ensureContentProjectionSchedulerStarted(triggerMainserverProjectionRefreshBatch);

  const currentStates = await computeProjectionSyncStates(targets);
  const targetsToRefresh = targets.filter((_target, index) => {
    const currentState = currentStates[index];
    return options.force || !currentState || !currentState.hasSnapshot || currentState.isStale;
  });

  if (targetsToRefresh.length === 0) {
    return { status: 'completed', syncStates: currentStates };
  }

  const { pendingSyncs, idleTargets } = partitionProjectionSyncs(targetsToRefresh);
  const hotSyncs = registerProjectionBatch(idleTargets, options.trigger, pendingSyncs);

  if (!options.awaitCompletion) {
    return {
      status: pendingSyncs.size > idleTargets.length ? 'already_running' : 'accepted',
      syncStates: markStatesRunning(targets, targetsToRefresh, currentStates),
    };
  }

  const hotCompletionEnabled =
    (process.env.SVA_CONTENT_PROJECTION_HOT_COMPLETION_ENABLED ?? 'true') !== 'false';
  const usedHotCompletion = hotCompletionEnabled && hotSyncs.size > 0;
  const awaitedSyncs = usedHotCompletion ? hotSyncs : pendingSyncs;
  const results = await Promise.all(Array.from(awaitedSyncs.values()));
  return {
    status: deriveCompletedRefreshStatus({
      results,
      idleTargetCount: idleTargets.length,
      usedHotCompletion,
    }),
    syncStates: await computeProjectionSyncStates(targets),
  };
};

export const buildProjectionTargets = (
  ctx: AuthenticatedRequestContext,
  contentTypes: readonly string[],
  actorAccountId: string | undefined
): readonly ContentProjectionSyncTarget[] =>
  contentTypes.flatMap((contentType) => {
    const mainserverContentType = toMainserverContentType(contentType);
    if (!mainserverContentType || !ctx.user.instanceId || !actorAccountId) {
      return [];
    }

    return [
      {
        instanceId: ctx.user.instanceId,
        keycloakSubject: ctx.user.id,
        actorAccountId,
        contentType: mainserverContentType,
        ...(ctx.activeOrganizationId ? { organizationId: ctx.activeOrganizationId } : {}),
      } satisfies ContentProjectionSyncTarget,
    ];
  });

export const computeProjectionSyncStates = async (
  targets: readonly ContentProjectionSyncTarget[]
): Promise<readonly ContentProjectionSyncState[]> =>
  Promise.all(targets.map((target) => computeProjectionSyncState(target)));

export const maybeStartBackgroundProjectionRefresh = async (
  targets: readonly ContentProjectionSyncTarget[],
  syncStates: readonly ContentProjectionSyncState[]
): Promise<void> => {
  const staleTargets = targets.filter((_target, index) => syncStates[index]?.isStale === true);
  if (staleTargets.length === 0) {
    return;
  }

  await triggerMainserverProjectionRefreshBatch(staleTargets, {
    force: staleTargets.some((target) => {
      const index = targets.indexOf(target);
      return syncStates[index]?.hasSnapshot === false;
    }),
    awaitCompletion: false,
    trigger: 'reconciliation',
  }).then(() => undefined);
};
