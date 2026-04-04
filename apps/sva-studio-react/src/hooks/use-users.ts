import type { IamUserDetail, IamUserImportSyncReport, IamUserListItem } from '@sva/core';
import React from 'react';

import {
  asIamError,
  bulkDeactivateUsers,
  createUser,
  deactivateUser,
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

type UserFilters = {
  readonly page: number;
  readonly pageSize: number;
  readonly search: string;
  readonly status: UserStatusFilter;
  readonly role: string;
};

type UseUsersResult = {
  readonly users: readonly IamUserListItem[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
  readonly isLoading: boolean;
  readonly error: IamHttpError | null;
  readonly filters: UserFilters;
  readonly setSearch: (value: string) => void;
  readonly setStatus: (value: UserStatusFilter) => void;
  readonly setRole: (value: string) => void;
  readonly setPage: (value: number) => void;
  readonly refetch: () => Promise<void>;
  readonly createUser: (payload: CreateUserPayload) => Promise<IamUserDetail | null>;
  readonly updateUser: (userId: string, payload: UpdateUserPayload) => Promise<IamUserDetail | null>;
  readonly deactivateUser: (userId: string) => Promise<boolean>;
  readonly bulkDeactivate: (userIds: readonly string[]) => Promise<boolean>;
  readonly syncUsersFromKeycloak: () => Promise<IamUserImportSyncReport | null>;
};

const DEFAULT_FILTERS: UserFilters = {
  page: 1,
  pageSize: 25,
  search: '',
  status: 'all',
  role: '',
};

const usersLogger = createOperationLogger('users-hook', 'debug');

export const useUsers = (initial?: Partial<UserFilters>): UseUsersResult => {
  const { invalidatePermissions } = useAuth();

  const [filters, setFilters] = React.useState<UserFilters>({
    ...DEFAULT_FILTERS,
    ...initial,
  });
  const [debouncedSearch, setDebouncedSearch] = React.useState(filters.search);
  const [users, setUsers] = React.useState<readonly IamUserListItem[]>([]);
  const [total, setTotal] = React.useState(0);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<IamHttpError | null>(null);

  React.useEffect(() => {
    usersLogger.debug('user_list_query_changed', {
      operation: 'list_users',
      page: filters.page,
      page_size: filters.pageSize,
      search: filters.search.trim(),
      status: filters.status,
      role: filters.role || undefined,
    });
    const timer = window.setTimeout(() => {
      setDebouncedSearch(filters.search.trim());
    }, 300);

    return () => {
      window.clearTimeout(timer);
    };
  }, [filters.search]);

  const loadUsers = React.useCallback(async () => {
    logBrowserOperationStart(usersLogger, 'user_list_refetch_started', {
      operation: 'list_users',
      page: filters.page,
      page_size: filters.pageSize,
      search: debouncedSearch || undefined,
      status: filters.status,
      role: filters.role || undefined,
    });
    setIsLoading(true);
    setError(null);

    try {
      const response = await listUsers({
        page: filters.page,
        pageSize: filters.pageSize,
        search: debouncedSearch || undefined,
        status: filters.status === 'all' ? undefined : filters.status,
        role: filters.role || undefined,
      });

      setUsers(response.data);
      setTotal(response.pagination.total);
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
    } catch (cause) {
      const resolvedError = asIamError(cause);
      if (resolvedError.status === 403) {
        await invalidatePermissions();
        usersLogger.info('permission_invalidated_after_403', {
          operation: 'list_users',
          status: resolvedError.status,
          error_code: resolvedError.code,
        });
      }
      setUsers([]);
      setTotal(0);
      setError(resolvedError);
      logBrowserOperationFailure(usersLogger, 'user_list_refetch_failed', resolvedError, {
        operation: 'list_users',
      });
    } finally {
      setIsLoading(false);
    }
  }, [debouncedSearch, filters.page, filters.pageSize, filters.role, filters.status, invalidatePermissions]);

  React.useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  React.useEffect(() => subscribeIamUsersUpdated(() => void loadUsers()), [loadUsers]);

  const mutate = React.useCallback(
    async <T,>(action: () => Promise<T>, operation = 'user_mutation'): Promise<T | null> => {
      setError(null);
      logBrowserOperationStart(usersLogger, `${operation}_started`, { operation });
      try {
        const result = await action();
        await loadUsers();
        logBrowserOperationSuccess(usersLogger, `${operation}_succeeded`, { operation });
        return result;
      } catch (cause) {
        const resolvedError = asIamError(cause);
        if (resolvedError.status === 403) {
          await invalidatePermissions();
          usersLogger.info('permission_invalidated_after_403', {
            operation,
            status: resolvedError.status,
            error_code: resolvedError.code,
          });
        }
        setError(resolvedError);
        logBrowserOperationFailure(usersLogger, `${operation}_failed`, resolvedError, { operation });
        return null;
      }
    },
    [invalidatePermissions, loadUsers]
  );

  return {
    users,
    total,
    page: filters.page,
    pageSize: filters.pageSize,
    isLoading,
    error,
    filters,
    setSearch: (value) => setFilters((current) => ({ ...current, page: 1, search: value })),
    setStatus: (value) => setFilters((current) => ({ ...current, page: 1, status: value })),
    setRole: (value) => setFilters((current) => ({ ...current, page: 1, role: value })),
    setPage: (value) => setFilters((current) => ({ ...current, page: Math.max(1, value) })),
    refetch: loadUsers,
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
    bulkDeactivate: async (userIds) => {
      const response = await mutate(() => bulkDeactivateUsers(userIds), 'user_bulk_deactivate');
      return Boolean(response);
    },
    syncUsersFromKeycloak: async () => {
      const response = await mutate(() => syncUsersFromKeycloakRequest(), 'user_sync_keycloak');
      return response?.data ?? null;
    },
  };
};
