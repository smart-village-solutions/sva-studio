import type { IamOrganizationDetail, IamOrganizationListItem } from '@sva/core';
import React from 'react';

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
  const [organizations, setOrganizations] = React.useState<readonly IamOrganizationListItem[]>([]);
  const [total, setTotal] = React.useState(0);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<IamHttpError | null>(null);
  const [mutationError, setMutationError] = React.useState<IamHttpError | null>(null);
  const [selectedOrganization, setSelectedOrganization] =
    React.useState<IamOrganizationDetail | null>(null);
  const [detailLoading, setDetailLoading] = React.useState(false);
  const organizationsRef = React.useRef(organizations);
  const totalRef = React.useRef(total);
  const listRequestIdRef = React.useRef(0);
  const detailRequestIdRef = React.useRef(0);

  organizationsRef.current = organizations;
  totalRef.current = total;

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

  const loadOrganizations = React.useCallback(
    async (options?: { preserveStateOnError?: boolean }) => {
      const requestId = ++listRequestIdRef.current;
      logBrowserOperationStart(organizationsLogger, 'organization_list_refetch_started', {
        operation: 'list_organizations',
        page: filters.page,
        page_size: filters.pageSize,
        search: debouncedSearch || undefined,
        organization_type: filters.organizationType,
        status: filters.status,
      });
      setIsLoading(true);
      if (!options?.preserveStateOnError) {
        setError(null);
      }
      try {
        const response = await listOrganizations({
          page: filters.page,
          pageSize: filters.pageSize,
          search: debouncedSearch || undefined,
          organizationType:
            filters.organizationType === 'all' ? undefined : filters.organizationType,
          status: filters.status === 'all' ? undefined : filters.status,
          sortBy: filters.sortBy,
          sortDirection: filters.sortDirection,
        });
        if (requestId !== listRequestIdRef.current) {
          return true;
        }
        setOrganizations(response.data);
        setTotal(response.pagination.total);
        logBrowserOperationSuccess(
          organizationsLogger,
          'organization_list_refetch_succeeded',
          {
            operation: 'list_organizations',
            item_count: response.data.length,
            total: response.pagination.total,
          },
          'debug'
        );
        return true;
      } catch (cause) {
        const resolvedError = asIamError(cause);
        if (resolvedError.status === 401) {
          await refreshSession();
          organizationsLogger.info(SESSION_REFRESHED_EVENT, {
            operation: 'list_organizations',
            status: resolvedError.status,
            error_code: resolvedError.code,
          });
        }
        if (requestId !== listRequestIdRef.current) {
          return false;
        }
        if (!options?.preserveStateOnError) {
          setOrganizations([]);
          setTotal(0);
          setError(resolvedError);
        }
        logBrowserOperationFailure(
          organizationsLogger,
          'organization_list_refetch_failed',
          resolvedError,
          {
            operation: 'list_organizations',
          }
        );
        return false;
      } finally {
        if (requestId === listRequestIdRef.current) {
          setIsLoading(false);
        }
      }
    },
    [
      debouncedSearch,
      filters.organizationType,
      filters.page,
      filters.pageSize,
      filters.status,
      filters.sortBy,
      filters.sortDirection,
      refreshSession,
    ]
  );

  React.useEffect(() => {
    void loadOrganizations();
  }, [loadOrganizations]);

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
        const previousOrganizations = organizationsRef.current;
        const previousTotal = totalRef.current;
        const result = await action();
        requestEffectiveAccessInvalidation();
        if (options?.reload !== false) {
          const reloaded = await loadOrganizations({ preserveStateOnError: true });
          if (!reloaded) {
            setOrganizations(previousOrganizations);
            setTotal(previousTotal);
          }
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
