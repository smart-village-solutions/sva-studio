import type { IamOrganizationDetail, IamOrganizationListItem } from '@sva/core';
import React from 'react';
import { useStudioTableQuery } from '@sva/studio-ui-react';

import {
  asIamError,
  assignOrganizationMembership,
  createOrganization,
  deleteOrganization,
  getOrganization,
  IamHttpError,
  listOrganizations,
  provisionOrganizationMainserver,
  removeOrganizationMembership,
  updateOrganizationMembership,
  updateOrganization,
} from '../lib/iam-api';
import {
  createOperationLogger,
  logBrowserOperationFailure,
  logBrowserOperationStart,
  logBrowserOperationSuccess,
} from '../lib/browser-operation-logging';
import { useAuth } from '../providers/auth-provider';
import { requestEffectiveAccessInvalidation } from '../providers/effective-access-invalidation';
import type { OrganizationFilters, UseOrganizationsResult } from './use-organizations.types';

const DEFAULT_FILTERS: OrganizationFilters = {
  page: 1,
  pageSize: 25,
  search: '',
  organizationType: 'all',
  status: 'all',
  sortBy: 'displayName',
  sortDirection: 'asc',
};

const EMPTY_ORGANIZATIONS: readonly IamOrganizationListItem[] = [];
const organizationsLogger = createOperationLogger('organizations-hook', 'debug');
const SESSION_REFRESHED_EVENT = 'session_refreshed_after_401';

const getOrganizationMutationOperation = (options?: {
  organizationId?: string;
  reload?: boolean;
}) => {
  if (options?.reload === false) {
    return 'organization_mutation_with_deferred_reload';
  }
  return options?.organizationId
    ? 'organization_mutation_with_detail_reload'
    : 'organization_mutation';
};

