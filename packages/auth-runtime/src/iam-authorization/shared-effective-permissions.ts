import type {
  EffectivePermission,
  IamRolePermissionAssignmentScope,
} from '@sva/core';

import { projectOrganizationIdForPermission } from './permission-scope-semantics.js';

export type PermissionRow = {
  permission_key: string;
  action?: string | null;
  resource_type?: string | null;
  resource_id?: string | null;
  scope?: Record<string, unknown> | null;
  access_scope?: IamRolePermissionAssignmentScope | null;
  role_id?: string | null;
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

const normalizeSourceKind = (value: PermissionRow['source_kind']): PermissionRow['source_kind'] =>
  value === 'direct_role' || value === 'group_role' ? value : undefined;

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
  organizationId?: string;
  scope?: Record<string, unknown>;
  accessScope?: IamRolePermissionAssignmentScope;
  groupId?: string;
  groupKey?: string;
  bucketKey: string;
};

const normalizePermissionRow = (row: PermissionRow): NormalizedPermissionRow => {
  const action = row.action?.trim() || row.permission_key;
  const resourceType = row.resource_type?.trim() || readResourceType(row.permission_key);
  const resourceId = row.resource_id?.trim() || undefined;
  const scope = row.scope ?? undefined;
  const accessScope = row.access_scope ?? undefined;
  const organizationId = projectOrganizationIdForPermission({
    permissionKey: row.permission_key,
    accessScope,
    organizationId: row.organization_id,
  });
  return {
    action,
    resourceType,
    resourceId,
    organizationId,
    scope,
    accessScope,
    groupId: row.group_id ?? undefined,
    groupKey: row.group_key ?? undefined,
    bucketKey: JSON.stringify({
      action,
      resourceType,
      resourceId,
      organizationId: organizationId ?? '',
      scope,
      accessScope,
    }),
  };
};

const createPermissionBucket = (row: PermissionRow, normalized: NormalizedPermissionRow): EffectivePermission => {
  const sourceKind = normalizeSourceKind(row.source_kind);
  return {
    action: normalized.action,
    resourceType: normalized.resourceType,
    ...(normalized.resourceId ? { resourceId: normalized.resourceId } : {}),
    ...(normalized.organizationId ? { organizationId: normalized.organizationId } : {}),
    ...(normalized.scope ? { scope: normalized.scope } : {}),
    ...(normalized.accessScope ? { accessScope: normalized.accessScope } : {}),
    ...(row.role_id ? { sourceRoleIds: [row.role_id] } : {}),
    ...(normalized.groupId ? { sourceGroupIds: [normalized.groupId] } : {}),
    ...(normalized.groupKey ? { groupName: normalized.groupKey } : {}),
    ...(sourceKind ? { provenance: { sourceKinds: [sourceKind] } } : {}),
  };
};

const withSortedValues = (
  values: readonly string[] | undefined
): readonly string[] | undefined => {
  return values ? sortStrings(values) : undefined;
};

const finalizePermissionBucket = (permission: EffectivePermission): EffectivePermission => {
  const sourceKinds = permission.provenance?.sourceKinds
    ? sortSourceKinds(permission.provenance.sourceKinds)
    : undefined;
  const normalizedSourceRoleIds = withSortedValues(permission.sourceRoleIds);
  const normalizedSourceGroupIds = withSortedValues(permission.sourceGroupIds);

  return {
    ...permission,
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
  const nextSourceRoleIds = withSortedValues(
    appendUniqueString(existing.sourceRoleIds, row.role_id ?? undefined)
  );
  const nextSourceGroupIds = withSortedValues(
    appendUniqueString(existing.sourceGroupIds, normalized.groupId)
  );
  const nextSourceKinds = mergeSourceKinds(existing.provenance?.sourceKinds, normalizeSourceKind(row.source_kind));
  const nextGroupName = normalized.groupKey ?? existing.groupName;
  const nextProvenance = nextSourceKinds
    ? {
        ...(existing.provenance ?? {}),
        sourceKinds: nextSourceKinds,
      }
    : existing.provenance;

  return {
    ...existing,
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
