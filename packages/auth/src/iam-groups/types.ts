import type { IamGroupDetail, IamGroupListItem, IamGroupMembership, IamGroupType, IamUuid } from '@sva/core';

export type { IamGroupDetail, IamGroupListItem, IamGroupMembership, IamGroupType, IamUuid };

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
  display_name: string | null;
  valid_from: string | null;
  valid_until: string | null;
  assigned_at: string;
  assigned_by: string | null;
};

export const mapGroupListItem = (row: GroupRow): IamGroupListItem => ({
  id: row.id,
  instanceId: row.instance_id,
  groupKey: row.group_key,
  displayName: row.display_name,
  ...(row.description ? { description: row.description } : {}),
  groupType: row.group_type as IamGroupType,
  isActive: row.is_active,
  memberCount: row.member_count,
  roleCount: row.role_count,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const mapGroupMembership = (row: AccountGroupRow): IamGroupMembership => ({
  instanceId: row.instance_id,
  accountId: row.account_id,
  groupId: row.group_id,
  keycloakSubject: row.keycloak_subject,
  ...(row.display_name ? { displayName: row.display_name } : {}),
  ...(row.valid_from ? { validFrom: row.valid_from } : {}),
  ...(row.valid_until ? { validUntil: row.valid_until } : {}),
  assignedAt: row.assigned_at,
  ...(row.assigned_by ? { assignedByAccountId: row.assigned_by } : {}),
});
