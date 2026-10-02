import type {
  IamOrganizationContextOption,
  IamOrganizationListItem,
  IamOrganizationMembership,
  IamOrganizationMembershipVisibility,
  IamOrganizationType,
} from '@sva/core';

import { revealField } from './encryption.js';
import { resolveUserDisplayName } from './user-mapping.js';

export type OrganizationRow = {
  readonly id: string;
  readonly organization_key: string;
  readonly display_name: string;
  readonly parent_organization_id: string | null;
  readonly parent_display_name: string | null;
  readonly organization_type: IamOrganizationType;
  readonly content_author_policy: 'org_only' | 'org_or_personal';
  readonly is_active: boolean;
  readonly depth: number;
  readonly hierarchy_path: readonly string[] | null;
  readonly child_count: number;
  readonly membership_count: number;
  readonly metadata?: Record<string, unknown> | null;
};

export type MembershipRow = {
  readonly account_id: string;
  readonly keycloak_subject: string;
  readonly display_name_ciphertext: string | null;
  readonly first_name_ciphertext: string | null;
  readonly last_name_ciphertext: string | null;
  readonly email_ciphertext: string | null;
  readonly membership_visibility: IamOrganizationMembershipVisibility;
  readonly is_default_context: boolean;
  readonly created_at: string;
};

export type ContextOptionRow = {
  readonly organization_id: string;
  readonly organization_key: string;
  readonly display_name: string;
  readonly organization_type: IamOrganizationType;
  readonly content_author_policy: 'org_only' | 'org_or_personal';
  readonly is_active: boolean;
  readonly is_default_context: boolean;
};

const ORGANIZATION_TYPE_VALUES = [
  'county',
  'municipality',
  'district',
  'company',
  'agency',
  'association',
  'institution',
  'other',
] as const satisfies readonly IamOrganizationType[];

const readString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

export const mapOrganizationListItem = (row: OrganizationRow): IamOrganizationListItem => ({
  id: row.id,
  organizationKey: row.organization_key,
  displayName: row.display_name,
  parentOrganizationId: row.parent_organization_id ?? undefined,
  parentDisplayName: row.parent_display_name ?? undefined,
  organizationType: row.organization_type,
  contentAuthorPolicy: row.content_author_policy,
  isActive: row.is_active,
  depth: row.depth,
  hierarchyPath: [...(row.hierarchy_path ?? [])],
  childCount: row.child_count,
  membershipCount: row.membership_count,
});

export const mapMembershipRow = (row: MembershipRow): IamOrganizationMembership => {
  const firstName = revealField(
    row.first_name_ciphertext,
    `iam.accounts.first_name:${row.keycloak_subject}`
  );
  const lastName = revealField(
    row.last_name_ciphertext,
    `iam.accounts.last_name:${row.keycloak_subject}`
  );
  const decryptedDisplayName = revealField(
    row.display_name_ciphertext,
    `iam.accounts.display_name:${row.keycloak_subject}`
  );

  return {
    accountId: row.account_id,
    keycloakSubject: row.keycloak_subject,
    displayName: resolveUserDisplayName({
      decryptedDisplayName,
      firstName,
      lastName,
      keycloakSubject: row.keycloak_subject,
    }),
    email: revealField(row.email_ciphertext, `iam.accounts.email:${row.keycloak_subject}`),
    visibility: row.membership_visibility,
    isDefaultContext: row.is_default_context,
    createdAt: row.created_at,
  };
};

export const mapContextOption = (row: ContextOptionRow): IamOrganizationContextOption => ({
  organizationId: row.organization_id,
  organizationKey: row.organization_key,
  displayName: row.display_name,
  organizationType: row.organization_type,
  contentAuthorPolicy: row.content_author_policy,
  isActive: row.is_active,
  isDefaultContext: row.is_default_context,
});

export const readStatusFilter = (request: Request): boolean | undefined => {
  const status = readString(new URL(request.url).searchParams.get('status'));
  if (!status || status === 'all') {
    return undefined;
  }
  if (status === 'active') {
    return true;
  }
  if (status === 'inactive') {
    return false;
  }
  return undefined;
};

export const readOrganizationTypeFilter = (
  request: Request
): IamOrganizationType | undefined | 'invalid' => {
  const organizationType = readString(new URL(request.url).searchParams.get('organizationType'));
  if (!organizationType) {
    return undefined;
  }
  return (ORGANIZATION_TYPE_VALUES as readonly string[]).includes(organizationType)
    ? (organizationType as IamOrganizationType)
    : 'invalid';
};

export const ORGANIZATION_LIST_SORT_FIELDS = [
  'displayName',
  'parentDisplayName',
  'childCount',
  'membershipCount',
  'isActive',
] as const;
export type OrganizationListSortField = (typeof ORGANIZATION_LIST_SORT_FIELDS)[number];
export type OrganizationListSortDirection = 'asc' | 'desc';

export const readOrganizationListSort = (
  request: Request
):
  | {
      readonly sortBy: OrganizationListSortField;
      readonly sortDirection: OrganizationListSortDirection;
    }
  | 'invalid' => {
  const url = new URL(request.url);
  const sortBy = readString(url.searchParams.get('sortBy')) ?? 'displayName';
  const sortDirection = readString(url.searchParams.get('sortDirection')) ?? 'asc';
  if (
    !(ORGANIZATION_LIST_SORT_FIELDS as readonly string[]).includes(sortBy) ||
    (sortDirection !== 'asc' && sortDirection !== 'desc')
  ) {
    return 'invalid';
  }
  return {
    sortBy: sortBy as OrganizationListSortField,
    sortDirection,
  };
};

export const escapeIlikePattern = (value: string): string =>
  value.replaceAll('\\', '\\\\').replaceAll('%', '\\%').replaceAll('_', '\\_');

export const chooseActiveOrganizationId = (input: {
  readonly storedActiveOrganizationId?: string;
  readonly organizations: readonly IamOrganizationContextOption[];
}): string | undefined => {
  const activeIds = new Set(
    input.organizations
      .filter((organization) => organization.isActive)
      .map((organization) => organization.organizationId)
  );
  if (input.storedActiveOrganizationId && activeIds.has(input.storedActiveOrganizationId)) {
    return input.storedActiveOrganizationId;
  }

  const defaultOrganization = input.organizations.find(
    (organization) => organization.isActive && organization.isDefaultContext
  );
  if (defaultOrganization) {
    return defaultOrganization.organizationId;
  }

  return input.organizations.find((organization) => organization.isActive)?.organizationId;
};
