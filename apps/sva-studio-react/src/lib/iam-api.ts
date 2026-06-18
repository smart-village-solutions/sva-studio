import type {
  ApiItemResponse,
  ApiListResponse,
  AuthorizePerformanceRequest,
  AuthorizePerformanceRunResponse,
  AuthorizePerformanceRunResult,
  CreateIamContentInput,
  IamAdminGroupDetail,
  IamAdminGroupListItem,
  IamCreateUserResult,
  IamContentDetail,
  IamContentHistoryEntry,
  IamContentListItem,
  IamContentListQuery,
  IamDeletionContentStrategy,
  IamDsrCanonicalStatus,
  IamDsrCaseListItem,
  IamDsrSelfServiceOverview,
  IamSelfServiceActivityItem,
  IamGovernanceCaseListItem,
  InstanceAuditRun,
  IamInstanceDetail,
  IamInstanceListItem,
  IamLegalTextListItem,
  IamPendingLegalTextItem,
  IamOrganizationContext,
  IamOrganizationDetail,
  IamOrganizationListItem,
  IamOrganizationMembershipVisibility,
  IamOrganizationType,
  IamMyDeletionRulesOverview,
  IamPermission,
  IamRolePermissionAssignmentScope,
  IamRoleListItem,
  IamRoleReconcileReport,
  IamTenantDeletionRulesOverview,
  RuntimeHealthResponse,
  StudioJobDetail,
  StudioJobDetailResponse,
  StudioJobListItem,
  StudioJobListQuery,
  StudioJobListResponse,
  IamUserDirectPermissionAssignment,
  IamUserTimelineEvent,
  IamUserDetail,
  IamUserImportSyncReport,
  IamUserListItem,
  RuntimeDependencyHealth,
  UpdateIamContentInput,
} from '@sva/core';
import {
  createMutationHeaders,
  createJsonMutationRequestInit,
  DEFAULT_IAM_REQUEST_TIMEOUT_MS,
  HEALTH_REQUEST_TIMEOUT_MS,
  HEAVY_IAM_REQUEST_TIMEOUT_MS,
  IAM_HEADERS,
  IamHttpError,
  type IamRequestOptions,
  patchJson,
  postJson,
  putJson,
  requestJson,
  requestJsonOrText,
} from './iam-http-client';
import { requestSingleFlight } from './request-singleflight';

export {
  asIamError,
  fetchWithRequestTimeout,
  IamHttpError,
  LEGAL_ACCEPTANCE_REQUIRED_EVENT,
  readIamErrorResponse,
} from './iam-http-client';

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
  readonly groupIds?: readonly string[];
  readonly sendPasswordSetupEmail?: boolean;
};

export type UpdateUserPayload = Partial<Omit<CreateUserPayload, 'roleIds'>> & {
  readonly roleIds?: readonly string[];
  readonly groupIds?: readonly string[];
  readonly directPermissions?: readonly Pick<
    IamUserDirectPermissionAssignment,
    'permissionId' | 'effect'
  >[];
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
  readonly permissionAssignments?: readonly {
    readonly permissionId: string;
    readonly accessScope?: IamRolePermissionAssignmentScope;
  }[];
};

export type UpdateRolePayload = {
  readonly displayName?: string;
  readonly description?: string;
  readonly roleLevel?: number;
  readonly permissionIds?: readonly string[];
  readonly permissionAssignments?: readonly {
    readonly permissionId: string;
    readonly accessScope?: IamRolePermissionAssignmentScope;
  }[];
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
  readonly targetRoleIds?: readonly string[];
  readonly targetGroupIds?: readonly string[];
};

