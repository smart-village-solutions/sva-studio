import type {
  StudioJobCancellationRequestInput,
  StudioJobCreateInput,
  StudioJobDetail,
  StudioJobEventCreateInput,
  StudioJobEventRecord,
  StudioJobHeartbeatInput,
  StudioJobListQuery,
  StudioJobProgressUpdateInput,
  StudioJobRecord,
  StudioJobUpdateInput,
} from '@sva/core';
import type { SqlExecutor } from '../iam/repositories/types.js';
import { createJobEventStatement, listJobEventsStatement } from './event-statements.js';
import { createJobStatement, deleteJobStatement, getJobByIdStatement } from './job-statements.js';
import {
  requestJobCancellationStatement,
  touchJobHeartbeatStatement,
  touchJobHeartbeatWithLeaseStatement,
  updateJobProgressStatement,
  updateJobProgressWithLeaseStatement,
} from './lease-statements.js';
import { countJobsStatement, listJobsStatement } from './list-statements.js';
import { mapStudioJobEventRow, mapStudioJobListRow, mapStudioJobRow } from './model.js';
import type {
  StudioJobCountRow,
  StudioJobEventRow,
  StudioJobListResult,
  StudioJobListRow,
  StudioJobRepository,
  StudioJobRow,
} from './model.js';
import { queryRows } from './sql-shared.js';
import {
  transitionJobStateAndAppendEventStatement,
  transitionJobStateStatement,
  updateJobStateStatement,
} from './state-statements.js';

export type {
  StudioJobListResult,
  StudioJobListResultItem,
  StudioJobRepository,
  StudioJobTerminalLeasePredicate,
} from './model.js';

const requireFirstRow = <TRow>(row: TRow | undefined, errorCode: string): TRow => {
  if (!row) {
    throw new Error(errorCode);
  }

  return row;
};

const createJob = async (
  executor: SqlExecutor,
  input: StudioJobCreateInput
): Promise<StudioJobRecord> => {
  const rows = await queryRows<StudioJobRow>(executor, createJobStatement(input));
  return mapStudioJobRow(requireFirstRow(rows[0], `studio_job_create_failed:${input.id}`));
};

const getJobById = async (
  executor: SqlExecutor,
  instanceId: string,
  jobId: string
): Promise<StudioJobRecord | null> => {
  const rows = await queryRows<StudioJobRow>(executor, getJobByIdStatement(instanceId, jobId));
  return rows[0] ? mapStudioJobRow(rows[0]) : null;
};

const getJobDetail = async (
  executor: SqlExecutor,
  instanceId: string,
  jobId: string
): Promise<StudioJobDetail | null> => {
  const job = await getJobById(executor, instanceId, jobId);
  if (!job) {
    return null;
  }

  const eventRows = await queryRows<StudioJobEventRow>(
    executor,
    listJobEventsStatement(instanceId, jobId)
  );
  return {
    ...job,
    history: eventRows.map(mapStudioJobEventRow),
  };
};

const listJobs = async (
  executor: SqlExecutor,
  instanceId: string,
  query: StudioJobListQuery
): Promise<StudioJobListResult> => {
  const rows = await queryRows<StudioJobListRow>(executor, listJobsStatement(instanceId, query));
  const shouldFallbackToCount = rows.length === 0 && query.page > 1;
  const fallbackCountRows = shouldFallbackToCount
    ? await queryRows<StudioJobCountRow>(executor, countJobsStatement(instanceId, query))
    : null;
  return {
    items: rows.map(mapStudioJobListRow),
    total: rows[0]?.total_count ?? fallbackCountRows?.[0]?.total_count ?? 0,
  };
};

const deleteJob = async (
  executor: SqlExecutor,
  instanceId: string,
  jobId: string
): Promise<StudioJobRecord | null> => {
  const rows = await queryRows<StudioJobRow>(executor, deleteJobStatement(instanceId, jobId));
  return rows[0] ? mapStudioJobRow(rows[0]) : null;
};

const updateJobState = async (
  executor: SqlExecutor,
  input: StudioJobUpdateInput
): Promise<StudioJobRecord | null> => {
  const rows = await queryRows<StudioJobRow>(executor, updateJobStateStatement(input));
  return rows[0] ? mapStudioJobRow(rows[0]) : null;
};

const transitionJobState = async (
  executor: SqlExecutor,
  input: Parameters<StudioJobRepository['transitionJobState']>[0]
): ReturnType<StudioJobRepository['transitionJobState']> => {
  const rows = await queryRows<StudioJobRow>(executor, transitionJobStateStatement(input));
  const applied = rows[0];
  if (applied) return { outcome: 'applied', job: mapStudioJobRow(applied) };
  const current = await getJobById(executor, input.instanceId, input.jobId);
  if (current?.status === input.status && current.attempts === input.attempts) {
    return { outcome: 'alreadyApplied', job: current };
  }
  return { outcome: 'conflict', ...(current ? { job: current } : {}) };
};

