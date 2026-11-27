import type {
  IamCreateUserResult,
  IamUserDetail,
  IamUserImportSyncReport,
  IamUserListItem,
} from '@sva/core';
import React from 'react';
import { useStudioTableQuery } from '@sva/studio-ui-react';

import {
  asIamError,
  bulkReprovisionMainserverUsers,
  bulkDeactivateUsers,
  createUser,
  deactivateUser,
  deleteUser as deleteUserRequest,
  IamHttpError,
  listUsers,
  syncUsersFromKeycloak as syncUsersFromKeycloakRequest,
  updateUser as updateUserRequest,
  type CreateUserPayload,
  type UpdateUserPayload,
  type UserStatusFilter,
} from '../lib/iam-api';
import {
  createOperationLogger,
  logBrowserOperationFailure,
  logBrowserOperationStart,
  logBrowserOperationSuccess,
} from '../lib/browser-operation-logging';
import { subscribeIamUsersUpdated } from '../lib/iam-user-events';
import { useAuth } from '../providers/auth-provider';
import { requestEffectiveAccessInvalidation } from '../providers/effective-access-invalidation';

type UserFilters = {
  readonly page: number;
  readonly pageSize: number;
  readonly search: string;
  readonly status: UserStatusFilter;
  readonly role: string;
  readonly includeTechnicalAccounts: boolean;
};

