import type {
  ApiListResponse,
  StudioJobDetail,
  StudioJobDetailResponse,
  StudioJobListItem,
  StudioJobListQuery,
  StudioJobListResponse,
  StudioJobResponse,
} from '@sva/core';

import type {
  AuthorizePerformanceRequest,
  AuthorizePerformanceRunResponse,
  AuthorizePerformanceRunResult,
  RuntimeDependencyHealth,
  RuntimeHealthResponse,
} from '@sva/iam-core';

import {
  createJsonMutationRequestInit,
  DEFAULT_IAM_REQUEST_TIMEOUT_MS,
  fetchWithRequestTimeout,
  HEALTH_REQUEST_TIMEOUT_MS,
  HEAVY_IAM_REQUEST_TIMEOUT_MS,
  IamHttpError,
  type IamRequestOptions,
  postJson,
  readIamErrorResponse,
  requestJson,
} from './iam-http-client';

export const getRuntimeHealth = async (
  options: IamRequestOptions = {}
): Promise<RuntimeHealthResponse> => {
  const response = await fetchWithRequestTimeout(
    '/api/v1/iam/health/ready',
    { signal: options.signal },
    {
      signal: options.signal,
      timeoutMs: options.timeoutMs ?? HEALTH_REQUEST_TIMEOUT_MS,
    }
  );
  if (!response.ok && response.status !== 503) {
    throw await readIamErrorResponse(response);
  }

  try {
    const payload: unknown = await response.json();
    if (response.status === 503 && !isNotReadyRuntimeHealthPayload(payload)) {
      throw new Error('invalid_runtime_health_response');
    }
    return normalizeRuntimeHealthResponse(payload as RuntimeHealthResponse);
  } catch {
    throw new IamHttpError({
      status: response.status,
      code: 'invalid_runtime_health_response',
      message: 'runtime_health_response_invalid',
      classification: 'unknown',
      diagnosticStatus: 'degradiert',
      recommendedAction: 'erneut_versuchen',
    });
  }
};

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isNotReadyRuntimeHealthPayload = (value: unknown): value is RuntimeHealthResponse => {
  if (!isRecord(value) || value.status !== 'not_ready') {
    return false;
  }
  if (typeof value.timestamp !== 'string' || !isRecord(value.checks)) {
    return false;
  }
  return isRecord(value.checks.services);
};

export const listPluginOperationJobs = async (
  query: StudioJobListQuery,
  options: IamRequestOptions = {}
): Promise<ApiListResponse<StudioJobListItem>> => {
  const params = new URLSearchParams({
    view: query.view,
    page: String(query.page),
    pageSize: String(query.pageSize),
  });

  if (query.status) {
    params.set('status', query.status);
  }
  if (query.pluginId) {
    params.set('pluginId', query.pluginId);
  }
  if (query.jobTypeId) {
    params.set('jobTypeId', query.jobTypeId);
  }
  if (query.q) {
    params.set('q', query.q);
  }

  return requestJson<StudioJobListResponse>(
    `/api/v1/plugin-operations/jobs?${params.toString()}`,
    undefined,
    {
      signal: options.signal,
      timeoutMs: options.timeoutMs ?? DEFAULT_IAM_REQUEST_TIMEOUT_MS,
    }
  );
};

export const getPluginOperationJob = async (
  jobId: string,
  options: IamRequestOptions = {}
): Promise<StudioJobDetail> => {
  const response = await requestJson<StudioJobDetailResponse>(
    `/api/v1/plugin-operations/jobs/${jobId}`,
    undefined,
    {
      signal: options.signal,
      timeoutMs: options.timeoutMs ?? DEFAULT_IAM_REQUEST_TIMEOUT_MS,
    }
  );

  return response.data;
};

export const cancelPluginOperationJob = async (jobId: string) => {
  const response = await postJson<StudioJobResponse, Record<string, never>>(
    `/api/v1/plugin-operations/jobs/${encodeURIComponent(jobId)}/cancel`,
    {},
    true
  );
  return response.data;
};

export const getLatestAuthorizePerformanceRun = async (
  options: IamRequestOptions = {}
): Promise<AuthorizePerformanceRunResult | null> => {
  const response = await requestJson<AuthorizePerformanceRunResponse>(
    '/api/v1/iam/authorize-performance',
    undefined,
    {
      signal: options.signal,
      timeoutMs: options.timeoutMs ?? HEAVY_IAM_REQUEST_TIMEOUT_MS,
    }
  );

  return response.data;
};

export const startAuthorizePerformanceRun = async (
  payload: AuthorizePerformanceRequest
): Promise<AuthorizePerformanceRunResult> => {
  const response = await requestJson<AuthorizePerformanceRunResponse>(
    '/api/v1/iam/authorize-performance',
    createJsonMutationRequestInit('POST', payload),
    {
      timeoutMs: HEAVY_IAM_REQUEST_TIMEOUT_MS,
    }
  );

  if (!response.data) {
    throw new IamHttpError({
      status: 500,
      code: 'invalid_response',
      message: 'http_500',
      classification: 'unknown',
      diagnosticStatus: 'degradiert',
      recommendedAction: 'erneut_versuchen',
    });
  }

  return response.data;
};

const toRuntimeDependencyStatus = (
  ready: boolean | undefined
): RuntimeDependencyHealth['status'] => {
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
  jobWorker: checks.services?.jobWorker ?? { status: 'unknown' },
  keycloak: checks.services?.keycloak ?? { status: toRuntimeDependencyStatus(checks.keycloak) },
  redis: checks.services?.redis ?? { status: toRuntimeDependencyStatus(checks.redis) },
});

export const normalizeRuntimeHealthResponse = (
  health: RuntimeHealthResponse
): RuntimeHealthResponse => {
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
