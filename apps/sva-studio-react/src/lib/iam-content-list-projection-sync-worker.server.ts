import { randomUUID } from 'node:crypto';

import { createSdkLogger, getWorkspaceContext } from '@sva/server-runtime';

import {
  createListErrorResponse,
  MAINSERVER_PROGRESSIVE_FETCH_PAGE_SIZE,
  normalizeApiErrorCode,
} from './iam-content-list-api.shared.js';
import type {
  ContentProjectionSyncTarget,
  MainserverProjectionRowInput,
  ProjectionRefreshTrigger,
} from './iam-content-list-projection-model.server.js';
import {
  buildProjectionLogContext,
  buildProjectionTargetKey,
  markProjectionRefreshPhase,
  markProjectionSyncFailed,
  markProjectionSyncStarted,
  persistMainserverProjectionRowsProgressively,
} from './iam-content-list-projection-repository.server.js';
import { loadMainserverProjectionPage } from './iam-content-list-projection-source.server.js';
import { runMainserverProjectionRoundRobin } from './mainserver-projection-refresh-coordinator.server.js';

const MAIN_SERVER_SYNC_POLL_INTERVAL_MS = 60 * 1000;
const MAX_SYNC_ITEMS_PER_TYPE = 5_000;
export const contentProjectionLogger = createSdkLogger({
  component: 'iam-content-list-projection',
  level: 'debug',
});

export const runningProjectionSyncs = new Map<string, Promise<Response | null>>();
const registeredProjectionTargets = new Map<string, ContentProjectionSyncTarget>();
let contentProjectionSchedulerStarted = false;
let contentProjectionSchedulerTimer: ReturnType<typeof setInterval> | null = null;

export const enqueueProjectionWork = async (
  target: ContentProjectionSyncTarget,
  work: () => Promise<void>
): Promise<void> => {
  const targetKey = buildProjectionTargetKey(target);
  const precedingSync = runningProjectionSyncs.get(targetKey) ?? Promise.resolve(null);
  const queuedWork = precedingSync.then(work);
  const registeredWork = queuedWork
    .then(
      () => null as Response | null,
      () => null as Response | null
    )
    .finally(() => {
      if (runningProjectionSyncs.get(targetKey) === registeredWork) {
        runningProjectionSyncs.delete(targetKey);
      }
    });

  runningProjectionSyncs.set(targetKey, registeredWork);
  await queuedWork;
};