export type UpdateLegalTextPayload = {
  readonly name?: string;
  readonly legalTextVersion?: string;
  readonly locale?: string;
  readonly contentHtml?: string;
  readonly status?: 'draft' | 'valid' | 'archived';
  readonly publishedAt?: string;
  readonly targetRoleIds?: readonly string[];
  readonly targetGroupIds?: readonly string[];
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

export type IamRegisteredMediaAsset = Readonly<{
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
  previewUrl?: string | null;
}>;

export type IamUnregisteredMediaAsset = Readonly<{
  source: 'bucket';
  registrationStatus: 'unregistered';
  storageKey: string;
  fileName: string;
  folderPath: string;
  relativePath: string;
  byteSize: number;
  updatedAt?: string | null;
  lastModified?: string | null;
  previewUrl?: string | null;
}>;

export type IamMediaAsset = IamRegisteredMediaAsset | IamUnregisteredMediaAsset;

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

export type CompleteMediaUploadResponse = Readonly<{
  assetId: string;
  uploadSessionId: string;
  status: string;
}>;

export type UpdateMediaMetadataPayload = Readonly<{
  title?: string | null;
  description?: string | null;
  altText?: string | null;
  copyright?: string | null;
  license?: string | null;
  focusPoint?: MediaMetadata['focusPoint'] | null;
  crop?: MediaMetadata['crop'] | null;
}>;

export type UpdateMediaPayload = Readonly<{
  visibility?: MediaVisibility;
  metadata: UpdateMediaMetadataPayload;
}>;

export type RegisterBucketMediaPayload = Readonly<{
  instanceId?: string;
  storageKey: string;
  fileName: string;
  byteSize: number;
  mimeType: string;
  visibility?: MediaVisibility;
  metadata?: UpdateMediaMetadataPayload;
}>;

export type IamMediaDelivery = Readonly<{
  assetId: string;
  visibility: MediaVisibility;
  deliveryUrl: string;
  expiresAt?: string;
}>;

export type MediaListQuery = {
  readonly search?: string;
  readonly visibility?: MediaVisibility | 'all';
  readonly page?: number;
  readonly pageSize?: number;
};

export const isRegisteredMediaAsset = (
  asset: IamMediaAsset
): asset is IamRegisteredMediaAsset => 'id' in asset;

export const getMediaLibraryItemKey = (asset: IamMediaAsset): string =>
  isRegisteredMediaAsset(asset) ? asset.id : asset.storageKey;

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
  readonly mainserverApplicationId?: string;
  readonly mainserverApplicationSecret?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
};

export type UpdateOrganizationPayload = Partial<CreateOrganizationPayload> & {
  readonly parentOrganizationId?: string | null;
  readonly isActive?: boolean;
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
  readonly intent:
    | 'provision'
    | 'provision_admin_client'
    | 'reset_tenant_admin'
    | 'rotate_client_secret';
  readonly tenantAdminTemporaryPassword?: string;
};

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

export const getUserTimeline = async (
  userId: string
): Promise<ApiListResponse<IamUserTimelineEvent>> =>
  requestJson<ApiListResponse<IamUserTimelineEvent>>(`/api/v1/iam/users/${userId}/timeline`);

export const createUser = async (
  payload: CreateUserPayload
): Promise<ApiItemResponse<IamCreateUserResult>> =>
  requestJson<ApiItemResponse<IamCreateUserResult>>(
    '/api/v1/iam/users',
    createJsonMutationRequestInit('POST', payload, { idempotent: true }),
    { timeoutMs: HEAVY_IAM_REQUEST_TIMEOUT_MS }
  );

export const updateUser = async (
  userId: string,
  payload: UpdateUserPayload
): Promise<ApiItemResponse<IamUserDetail>> =>
  patchJson<ApiItemResponse<IamUserDetail>, UpdateUserPayload>(
    `/api/v1/iam/users/${userId}`,
    payload
  );

export const sendPasswordSetupEmail = async (
  userId: string
): Promise<ApiItemResponse<{ status: 'sent' }>> =>
  postJson<ApiItemResponse<{ status: 'sent' }>, Record<string, never>>(
    `/api/v1/iam/users/${userId}/send-password-setup-email`,
    {},
    true
  );

