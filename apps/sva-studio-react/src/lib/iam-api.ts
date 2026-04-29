import type {
  ApiErrorResponse,
  ApiItemResponse,
  ApiListResponse,
  CreateIamContentInput,
  IamAdminGroupDetail,
  IamAdminGroupListItem,
  IamContentDetail,
  IamContentHistoryEntry,
  IamContentListItem,
  IamDsrCanonicalStatus,
  IamDsrCaseListItem,
  IamDsrSelfServiceOverview,
  IamGovernanceCaseListItem,
  IamInstanceDetail,
  IamInstanceListItem,
  IamLegalTextListItem,
  IamPendingLegalTextItem,
  IamOrganizationContext,
  IamOrganizationDetail,
  IamOrganizationListItem,
  IamOrganizationMembershipVisibility,
  IamOrganizationType,
  IamPermission,
  IamRoleListItem,
  IamRoleReconcileReport,
  RuntimeHealthResponse,
  IamUserDirectPermissionAssignment,
  IamUserTimelineEvent,
  IamUserDetail,
  IamUserImportSyncReport,
  IamUserListItem,
  IamRuntimeDiagnosticClassification,
  IamRuntimeDiagnosticStatus,
  IamRuntimeRecommendedAction,
  IamRuntimeSafeDetails,
  RuntimeDependencyHealth,
  UpdateIamContentInput,
} from '@sva/core';
import {
  deriveIamRuntimeDiagnostics,
  iamRuntimeDiagnosticClassifications,
  iamRuntimeDiagnosticStatuses,
  iamRuntimeRecommendedActions,
} from '@sva/core';
import { createBrowserLogger } from '@sva/monitoring-client/logging';

const IAM_HEADERS = {
  'Content-Type': 'application/json',
  'X-Requested-With': 'XMLHttpRequest',
} as const;

const browserLogger = createBrowserLogger({
  component: 'iam-api',
});

export const LEGAL_ACCEPTANCE_REQUIRED_EVENT = 'sva:legal-acceptance-required';
const DEFAULT_IAM_REQUEST_TIMEOUT_MS = 10_000;
const HEALTH_REQUEST_TIMEOUT_MS = 5_000;
const HEAVY_IAM_REQUEST_TIMEOUT_MS = 20_000;
const KNOWN_RUNTIME_DIAGNOSTIC_CLASSIFICATIONS = new Set<IamRuntimeDiagnosticClassification>(
  iamRuntimeDiagnosticClassifications
);
const KNOWN_RUNTIME_DIAGNOSTIC_STATUSES = new Set<IamRuntimeDiagnosticStatus>(iamRuntimeDiagnosticStatuses);
const KNOWN_RUNTIME_RECOMMENDED_ACTIONS = new Set<IamRuntimeRecommendedAction>(iamRuntimeRecommendedActions);

export class IamHttpError extends Error {
  readonly status: number;
  readonly code: string;
  readonly requestId?: string;
  readonly classification?: IamRuntimeDiagnosticClassification;
  readonly diagnosticStatus?: IamRuntimeDiagnosticStatus;
  readonly recommendedAction?: IamRuntimeRecommendedAction;
  readonly safeDetails?: IamRuntimeSafeDetails;

  constructor(input: {
    status: number;
    code: string;
    message: string;
    requestId?: string;
    classification?: IamRuntimeDiagnosticClassification;
    diagnosticStatus?: IamRuntimeDiagnosticStatus;
    recommendedAction?: IamRuntimeRecommendedAction;
    safeDetails?: IamRuntimeSafeDetails;
  }) {
    super(input.message);
    this.name = 'IamHttpError';
    this.status = input.status;
    this.code = input.code;
    this.requestId = input.requestId;
    this.classification = input.classification;
    this.diagnosticStatus = input.diagnosticStatus;
    this.recommendedAction = input.recommendedAction;
    this.safeDetails = input.safeDetails;
  }
}

type IamErrorPayload =
  | ApiErrorResponse
  | {
      readonly error?: string;
      readonly message?: string;
      readonly requestId?: string;
    };

const hasTopLevelMessage = (
  payload: IamErrorPayload
): payload is IamErrorPayload & { readonly message?: unknown } => 'message' in payload;

const isDevelopmentEnvironment = () => {
  if (typeof process !== 'undefined' && typeof process.env?.NODE_ENV === 'string') {
    return process.env.NODE_ENV !== 'production';
  }
  const meta = import.meta as ImportMeta & { env?: { DEV?: boolean; PROD?: boolean } };
  if (typeof meta.env?.DEV === 'boolean') {
    return meta.env.DEV;
  }
  if (typeof meta.env?.PROD === 'boolean') {
    return !meta.env.PROD;
  }
  return true;
};

const readRequestIdFromResponse = (response: Response, payload?: { requestId?: string }) =>
  payload?.requestId ?? response.headers.get('X-Request-Id') ?? undefined;

const readErrorCodeFromPayload = (payload: IamErrorPayload | null): string | undefined => {
  if (!payload) {
    return undefined;
  }
  if (typeof payload.error === 'string') {
    return payload.error;
  }
  if (typeof payload.error === 'object' && payload.error && 'code' in payload.error) {
    const code = (payload.error as { code?: unknown }).code;
    return typeof code === 'string' ? code : undefined;
  }
  return undefined;
};

const readErrorMessageFromPayload = (payload: IamErrorPayload | null, status: number): string => {
  if (!payload) {
    return `http_${status}`;
  }
  if (typeof payload.error === 'object' && payload.error && 'message' in payload.error) {
    const message = (payload.error as { message?: unknown }).message;
    if (typeof message === 'string') {
      return message;
    }
  }
  if (hasTopLevelMessage(payload) && typeof payload.message === 'string') {
    return payload.message;
  }
  return `http_${status}`;
};

const readSafeDiagnosticDetails = (payload: IamErrorPayload | null): IamRuntimeSafeDetails | undefined => {
  if (!payload || typeof payload.error !== 'object' || !payload.error || !('details' in payload.error)) {
    return undefined;
  }

  const details = (payload.error as { details?: unknown }).details;
  if (!details || typeof details !== 'object') {
    return undefined;
  }

  const source = details as Record<string, unknown>;
  const syncError =
    typeof source.syncError === 'object' && source.syncError !== null ? (source.syncError as Record<string, unknown>) : undefined;
  const safeDetails: IamRuntimeSafeDetails = {
    reason_code: typeof source.reason_code === 'string' ? source.reason_code : undefined,
    dependency: typeof source.dependency === 'string' ? source.dependency : undefined,
    schema_object: typeof source.schema_object === 'string' ? source.schema_object : undefined,
    expected_migration:
      typeof source.expected_migration === 'string' ? source.expected_migration : undefined,
    actor_resolution:
      typeof source.actor_resolution === 'string' ? source.actor_resolution : undefined,
    instance_id: typeof source.instance_id === 'string' ? source.instance_id : undefined,
    return_to: typeof source.return_to === 'string' ? source.return_to : undefined,
    sync_state:
      typeof source.sync_state === 'string'
        ? source.sync_state
        : typeof source.syncState === 'string'
          ? source.syncState
          : undefined,
    sync_error_code:
      typeof source.sync_error_code === 'string'
        ? source.sync_error_code
        : typeof source.syncErrorCode === 'string'
          ? source.syncErrorCode
          : typeof syncError?.code === 'string'
            ? syncError.code
            : undefined,
  };

  return Object.values(safeDetails).some((value) => typeof value === 'string') ? safeDetails : undefined;
};

