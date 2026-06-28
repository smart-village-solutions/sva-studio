import type {
  IamGroupDetail as IamAdminGroupDetail,
  IamGroupListItem as IamAdminGroupListItem,
  IamGroupMembership as IamAdminGroupMembership,
  IamGroupType as IamAdminGroupType,
  IamUuid,
} from '@sva/iam-core';

import { revealField } from './encryption.js';
import { resolveUserDisplayName } from './user-mapping.js';

export type { IamAdminGroupDetail, IamAdminGroupListItem, IamAdminGroupMembership, IamAdminGroupType, IamUuid };

export type GroupRow = {
  id: string;
  instance_id: string;
  group_key: string;
  display_name: string;
  description: string | null;
  group_type: string;
  is_active: boolean;
  member_count: number;
  role_count: number;
  created_at: string;
  updated_at: string;
};

export type GroupRoleRow = {
  group_id: string;
  role_id: string;
  assigned_at: string;
};

export type AccountGroupRow = {
  instance_id: string;
  account_id: string;
  group_id: string;
  keycloak_subject: string;
  display_name_ciphertext: string | null;
  first_name_ciphertext: string | null;
  last_name_ciphertext: string | null;
  email_ciphertext: string | null;
  valid_from: string | null;
  valid_until: string | null;
  assigned_at: string;
  assigned_by: string | null;
};

export const mapGroupListItem = (row: GroupRow): IamAdminGroupListItem => ({
  id: row.id,
  instanceId: row.instance_id,
  groupKey: row.group_key,
  displayName: row.display_name,
  ...(row.description ? { description: row.description } : {}),
  groupType: row.group_type as IamAdminGroupType,
  isActive: row.is_active,
  memberCount: row.member_count,
  roleCount: row.role_count,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const mapGroupMembership = (row: AccountGroupRow): IamAdminGroupMembership => {
  const decryptedDisplayName = revealField(
    row.display_name_ciphertext,
    `iam.accounts.display_name:${row.keycloak_subject}`
  );
  const firstName = revealField(
    row.first_name_ciphertext,
    `iam.accounts.first_name:${row.keycloak_subject}`
  );
  const lastName = revealField(
    row.last_name_ciphertext,
    `iam.accounts.last_name:${row.keycloak_subject}`
  );
  const email = revealField(row.email_ciphertext, `iam.accounts.email:${row.keycloak_subject}`);
  const resolvedDisplayName = resolveUserDisplayName({
    decryptedDisplayName,
    firstName,
    lastName,
    keycloakSubject: row.keycloak_subject,
  });
  const displayName = resolvedDisplayName === row.keycloak_subject && email ? email : resolvedDisplayName;

  return {
    instanceId: row.instance_id,
    accountId: row.account_id,
    groupId: row.group_id,
    keycloakSubject: row.keycloak_subject,
    ...(displayName ? { displayName } : {}),
    ...(row.valid_from ? { validFrom: row.valid_from } : {}),
    ...(row.valid_until ? { validUntil: row.valid_until } : {}),
    assignedAt: row.assigned_at,
    ...(row.assigned_by ? { assignedByAccountId: row.assigned_by } : {}),
  };
};
