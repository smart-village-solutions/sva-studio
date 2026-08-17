import type {
  IamOrganizationDetail,
  IamOrganizationListItem,
  IamOrganizationType,
} from '@sva/core';

import type {
  AssignOrganizationMembershipPayload,
  CreateOrganizationPayload,
  IamHttpError,
  OrganizationSortDirection,
  OrganizationSortField,
  UpdateOrganizationMembershipPayload,
  UpdateOrganizationPayload,
} from '../lib/iam-api';

export type OrganizationStatusFilter = 'active' | 'inactive' | 'all';

export type OrganizationFilters = {
  readonly page: number;
  readonly pageSize: number;
  readonly search: string;
  readonly organizationType: IamOrganizationType | 'all';
  readonly status: OrganizationStatusFilter;
  readonly sortBy: OrganizationSortField;
  readonly sortDirection: OrganizationSortDirection;
};

export type UseOrganizationsResult = {
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
  readonly setSorting: (
    sortBy: OrganizationSortField,
    sortDirection: OrganizationSortDirection
  ) => void;
  readonly setPage: (value: number) => void;
  readonly refetch: () => Promise<void>;
  readonly loadOrganization: (
    organizationId: string,
    options?: { readonly preserveMutationError?: boolean }
  ) => Promise<IamOrganizationDetail | null>;
  readonly clearSelectedOrganization: () => void;
  readonly clearMutationError: () => void;
  readonly createOrganization: (
    payload: CreateOrganizationPayload
  ) => Promise<IamOrganizationDetail | null>;
  readonly updateOrganization: (
    organizationId: string,
    payload: UpdateOrganizationPayload
  ) => Promise<IamOrganizationDetail | null>;
  readonly deleteOrganization: (organizationId: string) => Promise<boolean>;
  readonly provisionMainserver: (organizationId: string) => Promise<IamOrganizationDetail | null>;
  readonly assignMembership: (
    organizationId: string,
    payload: AssignOrganizationMembershipPayload,
    options?: { readonly reload?: boolean }
  ) => Promise<IamOrganizationDetail | null>;
  readonly updateMembership: (
    organizationId: string,
    accountId: string,
    payload: UpdateOrganizationMembershipPayload
  ) => Promise<IamOrganizationDetail | null>;
  readonly removeMembership: (
    organizationId: string,
    accountId: string
  ) => Promise<IamOrganizationDetail | null>;
};