type UseUsersResult = {
  readonly users: readonly IamUserListItem[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
  readonly isLoading: boolean;
  readonly error: IamHttpError | null;
  readonly mutationError: IamHttpError | null;
  readonly filters: UserFilters;
  readonly setSearch: (value: string) => void;
  readonly setStatus: (value: UserStatusFilter) => void;
  readonly setRole: (value: string) => void;
  readonly setIncludeTechnicalAccounts: (value: boolean) => void;
  readonly setPage: (value: number) => void;
  readonly refetch: () => Promise<void>;
  readonly createUser: (payload: CreateUserPayload) => Promise<IamCreateUserResult | null>;
  readonly updateUser: (
    userId: string,
    payload: UpdateUserPayload
  ) => Promise<IamUserDetail | null>;
  readonly deactivateUser: (userId: string) => Promise<boolean>;
  readonly deleteUser: (userId: string) => Promise<boolean>;
  readonly bulkDeactivate: (userIds: readonly string[]) => Promise<boolean>;
  readonly bulkReprovisionMainserver: (
    userIds: readonly string[]
  ) => Promise<import('../lib/iam-api').BulkReprovisionMainserverUsersResult | null>;
  readonly syncUsersFromKeycloak: () => Promise<
    | { readonly ok: true; readonly report: IamUserImportSyncReport }
    | { readonly ok: false; readonly error: IamHttpError }
  >;
};

const DEFAULT_FILTERS: UserFilters = {
  page: 1,
  pageSize: 25,
  search: '',
  status: 'all',
  role: '',
  includeTechnicalAccounts: false,
};

const EMPTY_USERS: readonly IamUserListItem[] = [];
const usersLogger = createOperationLogger('users-hook', 'debug');

export const useUsers = (initial?: Partial<UserFilters>): UseUsersResult => {
  const { refreshSession } = useAuth();
  const isMountedRef = React.useRef(false);

  const [filters, setFilters] = React.useState<UserFilters>({
    ...DEFAULT_FILTERS,
    ...initial,
  });
  const [debouncedSearch, setDebouncedSearch] = React.useState(filters.search);
  const [mutationError, setMutationError] = React.useState<IamHttpError | null>(null);

  React.useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  React.useEffect(() => {
    usersLogger.debug('user_list_query_changed', {
      operation: 'list_users',
      page: filters.page,
      page_size: filters.pageSize,
      search: filters.search.trim(),
      status: filters.status,
      role: filters.role || undefined,
      include_technical_accounts: filters.includeTechnicalAccounts,
    });
    const timer = globalThis.setTimeout(() => {
      setDebouncedSearch(filters.search.trim());
    }, 300);

    return () => {
      globalThis.clearTimeout(timer);
    };
  }, [filters.search]);

  const query = {
    page: filters.page,
    pageSize: filters.pageSize,
    search: debouncedSearch || undefined,
    status: filters.status === 'all' ? undefined : filters.status,
    role: filters.role || undefined,
    includeTechnicalAccounts: filters.includeTechnicalAccounts,
  };
  const list = useStudioTableQuery(['iam-users', query], async (signal) => {
    logBrowserOperationStart(usersLogger, 'user_list_refetch_started', { operation: 'list_users' });
    try {
      const response = await listUsers(query);
      logBrowserOperationSuccess(
        usersLogger,
        'user_list_refetch_succeeded',
        {
          operation: 'list_users',
          item_count: response.data.length,
          total: response.pagination.total,
        },
        'debug'
      );
      return response;
    } catch (cause) {
      if (signal.aborted) throw cause;
      const error = asIamError(cause);
      if (error.status === 401) {
        await refreshSession();
        usersLogger.info('session_refreshed_after_401', {
          operation: 'list_users',
          status: error.status,
          error_code: error.code,
        });
      }
      logBrowserOperationFailure(usersLogger, 'user_list_refetch_failed', error, {
        operation: 'list_users',
      });
      throw error;
    }
  });
  const users = list.data?.data ?? EMPTY_USERS;
  const total = list.data?.pagination.total ?? 0;
  const isLoading = list.state === 'loading';
  const error = list.error as IamHttpError | null;
  const loadUsers = React.useCallback(async () => {
    await list.refetch();
  }, [list.refetch]);
  const loadCurrentUsersRef = React.useRef(loadUsers);
  React.useEffect(() => {
    loadCurrentUsersRef.current = loadUsers;
  }, [loadUsers]);
  const reloadUsers = React.useCallback(() => loadCurrentUsersRef.current(), []);

  React.useEffect(
    () =>
      subscribeIamUsersUpdated(() =>
        reloadUsers().catch((cause) => {
          const resolvedError = asIamError(cause);
          usersLogger.error('background_user_list_refresh_failed_after_update', {
            error_code: resolvedError.code,
            status: resolvedError.status,
          });
        })
      ),
    [reloadUsers]
  );

  const mutate = React.useCallback(
    async <T>(action: () => Promise<T>, operation = 'user_mutation'): Promise<T | null> => {
      if (isMountedRef.current) {
        setMutationError(null);
      }
      logBrowserOperationStart(usersLogger, `${operation}_started`, { operation });
      try {
        const result = await action();
        requestEffectiveAccessInvalidation();
        // Do not block the visible mutation result on the follow-up list refresh.
        // If the reload is slow, the create/edit/deactivate flow should still complete.
        reloadUsers().catch((cause) => {
          const resolvedError = asIamError(cause);
          usersLogger.error('background_user_list_refresh_failed_after_mutation', {
            operation,
            error_code: resolvedError.code,
            status: resolvedError.status,
          });
        });
        logBrowserOperationSuccess(usersLogger, `${operation}_succeeded`, { operation });
        return result;
      } catch (cause) {
        const resolvedError = asIamError(cause);
        if (resolvedError.status === 401) {
          await refreshSession();
          usersLogger.info('session_refreshed_after_401', {
            operation,
            status: resolvedError.status,
            error_code: resolvedError.code,
          });
        }
        if (isMountedRef.current) {
          setMutationError(resolvedError);
        }
        logBrowserOperationFailure(usersLogger, `${operation}_failed`, resolvedError, {
          operation,
        });
        return null;
      }
    },
    [refreshSession, reloadUsers]
  );

  return {
    users,
    total,
    page: filters.page,
    pageSize: filters.pageSize,
    isLoading,
    error: error ?? mutationError,
    mutationError,
    filters,
    setSearch: (value) => setFilters((current) => ({ ...current, page: 1, search: value })),
    setStatus: (value) => setFilters((current) => ({ ...current, page: 1, status: value })),
    setRole: (value) => setFilters((current) => ({ ...current, page: 1, role: value })),
    setIncludeTechnicalAccounts: (value) =>
      setFilters((current) => ({ ...current, page: 1, includeTechnicalAccounts: value })),
    setPage: (value) => setFilters((current) => ({ ...current, page: Math.max(1, value) })),
    refetch: reloadUsers,
    createUser: async (payload) => {
      const response = await mutate(() => createUser(payload), 'user_create');
      return response?.data ?? null;
    },
    updateUser: async (userId, payload) => {
      const response = await mutate(() => updateUserRequest(userId, payload), 'user_update');
      return response?.data ?? null;
    },
    deactivateUser: async (userId) => {
      const response = await mutate(() => deactivateUser(userId), 'user_deactivate');
      return Boolean(response);
    },
    deleteUser: async (userId) => {
      const response = await mutate(() => deleteUserRequest(userId), 'user_delete');
      return response !== null;
    },
    bulkDeactivate: async (userIds) => {
      const response = await mutate(() => bulkDeactivateUsers(userIds), 'user_bulk_deactivate');
      return Boolean(response);
    },
    bulkReprovisionMainserver: async (userIds) => {
      const response = await mutate(
        () => bulkReprovisionMainserverUsers(userIds),
        'user_bulk_reprovision_mainserver'
      );
      return response?.data ?? null;
    },
    syncUsersFromKeycloak: async () => {
      logBrowserOperationStart(usersLogger, 'user_sync_keycloak_started', {
        operation: 'user_sync_keycloak',
      });
      try {
        const response = await syncUsersFromKeycloakRequest();
        requestEffectiveAccessInvalidation();
        // Do not block the visible sync feedback on the follow-up list refresh.
        // The list reload keeps its own loading/error handling.
        reloadUsers().catch((cause: unknown) => {
          const resolvedError = asIamError(cause);
          usersLogger.warn('user_sync_keycloak_list_refresh_failed', {
            operation: 'user_sync_keycloak',
            code: resolvedError.code,
            status: resolvedError.status,
            requestId: resolvedError.requestId,
          });
        });
        if (response.data.importedCount === 0 && response.data.updatedCount === 0) {
          logBrowserOperationSuccess(
            usersLogger,
            'user_sync_keycloak_empty',
            {
              operation: 'user_sync_keycloak',
              skipped_count: response.data.skippedCount,
              total_keycloak_users: response.data.totalKeycloakUsers,
            },
            'info'
          );
        } else {
          logBrowserOperationSuccess(
            usersLogger,
            'user_sync_keycloak_succeeded',
            {
              operation: 'user_sync_keycloak',
              imported_count: response.data.importedCount,
              updated_count: response.data.updatedCount,
              skipped_count: response.data.skippedCount,
            },
            'info'
          );
        }
        return { ok: true, report: response.data };
      } catch (cause) {
        const resolvedError = asIamError(cause);
        if (resolvedError.status === 401) {
          await refreshSession();
          usersLogger.info('session_refreshed_after_401', {
            operation: 'user_sync_keycloak',
            status: resolvedError.status,
            error_code: resolvedError.code,
          });
        }
        logBrowserOperationFailure(usersLogger, 'user_sync_keycloak_failed', resolvedError, {
          operation: 'user_sync_keycloak',
        });
        return { ok: false, error: resolvedError };
      }
    },
  };
};
