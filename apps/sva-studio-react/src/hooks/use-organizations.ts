import type { IamOrganizationDetail, IamOrganizationListItem, IamOrganizationType } from '@sva/core';
import React from 'react';

import {
  asIamError,
  assignOrganizationMembership,
  createOrganization,
  deactivateOrganization,
  getOrganization,
  IamHttpError,
  listOrganizations,
  removeOrganizationMembership,
  updateOrganization,
  type AssignOrganizationMembershipPayload,
  type CreateOrganizationPayload,
  type UpdateOrganizationPayload,
} from '../lib/iam-api';
import { useAuth } from '../providers/auth-provider';

type OrganizationStatusFilter = 'active' | 'inactive' | 'all';

type OrganizationFilters = {
  readonly page: number;
  readonly pageSize: number;
  readonly search: string;
  readonly organizationType: IamOrganizationType | 'all';
  readonly status: OrganizationStatusFilter;
};

type UseOrganizationsResult = {
  readonly organizations: readonly IamOrganizationListItem[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
  readonly isLoading: boolean;
  readonly error: IamHttpError | null;
  readonly mutationError: IamHttpError | null;
  readonly selectedOrganization: IamOrganizationDetail | null;
  readonly detailLoading: boolean;
  readonly filters: OrganizationFilters;
  readonly setSearch: (value: string) => void;
  readonly setOrganizationType: (value: OrganizationFilters['organizationType']) => void;
  readonly setStatus: (value: OrganizationStatusFilter) => void;
  readonly setPage: (value: number) => void;
  readonly refetch: () => Promise<void>;
  readonly loadOrganization: (organizationId: string) => Promise<IamOrganizationDetail | null>;
  readonly clearSelectedOrganization: () => void;
  readonly clearMutationError: () => void;
  readonly createOrganization: (payload: CreateOrganizationPayload) => Promise<IamOrganizationDetail | null>;
  readonly updateOrganization: (organizationId: string, payload: UpdateOrganizationPayload) => Promise<IamOrganizationDetail | null>;
  readonly deactivateOrganization: (organizationId: string) => Promise<boolean>;
  readonly assignMembership: (
    organizationId: string,
    payload: AssignOrganizationMembershipPayload
  ) => Promise<IamOrganizationDetail | null>;
  readonly removeMembership: (organizationId: string, accountId: string) => Promise<IamOrganizationDetail | null>;
};

const DEFAULT_FILTERS: OrganizationFilters = {
  page: 1,
  pageSize: 25,
  search: '',
  organizationType: 'all',
  status: 'all',
};

export const useOrganizations = (initial?: Partial<OrganizationFilters>): UseOrganizationsResult => {
  const { invalidatePermissions } = useAuth();

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
  const [selectedOrganization, setSelectedOrganization] = React.useState<IamOrganizationDetail | null>(null);
  const [detailLoading, setDetailLoading] = React.useState(false);

  React.useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(filters.search.trim()), 300);
    return () => {
      window.clearTimeout(timer);
    };
  }, [filters.search]);

  const loadOrganizations = React.useCallback(async (options?: { preserveStateOnError?: boolean }) => {
    setIsLoading(true);
    if (!options?.preserveStateOnError) {
      setError(null);
    }
    try {
      const response = await listOrganizations({
        page: filters.page,
        pageSize: filters.pageSize,
        search: debouncedSearch || undefined,
        organizationType: filters.organizationType === 'all' ? undefined : filters.organizationType,
        status: filters.status === 'all' ? undefined : filters.status,
      });
      setOrganizations(response.data);
      setTotal(response.pagination.total);
      return true;
    } catch (cause) {
      const resolvedError = asIamError(cause);
      if (resolvedError.status === 403) {
        await invalidatePermissions();
      }
      if (!options?.preserveStateOnError) {
        setOrganizations([]);
        setTotal(0);
        setError(resolvedError);
      }
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [debouncedSearch, filters.organizationType, filters.page, filters.pageSize, filters.status, invalidatePermissions]);

  React.useEffect(() => {
    void loadOrganizations();
  }, [loadOrganizations]);

  const loadOrganization = React.useCallback(
    async (organizationId: string) => {
      setDetailLoading(true);
      setMutationError(null);
      try {
        const response = await getOrganization(organizationId);
        setSelectedOrganization(response.data);
        return response.data;
      } catch (cause) {
        const resolvedError = asIamError(cause);
        if (resolvedError.status === 403) {
          await invalidatePermissions();
        }
        setMutationError(resolvedError);
        return null;
      } finally {
        setDetailLoading(false);
      }
    },
    [invalidatePermissions]
  );

  const mutate = React.useCallback(
    async <T,>(action: () => Promise<{ data: T }>, options?: { organizationId?: string }): Promise<T | null> => {
      setMutationError(null);
      try {
        const result = await action();
        await loadOrganizations({ preserveStateOnError: true });
        if (options?.organizationId) {
          await loadOrganization(options.organizationId);
        }
        return result.data;
      } catch (cause) {
        const resolvedError = asIamError(cause);
        if (resolvedError.status === 403) {
          await invalidatePermissions();
        }
        setMutationError(resolvedError);
        return null;
      }
    },
    [invalidatePermissions, loadOrganization, loadOrganizations]
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
    setOrganizationType: (value) => setFilters((current) => ({ ...current, page: 1, organizationType: value })),
    setStatus: (value) => setFilters((current) => ({ ...current, page: 1, status: value })),
    setPage: (value) => setFilters((current) => ({ ...current, page: Math.max(1, value) })),
    refetch: loadOrganizations,
    loadOrganization,
    clearSelectedOrganization: () => setSelectedOrganization(null),
    clearMutationError: () => setMutationError(null),
    createOrganization: async (payload) => mutate(() => createOrganization(payload)),
    updateOrganization: async (organizationId, payload) =>
      mutate(() => updateOrganization(organizationId, payload), { organizationId }),
    deactivateOrganization: async (organizationId) => {
      const response = await mutate(() => deactivateOrganization(organizationId));
      if (selectedOrganization?.id === organizationId) {
        setSelectedOrganization(null);
      }
      return Boolean(response);
    },
    assignMembership: async (organizationId, payload) =>
      mutate(() => assignOrganizationMembership(organizationId, payload), { organizationId }),
    removeMembership: async (organizationId, accountId) =>
      mutate(() => removeOrganizationMembership(organizationId, accountId), { organizationId }),
  };
};