export const deactivateUser = async (userId: string): Promise<ApiItemResponse<{ id: string }>> =>
  requestJson<ApiItemResponse<{ id: string }>>(`/api/v1/iam/users/${userId}`, {
    method: 'DELETE',
    headers: IAM_HEADERS,
  });

export const bulkDeactivateUsers = async (
  userIds: readonly string[]
): Promise<ApiItemResponse<{ deactivatedUserIds: readonly string[]; count: number }>> =>
  postJson<
    ApiItemResponse<{ deactivatedUserIds: readonly string[]; count: number }>,
    { userIds: readonly string[] }
  >('/api/v1/iam/users/bulk-deactivate', { userIds }, true);

export const syncUsersFromKeycloak = async (): Promise<ApiItemResponse<IamUserImportSyncReport>> =>
  requestJson<ApiItemResponse<IamUserImportSyncReport>>(
    '/api/v1/iam/users/sync-keycloak',
    {
      method: 'POST',
      headers: IAM_HEADERS,
      body: JSON.stringify({}),
    },
    {
      timeoutMs: HEAVY_IAM_REQUEST_TIMEOUT_MS,
    }
  );

export const getMyProfile = async (): Promise<ApiItemResponse<IamUserDetail>> =>
  requestJson<ApiItemResponse<IamUserDetail>>('/api/v1/iam/users/me/profile');

export const updateMyProfile = async (
  payload: UpdateMyProfilePayload
): Promise<ApiItemResponse<IamUserDetail>> =>
  patchJson<ApiItemResponse<IamUserDetail>, UpdateMyProfilePayload>(
    '/api/v1/iam/users/me/profile',
    payload
  );

export const listRoles = async (): Promise<ApiListResponse<IamRoleListItem>> =>
  requestJson<ApiListResponse<IamRoleListItem>>('/api/v1/iam/roles');

export const listGroups = async (): Promise<ApiListResponse<IamAdminGroupListItem>> =>
  requestJson<ApiListResponse<IamAdminGroupListItem>>('/api/v1/iam/groups');

export const getGroup = async (groupId: string): Promise<ApiItemResponse<IamAdminGroupDetail>> =>
  requestJson<ApiItemResponse<IamAdminGroupDetail>>(`/api/v1/iam/groups/${groupId}`);

export const listLegalTexts = async (): Promise<ApiListResponse<IamLegalTextListItem>> =>
  requestJson<ApiListResponse<IamLegalTextListItem>>('/api/v1/iam/legal-texts');

export const listContents = async (
  query: IamContentListQuery
): Promise<ApiListResponse<IamContentListItem>> => {
  const params = new URLSearchParams({
    page: String(query.page),
    pageSize: String(query.pageSize),
    sortBy: query.sortBy,
    sortDirection: query.sortDirection,
  });

  if (query.q) {
    params.set('q', query.q);
  }
  if (query.type) {
    params.set('type', query.type);
  }
  if (query.status) {
    params.set('status', query.status);
  }
  for (const contentType of query.visibleTypes ?? []) {
    params.append('visibleType', contentType);
  }

  return requestJson<ApiListResponse<IamContentListItem>>(`/api/v1/iam/contents?${params.toString()}`);
};

export const getContent = async (contentId: string): Promise<ApiItemResponse<IamContentDetail>> =>
  requestJson<ApiItemResponse<IamContentDetail>>(`/api/v1/iam/contents/${contentId}`);

export const getContentHistory = async (
  contentId: string
): Promise<ApiListResponse<IamContentHistoryEntry>> =>
  requestJson<ApiListResponse<IamContentHistoryEntry>>(`/api/v1/iam/contents/${contentId}/history`);

export const createContent = async (
  payload: CreateContentPayload
): Promise<ApiItemResponse<IamContentDetail>> =>
  postJson<ApiItemResponse<IamContentDetail>, CreateContentPayload>(
    '/api/v1/iam/contents',
    payload,
    true
  );