const readStructuredErrorPayload = (payload: IamErrorPayload | null) =>
  payload && typeof payload.error === 'object' && payload.error ? (payload.error as Record<string, unknown>) : undefined;

const normalizeRuntimeDiagnosticClassification = (
  value: unknown,
  fallback: IamRuntimeDiagnosticClassification
): IamRuntimeDiagnosticClassification =>
  typeof value === 'string' && KNOWN_RUNTIME_DIAGNOSTIC_CLASSIFICATIONS.has(value as IamRuntimeDiagnosticClassification)
    ? (value as IamRuntimeDiagnosticClassification)
    : fallback;

const normalizeRuntimeDiagnosticStatus = (
  value: unknown,
  fallback: IamRuntimeDiagnosticStatus
): IamRuntimeDiagnosticStatus =>
  typeof value === 'string' && KNOWN_RUNTIME_DIAGNOSTIC_STATUSES.has(value as IamRuntimeDiagnosticStatus)
    ? (value as IamRuntimeDiagnosticStatus)
    : fallback;

const normalizeRuntimeRecommendedAction = (
  value: unknown,
  fallback: IamRuntimeRecommendedAction
): IamRuntimeRecommendedAction =>
  typeof value === 'string' && KNOWN_RUNTIME_RECOMMENDED_ACTIONS.has(value as IamRuntimeRecommendedAction)
    ? (value as IamRuntimeRecommendedAction)
    : fallback;

const readRuntimeDiagnostics = (
  payload: IamErrorPayload | null,
  status: number,
  code: string,
  safeDetails: IamRuntimeSafeDetails | undefined
) => {
  const structuredError = readStructuredErrorPayload(payload);
  const rawDetails =
    structuredError?.details && typeof structuredError.details === 'object'
      ? (structuredError.details as Readonly<Record<string, unknown>>)
      : undefined;
  const fallbackDiagnostics = deriveIamRuntimeDiagnostics({
    code,
    status,
    details: rawDetails,
  });

  const classification = normalizeRuntimeDiagnosticClassification(
    structuredError?.classification,
    fallbackDiagnostics.classification
  );
  const diagnosticStatus = normalizeRuntimeDiagnosticStatus(structuredError?.status, fallbackDiagnostics.status);
  const recommendedAction = normalizeRuntimeRecommendedAction(
    structuredError?.recommendedAction,
    fallbackDiagnostics.recommendedAction
  );
  const explicitSafeDetails =
    structuredError?.safeDetails && typeof structuredError.safeDetails === 'object'
      ? (structuredError.safeDetails as IamRuntimeSafeDetails)
      : undefined;

  return {
    classification,
    diagnosticStatus,
    recommendedAction,
    safeDetails: explicitSafeDetails ?? safeDetails ?? fallbackDiagnostics.safeDetails,
  };
};

const logDevelopmentApiError = (input: {
  requestId?: string;
  status: number;
  code: string;
  details?: IamRuntimeSafeDetails;
}) => {
  if (!isDevelopmentEnvironment()) {
    return;
  }

  browserLogger.error('IAM API request failed', {
    request_id: input.requestId,
    status: input.status,
    code: input.code,
    ...(input.details ? { details: input.details } : {}),
  });
};

export const asIamError = (error: unknown): IamHttpError =>
  error instanceof IamHttpError
    ? error
    : (() => {
        const diagnostics = deriveIamRuntimeDiagnostics({
          code: 'internal_error',
          status: 500,
        });
        return new IamHttpError({
          status: 500,
          code: 'internal_error',
          message: error instanceof Error ? error.message : String(error),
          classification: diagnostics.classification,
          diagnosticStatus: diagnostics.status,
          recommendedAction: diagnostics.recommendedAction,
          safeDetails: diagnostics.safeDetails,
        });
      })();

export type UserStatusFilter = 'active' | 'inactive' | 'pending' | 'all';

export type UsersQuery = {
  readonly page: number;
  readonly pageSize: number;
  readonly search?: string;
  readonly status?: Exclude<UserStatusFilter, 'all'>;
  readonly role?: string;
};

export type CreateUserPayload = {
  readonly email: string;
  readonly firstName?: string;
  readonly lastName?: string;
  readonly displayName?: string;
  readonly phone?: string;
  readonly position?: string;
  readonly department?: string;
  readonly preferredLanguage?: string;
  readonly timezone?: string;
  readonly roleIds?: readonly string[];
};

export type UpdateUserPayload = Partial<Omit<CreateUserPayload, 'roleIds'>> & {
  readonly roleIds?: readonly string[];
  readonly groupIds?: readonly string[];
  readonly directPermissions?: readonly Pick<IamUserDirectPermissionAssignment, 'permissionId' | 'effect'>[];
  readonly status?: 'active' | 'inactive' | 'pending';
  readonly notes?: string;
  readonly mainserverUserApplicationId?: string;
  readonly mainserverUserApplicationSecret?: string;
};

export type UpdateMyProfilePayload = {
  readonly username?: string;
  readonly email?: string;
  readonly firstName?: string;
  readonly lastName?: string;
  readonly displayName?: string;
  readonly phone?: string;
  readonly position?: string;
  readonly department?: string;
  readonly preferredLanguage?: string;
  readonly timezone?: string;
};

export type CreateRolePayload = {
  readonly roleName: string;
  readonly displayName?: string;
  readonly description?: string;
  readonly roleLevel?: number;
  readonly permissionIds?: readonly string[];
};

export type UpdateRolePayload = {
  readonly displayName?: string;
  readonly description?: string;
  readonly roleLevel?: number;
  readonly permissionIds?: readonly string[];
  readonly retrySync?: boolean;
};

export type RoleReconcileReport = IamRoleReconcileReport;

export type CreateGroupPayload = {
  readonly groupKey: string;
  readonly displayName: string;
  readonly description?: string;
  readonly roleIds?: readonly string[];
};

export type UpdateGroupPayload = {
  readonly displayName?: string;
  readonly description?: string;
  readonly roleIds?: readonly string[];
  readonly isActive?: boolean;
};

export type AssignGroupRolePayload = {
  readonly roleId: string;
};

export type AssignGroupMembershipPayload = {
  readonly keycloakSubject: string;
  readonly validFrom?: string;
  readonly validUntil?: string;
};

export type CreateLegalTextPayload = {
  readonly name: string;
  readonly legalTextVersion: string;
  readonly locale: string;
  readonly contentHtml: string;
  readonly status: 'draft' | 'valid' | 'archived';
  readonly publishedAt?: string;
};

export type UpdateLegalTextPayload = {
  readonly name?: string;
  readonly legalTextVersion?: string;
  readonly locale?: string;
  readonly contentHtml?: string;
  readonly status?: 'draft' | 'valid' | 'archived';
  readonly publishedAt?: string;
};

