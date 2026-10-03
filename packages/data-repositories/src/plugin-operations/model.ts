import type {
  StudioJobCancellationRequestInput,
  StudioJobCreateInput,
  StudioJobDetail,
  StudioJobEventCreateInput,
  StudioJobEventDetails,
  StudioJobEventRecord,
  StudioJobHeartbeatInput,
  StudioJobListQuery,
  StudioJobProgressUpdateInput,
  StudioJobRecord,
  StudioJobSource,
  StudioJobUpdateInput,
} from '@sva/core';

export type StudioJobRow = {
  readonly id: string;
  readonly instance_id: string;
  readonly source: StudioJobSource;
  readonly plugin_id: string | null;
  readonly job_type_id: string;
  readonly import_profile_id: string | null;
  readonly queue_name: string;
  readonly status: StudioJobRecord['status'];
  readonly progress: Record<string, unknown> | null;
  readonly input_payload: Record<string, unknown>;
  readonly result_payload: Record<string, unknown> | null;
  readonly error_payload: Record<string, unknown> | null;
  readonly attempts: number;
  readonly max_attempts: number;
  readonly idempotency_key: string;
  readonly request_id: string | null;
  readonly actor_account_id: string | null;
  readonly worker_id: string | null;
  readonly heartbeat_at: string | null;
  readonly last_progress_at: string | null;
  readonly cancel_requested_at: string | null;
  readonly correlation_id: string | null;
  readonly parent_job_id: string | null;
  readonly scheduled_at: string;
  readonly started_at: string | null;
  readonly finished_at: string | null;
  readonly created_at: string;
  readonly updated_at: string;
};

export type StudioJobEventRow = {
  readonly id: string;
  readonly job_id: string;
  readonly instance_id: string;
  readonly event_type: StudioJobEventRecord['eventType'];
  readonly status: StudioJobRecord['status'];
  readonly progress: Record<string, unknown> | null;
  readonly attempts: number;
  readonly message: string | null;
  readonly details: Record<string, unknown> | null;
  readonly created_at: string;
};

export type StudioJobListRow = StudioJobRow & {
  readonly latest_event_id: string | null;
  readonly latest_event_type: StudioJobEventRecord['eventType'] | null;
  readonly latest_event_status: StudioJobRecord['status'] | null;
  readonly latest_event_progress: Record<string, unknown> | null;
  readonly latest_event_attempts: number | null;
  readonly latest_event_message: string | null;
  readonly latest_event_details: Record<string, unknown> | null;
  readonly latest_event_created_at: string | null;
  readonly total_count: number;
};

export type StudioJobCountRow = {
  readonly total_count: number;
};

export type StudioJobListResultItem = StudioJobRecord & {
  readonly latestEvent?: StudioJobEventRecord;
};

export type StudioJobListResult = {
  readonly items: readonly StudioJobListResultItem[];
  readonly total: number;
};

export type StudioJobTerminalLeasePredicate =
  { readonly kind: 'activeOwner' } | { readonly kind: 'expiredOwner' };

