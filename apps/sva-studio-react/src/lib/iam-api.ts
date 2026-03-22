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
  IamLegalTextListItem,
  IamPendingLegalTextItem,
  IamOrganizationContext,
  IamOrganizationDetail,
  IamOrganizationListItem,
  IamOrganizationMembershipVisibility,
  IamOrganizationType,
  IamRoleListItem,
  IamUserTimelineEvent,
  IamUserDetail,
  IamUserImportSyncReport,
  IamUserListItem,
  UpdateIamContentInput,
} from '@sva/core';

const IAM_HEADERS = {
  'Content-Type': 'application/json',
  'X-Requested-With': 'XMLHttpRequest',
} as const;

export const LEGAL_ACCEPTANCE_REQUIRED_EVENT = 'sva:legal-acceptance-required';

export class IamHttpError extends Error {
  readonly status: number;
  readonly code: string;
  readonly requestId?: string;

  constructor(input: { status: number; code: string; message: string; requestId?: string }) {
    super(input.message);
    this.name = 'IamHttpError';
    this.status = input.status;
    this.code = input.code;
    this.requestId = input.requestId;
  }
}

type IamErrorPayload =
  | ApiErrorResponse
  | {
      readonly error?: string;
      readonly message?: string;
      readonly requestId?: string;
    };

type SafeDiagnosticDetails = Readonly<{
  reason_code?: string;
  dependency?: string;
  schema_object?: string;
  expected_migration?: string;
  actor_resolution?: string;
  instance_id?: string;
}>;

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

const readSafeDiagnosticDetails = (payload: IamErrorPayload | null): SafeDiagnosticDetails | undefined => {
  if (!payload || typeof payload.error !== 'object' || !payload.error || !('details' in payload.error)) {
    return undefined;
  }

  const details = (payload.error as { details?: unknown }).details;
  if (!details || typeof details !== 'object') {
    return undefined;
  }

  const source = details as Record<string, unknown>;
  const safeDetails: SafeDiagnosticDetails = {
    reason_code: typeof source.reason_code === 'string' ? source.reason_code : undefined,
    dependency: typeof source.dependency === 'string' ? source.dependency : undefined,
    schema_object: typeof source.schema_object === 'string' ? source.schema_object : undefined,
    expected_migration:
      typeof source.expected_migration === 'string' ? source.expected_migration : undefined,
    actor_resolution:
      typeof source.actor_resolution === 'string' ? source.actor_resolution : undefined,
    instance_id: typeof source.instance_id === 'string' ? source.instance_id : undefined,
  };

  return Object.values(safeDetails).some((value) => typeof value === 'string') ? safeDetails : undefined;
};

const logDevelopmentApiError = (input: {
  requestId?: string;
  status: number;
  code: string;
  details?: SafeDiagnosticDetails;
}) => {
  if (!isDevelopmentEnvironment()) {
    return;
  }

  console.error('IAM API request failed', {
    request_id: input.requestId,
    status: input.status,
    code: input.code,
    ...(input.details ? { details: input.details } : {}),
  });
};

export const asIamError = (error: unknown): IamHttpError =>
  error instanceof IamHttpError
    ? error
    : new IamHttpError({
        status: 500,
        code: 'internal_error',
        message: error instanceof Error ? error.message : String(error),
      });

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

export type RoleReconcileEntry = {
  readonly roleId?: string;
  readonly roleKey?: string;
  readonly externalRoleName: string;
  readonly action: 'noop' | 'create' | 'update' | 'report';
  readonly status: 'synced' | 'corrected' | 'failed' | 'requires_manual_action';
  readonly errorCode?: string;
};

export type RoleReconcileReport = {
  readonly checkedCount: number;
  readonly correctedCount: number;
  readonly failedCount: number;
  readonly requiresManualActionCount: number;
  readonly roles: readonly RoleReconcileEntry[];
};

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

type IamRequestOptions = Readonly<{
  signal?: AbortSignal;
}>;

const createIdempotencyKey = () => crypto.randomUUID();

const readErrorPayload = async (response: Response): Promise<IamHttpError> => {
  const payload = (await response.json().catch(() => null)) as IamErrorPayload | null;
  const code = readErrorCodeFromPayload(payload) ?? 'internal_error';
  const requestId = readRequestIdFromResponse(response, payload ?? undefined);
  const details = readSafeDiagnosticDetails(payload);

  logDevelopmentApiError({ requestId, status: response.status, code, details });

  if (code === 'legal_acceptance_required' && typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(LEGAL_ACCEPTANCE_REQUIRED_EVENT));
  }

  return new IamHttpError({
    status: response.status,
    code,
    message: readErrorMessageFromPayload(payload, response.status),
    requestId,
  });
};

const requestJson = async <T>(input: string, init?: RequestInit): Promise<T> => {
  const { headers: initHeaders, ...restInit } = init ?? {};
  const response = await fetch(input, {
    credentials: 'include',
    ...restInit,
    headers: { Accept: 'application/json', ...initHeaders },
  });

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
      });
    }
    throw await readErrorPayload(response);
  }

  if (!contentType.includes('application/json')) {
    throw new IamHttpError({
      status: response.status,
      code: 'non_json_response',
      message: `Erwartete JSON-Antwort, erhielt ${contentType || 'unbekannten Content-Type'}.`,
    });
  }

  return (await response.json()) as T;
};

const requestJsonOrText = async <T>(
  input: string,
  init?: RequestInit
): Promise<T | { data: string }> => {
  const { headers: initHeaders, ...restInit } = init ?? {};
  const response = await fetch(input, {
    credentials: 'include',
    ...restInit,
    headers: { Accept: 'application/json, text/plain, text/csv, application/xml', ...initHeaders },
  });

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
  });
};

export const getMyDataSubjectRights = async (): Promise<ApiItemResponse<IamDsrSelfServiceOverview>> =>
  requestJson<ApiItemResponse<IamDsrSelfServiceOverview>>('/iam/me/data-subject-rights/requests');

export const getMyPendingLegalTexts = async (): Promise<ApiListResponse<IamPendingLegalTextItem>> =>
  requestJson<ApiListResponse<IamPendingLegalTextItem>>('/iam/me/legal-texts/pending');

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
  });
};

export const getDataExportStatus = async (
  jobId: string
): Promise<ApiItemResponse<{ id: string; format: string; status: string; createdAt: string; completedAt?: string; errorMessage?: string }>> =>
  requestJson(`/iam/me/data-export/status?jobId=${encodeURIComponent(jobId)}`);

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
  });
};
