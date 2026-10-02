import type {
  ApiErrorResponse,
  ApiItemResponse,
  ApiListResponse,
  IamRuntimeDiagnosticClassification,
  IamRuntimeDiagnosticStatus,
  IamRuntimeRecommendedAction,
  IamRuntimeSafeDetails,
} from './iam/account-management-contract.js';
import type {
  StudioJobDetail,
  StudioJobListItem,
  StudioJobRecord,
} from './studio-job-record-contract.js';

export * from './studio-job-status-contract.js';
export type * from './studio-job-record-contract.js';

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
  'active_job_exists',
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