export type CreateContentPayload = CreateIamContentInput;

export type UpdateContentPayload = UpdateIamContentInput;

export type MediaVisibility = 'public' | 'protected';
export type MediaUploadStatus = 'pending' | 'validated' | 'processed' | 'failed' | 'blocked';
export type MediaProcessingStatus = 'pending' | 'ready' | 'failed';

export type MediaMetadata = Readonly<{
  title?: string;
  description?: string;
  altText?: string;
  copyright?: string;
  license?: string;
  focusPoint?: Readonly<{
    x: number;
    y: number;
  }>;
  crop?: Readonly<{
    x: number;
    y: number;
    width: number;
    height: number;
  }>;
}>;

export type IamMediaAsset = Readonly<{
  id: string;
  instanceId: string;
  storageKey: string;
  mediaType: 'image';
  mimeType: string;
  byteSize: number;
  visibility: MediaVisibility;
  uploadStatus: MediaUploadStatus;
  processingStatus: MediaProcessingStatus;
  metadata: MediaMetadata;
  technical: Readonly<Record<string, unknown>>;
  createdAt?: string;
  updatedAt?: string;
}>;

export type IamMediaUsageReference = Readonly<{
  id: string;
  assetId: string;
  targetType: string;
  targetId: string;
  role: string;
  sortOrder?: number;
  createdAt?: string;
}>;

export type IamMediaUsageImpact = Readonly<{
  assetId: string;
  totalReferences: number;
  references: readonly IamMediaUsageReference[];
}>;

export type InitializeMediaUploadPayload = Readonly<{
  mediaType?: 'image';
  mimeType: string;
  byteSize: number;
  visibility?: MediaVisibility;
}>;

export type InitializeMediaUploadResponse = Readonly<{
  assetId: string;
  uploadSessionId: string;
  uploadUrl: string;
  method: string;
  headers: Readonly<Record<string, string>>;
  expiresAt: string;
  status: string;
  initializedAt: string;
}>;

export type UpdateMediaPayload = Readonly<{
  visibility?: MediaVisibility;
  metadata: Partial<MediaMetadata>;
}>;

export type IamMediaDelivery = Readonly<{
  assetId: string;
  visibility: MediaVisibility;
  deliveryUrl: string;
  expiresAt?: string;
}>;

export type OrganizationsQuery = {
  readonly page: number;
  readonly pageSize: number;
  readonly search?: string;
  readonly organizationType?: IamOrganizationType;
  readonly status?: 'active' | 'inactive';
};

export type CreateOrganizationPayload = {
  readonly organizationKey: string;
  readonly displayName: string;
  readonly parentOrganizationId?: string;
  readonly organizationType: IamOrganizationType;
  readonly contentAuthorPolicy: 'org_only' | 'org_or_personal';
  readonly metadata?: Readonly<Record<string, unknown>>;
};

export type UpdateOrganizationPayload = Partial<CreateOrganizationPayload> & {
  readonly parentOrganizationId?: string | null;
};

export type AssignOrganizationMembershipPayload = {
  readonly accountId: string;
  readonly isDefaultContext?: boolean;
  readonly visibility?: IamOrganizationMembershipVisibility;
};

export type GovernanceCasesQuery = {
  readonly page: number;
  readonly pageSize: number;
  readonly type?: IamGovernanceCaseListItem['type'];
  readonly status?: string;
  readonly search?: string;
};

export type DsrAdminCasesQuery = {
  readonly page: number;
  readonly pageSize: number;
  readonly type?: IamDsrCaseListItem['type'];
  readonly status?: IamDsrCanonicalStatus;
  readonly search?: string;
};

export type InstancesQuery = {
  readonly search?: string;
  readonly status?: IamInstanceListItem['status'];
};

export type CreateInstancePayload = {
  readonly instanceId: string;
  readonly displayName: string;
  readonly parentDomain: string;
  readonly realmMode: 'new' | 'existing';
  readonly authRealm: string;
  readonly authClientId: string;
  readonly authIssuerUrl?: string;
  readonly authClientSecret?: string;
  readonly tenantAdminClient?: {
    readonly clientId: string;
    readonly secret?: string;
  };
  readonly tenantAdminBootstrap?: {
    readonly username: string;
    readonly email?: string;
    readonly firstName?: string;
    readonly lastName?: string;
  };
  readonly themeKey?: string;
  readonly mainserverConfigRef?: string;
  readonly featureFlags?: Readonly<Record<string, boolean>>;
};

export type UpdateInstancePayload = {
  readonly displayName: string;
  readonly parentDomain: string;
  readonly realmMode: 'new' | 'existing';
  readonly authRealm: string;
  readonly authClientId: string;
  readonly authIssuerUrl?: string;
  readonly authClientSecret?: string;
  readonly tenantAdminClient?: {
    readonly clientId: string;
    readonly secret?: string;
  };
  readonly tenantAdminBootstrap?: {
    readonly username: string;
    readonly email?: string;
    readonly firstName?: string;
    readonly lastName?: string;
  };
  readonly themeKey?: string;
  readonly mainserverConfigRef?: string;
  readonly featureFlags?: Readonly<Record<string, boolean>>;
};

export type ReconcileInstanceKeycloakPayload = {
  readonly tenantAdminTemporaryPassword?: string;
  readonly rotateClientSecret?: boolean;
};

export type ExecuteInstanceKeycloakProvisioningPayload = {
  readonly intent: 'provision' | 'provision_admin_client' | 'reset_tenant_admin' | 'rotate_client_secret';
  readonly tenantAdminTemporaryPassword?: string;
};

type IamRequestOptions = Readonly<{
  signal?: AbortSignal;
  timeoutMs?: number;
}>;

const isAbortLikeError = (error: unknown): boolean =>
  error instanceof DOMException
    ? error.name === 'AbortError' || error.name === 'TimeoutError'
    : error instanceof Error && error.name === 'AbortError';

const mergeAbortSignals = (
  input: {
    readonly signal?: AbortSignal;
    readonly timeoutMs: number;
  }
): {
  readonly signal: AbortSignal;
  readonly cleanup: () => void;
  readonly didTimeout: () => boolean;
} => {
  const controller = new AbortController();
  let timeoutTriggered = false;
  let timeoutId: ReturnType<typeof globalThis.setTimeout> | null = null;
  let removeAbortListener: (() => void) | undefined;

  const abortFromExternal = () => {
    controller.abort(
      input.signal?.reason ??
        new DOMException('IAM-Anfrage wurde abgebrochen.', 'AbortError')
    );
  };

  if (input.signal) {
    if (input.signal.aborted) {
      abortFromExternal();
    } else {
      input.signal.addEventListener('abort', abortFromExternal, { once: true });
      removeAbortListener = () => {
        input.signal?.removeEventListener('abort', abortFromExternal);
      };
    }
  }

  timeoutId = globalThis.setTimeout(() => {
    timeoutTriggered = true;
    controller.abort(new DOMException('IAM-Anfrage hat das Timeout erreicht.', 'TimeoutError'));
  }, input.timeoutMs);

  return {
    signal: controller.signal,
    cleanup: () => {
      if (timeoutId !== null) {
        globalThis.clearTimeout(timeoutId);
      }
      removeAbortListener?.();
    },
    didTimeout: () => timeoutTriggered,
  };
};

