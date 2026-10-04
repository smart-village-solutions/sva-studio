import type {
  StudioJobFollowUpAction,
  StudioJobListView,
  StudioJobSource,
  StudioJobStaleState,
  StudioJobStatus,
} from './studio-job-status-contract.js';
import type {
  StudioJobError,
  StudioJobEventRecord,
  StudioJobProgress,
  StudioJobResult,
} from './studio-job-event-record-contract.js';
export type * from './studio-job-event-record-contract.js';

export type StudioJobRecord = {
  readonly id: string;
  readonly instanceId: string;
  readonly source: StudioJobSource;
  readonly pluginId?: string;
  readonly jobTypeId: string;
  readonly importProfileId?: string;
  readonly queueName: string;
  readonly status: StudioJobStatus;
  readonly progress?: StudioJobProgress;
  readonly inputPayload: Readonly<Record<string, unknown>>;
  readonly resultPayload?: StudioJobResult;
  readonly errorPayload?: StudioJobError;
  readonly attempts: number;
  readonly maxAttempts: number;
  readonly idempotencyKey: string;
  readonly requestId?: string;
  readonly actorAccountId?: string;
  readonly workerId?: string;
  readonly heartbeatAt?: string;
  readonly lastProgressAt?: string;
  readonly cancelRequestedAt?: string;
  readonly correlationId?: string;
  readonly parentJobId?: string;
  readonly scheduledAt: string;
  readonly startedAt?: string;
  readonly finishedAt?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type StudioJobCreateInput = Omit<StudioJobRecord, 'createdAt' | 'updatedAt'>;

export type StudioJobUpdateInput = {
  readonly jobId: string;
  readonly instanceId: string;
  readonly status: StudioJobStatus;
  readonly progress?: StudioJobProgress;
  readonly attempts: number;
  readonly startedAt?: string;
  readonly finishedAt?: string;
  readonly resultPayload?: Readonly<Record<string, unknown>>;
  readonly errorPayload?: StudioJobError;
  readonly workerId?: string;
  readonly heartbeatAt?: string;
};

export type StudioJobProgressUpdateInput = {
  readonly jobId: string;
  readonly instanceId: string;
  readonly progress: StudioJobProgress;
  readonly lastProgressAt: string;
  readonly heartbeatAt?: string;
};

export type StudioJobHeartbeatInput = {
  readonly jobId: string;
  readonly instanceId: string;
  readonly heartbeatAt: string;
  readonly workerId?: string;
};

export type StudioJobCancellationRequestInput = {
  readonly jobId: string;
  readonly instanceId: string;
  readonly cancelRequestedAt: string;
};

export type StudioJobDetail = StudioJobRecord & {
  readonly history: readonly StudioJobEventRecord[];
  readonly latestEvent?: StudioJobEventRecord;
  readonly availableActions?: readonly StudioJobFollowUpAction[];
  readonly runtime?: {
    readonly cancellationRequested: boolean;
    readonly staleState: StudioJobStaleState;
    readonly staleAfterSeconds: number;
    readonly evaluatedAt: string;
    readonly lastObservedAt?: string;
  };
};

export type StudioJobListQuery = {
  readonly view: StudioJobListView;
  readonly page: number;
  readonly pageSize: number;
  readonly status?: StudioJobStatus;
  readonly pluginId?: string;
  readonly jobTypeId?: string;
  readonly q?: string;
};

export type StudioJobRuntimeDiagnostics = NonNullable<StudioJobDetail['runtime']>;

export type StudioJobListItem = Pick<
  StudioJobRecord,
  | 'id'
  | 'instanceId'
  | 'source'
  | 'pluginId'
  | 'jobTypeId'
  | 'status'
  | 'progress'
  | 'attempts'
  | 'maxAttempts'
  | 'correlationId'
  | 'parentJobId'
  | 'workerId'
  | 'startedAt'
  | 'finishedAt'
  | 'createdAt'
  | 'updatedAt'
  | 'lastProgressAt'
  | 'heartbeatAt'
> & {
  readonly latestEvent?: StudioJobEventRecord;
  readonly runtime: StudioJobRuntimeDiagnostics;
};