export const useOrganizations = (
  initial?: Partial<OrganizationFilters>
): UseOrganizationsResult => {
  const { refreshSession } = useAuth();

  const [filters, setFilters] = React.useState<OrganizationFilters>({
    ...DEFAULT_FILTERS,
    ...initial,
  });
  const [debouncedSearch, setDebouncedSearch] = React.useState(filters.search);
  const [mutationError, setMutationError] = React.useState<IamHttpError | null>(null);
  const [selectedOrganization, setSelectedOrganization] =
    React.useState<IamOrganizationDetail | null>(null);
  const [detailLoading, setDetailLoading] = React.useState(false);
  const detailRequestIdRef = React.useRef(0);

  React.useEffect(() => {
    organizationsLogger.debug('organization_list_query_changed', {
      operation: 'list_organizations',
      page: filters.page,
      page_size: filters.pageSize,
      search: filters.search.trim(),
      organization_type: filters.organizationType,
      status: filters.status,
      sort_by: filters.sortBy,
      sort_direction: filters.sortDirection,
    });
    const timer = window.setTimeout(() => setDebouncedSearch(filters.search.trim()), 300);
    return () => {
      window.clearTimeout(timer);
    };
  }, [filters.search]);

  const query = {
    page: filters.page,
    pageSize: filters.pageSize,
    search: debouncedSearch || undefined,
    organizationType: filters.organizationType === 'all' ? undefined : filters.organizationType,
    status: filters.status === 'all' ? undefined : filters.status,
    sortBy: filters.sortBy,
    sortDirection: filters.sortDirection,
  };
  const list = useStudioTableQuery(['iam-organizations', query], async (signal) => {
    const meta = { operation: 'list_organizations' };
    logBrowserOperationStart(organizationsLogger, 'organization_list_refetch_started', meta);
    try {
      const response = await listOrganizations(query);
      logBrowserOperationSuccess(
        organizationsLogger,
        'organization_list_refetch_succeeded',
        {
          ...meta,
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
        organizationsLogger.info(SESSION_REFRESHED_EVENT, {
          ...meta,
          status: error.status,
          error_code: error.code,
        });
      }
      logBrowserOperationFailure(
        organizationsLogger,
        'organization_list_refetch_failed',
        error,
        meta
      );
      throw error;
    }
  });
  const organizations = list.data?.data ?? EMPTY_ORGANIZATIONS;
  const total = list.data?.pagination.total ?? 0;
  const isLoading = list.state === 'loading';
  const queryKey = JSON.stringify(query);
  const [silentRefreshQuery, setSilentRefreshQuery] = React.useState<string | null>(null);
  const error =
    silentRefreshQuery === queryKey && list.data ? null : (list.error as IamHttpError | null);
  const loadOrganizations = React.useCallback(
    async (options?: { preserveStateOnError?: boolean }) => {
      setSilentRefreshQuery(options?.preserveStateOnError ? queryKey : null);
      return list.refetch();
    },
    [list.refetch, queryKey]
  );

  const loadOrganization = React.useCallback(
    async (organizationId: string, options?: { readonly preserveMutationError?: boolean }) => {
      const requestId = ++detailRequestIdRef.current;
      logBrowserOperationStart(organizationsLogger, 'organization_detail_load_started', {
        operation: 'get_organization',
        organization_id: organizationId,
      });
      setDetailLoading(true);
      if (!options?.preserveMutationError) {
        setMutationError(null);
      }
      try {
        const response = await getOrganization(organizationId);
        if (requestId !== detailRequestIdRef.current) {
          return response.data;
        }
        setSelectedOrganization(response.data);
        logBrowserOperationSuccess(organizationsLogger, 'organization_detail_load_succeeded', {
          operation: 'get_organization',
          organization_id: organizationId,
        });
        return response.data;
      } catch (cause) {
        const resolvedError = asIamError(cause);
        if (resolvedError.status === 401) {
          await refreshSession();
          organizationsLogger.info(SESSION_REFRESHED_EVENT, {
            operation: 'get_organization',
            status: resolvedError.status,
            error_code: resolvedError.code,
            organization_id: organizationId,
          });
        }
        if (requestId !== detailRequestIdRef.current) {
          return null;
        }
        setMutationError(resolvedError);
        logBrowserOperationFailure(
          organizationsLogger,
          'organization_detail_load_failed',
          resolvedError,
          {
            operation: 'get_organization',
            organization_id: organizationId,
          }
        );
        return null;
      } finally {
        if (requestId === detailRequestIdRef.current) {
          setDetailLoading(false);
        }
      }
    },
    [refreshSession]
  );

  const mutate = React.useCallback(
    async <T>(
      action: () => Promise<{ data: T }>,
      options?: { organizationId?: string; reload?: boolean }
    ): Promise<T | null> => {
      setMutationError(null);
      const operation = getOrganizationMutationOperation(options);
      logBrowserOperationStart(organizationsLogger, 'organization_mutation_started', {
        operation,
        organization_id: options?.organizationId,
      });
      try {
        const result = await action();
        requestEffectiveAccessInvalidation();
        if (options?.reload !== false) {
          await loadOrganizations({ preserveStateOnError: true });
          if (options?.organizationId) {
            await loadOrganization(options.organizationId);
          }
        }
        logBrowserOperationSuccess(organizationsLogger, 'organization_mutation_succeeded', {
          operation,
          organization_id: options?.organizationId,
        });
        return result.data;
      } catch (cause) {
        const resolvedError = asIamError(cause);
        if (resolvedError.status === 401) {
          await refreshSession();
          organizationsLogger.info(SESSION_REFRESHED_EVENT, {
            operation,
            status: resolvedError.status,
            error_code: resolvedError.code,
            organization_id: options?.organizationId,
          });
        }
        setMutationError(resolvedError);
        logBrowserOperationFailure(
          organizationsLogger,
          'organization_mutation_failed',
          resolvedError,
          {
            operation,
            organization_id: options?.organizationId,
          }
        );
        return null;
      }
    },
    [refreshSession, loadOrganization, loadOrganizations]
  );

  return {
    organizations,
    total,
    page: filters.page,
    pageSize: filters.pageSize,
    isLoading,
    error,
    mutationError,
    selectedOrganization,
    detailLoading,
    filters,
    setSearch: (value) => setFilters((current) => ({ ...current, page: 1, search: value })),
    setOrganizationType: (value) =>
      setFilters((current) => ({ ...current, page: 1, organizationType: value })),
    setStatus: (value) => setFilters((current) => ({ ...current, page: 1, status: value })),
    setSorting: (sortBy, sortDirection) =>
      setFilters((current) => ({ ...current, page: 1, sortBy, sortDirection })),
    setPage: (value) => setFilters((current) => ({ ...current, page: Math.max(1, value) })),
    refetch: async () => {
      await loadOrganizations();
    },
    loadOrganization,
    clearSelectedOrganization: () => setSelectedOrganization(null),
    clearMutationError: () => setMutationError(null),
    createOrganization: async (payload) => mutate(() => createOrganization(payload)),
    updateOrganization: async (organizationId, payload) =>
      mutate(() => updateOrganization(organizationId, payload), { organizationId }),
    deleteOrganization: async (organizationId) => {
      const response = await mutate(() => deleteOrganization(organizationId));
      setSelectedOrganization((current) => (current?.id === organizationId ? null : current));
      return Boolean(response);
    },
    provisionMainserver: async (organizationId) =>
      mutate(() => provisionOrganizationMainserver(organizationId), { organizationId }),
    assignMembership: async (organizationId, payload, options) =>
      mutate(() => assignOrganizationMembership(organizationId, payload), {
        organizationId,
        reload: options?.reload ?? true,
      }),
    updateMembership: async (organizationId, accountId, payload) =>
      mutate(() => updateOrganizationMembership(organizationId, accountId, payload), {
        organizationId,
      }),
    removeMembership: async (organizationId, accountId) =>
      mutate(() => removeOrganizationMembership(organizationId, accountId), { organizationId }),
  };
};
