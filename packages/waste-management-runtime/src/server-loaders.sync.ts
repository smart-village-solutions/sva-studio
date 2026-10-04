import { deriveWasteMainserverSyncStatus } from '@sva/waste-management-contracts';
import type {
  WasteMainserverSourceRevisionRecord,
  WasteMainserverSyncJobSummary,
  WasteMainserverSyncStatusRecord,
  WasteMainserverSuccessfulSyncSummary,
} from '@sva/waste-management-contracts';
import type { WasteLoaderContext } from './server-loaders.context.js';
import type { WasteServerLoaderHost } from './server-loaders.js';

type WasteMainserverSyncStatusJobRow = {
  readonly role: 'active' | 'latest_attempt' | 'last_success';
  readonly id: string;
  readonly status: WasteMainserverSyncJobSummary['status'];
  readonly started_at: string | Date | null;
  readonly finished_at: string | Date | null;
  readonly progress: WasteMainserverSyncJobSummary['progress'] | null;
  readonly source_revision: string | null;
  readonly year_window: unknown;
};
export class WasteSyncLoaders {
  constructor(
    private readonly context: WasteLoaderContext,
    private readonly host: WasteServerLoaderHost
  ) {}

  toIsoString = (value: string | Date | null): string | undefined =>
    value instanceof Date ? value.toISOString() : (value ?? undefined);

  toSyncJobSummary = (row: WasteMainserverSyncStatusJobRow): WasteMainserverSyncJobSummary => ({
    id: row.id,
    status: row.status,
    ...(this.toIsoString(row.started_at) ? { startedAt: this.toIsoString(row.started_at) } : {}),
    ...(this.toIsoString(row.finished_at) ? { finishedAt: this.toIsoString(row.finished_at) } : {}),
    ...(row.progress ? { progress: row.progress } : {}),
  });

  isYearWindow = (value: unknown): value is readonly [number, number] =>
    Array.isArray(value) &&
    value.length === 2 &&
    value.every((year) => Number.isInteger(year)) &&
    value[1] === value[0] + 1;

  loadWasteMainserverSyncStatusJobs = (
    instanceId: string
  ): Promise<readonly WasteMainserverSyncStatusJobRow[]> =>
    this.host.withInstanceDb(instanceId, async (client) => {
      const result = await client.query<WasteMainserverSyncStatusJobRow>(
        `
WITH relevant_jobs AS (
  SELECT
    id,
    status,
    started_at,
    finished_at,
    progress,
    result_payload -> 'plugin' ->> 'sourceRevision' AS source_revision,
    result_payload -> 'plugin' -> 'yearWindow' AS year_window,
    created_at,
    scheduled_at
  FROM iam.studio_jobs
  WHERE instance_id = $1
    AND plugin_id = 'waste-management'
    AND job_type_id = 'waste-management.sync-mainserver'
),
active_job AS (
  SELECT 'active'::text AS role, *
  FROM relevant_jobs
  WHERE status IN ('queued', 'running', 'retrying')
  ORDER BY COALESCE(started_at, scheduled_at, created_at) DESC
  LIMIT 1
),
latest_attempt AS (
  SELECT 'latest_attempt'::text AS role, *
  FROM relevant_jobs
  ORDER BY created_at DESC
  LIMIT 1
),
last_success AS (
  SELECT 'last_success'::text AS role, *
  FROM relevant_jobs
  WHERE status = 'succeeded'
    AND finished_at IS NOT NULL
    AND source_revision ~ '^[0-9]+$'
    AND jsonb_typeof(year_window) = 'array'
    AND jsonb_array_length(year_window) = 2
  ORDER BY finished_at DESC
  LIMIT 1
)
SELECT role, id, status, started_at, finished_at, progress, source_revision, year_window
FROM active_job
UNION ALL
SELECT role, id, status, started_at, finished_at, progress, source_revision, year_window
FROM latest_attempt
UNION ALL
SELECT role, id, status, started_at, finished_at, progress, source_revision, year_window
FROM last_success
      `,
        [instanceId]
      );
      return result.rows;
    });

  loadWasteMainserverSyncStatus = async (
    instanceId: string
  ): Promise<WasteMainserverSyncStatusRecord> => {
    const currentYear = new Date().getUTCFullYear();
    const [sourceResult, jobsResult] = await Promise.allSettled([
      this.context.withWasteRepository(
        instanceId,
        'load_mainserver_sync_source_revision',
        (repository) => repository.getWasteMainserverSourceRevision()
      ),
      this.loadWasteMainserverSyncStatusJobs(instanceId),
    ]);

    const sourceRevision: WasteMainserverSourceRevisionRecord | null =
      sourceResult.status === 'fulfilled' ? sourceResult.value : null;
    const jobs = jobsResult.status === 'fulfilled' ? jobsResult.value : [];
    const activeRow = jobs.find((row) => row.role === 'active');
    const latestAttemptRow = jobs.find((row) => row.role === 'latest_attempt');
    const successRow = jobs.find((row) => row.role === 'last_success');
    const lastSuccessfulSync: WasteMainserverSuccessfulSyncSummary | undefined =
      successRow?.status === 'succeeded' &&
      successRow.source_revision !== null &&
      this.isYearWindow(successRow.year_window)
        ? {
            ...this.toSyncJobSummary(successRow),
            status: 'succeeded',
            sourceRevision: successRow.source_revision,
            yearWindow: successRow.year_window,
          }
        : undefined;

    return deriveWasteMainserverSyncStatus({
      currentYear,
      jobsAvailable: jobsResult.status === 'fulfilled',
      sourceRevision,
      ...(lastSuccessfulSync ? { lastSuccessfulSync } : {}),
      ...(latestAttemptRow ? { latestAttempt: this.toSyncJobSummary(latestAttemptRow) } : {}),
      ...(activeRow ? { activeJob: this.toSyncJobSummary(activeRow) } : {}),
    });
  };
}
