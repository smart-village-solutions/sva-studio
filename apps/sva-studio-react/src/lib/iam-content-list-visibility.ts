import type { EffectivePermission } from '@sva/core';

type ProjectionRowReadView = {
  readonly contentType: string;
  readonly organizationId?: string;
  readonly createdByAccountId: string;
};

export type ProjectionReadVisibilityRule = {
  readonly contentType: string;
  readonly allowGlobal: boolean;
  readonly allowOrganizationIds: readonly string[];
  readonly allowOwn: boolean;
  readonly denyGlobal: boolean;
  readonly denyOrganizationIds: readonly string[];
  readonly denyOwn: boolean;
};

const ORGANIZATION_OPTIONAL_CONTENT_TYPES = new Set([
  'events.event-record',
  'news.article',
  'poi.point-of-interest',
]);

const buildReadAction = (contentType: string): string =>
  contentType === 'news.article' || contentType === 'events.event-record' || contentType === 'poi.point-of-interest'
    ? `${contentType.split('.')[0] ?? 'content'}.read`
    : 'content.read';

const buildReadResourceType = (action: string): string => action.split('.')[0] ?? 'content';

const uniqueSortedStrings = (values: readonly string[]) => [...new Set(values)].sort((left, right) => left.localeCompare(right));

const matchesReadPermission = (permission: EffectivePermission, action: string): boolean =>
  permission.action === action && permission.resourceType === buildReadResourceType(action) && !permission.resourceId;

const normalizePermissionForProjectionRead = (
  contentType: string,
  permission: EffectivePermission
): EffectivePermission =>
  ORGANIZATION_OPTIONAL_CONTENT_TYPES.has(contentType) && permission.organizationId
    ? {
        ...permission,
        organizationId: undefined,
        ...(permission.accessScope === 'organization' ? { accessScope: undefined } : {}),
      }
    : permission;

export const buildProjectionReadVisibilityRules = (
  contentTypes: readonly string[],
  permissions: readonly EffectivePermission[]
): readonly ProjectionReadVisibilityRule[] =>
  contentTypes.map((contentType) => {
    const action = buildReadAction(contentType);
    const matchingPermissions = permissions
      .filter((permission) => matchesReadPermission(permission, action))
      .map((permission) => normalizePermissionForProjectionRead(contentType, permission));
    const allowPermissions = matchingPermissions.filter((permission) => permission.effect !== 'deny');
    const denyPermissions = matchingPermissions.filter((permission) => permission.effect === 'deny');

    const hasOwnFallback = (permission: EffectivePermission): boolean =>
      permission.accessScope === 'own' || permission.accessScope === 'organization';

    return {
      contentType,
      allowGlobal: allowPermissions.some((permission) => !permission.organizationId && permission.accessScope !== 'own'),
      allowOrganizationIds: uniqueSortedStrings(
        allowPermissions.flatMap((permission) => (permission.organizationId ? [permission.organizationId] : []))
      ),
      allowOwn: allowPermissions.some(hasOwnFallback),
      denyGlobal: denyPermissions.some((permission) => !permission.organizationId && permission.accessScope !== 'own'),
      denyOrganizationIds: uniqueSortedStrings(
        denyPermissions.flatMap((permission) => (permission.organizationId ? [permission.organizationId] : []))
      ),
      denyOwn: denyPermissions.some(hasOwnFallback),
    };
  });

export const isProjectionRowVisibleForRead = (
  rule: ProjectionReadVisibilityRule,
  row: ProjectionRowReadView,
  actorAccountId: string | undefined
): boolean => {
  if (rule.contentType !== row.contentType) {
    return false;
  }

  const ownMatch = Boolean(actorAccountId && row.createdByAccountId === actorAccountId);
  const organizationMatch = Boolean(row.organizationId && rule.allowOrganizationIds.includes(row.organizationId));
  const deniedOrganizationMatch = Boolean(row.organizationId && rule.denyOrganizationIds.includes(row.organizationId));

  const allowed = rule.allowGlobal || organizationMatch || (rule.allowOwn && ownMatch);
  if (!allowed) {
    return false;
  }

  if (rule.denyGlobal) {
    return false;
  }

  if (deniedOrganizationMatch) {
    return false;
  }

  if (rule.denyOwn && ownMatch) {
    return false;
  }

  return true;
};
