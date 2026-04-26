import type { EffectivePermission, IamPermissionEffect } from '@sva/core';

export type PermissionRow = {
  permission_key: string;
  action?: string | null;
  resource_type?: string | null;
  resource_id?: string | null;
  effect?: IamPermissionEffect | null;
  scope?: Record<string, unknown> | null;
  account_id?: string | null;
  role_id?: string | null;
  organization_id: string | null;
  group_id?: string | null;
  group_key?: string | null;
  source_kind?: 'direct_user' | 'direct_role' | 'group_role' | null;
};

export const readResourceType = (permissionKey: string) => permissionKey.split('.')[0] ?? permissionKey;

const SOURCE_KIND_ORDER: Record<NonNullable<PermissionRow['source_kind']>, number> = {
  direct_user: 0,
  direct_role: 1,
  group_role: 2,
};

const sortStrings = (values: readonly string[]): readonly string[] =>
  [...values].sort((left, right) => left.localeCompare(right));

const sortSourceKinds = (
  values: readonly NonNullable<PermissionRow['source_kind']>[]
): readonly NonNullable<PermissionRow['source_kind']>[] =>
  [...values].sort((left, right) => SOURCE_KIND_ORDER[left] - SOURCE_KIND_ORDER[right] || left.localeCompare(right));

const appendUniqueString = (
  values: readonly string[] | undefined,
  nextValue: string | undefined
): readonly string[] | undefined => {
  if (!nextValue) {
    return values;
  }

  if (values?.includes(nextValue)) {
    return values;
  }

  return [...(values ?? []), nextValue];
};

const mergeSourceKinds = (
  values: readonly NonNullable<PermissionRow['source_kind']>[] | undefined,
  nextValue: PermissionRow['source_kind']
): readonly NonNullable<PermissionRow['source_kind']>[] | undefined => {
  if (!nextValue) {
    return values;
  }

  return sortSourceKinds(Array.from(new Set([...(values ?? []), nextValue])));
};

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
  ...(row.account_id ? { sourceUserIds: [row.account_id] } : {}),
  ...(row.role_id ? { sourceRoleIds: [row.role_id] } : {}),
  ...(normalized.groupId ? { sourceGroupIds: [normalized.groupId] } : {}),
  ...(normalized.groupKey ? { groupName: normalized.groupKey } : {}),
  provenance: row.source_kind ? { sourceKinds: [row.source_kind] } : undefined,
});

const withSortedValues = (
  values: readonly string[] | undefined
): readonly string[] | undefined => {
  return values ? sortStrings(values) : undefined;
};

const finalizePermissionBucket = (permission: EffectivePermission): EffectivePermission => {
  const sourceKinds = permission.provenance?.sourceKinds
    ? sortSourceKinds(permission.provenance.sourceKinds)
    : undefined;
  const normalizedSourceUserIds = withSortedValues(permission.sourceUserIds);
  const normalizedSourceRoleIds = withSortedValues(permission.sourceRoleIds);
  const normalizedSourceGroupIds = withSortedValues(permission.sourceGroupIds);

  return {
    ...permission,
    ...(normalizedSourceUserIds ? { sourceUserIds: normalizedSourceUserIds } : {}),
    ...(normalizedSourceRoleIds ? { sourceRoleIds: normalizedSourceRoleIds } : {}),
    ...(normalizedSourceGroupIds ? { sourceGroupIds: normalizedSourceGroupIds } : {}),
    provenance: sourceKinds
      ? permission.provenance
        ? { ...permission.provenance, sourceKinds }
        : { sourceKinds }
      : permission.provenance,
  };
};

const mergePermissionBucket = (
  existing: EffectivePermission,
  row: PermissionRow,
  normalized: NormalizedPermissionRow
): EffectivePermission => {
  const nextSourceUserIds = withSortedValues(
    appendUniqueString(existing.sourceUserIds, row.account_id ?? undefined)
  );
  const nextSourceRoleIds = withSortedValues(
    appendUniqueString(existing.sourceRoleIds, row.role_id ?? undefined)
  );
  const nextSourceGroupIds = withSortedValues(
    appendUniqueString(existing.sourceGroupIds, normalized.groupId)
  );
  const nextSourceKinds = mergeSourceKinds(existing.provenance?.sourceKinds, row.source_kind);
  const nextGroupName = normalized.groupKey ?? existing.groupName;
  const nextProvenance = nextSourceKinds
    ? {
        ...(existing.provenance ?? {}),
        sourceKinds: nextSourceKinds,
      }
    : existing.provenance;

  return {
    ...existing,
    ...(nextSourceUserIds ? { sourceUserIds: nextSourceUserIds } : {}),
    ...(nextSourceRoleIds ? { sourceRoleIds: nextSourceRoleIds } : {}),
    ...(nextSourceGroupIds ? { sourceGroupIds: nextSourceGroupIds } : {}),
    ...(nextGroupName ? { groupName: nextGroupName } : {}),
    provenance: nextProvenance,
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

  return [...buckets.values()].map(finalizePermissionBucket);
};
