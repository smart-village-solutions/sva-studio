import type {
  ApiErrorResponse,
  ApiItemResponse,
  ApiListResponse,
  IamRuntimeDiagnosticClassification,
  IamRuntimeDiagnosticStatus,
  IamRuntimeRecommendedAction,
  IamRuntimeSafeDetails,
} from './iam/account-management-contract.js';

const studioJobStatuses = ['queued', 'running', 'retrying', 'succeeded', 'failed', 'cancelled'] as const;
const terminalStudioJobStatuses = ['succeeded', 'failed', 'cancelled'] as const;
const studioJobErrorCategories = ['retryable', 'permanent', 'validation', 'external_dependency'] as const;
const studioJobEventTypes = [
  'job.queued',
  'job.started',
  'job.progressed',
  'job.retrying',
  'job.succeeded',
  'job.failed',
  'job.cancelled',
] as const;

export type StudioJobStatus = (typeof studioJobStatuses)[number];
export type TerminalStudioJobStatus = (typeof terminalStudioJobStatuses)[number];
export type StudioJobErrorCategory = (typeof studioJobErrorCategories)[number];
export type StudioJobEventType = (typeof studioJobEventTypes)[number];
export type StudioJobSource = 'plugin' | 'host';
export type StudioJobStaleState = 'fresh' | 'stale' | 'terminal';
export type StudioJobEventTone = 'neutral' | 'info' | 'success' | 'warning' | 'error';
export type StudioJobListView = 'active' | 'history';

export const studioJobContract = {
  statuses: studioJobStatuses,
  terminalStatuses: terminalStudioJobStatuses,
  isStatus: (value: string): value is StudioJobStatus =>
    (studioJobStatuses as readonly string[]).includes(value),
  isTerminalStatus: (value: string): value is TerminalStudioJobStatus =>
    (terminalStudioJobStatuses as readonly string[]).includes(value),
} as const;

export const studioJobErrorContract = {
  categories: studioJobErrorCategories,
  isCategory: (value: string): value is StudioJobErrorCategory =>
    (studioJobErrorCategories as readonly string[]).includes(value),
} as const;

export const studioJobEventContract = {
  types: studioJobEventTypes,
  isType: (value: string): value is StudioJobEventType =>
    (studioJobEventTypes as readonly string[]).includes(value),
} as const;

export const studioJobRuntimeContract = {
  staleStates: ['fresh', 'stale', 'terminal'] as const,
  isStaleState: (value: string): value is StudioJobStaleState =>
    (['fresh', 'stale', 'terminal'] as readonly string[]).includes(value),
} as const;

export const studioJobListContract = {
  views: ['active', 'history'] as const,
  isView: (value: string): value is StudioJobListView =>
    (['active', 'history'] as readonly string[]).includes(value),
} as const;

const studioImportPhases = [
  'ingestion',
  'schema-validation',
  'mapping',
  'preview',
  'commit',
  'completed',
] as const;

export type StudioImportPhase = (typeof studioImportPhases)[number];

export const studioImportContract = {
  phases: studioImportPhases,
  isPhase: (value: string): value is StudioImportPhase =>
    (studioImportPhases as readonly string[]).includes(value),
} as const;

export type StudioJobProgress = {
  readonly completedSteps: number;
  readonly totalSteps: number;
  readonly currentPhase?: StudioImportPhase | string;
  readonly currentStepKey?: string;
  readonly currentStepLabel?: string;
  readonly details?: Readonly<Record<string, unknown>>;
  readonly lastUpdatedAt?: string;
};

export type StudioJobResultSummary = {
  readonly processedItems?: number;
  readonly acceptedItems?: number;
  readonly rejectedItems?: number;
  readonly skippedItems?: number;
  readonly warningCount?: number;
  readonly durationMs?: number;
};

export type StudioJobResult = {
  readonly summary?: StudioJobResultSummary;
  readonly plugin?: Readonly<Record<string, unknown>>;
};

export type StudioJobError = {
  readonly code: string;
  readonly category: StudioJobErrorCategory;
  readonly message?: string;
  readonly details?: {
    readonly host?: StudioJobEventHostDetails;
    readonly plugin?: Readonly<Record<string, unknown>>;
  };
};

export type StudioJobEventHostDetails = {
  readonly workerId?: string;
  readonly errorCode?: string;
  readonly errorCategory?: StudioJobErrorCategory;
  readonly cancellationRequestedAt?: string;
  readonly source?: StudioJobSource;
  readonly pluginId?: string;
  readonly jobTypeId?: string;
};

export type StudioJobEventDetails = {
  readonly host?: StudioJobEventHostDetails;
  readonly plugin?: Readonly<Record<string, unknown>>;
};

export type StudioJobEventPresentation = {
  readonly tone: StudioJobEventTone;
  readonly title: string;
  readonly isTerminal: boolean;
};

export type StudioJobEventRecord = {
  readonly id: string;
  readonly jobId: string;
  readonly instanceId: string;
  readonly eventType: StudioJobEventType;
  readonly status: StudioJobStatus;
  readonly progress?: StudioJobProgress;
  readonly attempts: number;
  readonly message?: string;
  readonly details?: StudioJobEventDetails;
  readonly presentation?: StudioJobEventPresentation;
  readonly createdAt: string;
};

export type StudioJobEventCreateInput = Omit<StudioJobEventRecord, 'createdAt'>;

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

export type StudioPluginOperationStartRequest = {
  readonly pluginId: string;
  readonly jobTypeId: string;
  readonly importProfileId?: string;
  readonly correlationId?: string;
  readonly parentJobId?: string;
  readonly input: Readonly<Record<string, unknown>>;
};

export type StudioJobStartRequest = StudioPluginOperationStartRequest;

const studioPluginOperationApiErrorCodes = [
  'unauthorized',
  'forbidden',
  'not_found',
  'invalid_request',
  'invalid_instance_id',
  'csrf_validation_failed',
  'idempotency_key_required',
  'idempotency_key_reuse',
  'database_unavailable',
] as const;

type StudioPluginOperationApiErrorCode = (typeof studioPluginOperationApiErrorCodes)[number];

export const studioPluginOperationErrorContract = {
  codes: studioPluginOperationApiErrorCodes,
  isCode: (value: string): value is StudioPluginOperationApiErrorCode =>
    (studioPluginOperationApiErrorCodes as readonly string[]).includes(value),
} as const;

export type StudioPluginOperationApiError = {
  readonly code: StudioPluginOperationApiErrorCode;
  readonly message: string;
  readonly details?: Readonly<Record<string, unknown>>;
  readonly classification: IamRuntimeDiagnosticClassification;
  readonly status: IamRuntimeDiagnosticStatus;
  readonly recommendedAction: IamRuntimeRecommendedAction;
  readonly safeDetails?: IamRuntimeSafeDetails;
};

export type StudioJobResponse = ApiItemResponse<StudioJobRecord>;
export type StudioJobDetailResponse = ApiItemResponse<StudioJobDetail>;
export type StudioJobListResponse = ApiListResponse<StudioJobListItem>;

export type StudioPluginOperationApiErrorResponse = Omit<ApiErrorResponse, 'error'> & {
  readonly error: StudioPluginOperationApiError;
};