const createIdempotencyKey = () => crypto.randomUUID();

const readErrorPayload = async (response: Response): Promise<IamHttpError> => {
  const payload = (await response.json().catch(() => null)) as IamErrorPayload | null;
  const code = readErrorCodeFromPayload(payload) ?? 'internal_error';
  const requestId = readRequestIdFromResponse(response, payload ?? undefined);
  const safeDetails = readSafeDiagnosticDetails(payload);
  const diagnostics = readRuntimeDiagnostics(payload, response.status, code, safeDetails);

  logDevelopmentApiError({ requestId, status: response.status, code, details: diagnostics.safeDetails });

  if (code === 'legal_acceptance_required' && globalThis.window !== undefined) {
    globalThis.dispatchEvent(new CustomEvent(LEGAL_ACCEPTANCE_REQUIRED_EVENT, { detail: diagnostics.safeDetails }));
  }

  return new IamHttpError({
    status: response.status,
    code,
    message: readErrorMessageFromPayload(payload, response.status),
    requestId,
    classification: diagnostics.classification,
    diagnosticStatus: diagnostics.diagnosticStatus,
    recommendedAction: diagnostics.recommendedAction,
    safeDetails: diagnostics.safeDetails,
  });
};

export const fetchWithRequestTimeout = async (
  input: string,
  init?: RequestInit,
  options: IamRequestOptions = {}
): Promise<Response> => {
  const { headers: initHeaders, signal: initSignal, ...restInit } = init ?? {};
  const mergedSignal = mergeAbortSignals({
    signal: options.signal ?? initSignal ?? undefined,
    timeoutMs: options.timeoutMs ?? DEFAULT_IAM_REQUEST_TIMEOUT_MS,
  });

  try {
    return await fetch(input, {
      credentials: 'include',
      ...restInit,
      signal: mergedSignal.signal,
      headers: initHeaders,
    });
  } catch (error) {
    if (mergedSignal.signal.aborted || isAbortLikeError(error)) {
      const didTimeout = mergedSignal.didTimeout();
      throw new IamHttpError({
        status: 0,
        code: didTimeout ? 'timeout' : 'aborted',
        message: didTimeout ? 'request_timeout' : 'request_aborted',
        classification: 'unknown',
        diagnosticStatus: 'degradiert',
        recommendedAction: 'erneut_versuchen',
      });
    }
    throw error;
  } finally {
    mergedSignal.cleanup();
  }
};

const requestJson = async <T>(input: string, init?: RequestInit, options: IamRequestOptions = {}): Promise<T> => {
  const { headers: initHeaders, ...restInit } = init ?? {};
  const response = await fetchWithRequestTimeout(
    input,
    {
      ...restInit,
      headers: { Accept: 'application/json', ...initHeaders },
    },
    options
  );

  // Guard: when the response is not JSON (e.g. HTML error page from the
  // dev-server), surface a clear message instead of a cryptic parse error.
  const contentType = response.headers.get('content-type') ?? '';
  if (!response.ok) {
    if (!contentType.includes('application/json')) {
      const requestId = response.headers.get('X-Request-Id') ?? undefined;
      logDevelopmentApiError({
        requestId,
        status: response.status,
        code: 'non_json_response',
      });
      throw new IamHttpError({
        status: response.status,
        code: 'non_json_response',
        message: `Server antwortete mit ${response.status} (${contentType || 'unbekannter Content-Type'}) statt JSON.`,
        requestId,
        classification: 'unknown',
        diagnosticStatus: 'degradiert',
        recommendedAction: 'erneut_versuchen',
      });
    }
    throw await readErrorPayload(response);
  }

  if (!contentType.includes('application/json')) {
    throw new IamHttpError({
      status: response.status,
      code: 'non_json_response',
      message: `Erwartete JSON-Antwort, erhielt ${contentType || 'unbekannten Content-Type'}.`,
      classification: 'unknown',
      diagnosticStatus: 'degradiert',
      recommendedAction: 'erneut_versuchen',
    });
  }

  return (await response.json()) as T;
};

const requestJsonOrText = async <T>(
  input: string,
  init?: RequestInit,
  options: IamRequestOptions = {}
): Promise<T | { data: string }> => {
  const { headers: initHeaders, ...restInit } = init ?? {};
  const response = await fetchWithRequestTimeout(
    input,
    {
      ...restInit,
      headers: { Accept: 'application/json, text/plain, text/csv, application/xml', ...initHeaders },
    },
    options
  );

  const contentType = response.headers.get('content-type') ?? '';
  if (!response.ok) {
    if (!contentType.includes('application/json')) {
      const requestId = response.headers.get('X-Request-Id') ?? undefined;
      logDevelopmentApiError({
        requestId,
        status: response.status,
        code: 'non_json_response',
      });
      throw new IamHttpError({
        status: response.status,
        code: 'non_json_response',
        message: `Server antwortete mit ${response.status} (${contentType || 'unbekannter Content-Type'}) statt JSON.`,
        requestId,
        classification: 'unknown',
        diagnosticStatus: 'degradiert',
        recommendedAction: 'erneut_versuchen',
      });
    }
    throw await readErrorPayload(response);
  }

  if (contentType.includes('application/json')) {
    return (await response.json()) as T;
  }

  return { data: await response.text() };
};

const patchJson = async <TResponse, TPayload>(path: string, payload: TPayload) =>
  requestJson<TResponse>(path, {
    method: 'PATCH',
    headers: IAM_HEADERS,
    body: JSON.stringify(payload),
  });

const patchJsonWithReauth = async <TResponse, TPayload>(path: string, payload: TPayload) =>
  requestJson<TResponse>(path, {
    method: 'PATCH',
    headers: {
      ...IAM_HEADERS,
      'X-SVA-Reauth-Confirmed': 'true',
    },
    body: JSON.stringify(payload),
  });

const putJson = async <TResponse, TPayload>(path: string, payload: TPayload) =>
  requestJson<TResponse>(path, {
    method: 'PUT',
    headers: IAM_HEADERS,
    body: JSON.stringify(payload),
  });

const postJson = async <TResponse, TPayload>(path: string, payload: TPayload, idempotent = false) =>
  requestJson<TResponse>(path, {
    method: 'POST',
    headers: {
      ...IAM_HEADERS,
      ...(idempotent ? { 'Idempotency-Key': createIdempotencyKey() } : {}),
    },
    body: JSON.stringify(payload),
  });

const postJsonWithReauth = async <TResponse, TPayload>(path: string, payload: TPayload, idempotent = false) =>
  requestJson<TResponse>(path, {
    method: 'POST',
    headers: {
      ...IAM_HEADERS,
      'X-SVA-Reauth-Confirmed': 'true',
      ...(idempotent ? { 'Idempotency-Key': createIdempotencyKey() } : {}),
    },
    body: JSON.stringify(payload),
  });

