import type {
  IamOrganizationContextOption,
  IamOrganizationListItem,
  IamOrganizationMembership,
  IamOrganizationMembershipVisibility,
  IamOrganizationType,
} from '@sva/core';

import { readString } from '../shared/input-readers.js';

import { revealField } from '../iam-account-management/encryption.js';
import { resolveUserDisplayName } from '../iam-account-management/user-mapping.js';

export type OrganizationRow = {
  id: string;
  organization_key: string;
  display_name: string;
  parent_organization_id: string | null;
  parent_display_name: string | null;
  organization_type: IamOrganizationType;
  content_author_policy: 'org_only' | 'org_or_personal';
  is_active: boolean;
  depth: number;
  hierarchy_path: string[] | null;
  child_count: number;
  membership_count: number;
  metadata?: Record<string, unknown> | null;
};

export type MembershipRow = {
  account_id: string;
  keycloak_subject: string;
  display_name_ciphertext: string | null;
  first_name_ciphertext: string | null;
  last_name_ciphertext: string | null;
  email_ciphertext: string | null;
  membership_visibility: IamOrganizationMembershipVisibility;
  is_default_context: boolean;
  created_at: string;
};

export type ContextOptionRow = {
  organization_id: string;
  organization_key: string;
  display_name: string;
  organization_type: IamOrganizationType;
  is_active: boolean;
  is_default_context: boolean;
};

export type HierarchyResolution =
  | { ok: true; hierarchyPath: readonly string[]; depth: number }
  | {
      ok: false;
      status: number;
      code: 'invalid_organization_id' | 'conflict' | 'organization_inactive';
      message: string;
    };

const ORGANIZATION_TYPE_VALUES = ['county', 'municipality', 'district', 'company', 'agency', 'other'] as const satisfies readonly IamOrganizationType[];

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
  hierarchyPath: row.hierarchy_path ?? [],
  childCount: row.child_count,
  membershipCount: row.membership_count,
});

export const mapMembershipRow = (row: MembershipRow): IamOrganizationMembership => {
  const firstName = revealField(row.first_name_ciphertext, `iam.accounts.first_name:${row.keycloak_subject}`);
  const lastName = revealField(row.last_name_ciphertext, `iam.accounts.last_name:${row.keycloak_subject}`);
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
  isActive: row.is_active,
  isDefaultContext: row.is_default_context,
});

export const isHierarchyError = (value: unknown): value is Extract<HierarchyResolution, { ok: false }> =>
  typeof value === 'object' && value !== null && 'ok' in value && value.ok === false;

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

export const readOrganizationTypeFilter = (request: Request): IamOrganizationType | undefined | 'invalid' => {
  const organizationType = readString(new URL(request.url).searchParams.get('organizationType'));
  if (!organizationType) {
    return undefined;
  }
  return (ORGANIZATION_TYPE_VALUES as readonly string[]).includes(organizationType)
    ? (organizationType as IamOrganizationType)
    : 'invalid';
};

export const escapeIlikePattern = (value: string): string =>
  value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');

export const chooseActiveOrganizationId = (input: {
  storedActiveOrganizationId?: string;
  organizations: readonly IamOrganizationContextOption[];
}): string | undefined => {
  const activeIds = new Set(
    input.organizations.filter((organization) => organization.isActive).map((organization) => organization.organizationId)
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
