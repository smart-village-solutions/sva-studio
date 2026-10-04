import type {
  ApiItemResponse,
  ApiListResponse,
  IamDeletionContentStrategy,
  IamDsrCaseListItem,
  IamDsrSelfServiceOverview,
  IamGovernanceCaseListItem,
  IamMyDeletionRulesOverview,
  IamPendingLegalTextItem,
  IamSelfServiceActivityItem,
  IamTenantDeletionRulesOverview,
} from '@sva/core';

import {
  createMutationHeaders,
  HEALTH_REQUEST_TIMEOUT_MS,
  HEAVY_IAM_REQUEST_TIMEOUT_MS,
  IAM_HEADERS,
  type IamRequestOptions,
  postJson,
  requestJson,
  requestJsonOrText,
} from './iam-http-client';

import type { DsrAdminCasesQuery, GovernanceCasesQuery } from './iam-api-admin-types';
import { requestSingleFlight } from './request-singleflight';

export const listGovernanceCases = async (
  query: GovernanceCasesQuery,
  options?: IamRequestOptions
): Promise<ApiListResponse<IamGovernanceCaseListItem>> => {
  const params = new URLSearchParams({
    page: String(query.page),
    pageSize: String(query.pageSize),
    sortBy: query.sortBy,
    sortDirection: query.sortDirection,
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

  return requestJson<ApiListResponse<IamGovernanceCaseListItem>>(
    `/iam/governance/workflows?${params.toString()}`,
    {
      signal: options?.signal,
    },
    {
      signal: options?.signal,
      timeoutMs: HEAVY_IAM_REQUEST_TIMEOUT_MS,
    }
  );
};

export const getGovernanceCase = async (
  caseId: string,
  options?: IamRequestOptions
): Promise<ApiItemResponse<IamGovernanceCaseListItem>> =>
  requestJson<ApiItemResponse<IamGovernanceCaseListItem>>(
    `/iam/governance/workflows/${encodeURIComponent(caseId)}`,
    {
      signal: options?.signal,
    },
    {
      signal: options?.signal,
      timeoutMs: HEAVY_IAM_REQUEST_TIMEOUT_MS,
    }
  );

export const getAdminDeletionRules = async (
  instanceId: string
): Promise<IamTenantDeletionRulesOverview> =>
  requestJson<IamTenantDeletionRulesOverview>(
    `/iam/admin/deletion-rules?instanceId=${encodeURIComponent(instanceId)}`
  );

export const saveAdminDeletionRules = async (payload: {
  readonly instanceId: string;
  readonly deactivateAfterDays: number;
  readonly pseudonymizeAfterDays: number;
  readonly deleteAfterDays: number;
  readonly defaultContentStrategy: IamDeletionContentStrategy;
  readonly allowContentPreferenceOverride: boolean;
}): Promise<IamTenantDeletionRulesOverview> =>
  requestJson<IamTenantDeletionRulesOverview>('/iam/admin/deletion-rules', {
    method: 'POST',
    headers: IAM_HEADERS,
    body: JSON.stringify(payload),
  });

export const getMyDeletionRules = async (): Promise<IamMyDeletionRulesOverview> =>
  requestJson<IamMyDeletionRulesOverview>('/iam/me/deletion-rules');

export const saveMyDeletionRulesContentPreference = async (payload: {
  readonly strategy?: IamDeletionContentStrategy;
}): Promise<IamMyDeletionRulesOverview> =>
  requestJson<IamMyDeletionRulesOverview>('/iam/me/deletion-rules/content-preference', {
    method: 'POST',
    headers: IAM_HEADERS,
    body: JSON.stringify(payload),
  });

export const getMyDataSubjectRights = async (): Promise<
  ApiItemResponse<IamDsrSelfServiceOverview>
> =>
  requestJson<ApiItemResponse<IamDsrSelfServiceOverview>>('/iam/me/data-subject-rights/requests');

export const getMyDataSubjectRightsCase = async (
  caseId: string,
  options?: IamRequestOptions
): Promise<ApiItemResponse<IamSelfServiceActivityItem>> =>
  requestJson<ApiItemResponse<IamSelfServiceActivityItem>>(
    `/iam/me/data-subject-rights/cases/${encodeURIComponent(caseId)}`,
    { signal: options?.signal },
    { signal: options?.signal, timeoutMs: HEAVY_IAM_REQUEST_TIMEOUT_MS }
  );

export const getMyPendingLegalTexts = async (): Promise<ApiListResponse<IamPendingLegalTextItem>> =>
  requestSingleFlight('iam:pending-legal-texts', async () =>
    requestJson<ApiListResponse<IamPendingLegalTextItem>>(
      '/iam/me/legal-texts/pending',
      undefined,
      {
        timeoutMs: HEALTH_REQUEST_TIMEOUT_MS,
      }
    )
  );

export const acceptLegalText = async (payload: {
  readonly instanceId: string;
  readonly legalTextId: string;
  readonly legalTextVersion: string;
  readonly locale: string;
}): Promise<
  ApiItemResponse<{ workflowId: string; operation: 'accept_legal_text'; status: 'ok' }>
> =>
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

export const requestPermissionChange = async (payload: {
  readonly requestNote: string;
}): Promise<
  ApiItemResponse<{
    workflowId: string;
    operation: 'request_permission_change';
    status: 'accepted';
  }>
> =>
  postJson<
    ApiItemResponse<{
      workflowId: string;
      operation: 'request_permission_change';
      status: 'accepted';
    }>,
    typeof payload
  >('/iam/me/permission-change-requests', payload);

export const requestDataExport = async (input: {
  readonly format: 'json' | 'csv' | 'xml';
  readonly async: boolean;
}): Promise<
  | ApiItemResponse<{ exportJobId: string; status: string; format: string }>
  | { exportJobId?: undefined; status?: undefined; format?: undefined; data?: unknown }
> => {
  return requestJsonOrText(
    '/iam/me/data-export',
    {
      method: 'POST',
      headers: createMutationHeaders({ idempotent: true }),
      body: JSON.stringify({
        format: input.format,
        async: input.async,
      }),
    },
    {
      timeoutMs: HEAVY_IAM_REQUEST_TIMEOUT_MS,
    }
  );
};

export const requestLegalConsentExport = async (input: {
  readonly instanceId: string;
  readonly format: 'json' | 'csv';
  readonly accountId?: string;
}): Promise<
  | { data: string }
  | {
      readonly format: 'json';
      readonly rows: readonly Record<string, unknown>[];
    }
> => {
  const params = new URLSearchParams();
  params.set('instanceId', input.instanceId);
  params.set('format', input.format);
  if (input.accountId) {
    params.set('accountId', input.accountId);
  }

  return requestJsonOrText(`/iam/governance/legal-consents/export?${params.toString()}`);
};

export const buildMyDataExportDownloadUrl = (jobId: string, format: 'json' | 'csv' | 'xml') =>
  `/iam/me/data-export/status?jobId=${encodeURIComponent(jobId)}&download=${encodeURIComponent(format)}`;

export const getDataExportStatus = async (
  jobId: string
): Promise<
  ApiItemResponse<{
    id: string;
    format: string;
    status: string;
    createdAt: string;
    completedAt?: string;
    errorMessage?: string;
  }>
> =>
  requestJson(`/iam/me/data-export/status?jobId=${encodeURIComponent(jobId)}`, undefined, {
    timeoutMs: HEAVY_IAM_REQUEST_TIMEOUT_MS,
  });

export const checkOptionalProcessing = async (): Promise<
  | ApiItemResponse<{ status: 'ok'; executed: true }>
  | { error: string; blockedByRestriction?: boolean; blockedByObjection?: boolean }
> =>
  requestJson('/iam/me/optional-processing/execute', {
    method: 'POST',
  });

export const listAdminDsrCases = async (
  query: DsrAdminCasesQuery,
  options?: IamRequestOptions
): Promise<ApiListResponse<IamDsrCaseListItem>> => {
  const params = new URLSearchParams({
    page: String(query.page),
    pageSize: String(query.pageSize),
    sortBy: query.sortBy,
    sortDirection: query.sortDirection,
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

  return requestJson<ApiListResponse<IamDsrCaseListItem>>(
    `/iam/admin/data-subject-rights/cases?${params.toString()}`,
    {
      signal: options?.signal,
    },
    {
      signal: options?.signal,
      timeoutMs: HEAVY_IAM_REQUEST_TIMEOUT_MS,
    }
  );
};

export const getAdminDsrCase = async (
  caseId: string,
  options?: IamRequestOptions
): Promise<ApiItemResponse<IamDsrCaseListItem>> =>
  requestJson<ApiItemResponse<IamDsrCaseListItem>>(
    `/iam/admin/data-subject-rights/cases/${encodeURIComponent(caseId)}`,
    {
      signal: options?.signal,
    },
    {
      signal: options?.signal,
      timeoutMs: HEAVY_IAM_REQUEST_TIMEOUT_MS,
    }
  );