export const listUsers = async (query: UsersQuery): Promise<ApiListResponse<IamUserListItem>> => {
  const params = new URLSearchParams({
    page: String(query.page),
    pageSize: String(query.pageSize),
  });

  if (query.search) {
    params.set('search', query.search);
  }
  if (query.status) {
    params.set('status', query.status);
  }
  if (query.role) {
    params.set('role', query.role);
  }

  return requestJson<ApiListResponse<IamUserListItem>>(`/api/v1/iam/users?${params.toString()}`);
};

export const getUser = async (userId: string): Promise<ApiItemResponse<IamUserDetail>> =>
  requestJson<ApiItemResponse<IamUserDetail>>(`/api/v1/iam/users/${userId}`);

export const getUserTimeline = async (userId: string): Promise<ApiListResponse<IamUserTimelineEvent>> =>
  requestJson<ApiListResponse<IamUserTimelineEvent>>(`/api/v1/iam/users/${userId}/timeline`);

export const createUser = async (payload: CreateUserPayload): Promise<ApiItemResponse<IamUserDetail>> =>
  postJson<ApiItemResponse<IamUserDetail>, CreateUserPayload>('/api/v1/iam/users', payload, true);

export const updateUser = async (
  userId: string,
  payload: UpdateUserPayload
): Promise<ApiItemResponse<IamUserDetail>> =>
  patchJson<ApiItemResponse<IamUserDetail>, UpdateUserPayload>(`/api/v1/iam/users/${userId}`, payload);

export const deactivateUser = async (userId: string): Promise<ApiItemResponse<{ id: string }>> =>
  requestJson<ApiItemResponse<{ id: string }>>(`/api/v1/iam/users/${userId}`, {
    method: 'DELETE',
    headers: IAM_HEADERS,
  });

export const bulkDeactivateUsers = async (
  userIds: readonly string[]
): Promise<ApiItemResponse<{ deactivatedUserIds: readonly string[]; count: number }>> =>
  postJson<ApiItemResponse<{ deactivatedUserIds: readonly string[]; count: number }>, { userIds: readonly string[] }>(
    '/api/v1/iam/users/bulk-deactivate',
    { userIds },
    true
  );

export const syncUsersFromKeycloak = async (): Promise<ApiItemResponse<IamUserImportSyncReport>> =>
  requestJson<ApiItemResponse<IamUserImportSyncReport>>('/api/v1/iam/users/sync-keycloak', {
    method: 'POST',
    headers: IAM_HEADERS,
    body: JSON.stringify({}),
  }, {
    timeoutMs: HEAVY_IAM_REQUEST_TIMEOUT_MS,
  });

export const getMyProfile = async (): Promise<ApiItemResponse<IamUserDetail>> =>
  requestJson<ApiItemResponse<IamUserDetail>>('/api/v1/iam/users/me/profile');

export const updateMyProfile = async (
  payload: UpdateMyProfilePayload
): Promise<ApiItemResponse<IamUserDetail>> =>
  patchJson<ApiItemResponse<IamUserDetail>, UpdateMyProfilePayload>('/api/v1/iam/users/me/profile', payload);

export const listRoles = async (): Promise<ApiListResponse<IamRoleListItem>> =>
  requestJson<ApiListResponse<IamRoleListItem>>('/api/v1/iam/roles');

export const listGroups = async (): Promise<ApiListResponse<IamAdminGroupListItem>> =>
  requestJson<ApiListResponse<IamAdminGroupListItem>>('/api/v1/iam/groups');

export const getGroup = async (groupId: string): Promise<ApiItemResponse<IamAdminGroupDetail>> =>
  requestJson<ApiItemResponse<IamAdminGroupDetail>>(`/api/v1/iam/groups/${groupId}`);

export const listLegalTexts = async (): Promise<ApiListResponse<IamLegalTextListItem>> =>
  requestJson<ApiListResponse<IamLegalTextListItem>>('/api/v1/iam/legal-texts');

export const listContents = async (): Promise<ApiListResponse<IamContentListItem>> =>
  requestJson<ApiListResponse<IamContentListItem>>('/api/v1/iam/contents');

export const getContent = async (contentId: string): Promise<ApiItemResponse<IamContentDetail>> =>
  requestJson<ApiItemResponse<IamContentDetail>>(`/api/v1/iam/contents/${contentId}`);

export const getContentHistory = async (contentId: string): Promise<ApiListResponse<IamContentHistoryEntry>> =>
  requestJson<ApiListResponse<IamContentHistoryEntry>>(`/api/v1/iam/contents/${contentId}/history`);

export const createContent = async (payload: CreateContentPayload): Promise<ApiItemResponse<IamContentDetail>> =>
  postJson<ApiItemResponse<IamContentDetail>, CreateContentPayload>('/api/v1/iam/contents', payload, true);

export const updateContent = async (
  contentId: string,
  payload: UpdateContentPayload
): Promise<ApiItemResponse<IamContentDetail>> =>
  patchJson<ApiItemResponse<IamContentDetail>, UpdateContentPayload>(`/api/v1/iam/contents/${contentId}`, payload);

export const deleteContent = async (contentId: string): Promise<ApiItemResponse<{ id: string }>> =>
  requestJson<ApiItemResponse<{ id: string }>>(`/api/v1/iam/contents/${contentId}`, {
    method: 'DELETE',
    headers: IAM_HEADERS,
  });

export const listMedia = async (query: {
  readonly search?: string;
  readonly visibility?: MediaVisibility | 'all';
} = {}): Promise<ApiListResponse<IamMediaAsset>> => {
  const params = new URLSearchParams();

  if (query.search) {
    params.set('search', query.search);
  }
  if (query.visibility && query.visibility !== 'all') {
    params.set('visibility', query.visibility);
  }

  const suffix = params.toString();
  return requestJson<ApiListResponse<IamMediaAsset>>(`/api/v1/iam/media${suffix ? `?${suffix}` : ''}`);
};

export const getMedia = async (assetId: string): Promise<ApiItemResponse<IamMediaAsset>> =>
  requestJson<ApiItemResponse<IamMediaAsset>>(`/api/v1/iam/media/${assetId}`);

export const getMediaUsage = async (assetId: string): Promise<ApiItemResponse<IamMediaUsageImpact>> =>
  requestJson<ApiItemResponse<IamMediaUsageImpact>>(`/api/v1/iam/media/${assetId}/usage`);

export const initializeMediaUpload = async (
  payload: InitializeMediaUploadPayload
): Promise<ApiItemResponse<InitializeMediaUploadResponse>> =>
  postJson<ApiItemResponse<InitializeMediaUploadResponse>, InitializeMediaUploadPayload>(
    '/api/v1/iam/media/upload-sessions',
    payload,
    true
  );

export const updateMedia = async (
  assetId: string,
  payload: UpdateMediaPayload
): Promise<ApiItemResponse<IamMediaAsset>> =>
  patchJson<ApiItemResponse<IamMediaAsset>, UpdateMediaPayload>(`/api/v1/iam/media/${assetId}`, payload);

export const getMediaDelivery = async (assetId: string): Promise<ApiItemResponse<IamMediaDelivery>> =>
  requestJson<ApiItemResponse<IamMediaDelivery>>(`/api/v1/iam/media/${assetId}/delivery`);

