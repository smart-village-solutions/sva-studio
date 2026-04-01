import type { EffectivePermission, IamPermissionEffect } from '@sva/core';

export type PermissionRow = {
  permission_key: string;
  action?: string | null;
  resource_type?: string | null;
  resource_id?: string | null;
  effect?: IamPermissionEffect | null;
  scope?: Record<string, unknown> | null;
  role_id: string;
  organization_id: string | null;
  group_id?: string | null;
  group_key?: string | null;
  source_kind?: 'direct_role' | 'group_role' | null;
};

export const readResourceType = (permissionKey: string) => permissionKey.split('.')[0] ?? permissionKey;

const SOURCE_KIND_ORDER: Record<NonNullable<PermissionRow['source_kind']>, number> = {
  direct_role: 0,
  group_role: 1,
};

const sortStrings = (values: readonly string[]): readonly string[] =>
  [...values].sort((left, right) => left.localeCompare(right));

const sortSourceKinds = (
  values: readonly NonNullable<PermissionRow['source_kind']>[]
): readonly NonNullable<PermissionRow['source_kind']>[] =>
  [...values].sort((left, right) => SOURCE_KIND_ORDER[left] - SOURCE_KIND_ORDER[right] || left.localeCompare(right));

type NormalizedPermissionRow = {
  action: string;
  resourceType: string;
  resourceId?: string;
  effect: 'allow' | 'deny';
  scope?: Record<string, unknown>;
  groupId?: string;
  groupKey?: string;
  bucketKey: string;
};

const normalizePermissionRow = (row: PermissionRow): NormalizedPermissionRow => {
  const action = row.action?.trim() || row.permission_key;
  const resourceType = row.resource_type?.trim() || readResourceType(row.permission_key);
  const resourceId = row.resource_id?.trim() || undefined;
  const effect = row.effect ?? 'allow';
  const scope = row.scope ?? undefined;
  return {
    action,
    resourceType,
    resourceId,
    effect,
    scope,
    groupId: row.group_id ?? undefined,
    groupKey: row.group_key ?? undefined,
    bucketKey: JSON.stringify({
      action,
      resourceType,
      resourceId,
      organizationId: row.organization_id ?? '',
      effect,
      scope,
    }),
  };
};

const createPermissionBucket = (row: PermissionRow, normalized: NormalizedPermissionRow): EffectivePermission => ({
  action: normalized.action,
  resourceType: normalized.resourceType,
  resourceId: normalized.resourceId,
  organizationId: row.organization_id ?? undefined,
  effect: normalized.effect,
  scope: normalized.scope,
  sourceRoleIds: [row.role_id],
  sourceGroupIds: normalized.groupId ? [normalized.groupId] : [],
  ...(normalized.groupKey ? { groupName: normalized.groupKey } : {}),
  provenance: row.source_kind ? { sourceKinds: [row.source_kind] } : undefined,
});

const mergePermissionBucket = (
  existing: EffectivePermission,
  row: PermissionRow,
  normalized: NormalizedPermissionRow
): EffectivePermission => {
  const sourceRoleIds = existing.sourceRoleIds.includes(row.role_id)
    ? existing.sourceRoleIds
    : [...existing.sourceRoleIds, row.role_id];
  const sourceGroupIds =
    normalized.groupId && !existing.sourceGroupIds.includes(normalized.groupId)
      ? [...existing.sourceGroupIds, normalized.groupId]
      : existing.sourceGroupIds;
  const groupName = normalized.groupKey ?? existing.groupName;
  const sourceKinds = row.source_kind
    ? sortSourceKinds(Array.from(new Set([...(existing.provenance?.sourceKinds ?? []), row.source_kind])))
    : existing.provenance?.sourceKinds;

  return {
    ...existing,
    sourceRoleIds: sortStrings(sourceRoleIds),
    sourceGroupIds: sortStrings(sourceGroupIds),
    ...(groupName ? { groupName } : {}),
    provenance: sourceKinds ? { ...(existing.provenance ?? {}), sourceKinds } : existing.provenance,
  };
};

export const toEffectivePermissions = (rows: readonly PermissionRow[]): EffectivePermission[] => {
  const buckets = new Map<string, EffectivePermission>();

  for (const row of rows) {
    const normalized = normalizePermissionRow(row);
    const existing = buckets.get(normalized.bucketKey);

    if (!existing) {
      buckets.set(normalized.bucketKey, createPermissionBucket(row, normalized));
      continue;
    }

    buckets.set(normalized.bucketKey, mergePermissionBucket(existing, row, normalized));
  }

  return [...buckets.values()].map((permission) => ({
    ...permission,
    sourceRoleIds: sortStrings(permission.sourceRoleIds),
    sourceGroupIds: sortStrings(permission.sourceGroupIds),
    provenance: permission.provenance?.sourceKinds
      ? { ...permission.provenance, sourceKinds: sortSourceKinds(permission.provenance.sourceKinds) }
      : permission.provenance,
  }));
};