export const updateContent = async (
  contentId: string,
  payload: UpdateContentPayload
): Promise<ApiItemResponse<IamContentDetail>> =>
  patchJson<ApiItemResponse<IamContentDetail>, UpdateContentPayload>(
    `/api/v1/iam/contents/${contentId}`,
    payload
  );

export const deleteContent = async (contentId: string): Promise<ApiItemResponse<{ id: string }>> =>
  requestJson<ApiItemResponse<{ id: string }>>(`/api/v1/iam/contents/${contentId}`, {
    method: 'DELETE',
    headers: IAM_HEADERS,
  });

export const listMedia = async (
  query: MediaListQuery = {}
): Promise<ApiListResponse<IamMediaAsset>> => {
  const params = new URLSearchParams();

  if (query.search) {
    params.set('search', query.search);
  }
  if (query.visibility && query.visibility !== 'all') {
    params.set('visibility', query.visibility);
  }
  if (typeof query.page === 'number') {
    params.set('page', String(query.page));
  }
  if (typeof query.pageSize === 'number') {
    params.set('pageSize', String(query.pageSize));
  }

  const suffix = params.toString();
  return requestJson<ApiListResponse<IamMediaAsset>>(
    `/api/v1/iam/media${suffix ? `?${suffix}` : ''}`
  );
};

export const getMedia = async (
  assetId: string
): Promise<ApiItemResponse<IamRegisteredMediaAsset>> =>
  requestJson<ApiItemResponse<IamRegisteredMediaAsset>>(`/api/v1/iam/media/${assetId}`);

export const getMediaUsage = async (
  assetId: string
): Promise<ApiItemResponse<IamMediaUsageImpact>> =>
  requestJson<ApiItemResponse<IamMediaUsageImpact>>(`/api/v1/iam/media/${assetId}/usage`);

export const initializeMediaUpload = async (
  payload: InitializeMediaUploadPayload
): Promise<ApiItemResponse<InitializeMediaUploadResponse>> =>
  postJson<ApiItemResponse<InitializeMediaUploadResponse>, InitializeMediaUploadPayload>(
    '/api/v1/iam/media/upload-sessions',
    payload,
    true
  );

export const completeMediaUpload = async (
  uploadSessionId: string
): Promise<ApiItemResponse<CompleteMediaUploadResponse>> =>
  requestJson<ApiItemResponse<CompleteMediaUploadResponse>>(
    `/api/v1/iam/media/upload-sessions/${uploadSessionId}/complete`,
    {
      method: 'POST',
      headers: IAM_HEADERS,
    }
  );

export const registerBucketMedia = async (
  payload: RegisterBucketMediaPayload
): Promise<ApiItemResponse<IamRegisteredMediaAsset>> =>
  postJson<ApiItemResponse<IamRegisteredMediaAsset>, RegisterBucketMediaPayload>(
    '/api/v1/iam/media/register',
    payload,
    true
  );

export const updateMedia = async (
  assetId: string,
  payload: UpdateMediaPayload
): Promise<ApiItemResponse<IamRegisteredMediaAsset>> =>
  patchJson<ApiItemResponse<IamRegisteredMediaAsset>, UpdateMediaPayload>(
    `/api/v1/iam/media/${assetId}`,
    payload
  );

export const getMediaDelivery = async (
  assetId: string
): Promise<ApiItemResponse<IamMediaDelivery>> =>
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

  return requestJson<ApiListResponse<IamOrganizationListItem>>(
    `/api/v1/iam/organizations?${params.toString()}`
  );
};