export const deleteMedia = async (assetId: string): Promise<ApiItemResponse<{ id: string }>> =>
  requestJson<ApiItemResponse<{ id: string }>>(`/api/v1/iam/media/${assetId}`, {
    method: 'DELETE',
    headers: IAM_HEADERS,
  });

export const listOrganizations = async (
  query: OrganizationsQuery
): Promise<ApiListResponse<IamOrganizationListItem>> => {
  const params = new URLSearchParams({
    page: String(query.page),
    pageSize: String(query.pageSize),
  });

  if (query.search) {
    params.set('search', query.search);
  }
  if (query.organizationType) {
    params.set('organizationType', query.organizationType);
  }
  if (query.status) {
    params.set('status', query.status);
  }

  return requestJson<ApiListResponse<IamOrganizationListItem>>(`/api/v1/iam/organizations?${params.toString()}`);
};

export const listInstances = async (query: InstancesQuery = {}): Promise<ApiListResponse<IamInstanceListItem>> => {
  const params = new URLSearchParams();
  if (query.search) {
    params.set('search', query.search);
  }
  if (query.status) {
    params.set('status', query.status);
  }
  const suffix = params.toString();
  return requestJson<ApiListResponse<IamInstanceListItem>>(`/api/v1/iam/instances${suffix ? `?${suffix}` : ''}`);
};

export const getInstance = async (instanceId: string): Promise<ApiItemResponse<IamInstanceDetail>> =>
  requestJson<ApiItemResponse<IamInstanceDetail>>(`/api/v1/iam/instances/${instanceId}`);

export const createInstance = async (
  payload: CreateInstancePayload
): Promise<ApiItemResponse<IamInstanceListItem>> =>
  postJsonWithReauth<ApiItemResponse<IamInstanceListItem>, CreateInstancePayload>('/api/v1/iam/instances', payload, true);

export const updateInstance = async (
  instanceId: string,
  payload: UpdateInstancePayload
): Promise<ApiItemResponse<IamInstanceDetail>> =>
  patchJsonWithReauth<ApiItemResponse<IamInstanceDetail>, UpdateInstancePayload>(
    `/api/v1/iam/instances/${instanceId}`,
    payload
  );

export const getInstanceKeycloakStatus = async (
  instanceId: string
): Promise<ApiItemResponse<IamInstanceDetail['keycloakStatus']>> =>
  requestJson<ApiItemResponse<IamInstanceDetail['keycloakStatus']>>(`/api/v1/iam/instances/${instanceId}/keycloak/status`);

export const getInstanceKeycloakPreflight = async (
  instanceId: string
): Promise<ApiItemResponse<IamInstanceDetail['keycloakPreflight']>> =>
  requestJson<ApiItemResponse<IamInstanceDetail['keycloakPreflight']>>(
    `/api/v1/iam/instances/${instanceId}/keycloak/preflight`
  );

export const planInstanceKeycloakProvisioning = async (
  instanceId: string
): Promise<ApiItemResponse<IamInstanceDetail['keycloakPlan']>> =>
  postJsonWithReauth<ApiItemResponse<IamInstanceDetail['keycloakPlan']>, Record<string, never>>(
    `/api/v1/iam/instances/${instanceId}/keycloak/plan`,
    {},
    true
  );

export const executeInstanceKeycloakProvisioning = async (
  instanceId: string,
  payload: ExecuteInstanceKeycloakProvisioningPayload
): Promise<ApiItemResponse<IamInstanceDetail['latestKeycloakProvisioningRun']>> =>
  postJsonWithReauth<
    ApiItemResponse<IamInstanceDetail['latestKeycloakProvisioningRun']>,
    ExecuteInstanceKeycloakProvisioningPayload
  >(`/api/v1/iam/instances/${instanceId}/keycloak/execute`, payload, true);

export const getInstanceKeycloakProvisioningRun = async (
  instanceId: string,
  runId: string
): Promise<ApiItemResponse<IamInstanceDetail['latestKeycloakProvisioningRun']>> =>
  requestJson<ApiItemResponse<IamInstanceDetail['latestKeycloakProvisioningRun']>>(
    `/api/v1/iam/instances/${instanceId}/keycloak/runs/${runId}`
  );

export const getRuntimeHealth = async (options: IamRequestOptions = {}): Promise<RuntimeHealthResponse> =>
  normalizeRuntimeHealthResponse(
    await requestJson<RuntimeHealthResponse>(
      '/api/v1/iam/health/ready',
      {
        signal: options.signal,
      },
      {
        signal: options.signal,
        timeoutMs: options.timeoutMs ?? HEALTH_REQUEST_TIMEOUT_MS,
      }
    )
  );

const toRuntimeDependencyStatus = (ready: boolean | undefined): RuntimeDependencyHealth['status'] => {
  if (ready === true) {
    return 'ready';
  }
  if (ready === false) {
    return 'not_ready';
  }
  return 'unknown';
};

const createFallbackRuntimeServices = (
  checks: Partial<RuntimeHealthResponse['checks']>
): RuntimeHealthResponse['checks']['services'] => ({
  authorizationCache: checks.services?.authorizationCache ?? { status: 'unknown' },
  database: checks.services?.database ?? { status: toRuntimeDependencyStatus(checks.db) },
  keycloak: checks.services?.keycloak ?? { status: toRuntimeDependencyStatus(checks.keycloak) },
  redis: checks.services?.redis ?? { status: toRuntimeDependencyStatus(checks.redis) },
});

export const normalizeRuntimeHealthResponse = (health: RuntimeHealthResponse): RuntimeHealthResponse => {
  const checks: Partial<RuntimeHealthResponse['checks']> = health.checks ?? {};

  return {
    ...health,
    checks: {
      ...checks,
      db: checks.db ?? false,
      keycloak: checks.keycloak ?? false,
      redis: checks.redis ?? false,
      authorizationCache: checks.authorizationCache ?? {
        coldStart: false,
        consecutiveRedisFailures: 0,
        recomputePerMinute: 0,
        status: 'empty',
      },
      auth: checks.auth ?? {},
      diagnostics: checks.diagnostics ?? {},
      errors: checks.errors ?? {},
      services: createFallbackRuntimeServices(checks),
    },
  };
};

export const reconcileInstanceKeycloak = async (
  instanceId: string,
  payload: ReconcileInstanceKeycloakPayload
): Promise<ApiItemResponse<IamInstanceDetail['keycloakStatus']>> =>
  postJsonWithReauth<ApiItemResponse<IamInstanceDetail['keycloakStatus']>, ReconcileInstanceKeycloakPayload>(
    `/api/v1/iam/instances/${instanceId}/keycloak/reconcile`,
    payload,
    true
  );

export const probeTenantIamAccess = async (
  instanceId: string
): Promise<ApiItemResponse<IamInstanceDetail['tenantIamStatus']>> =>
  postJsonWithReauth<ApiItemResponse<IamInstanceDetail['tenantIamStatus']>, Record<string, never>>(
    `/api/v1/iam/instances/${instanceId}/tenant-iam/access-probe`,
    {},
    true
  );