const transitionJobStateAndAppendEvent = async (
  executor: SqlExecutor,
  input: Parameters<StudioJobRepository['transitionJobStateAndAppendEvent']>[0]
): ReturnType<StudioJobRepository['transitionJobStateAndAppendEvent']> => {
  const rows = await queryRows<StudioJobRow>(
    executor,
    transitionJobStateAndAppendEventStatement(input)
  );
  const applied = rows[0];
  if (applied) return { outcome: 'applied', job: mapStudioJobRow(applied) };
  const current = await getJobDetail(executor, input.instanceId, input.jobId);
  const matchingEvent = current?.history.some(
    (event) => event.attempts === input.attempts && event.eventType === input.event.eventType
  );
  if (current?.status === input.status && current.attempts === input.attempts && matchingEvent) {
    return { outcome: 'alreadyApplied', job: current };
  }
  return { outcome: 'conflict', ...(current ? { job: current } : {}) };
};

const updateJobProgress = async (
  executor: SqlExecutor,
  input: StudioJobProgressUpdateInput
): Promise<StudioJobRecord | null> => {
  const rows = await queryRows<StudioJobRow>(executor, updateJobProgressStatement(input));
  return rows[0] ? mapStudioJobRow(rows[0]) : null;
};

const updateJobProgressWithLease = async (
  executor: SqlExecutor,
  input: Parameters<StudioJobRepository['updateJobProgressWithLease']>[0]
): Promise<StudioJobRecord | null> => {
  const rows = await queryRows<StudioJobRow>(executor, updateJobProgressWithLeaseStatement(input));
  return rows[0] ? mapStudioJobRow(rows[0]) : null;
};

const touchJobHeartbeat = async (
  executor: SqlExecutor,
  input: StudioJobHeartbeatInput
): Promise<StudioJobRecord | null> => {
  const rows = await queryRows<StudioJobRow>(executor, touchJobHeartbeatStatement(input));
  return rows[0] ? mapStudioJobRow(rows[0]) : null;
};

const touchJobHeartbeatWithLease = async (
  executor: SqlExecutor,
  input: Parameters<StudioJobRepository['touchJobHeartbeatWithLease']>[0]
): Promise<StudioJobRecord | null> => {
  const rows = await queryRows<StudioJobRow>(executor, touchJobHeartbeatWithLeaseStatement(input));
  return rows[0] ? mapStudioJobRow(rows[0]) : null;
};

const requestJobCancellation = async (
  executor: SqlExecutor,
  input: StudioJobCancellationRequestInput
): Promise<StudioJobRecord | null> => {
  const rows = await queryRows<StudioJobRow>(executor, requestJobCancellationStatement(input));
  return rows[0] ? mapStudioJobRow(rows[0]) : null;
};

const appendJobEvent = async (
  executor: SqlExecutor,
  input: StudioJobEventCreateInput
): Promise<StudioJobEventRecord> => {
  const rows = await queryRows<StudioJobEventRow>(executor, createJobEventStatement(input));
  return mapStudioJobEventRow(
    requireFirstRow(rows[0], `studio_job_event_create_failed:${input.id}`)
  );
};

export const createStudioJobRepository = (executor: SqlExecutor): StudioJobRepository => ({
  createJob: (input) => createJob(executor, input),
  getJobById: (instanceId, jobId) => getJobById(executor, instanceId, jobId),
  getJobDetail: (instanceId, jobId) => getJobDetail(executor, instanceId, jobId),
  listJobs: (instanceId, query) => listJobs(executor, instanceId, query),
  deleteJob: (instanceId, jobId) => deleteJob(executor, instanceId, jobId),
  updateJobState: (input) => updateJobState(executor, input),
  transitionJobState: (input) => transitionJobState(executor, input),
  transitionJobStateAndAppendEvent: (input) => transitionJobStateAndAppendEvent(executor, input),
  updateJobProgress: (input) => updateJobProgress(executor, input),
  updateJobProgressWithLease: (input) => updateJobProgressWithLease(executor, input),
  touchJobHeartbeat: (input) => touchJobHeartbeat(executor, input),
  touchJobHeartbeatWithLease: (input) => touchJobHeartbeatWithLease(executor, input),
  requestJobCancellation: (input) => requestJobCancellation(executor, input),
  appendJobEvent: (input) => appendJobEvent(executor, input),
});