export type StudioJobRepository = {
  createJob(input: StudioJobCreateInput): Promise<StudioJobRecord>;
  getJobById(instanceId: string, jobId: string): Promise<StudioJobRecord | null>;
  getJobDetail(instanceId: string, jobId: string): Promise<StudioJobDetail | null>;
  listJobs(instanceId: string, query: StudioJobListQuery): Promise<StudioJobListResult>;
  deleteJob(instanceId: string, jobId: string): Promise<StudioJobRecord | null>;
  updateJobState(input: StudioJobUpdateInput): Promise<StudioJobRecord | null>;
  transitionJobState(
    input: StudioJobUpdateInput & {
      readonly expectedStatuses: readonly StudioJobRecord['status'][];
      readonly expectedAttempts: number;
      readonly expectedWorkerId: string | null;
      readonly leasePredicate?: Extract<StudioJobTerminalLeasePredicate, { kind: 'activeOwner' }>;
    }
  ): Promise<
    | { readonly outcome: 'applied'; readonly job: StudioJobRecord }
    | { readonly outcome: 'alreadyApplied'; readonly job: StudioJobRecord }
    | { readonly outcome: 'conflict'; readonly job?: StudioJobRecord }
  >;
  transitionJobStateAndAppendEvent(
    input: StudioJobUpdateInput & {
      readonly expectedStatuses: readonly StudioJobRecord['status'][];
      readonly expectedAttempts: number;
      readonly expectedWorkerId: string | null;
      readonly leasePredicate: StudioJobTerminalLeasePredicate;
      readonly event: StudioJobEventCreateInput;
    }
  ): Promise<
    | { readonly outcome: 'applied'; readonly job: StudioJobRecord }
    | { readonly outcome: 'alreadyApplied'; readonly job: StudioJobRecord }
    | { readonly outcome: 'conflict'; readonly job?: StudioJobRecord }
  >;
  updateJobProgress(input: StudioJobProgressUpdateInput): Promise<StudioJobRecord | null>;
  updateJobProgressWithLease(
    input: StudioJobProgressUpdateInput & {
      readonly attempts: number;
      readonly workerId: string;
    }
  ): Promise<StudioJobRecord | null>;
  touchJobHeartbeat(input: StudioJobHeartbeatInput): Promise<StudioJobRecord | null>;
  touchJobHeartbeatWithLease(
    input: StudioJobHeartbeatInput & {
      readonly attempts: number;
      readonly workerId: string;
    }
  ): Promise<StudioJobRecord | null>;
  requestJobCancellation(input: StudioJobCancellationRequestInput): Promise<StudioJobRecord | null>;
  appendJobEvent(input: StudioJobEventCreateInput): Promise<StudioJobEventRecord>;
};

const nullAsUndefined = <T>(value: T | null): T | undefined => value ?? undefined;

export const mapStudioJobRow = (row: StudioJobRow): StudioJobRecord => ({
  id: row.id,
  instanceId: row.instance_id,
  source: row.source,
  pluginId: nullAsUndefined(row.plugin_id),
  jobTypeId: row.job_type_id,
  importProfileId: nullAsUndefined(row.import_profile_id),
  queueName: row.queue_name,
  status: row.status,
  progress: nullAsUndefined(row.progress as StudioJobRecord['progress'] | null),
  inputPayload: row.input_payload,
  resultPayload: nullAsUndefined(row.result_payload),
  errorPayload: nullAsUndefined(row.error_payload as StudioJobRecord['errorPayload'] | null),
  attempts: row.attempts,
  maxAttempts: row.max_attempts,
  idempotencyKey: row.idempotency_key,
  requestId: nullAsUndefined(row.request_id),
  actorAccountId: nullAsUndefined(row.actor_account_id),
  workerId: nullAsUndefined(row.worker_id),
  heartbeatAt: nullAsUndefined(row.heartbeat_at),
  lastProgressAt: nullAsUndefined(row.last_progress_at),
  cancelRequestedAt: nullAsUndefined(row.cancel_requested_at),
  correlationId: nullAsUndefined(row.correlation_id),
  parentJobId: nullAsUndefined(row.parent_job_id),
  scheduledAt: row.scheduled_at,
  startedAt: nullAsUndefined(row.started_at),
  finishedAt: nullAsUndefined(row.finished_at),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const mapStudioJobEventRow = (row: StudioJobEventRow): StudioJobEventRecord => ({
  id: row.id,
  jobId: row.job_id,
  instanceId: row.instance_id,
  eventType: row.event_type,
  status: row.status,
  progress: (row.progress as StudioJobEventRecord['progress'] | null) ?? undefined,
  attempts: row.attempts,
  message: row.message ?? undefined,
  details: (row.details as StudioJobEventDetails | null) ?? undefined,
  createdAt: row.created_at,
});

export const mapStudioJobListRow = (row: StudioJobListRow): StudioJobListResultItem => ({
  ...mapStudioJobRow(row),
  ...(row.latest_event_id
    ? {
        latestEvent: {
          id: row.latest_event_id,
          jobId: row.id,
          instanceId: row.instance_id,
          eventType: row.latest_event_type ?? 'job.queued',
          status: row.latest_event_status ?? row.status,
          progress:
            (row.latest_event_progress as StudioJobEventRecord['progress'] | null) ?? undefined,
          attempts: row.latest_event_attempts ?? row.attempts,
          message: row.latest_event_message ?? undefined,
          details: (row.latest_event_details as StudioJobEventDetails | null) ?? undefined,
          createdAt: row.latest_event_created_at ?? row.updated_at,
        },
      }
    : {}),
});