export const assignInstanceModule = async (
  instanceId: string,
  moduleId: string
): Promise<ApiItemResponse<IamInstanceDetail>> =>
  postJsonWithReauth<ApiItemResponse<IamInstanceDetail>, { moduleId: string }>(
    `/api/v1/iam/instances/${instanceId}/modules/assign`,
    { moduleId },
    true
  );

export const revokeInstanceModule = async (
  instanceId: string,
  moduleId: string
): Promise<ApiItemResponse<IamInstanceDetail>> =>
  postJsonWithReauth<ApiItemResponse<IamInstanceDetail>, { moduleId: string; confirmation: 'REVOKE' }>(
    `/api/v1/iam/instances/${instanceId}/modules/revoke`,
    { moduleId, confirmation: 'REVOKE' },
    true
  );

export const seedInstanceIamBaseline = async (instanceId: string): Promise<ApiItemResponse<IamInstanceDetail>> =>
  postJsonWithReauth<ApiItemResponse<IamInstanceDetail>, Record<string, never>>(
    `/api/v1/iam/instances/${instanceId}/modules/seed-iam-baseline`,
    {},
    true
  );

export const activateInstance = async (instanceId: string): Promise<ApiItemResponse<IamInstanceListItem>> =>
  postJsonWithReauth<ApiItemResponse<IamInstanceListItem>, { status: 'active' }>(
    `/api/v1/iam/instances/${instanceId}/activate`,
    { status: 'active' },
    true
  );

export const suspendInstance = async (instanceId: string): Promise<ApiItemResponse<IamInstanceListItem>> =>
  postJsonWithReauth<ApiItemResponse<IamInstanceListItem>, { status: 'suspended' }>(
    `/api/v1/iam/instances/${instanceId}/suspend`,
    { status: 'suspended' },
    true
  );

export const archiveInstance = async (instanceId: string): Promise<ApiItemResponse<IamInstanceListItem>> =>
  postJsonWithReauth<ApiItemResponse<IamInstanceListItem>, { status: 'archived' }>(
    `/api/v1/iam/instances/${instanceId}/archive`,
    { status: 'archived' },
    true
  );

export const getOrganization = async (organizationId: string): Promise<ApiItemResponse<IamOrganizationDetail>> =>
  requestJson<ApiItemResponse<IamOrganizationDetail>>(`/api/v1/iam/organizations/${organizationId}`);

export const createOrganization = async (
  payload: CreateOrganizationPayload
): Promise<ApiItemResponse<IamOrganizationDetail>> =>
  postJson<ApiItemResponse<IamOrganizationDetail>, CreateOrganizationPayload>('/api/v1/iam/organizations', payload, true);

export const updateOrganization = async (
  organizationId: string,
  payload: UpdateOrganizationPayload
): Promise<ApiItemResponse<IamOrganizationDetail>> =>
  patchJson<ApiItemResponse<IamOrganizationDetail>, UpdateOrganizationPayload>(
    `/api/v1/iam/organizations/${organizationId}`,
    payload
  );

export const deactivateOrganization = async (organizationId: string): Promise<ApiItemResponse<{ id: string }>> =>
  requestJson<ApiItemResponse<{ id: string }>>(`/api/v1/iam/organizations/${organizationId}`, {
    method: 'DELETE',
    headers: IAM_HEADERS,
  });

export const assignOrganizationMembership = async (
  organizationId: string,
  payload: AssignOrganizationMembershipPayload
): Promise<ApiItemResponse<IamOrganizationDetail>> =>
  postJson<ApiItemResponse<IamOrganizationDetail>, AssignOrganizationMembershipPayload>(
    `/api/v1/iam/organizations/${organizationId}/memberships`,
    payload,
    true
  );

export const removeOrganizationMembership = async (
  organizationId: string,
  accountId: string
): Promise<ApiItemResponse<IamOrganizationDetail>> =>
  requestJson<ApiItemResponse<IamOrganizationDetail>>(
    `/api/v1/iam/organizations/${organizationId}/memberships/${accountId}`,
    {
      method: 'DELETE',
      headers: IAM_HEADERS,
    }
  );

export const getMyOrganizationContext = async (): Promise<ApiItemResponse<IamOrganizationContext>> =>
  requestJson<ApiItemResponse<IamOrganizationContext>>('/api/v1/iam/me/context');

export const listPermissions = async (): Promise<ApiListResponse<IamPermission>> =>
  requestJson<ApiListResponse<IamPermission>>('/api/v1/iam/permissions');

export const updateMyOrganizationContext = async (
  organizationId: string
): Promise<ApiItemResponse<IamOrganizationContext>> =>
  putJson<ApiItemResponse<IamOrganizationContext>, { organizationId: string }>('/api/v1/iam/me/context', {
    organizationId,
  });

export const createRole = async (
  payload: CreateRolePayload
): Promise<ApiItemResponse<IamRoleListItem>> =>
  postJson<ApiItemResponse<IamRoleListItem>, CreateRolePayload>('/api/v1/iam/roles', payload, true);

export const createGroup = async (
  payload: CreateGroupPayload
): Promise<ApiItemResponse<{ id: string }>> =>
  postJson<ApiItemResponse<{ id: string }>, CreateGroupPayload>('/api/v1/iam/groups', payload, true);

export const createLegalText = async (
  payload: CreateLegalTextPayload
): Promise<ApiItemResponse<IamLegalTextListItem>> =>
  postJson<ApiItemResponse<IamLegalTextListItem>, CreateLegalTextPayload>('/api/v1/iam/legal-texts', payload, true);

export const updateRole = async (roleId: string, payload: UpdateRolePayload): Promise<ApiItemResponse<IamRoleListItem>> =>
  patchJson<ApiItemResponse<IamRoleListItem>, UpdateRolePayload>(`/api/v1/iam/roles/${roleId}`, payload);

export const updateGroup = async (
  groupId: string,
  payload: UpdateGroupPayload
): Promise<ApiItemResponse<{ id: string }>> =>
  patchJson<ApiItemResponse<{ id: string }>, UpdateGroupPayload>(`/api/v1/iam/groups/${groupId}`, payload);

export const updateLegalText = async (
  legalTextVersionId: string,
  payload: UpdateLegalTextPayload
): Promise<ApiItemResponse<IamLegalTextListItem>> =>
  patchJson<ApiItemResponse<IamLegalTextListItem>, UpdateLegalTextPayload>(
    `/api/v1/iam/legal-texts/${legalTextVersionId}`,
    payload
  );

export const deleteRole = async (roleId: string): Promise<ApiItemResponse<{ id: string }>> =>
  requestJson<ApiItemResponse<{ id: string }>>(`/api/v1/iam/roles/${roleId}`, {
    method: 'DELETE',
    headers: IAM_HEADERS,
  });

export const deleteGroup = async (groupId: string): Promise<ApiItemResponse<{ id: string }>> =>
  requestJson<ApiItemResponse<{ id: string }>>(`/api/v1/iam/groups/${groupId}`, {
    method: 'DELETE',
    headers: IAM_HEADERS,
  });

