import type {
  ApiErrorResponse,
  ApiItemResponse,
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

type StudioJobStatus = (typeof studioJobStatuses)[number];
type TerminalStudioJobStatus = (typeof terminalStudioJobStatuses)[number];
type StudioJobErrorCategory = (typeof studioJobErrorCategories)[number];
type StudioJobEventType = (typeof studioJobEventTypes)[number];

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

const studioImportPhases = [
  'ingestion',
  'schema-validation',
  'mapping',
  'preview',
  'commit',
  'completed',
] as const;

type StudioImportPhase = (typeof studioImportPhases)[number];

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

export type StudioJobError = {
  readonly code: string;
  readonly category: StudioJobErrorCategory;
  readonly message?: string;
  readonly details?: Readonly<Record<string, unknown>>;
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
  readonly details?: Readonly<Record<string, unknown>>;
  readonly createdAt: string;
};

export type StudioJobRecord = {
  readonly id: string;
  readonly instanceId: string;
  readonly pluginId: string;
  readonly jobTypeId: string;
  readonly importProfileId?: string;
  readonly queueName: string;
  readonly status: StudioJobStatus;
  readonly progress?: StudioJobProgress;
  readonly inputPayload: Readonly<Record<string, unknown>>;
  readonly resultPayload?: Readonly<Record<string, unknown>>;
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
};

export type StudioJobStartRequest = {
  readonly pluginId: string;
  readonly jobTypeId: string;
  readonly importProfileId?: string;
  readonly correlationId?: string;
  readonly parentJobId?: string;
  readonly input: Readonly<Record<string, unknown>>;
};

const studioPluginOperationApiErrorCodes = [
  'unauthorized',
  'forbidden',
  'not_found',
  'invalid_request',
  'invalid_instance_id',
  'idempotency_key_required',
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

export type StudioPluginOperationApiErrorResponse = Omit<ApiErrorResponse, 'error'> & {
  readonly error: StudioPluginOperationApiError;
};