export const refreshMainserverProjectionBatch = (
  targets: readonly ContentProjectionSyncTarget[],
  trigger: ProjectionRefreshTrigger
): Readonly<{
  hotCompletion: Promise<Map<string, Response | null>>;
  completion: Promise<Map<string, Response | null>>;
}> => {
  const responses = new Map<string, Response | null>();
  const accumulatedRows = new Map<string, MainserverProjectionRowInput[]>();
  const refreshRunIds = new Map<string, string>();
  const skippedInvalidCounts = new Map<string, number>();
  const genericItemScanOffsets = new Map<string, number>();
  let resolveHotCompletion: ((responses: Map<string, Response | null>) => void) | undefined;
  const hotCompletion = new Promise<Map<string, Response | null>>((resolve) => {
    resolveHotCompletion = resolve;
  });

  const completion = (async () => {
    for (const target of targets) {
      const targetKey = buildProjectionTargetKey(target);
      const refreshRunId = randomUUID();
      await markProjectionSyncStarted(target, refreshRunId, 'hot');
      accumulatedRows.set(targetKey, []);
      refreshRunIds.set(targetKey, refreshRunId);
      skippedInvalidCounts.set(targetKey, 0);
    }

    await runMainserverProjectionRoundRobin(
      targets,
      MAINSERVER_PROGRESSIVE_FETCH_PAGE_SIZE,
      async (target, pageQuery) => {
        const targetKey = buildProjectionTargetKey(target);
        const genericItemScanOffset = genericItemScanOffsets.get(targetKey);
        const result = await loadMainserverProjectionPage(target, {
          ...pageQuery,
          ...(genericItemScanOffset !== undefined ? { genericItemScanOffset } : {}),
        });
        if (result.nextGenericItemScanOffset !== undefined) {
          genericItemScanOffsets.set(targetKey, result.nextGenericItemScanOffset);
        } else {
          genericItemScanOffsets.delete(targetKey);
        }
        skippedInvalidCounts.set(
          targetKey,
          (skippedInvalidCounts.get(targetKey) ?? 0) + result.skippedInvalidCount
        );
        return {
          data: result.rows,
          hasNextPage: result.hasNextPage,
          nextPage: result.nextPage,
        };
      },
      async (target, pages) => {
        const targetKey = buildProjectionTargetKey(target);
        const rows = pages.flat().slice(0, MAX_SYNC_ITEMS_PER_TYPE);
        accumulatedRows.set(targetKey, rows);
        const latestPage = pages.at(-1) ?? [];
        contentProjectionLogger.debug('mainserver_projection_page_loaded', {
          ...buildProjectionLogContext(target, trigger),
          loaded_row_count: latestPage.length,
          page: pages.length,
          page_size: MAINSERVER_PROGRESSIVE_FETCH_PAGE_SIZE,
          projected_row_count: rows.length,
        });
        await persistMainserverProjectionRowsProgressively({
          target,
          keycloakSubject: target.keycloakSubject,
          actorAccountId: target.actorAccountId,
          rows: latestPage,
          finalize: false,
          page: pages.length,
          refreshRunId: refreshRunIds.get(targetKey) as string,
          skippedInvalidCount: skippedInvalidCounts.get(targetKey) ?? 0,
        });
      },
      async (target, _pages, error) => {
        const errorCode = normalizeApiErrorCode(
          error && typeof error === 'object' && 'code' in error
            ? (error as { code?: unknown }).code
            : undefined
        );
        const errorMessage =
          error instanceof Error
            ? error.message
            : 'Mainserver-Inhalte konnten nicht synchronisiert werden.';
        contentProjectionLogger.warn('mainserver_projection_page_failed', {
          ...buildProjectionLogContext(target, trigger),
          error_code: errorCode,
          error_message: errorMessage,
          page: _pages.length + 1,
          page_size: MAINSERVER_PROGRESSIVE_FETCH_PAGE_SIZE,
        });
        await markProjectionSyncFailed(
          target,
          refreshRunIds.get(buildProjectionTargetKey(target)) as string,
          errorCode,
          errorMessage
        );
        responses.set(
          buildProjectionTargetKey(target),
          createListErrorResponse(503, errorCode, errorMessage, getWorkspaceContext().requestId)
        );
      },
      async () => {
        resolveHotCompletion?.(new Map(responses));
        for (const target of targets) {
          const targetKey = buildProjectionTargetKey(target);
          if (!responses.has(targetKey)) {
            await markProjectionRefreshPhase(
              target,
              refreshRunIds.get(targetKey) as string,
              'reconciliation'
            );
          }
        }
      }
    );

    for (const target of targets) {
      const targetKey = buildProjectionTargetKey(target);
      if (responses.has(targetKey)) {
        continue;
      }

      await persistMainserverProjectionRowsProgressively({
        target,
        keycloakSubject: target.keycloakSubject,
        actorAccountId: target.actorAccountId,
        rows: accumulatedRows.get(targetKey) ?? [],
        finalize: true,
        page: Math.max(
          1,
          Math.ceil(
            (accumulatedRows.get(targetKey)?.length ?? 0) / MAINSERVER_PROGRESSIVE_FETCH_PAGE_SIZE
          )
        ),
        refreshRunId: refreshRunIds.get(targetKey) as string,
        skippedInvalidCount: skippedInvalidCounts.get(targetKey) ?? 0,
      });
      responses.set(targetKey, null);
    }

    resolveHotCompletion?.(new Map(responses));
    return responses;
  })().catch((error: unknown) => {
    resolveHotCompletion?.(new Map(responses));
    throw error;
  });

  return { hotCompletion, completion };
};

export const registerProjectionTarget = (target: ContentProjectionSyncTarget): void => {
  registeredProjectionTargets.set(buildProjectionTargetKey(target), target);
};

export const ensureContentProjectionSchedulerStarted = (
  refreshBatch: (
    targets: readonly ContentProjectionSyncTarget[],
    options: Readonly<{
      force: boolean;
      awaitCompletion: boolean;
      trigger: ProjectionRefreshTrigger;
    }>
  ) => Promise<unknown>
): void => {
  if (contentProjectionSchedulerStarted) {
    return;
  }

  contentProjectionSchedulerStarted = true;
  contentProjectionSchedulerTimer = setInterval(() => {
    const targets = [...registeredProjectionTargets.values()];
    if (targets.length === 0) {
      return;
    }

    void refreshBatch(targets, {
      force: false,
      awaitCompletion: false,
      trigger: 'scheduler',
    });
  }, MAIN_SERVER_SYNC_POLL_INTERVAL_MS);

  contentProjectionSchedulerTimer.unref?.();
};

export const resetProjectionSyncWorkerState = (): void => {
  runningProjectionSyncs.clear();
  registeredProjectionTargets.clear();
  if (contentProjectionSchedulerTimer) {
    clearInterval(contentProjectionSchedulerTimer);
    contentProjectionSchedulerTimer = null;
  }
  contentProjectionSchedulerStarted = false;
};