export const deleteLegalText = async (legalTextVersionId: string): Promise<ApiItemResponse<{ id: string }>> =>
  requestJson<ApiItemResponse<{ id: string }>>(`/api/v1/iam/legal-texts/${legalTextVersionId}`, {
    method: 'DELETE',
    headers: IAM_HEADERS,
  });

export const assignGroupRole = async (
  groupId: string,
  payload: AssignGroupRolePayload
): Promise<ApiItemResponse<{ groupId: string; roleId: string }>> =>
  postJson<ApiItemResponse<{ groupId: string; roleId: string }>, AssignGroupRolePayload>(
    `/api/v1/iam/groups/${groupId}/roles`,
    payload,
    true
  );

export const removeGroupRole = async (
  groupId: string,
  roleId: string
): Promise<ApiItemResponse<{ groupId: string; roleId: string }>> =>
  requestJson<ApiItemResponse<{ groupId: string; roleId: string }>>(`/api/v1/iam/groups/${groupId}/roles/${roleId}`, {
    method: 'DELETE',
    headers: IAM_HEADERS,
  });

export const assignGroupMembership = async (
  groupId: string,
  payload: AssignGroupMembershipPayload
): Promise<ApiItemResponse<{ groupId: string }>> =>
  postJson<ApiItemResponse<{ groupId: string }>, AssignGroupMembershipPayload>(
    `/api/v1/iam/groups/${groupId}/memberships`,
    payload,
    true
  );

export const removeGroupMembership = async (
  groupId: string,
  keycloakSubject: string
): Promise<ApiItemResponse<{ groupId: string }>> =>
  requestJson<ApiItemResponse<{ groupId: string }>>(`/api/v1/iam/groups/${groupId}/memberships`, {
    method: 'DELETE',
    headers: IAM_HEADERS,
    body: JSON.stringify({ keycloakSubject }),
  });

export const reconcileRoles = async (): Promise<ApiItemResponse<RoleReconcileReport>> =>
  requestJson<ApiItemResponse<RoleReconcileReport>>('/api/v1/iam/admin/reconcile', {
    method: 'POST',
    headers: IAM_HEADERS,
    body: JSON.stringify({}),
  });

export const listGovernanceCases = async (
  query: GovernanceCasesQuery,
  options?: IamRequestOptions
): Promise<ApiListResponse<IamGovernanceCaseListItem>> => {
  const params = new URLSearchParams({
    page: String(query.page),
    pageSize: String(query.pageSize),
  });

  if (query.type) {
    params.set('type', query.type);
  }
  if (query.status) {
    params.set('status', query.status);
  }
  if (query.search) {
    params.set('search', query.search);
  }

  return requestJson<ApiListResponse<IamGovernanceCaseListItem>>(`/iam/governance/workflows?${params.toString()}`, {
    signal: options?.signal,
  }, {
    signal: options?.signal,
    timeoutMs: HEAVY_IAM_REQUEST_TIMEOUT_MS,
  });
};

export const getMyDataSubjectRights = async (): Promise<ApiItemResponse<IamDsrSelfServiceOverview>> =>
  requestJson<ApiItemResponse<IamDsrSelfServiceOverview>>('/iam/me/data-subject-rights/requests');

export const getMyPendingLegalTexts = async (): Promise<ApiListResponse<IamPendingLegalTextItem>> =>
  requestJson<ApiListResponse<IamPendingLegalTextItem>>('/iam/me/legal-texts/pending', undefined, {
    timeoutMs: HEALTH_REQUEST_TIMEOUT_MS,
  });

export const acceptLegalText = async (payload: {
  readonly instanceId: string;
  readonly legalTextId: string;
  readonly legalTextVersion: string;
  readonly locale: string;
}): Promise<ApiItemResponse<{ workflowId: string; operation: 'accept_legal_text'; status: 'ok' }>> =>
  postJson<
    ApiItemResponse<{ workflowId: string; operation: 'accept_legal_text'; status: 'ok' }>,
    {
      readonly operation: 'accept_legal_text';
      readonly instanceId: string;
      readonly payload: {
        readonly legalTextId: string;
        readonly legalTextVersion: string;
        readonly locale: string;
      };
    }
  >('/iam/governance/workflows', {
    operation: 'accept_legal_text',
    instanceId: payload.instanceId,
    payload: {
      legalTextId: payload.legalTextId,
      legalTextVersion: payload.legalTextVersion,
      locale: payload.locale,
    },
  });

export const createDataSubjectRequest = async (payload: {
  readonly instanceId?: string;
  readonly type: 'access' | 'deletion' | 'restriction' | 'objection';
  readonly payload?: Readonly<Record<string, unknown>>;
}): Promise<ApiItemResponse<{ requestId: string; status: string }>> =>
  postJson<ApiItemResponse<{ requestId: string; status: string }>, typeof payload>(
    '/iam/me/data-subject-rights/requests',
    payload
  );

export const requestDataExport = async (input: {
  readonly format: 'json' | 'csv' | 'xml';
  readonly async: boolean;
}): Promise<
  | ApiItemResponse<{ exportJobId: string; status: string; format: string }>
  | { exportJobId?: undefined; status?: undefined; format?: undefined; data?: unknown }
> => {
  return requestJsonOrText('/iam/me/data-export', {
    method: 'POST',
    headers: {
      ...IAM_HEADERS,
      'Idempotency-Key': createIdempotencyKey(),
    },
    body: JSON.stringify({
      format: input.format,
      async: input.async,
    }),
  }, {
    timeoutMs: HEAVY_IAM_REQUEST_TIMEOUT_MS,
  });
};

export const getDataExportStatus = async (
  jobId: string
): Promise<ApiItemResponse<{ id: string; format: string; status: string; createdAt: string; completedAt?: string; errorMessage?: string }>> =>
  requestJson(`/iam/me/data-export/status?jobId=${encodeURIComponent(jobId)}`, undefined, {
    timeoutMs: HEAVY_IAM_REQUEST_TIMEOUT_MS,
  });

export const checkOptionalProcessing = async (): Promise<
  ApiItemResponse<{ status: 'ok'; executed: true }> | { error: string; blockedByRestriction?: boolean; blockedByObjection?: boolean }
> =>
  requestJson('/iam/me/optional-processing/execute', {
    method: 'POST',
    headers: IAM_HEADERS,
    body: JSON.stringify({}),
  });

export const listAdminDsrCases = async (
  query: DsrAdminCasesQuery,
  options?: IamRequestOptions
): Promise<ApiListResponse<IamDsrCaseListItem>> => {
  const params = new URLSearchParams({
    page: String(query.page),
    pageSize: String(query.pageSize),
  });

  if (query.type) {
    params.set('type', query.type);
  }
  if (query.status) {
    params.set('status', query.status);
  }
  if (query.search) {
    params.set('search', query.search);
  }

  return requestJson<ApiListResponse<IamDsrCaseListItem>>(`/iam/admin/data-subject-rights/cases?${params.toString()}`, {
    signal: options?.signal,
  }, {
    signal: options?.signal,
    timeoutMs: HEAVY_IAM_REQUEST_TIMEOUT_MS,
  });
};
