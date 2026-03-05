import type {
  ApiErrorResponse,
  ApiItemResponse,
  ApiListResponse,
  IamRoleListItem,
  IamUserDetail,
  IamUserListItem,
} from '@sva/core';

const IAM_HEADERS = {
  'Content-Type': 'application/json',
  'X-Requested-With': 'XMLHttpRequest',
} as const;

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
  readonly status?: 'active' | 'inactive' | 'pending';
  readonly notes?: string;
};

export type UpdateMyProfilePayload = {
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
  readonly description?: string;
  readonly roleLevel?: number;
  readonly permissionIds?: readonly string[];
};

export type UpdateRolePayload = {
  readonly description?: string;
  readonly roleLevel?: number;
  readonly permissionIds?: readonly string[];
};

const createIdempotencyKey = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `idempotency-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const readErrorPayload = async (response: Response): Promise<IamHttpError> => {
  const payload = (await response.json().catch(() => null)) as ApiErrorResponse | null;

  return new IamHttpError({
    status: response.status,
    code: payload?.error.code ?? 'internal_error',
    message: payload?.error.message ?? `http_${response.status}`,
    requestId: payload?.requestId,
  });
};

const requestJson = async <T>(input: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(input, {
    credentials: 'include',
    ...init,
  });

  if (!response.ok) {
    throw await readErrorPayload(response);
  }

  return (await response.json()) as T;
};

const patchJson = async <TResponse, TPayload>(path: string, payload: TPayload) =>
  requestJson<TResponse>(path, {
    method: 'PATCH',
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

export const getMyProfile = async (): Promise<ApiItemResponse<IamUserDetail>> =>
  requestJson<ApiItemResponse<IamUserDetail>>('/api/v1/iam/users/me/profile');

export const updateMyProfile = async (
  payload: UpdateMyProfilePayload
): Promise<ApiItemResponse<IamUserDetail>> =>
  patchJson<ApiItemResponse<IamUserDetail>, UpdateMyProfilePayload>('/api/v1/iam/users/me/profile', payload);

export const listRoles = async (): Promise<ApiListResponse<IamRoleListItem>> =>
  requestJson<ApiListResponse<IamRoleListItem>>('/api/v1/iam/roles');

export const createRole = async (
  payload: CreateRolePayload
): Promise<ApiItemResponse<{ id: string; roleName: string }>> =>
  postJson<ApiItemResponse<{ id: string; roleName: string }>, CreateRolePayload>('/api/v1/iam/roles', payload, true);

export const updateRole = async (roleId: string, payload: UpdateRolePayload): Promise<ApiItemResponse<{ id: string }>> =>
  patchJson<ApiItemResponse<{ id: string }>, UpdateRolePayload>(`/api/v1/iam/roles/${roleId}`, payload);

export const deleteRole = async (roleId: string): Promise<ApiItemResponse<{ id: string }>> =>
  requestJson<ApiItemResponse<{ id: string }>>(`/api/v1/iam/roles/${roleId}`, {
    method: 'DELETE',
    headers: IAM_HEADERS,
  });