export const listInstances = async (
  query: InstancesQuery = {}
): Promise<ApiListResponse<IamInstanceListItem>> => {
  const params = new URLSearchParams();
  if (query.search) {
    params.set('search', query.search);
  }
  if (query.status) {
    params.set('status', query.status);
  }
  const suffix = params.toString();
  return requestJson<ApiListResponse<IamInstanceListItem>>(
    `/api/v1/iam/instances${suffix ? `?${suffix}` : ''}`
  );
};

export const getInstance = async (
  instanceId: string
): Promise<ApiItemResponse<IamInstanceDetail>> =>
  requestJson<ApiItemResponse<IamInstanceDetail>>(`/api/v1/iam/instances/${instanceId}`);

export const getInstanceAuditRun = async (
  query: {
    readonly instanceIds?: readonly string[];
    readonly includeOnlyActive?: boolean;
  } = {}
): Promise<ApiItemResponse<InstanceAuditRun>> => {
  const params = new URLSearchParams();
  for (const instanceId of query.instanceIds ?? []) {
    params.append('instanceId', instanceId);
  }
  if (typeof query.includeOnlyActive === 'boolean') {
    params.set('includeOnlyActive', String(query.includeOnlyActive));
  }

  const suffix = params.toString();
  return requestJson<ApiItemResponse<InstanceAuditRun>>(
    `/api/v1/iam/instances/audit${suffix ? `?${suffix}` : ''}`
  );
};

export const getSingleInstanceAuditRun = async (
  instanceId: string
): Promise<ApiItemResponse<InstanceAuditRun>> =>
  requestJson<ApiItemResponse<InstanceAuditRun>>(`/api/v1/iam/instances/${instanceId}/audit`);

export const createInstance = async (
  payload: CreateInstancePayload
): Promise<ApiItemResponse<IamInstanceListItem>> =>
  postJson<ApiItemResponse<IamInstanceListItem>, CreateInstancePayload>(
    '/api/v1/iam/instances',
    payload,
    true
  );

export const updateInstance = async (
  instanceId: string,
  payload: UpdateInstancePayload
): Promise<ApiItemResponse<IamInstanceDetail>> =>
  patchJson<ApiItemResponse<IamInstanceDetail>, UpdateInstancePayload>(`/api/v1/iam/instances/${instanceId}`, payload);

export const getInstanceKeycloakStatus = async (
  instanceId: string
): Promise<ApiItemResponse<IamInstanceDetail['keycloakStatus']>> =>
  requestJson<ApiItemResponse<IamInstanceDetail['keycloakStatus']>>(
    `/api/v1/iam/instances/${instanceId}/keycloak/status`
  );

export const getInstanceKeycloakPreflight = async (
  instanceId: string
): Promise<ApiItemResponse<IamInstanceDetail['keycloakPreflight']>> =>
  requestJson<ApiItemResponse<IamInstanceDetail['keycloakPreflight']>>(
    `/api/v1/iam/instances/${instanceId}/keycloak/preflight`
  );

export const planInstanceKeycloakProvisioning = async (
  instanceId: string
): Promise<ApiItemResponse<IamInstanceDetail['keycloakPlan']>> =>
  postJson<ApiItemResponse<IamInstanceDetail['keycloakPlan']>, Record<string, never>>(
    `/api/v1/iam/instances/${instanceId}/keycloak/plan`,
    {},
    true
  );

export const executeInstanceKeycloakProvisioning = async (
  instanceId: string,
  payload: ExecuteInstanceKeycloakProvisioningPayload
): Promise<ApiItemResponse<IamInstanceDetail['latestKeycloakProvisioningRun']>> =>
  postJson<
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

export const getRuntimeHealth = async (
  options: IamRequestOptions = {}
): Promise<RuntimeHealthResponse> =>
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

  return requestJson<StudioJobListResponse>(`/api/v1/plugin-operations/jobs?${params.toString()}`, undefined, {
    signal: options.signal,
    timeoutMs: options.timeoutMs ?? DEFAULT_IAM_REQUEST_TIMEOUT_MS,
  });
};

export const getPluginOperationJob = async (
  jobId: string,
  options: IamRequestOptions = {}
): Promise<StudioJobDetail> => {
  const response = await requestJson<StudioJobDetailResponse>(`/api/v1/plugin-operations/jobs/${jobId}`, undefined, {
    signal: options.signal,
    timeoutMs: options.timeoutMs ?? DEFAULT_IAM_REQUEST_TIMEOUT_MS,
  });

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

export const reconcileInstanceKeycloak = async (
  instanceId: string,
  payload: ReconcileInstanceKeycloakPayload
): Promise<ApiItemResponse<IamInstanceDetail['keycloakStatus']>> =>
  postJson<
    ApiItemResponse<IamInstanceDetail['keycloakStatus']>,
    ReconcileInstanceKeycloakPayload
  >(`/api/v1/iam/instances/${instanceId}/keycloak/reconcile`, payload, true);

export const probeTenantIamAccess = async (
  instanceId: string
): Promise<ApiItemResponse<IamInstanceDetail['tenantIamStatus']>> =>
  postJson<ApiItemResponse<IamInstanceDetail['tenantIamStatus']>, Record<string, never>>(
    `/api/v1/iam/instances/${instanceId}/tenant-iam/access-probe`,
    {},
    true
  );

export const assignInstanceModule = async (
  instanceId: string,
  moduleId: string
): Promise<ApiItemResponse<IamInstanceDetail>> =>
  postJson<ApiItemResponse<IamInstanceDetail>, { moduleId: string }>(
    `/api/v1/iam/instances/${instanceId}/modules/assign`,
    { moduleId },
    true
  );

export const bootstrapInstanceAdminStructure = async (
  instanceId: string,
  moduleIds: readonly string[]
): Promise<ApiItemResponse<IamInstanceDetail>> =>
  postJson<ApiItemResponse<IamInstanceDetail>, { moduleIds: readonly string[] }>(
    `/api/v1/iam/instances/${instanceId}/modules/bootstrap-admin-structure`,
    { moduleIds },
    true
  );

export const revokeInstanceModule = async (
  instanceId: string,
  moduleId: string
): Promise<ApiItemResponse<IamInstanceDetail>> =>
  postJson<
    ApiItemResponse<IamInstanceDetail>,
    { moduleId: string; confirmation: 'REVOKE' }
  >(
    `/api/v1/iam/instances/${instanceId}/modules/revoke`,
    { moduleId, confirmation: 'REVOKE' },
    true
  );

export const seedInstanceIamBaseline = async (
  instanceId: string
): Promise<ApiItemResponse<IamInstanceDetail>> =>
  postJson<ApiItemResponse<IamInstanceDetail>, Record<string, never>>(
    `/api/v1/iam/instances/${instanceId}/modules/seed-iam-baseline`,
    {},
    true
  );

export const activateInstance = async (
  instanceId: string
): Promise<ApiItemResponse<IamInstanceListItem>> =>
  postJson<ApiItemResponse<IamInstanceListItem>, { status: 'active' }>(
    `/api/v1/iam/instances/${instanceId}/activate`,
    { status: 'active' },
    true
  );

export const suspendInstance = async (
  instanceId: string
): Promise<ApiItemResponse<IamInstanceListItem>> =>
  postJson<ApiItemResponse<IamInstanceListItem>, { status: 'suspended' }>(
    `/api/v1/iam/instances/${instanceId}/suspend`,
    { status: 'suspended' },
    true
  );

export const archiveInstance = async (
  instanceId: string
): Promise<ApiItemResponse<IamInstanceListItem>> =>
  postJson<ApiItemResponse<IamInstanceListItem>, { status: 'archived' }>(
    `/api/v1/iam/instances/${instanceId}/archive`,
    { status: 'archived' },
    true
  );

export const getOrganization = async (
  organizationId: string
): Promise<ApiItemResponse<IamOrganizationDetail>> =>
  requestJson<ApiItemResponse<IamOrganizationDetail>>(
    `/api/v1/iam/organizations/${organizationId}`
  );

export const createOrganization = async (
  payload: CreateOrganizationPayload
): Promise<ApiItemResponse<IamOrganizationDetail>> =>
  postJson<ApiItemResponse<IamOrganizationDetail>, CreateOrganizationPayload>(
    '/api/v1/iam/organizations',
    payload,
    true
  );

export const updateOrganization = async (
  organizationId: string,
  payload: UpdateOrganizationPayload
): Promise<ApiItemResponse<IamOrganizationDetail>> =>
  patchJson<ApiItemResponse<IamOrganizationDetail>, UpdateOrganizationPayload>(
    `/api/v1/iam/organizations/${organizationId}`,
    payload
  );

export const deactivateOrganization = async (
  organizationId: string
): Promise<ApiItemResponse<{ id: string }>> =>
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

export const getMyOrganizationContext = async (): Promise<
  ApiItemResponse<IamOrganizationContext>
> =>
  requestSingleFlight('iam:me-context', async () =>
    requestJson<ApiItemResponse<IamOrganizationContext>>('/api/v1/iam/me/context')
  );

export const listPermissions = async (): Promise<ApiListResponse<IamPermission>> =>
  requestJson<ApiListResponse<IamPermission>>('/api/v1/iam/permissions');

export const updateMyOrganizationContext = async (
  organizationId: string
): Promise<ApiItemResponse<IamOrganizationContext>> =>
  putJson<ApiItemResponse<IamOrganizationContext>, { organizationId: string }>(
    '/api/v1/iam/me/context',
    {
      organizationId,
    }
  );

export const createRole = async (
  payload: CreateRolePayload
): Promise<ApiItemResponse<IamRoleListItem>> =>
  postJson<ApiItemResponse<IamRoleListItem>, CreateRolePayload>('/api/v1/iam/roles', payload, true);

export const createGroup = async (
  payload: CreateGroupPayload
): Promise<ApiItemResponse<{ id: string }>> =>
  postJson<ApiItemResponse<{ id: string }>, CreateGroupPayload>(
    '/api/v1/iam/groups',
    payload,
    true
  );

export const createLegalText = async (
  payload: CreateLegalTextPayload
): Promise<ApiItemResponse<IamLegalTextListItem>> =>
  postJson<ApiItemResponse<IamLegalTextListItem>, CreateLegalTextPayload>(
    '/api/v1/iam/legal-texts',
    payload,
    true
  );

export const updateRole = async (
  roleId: string,
  payload: UpdateRolePayload
): Promise<ApiItemResponse<IamRoleListItem>> =>
  patchJson<ApiItemResponse<IamRoleListItem>, UpdateRolePayload>(
    `/api/v1/iam/roles/${roleId}`,
    payload
  );

export const updateGroup = async (
  groupId: string,
  payload: UpdateGroupPayload
): Promise<ApiItemResponse<{ id: string }>> =>
  patchJson<ApiItemResponse<{ id: string }>, UpdateGroupPayload>(
    `/api/v1/iam/groups/${groupId}`,
    payload
  );

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

export const deleteLegalText = async (
  legalTextVersionId: string
): Promise<ApiItemResponse<{ id: string }>> =>
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
  requestJson<ApiItemResponse<{ groupId: string; roleId: string }>>(
    `/api/v1/iam/groups/${groupId}/roles/${roleId}`,
    {
      method: 'DELETE',
      headers: IAM_HEADERS,
    }
  );

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
    requestJson<ApiListResponse<IamPendingLegalTextItem>>('/iam/me/legal-texts/pending', undefined, {
      timeoutMs: HEALTH_REQUEST_TIMEOUT_MS,
    })
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

export const buildMyDataExportDownloadUrl = (
  jobId: string,
  format: 'json' | 'csv' | 'xml'
) =>
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
