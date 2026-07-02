import type { EffectivePermission } from '@sva/iam-core';

type ProjectionRowReadView = {
  readonly contentType: string;
  readonly organizationId?: string;
  readonly ownerUserId?: string;
  readonly ownerOrganizationId?: string;
};

export type ProjectionReadVisibilityRule = {
  readonly contentType: string;
  readonly allowGlobal: boolean;
  readonly allowOrganizationIds: readonly string[];
  readonly allowOwn: boolean;
};

const ORGANIZATION_OPTIONAL_CONTENT_TYPES = new Set([
  'events.event-record',
  'news.article',
  'poi.point-of-interest',
]);

const buildReadAction = (contentType: string): string =>
  contentType === 'news.article' ||
  contentType === 'events.event-record' ||
  contentType === 'poi.point-of-interest' ||
  contentType === 'surveys.survey'
    ? `${contentType.split('.')[0] ?? 'content'}.read`
    : 'content.read';

const buildReadResourceType = (action: string): string => action.split('.')[0] ?? 'content';

const uniqueSortedStrings = (values: readonly string[]) =>
  [...new Set(values)].sort((left, right) => left.localeCompare(right, 'de'));

const matchesReadPermission = (permission: EffectivePermission, action: string): boolean =>
  permission.action === action &&
  permission.resourceType === buildReadResourceType(action) &&
  !permission.resourceId;

export const buildProjectionReadVisibilityRules = (
  contentTypes: readonly string[],
  permissions: readonly EffectivePermission[]
): readonly ProjectionReadVisibilityRule[] =>
  contentTypes.map((contentType) => {
    const action = buildReadAction(contentType);
    const matchingPermissions = permissions
      .filter((permission) => matchesReadPermission(permission, action))
      .map((permission) =>
        ORGANIZATION_OPTIONAL_CONTENT_TYPES.has(contentType) && !permission.organizationId
          ? {
              ...permission,
              ...(permission.accessScope === 'organization' ? { accessScope: undefined } : {}),
            }
          : permission
      );
    const hasOwnFallback = (permission: EffectivePermission): boolean =>
      permission.accessScope === 'own' || permission.accessScope === 'organization';

    return {
      contentType,
      allowGlobal: matchingPermissions.some(
        (permission) => !permission.organizationId && permission.accessScope !== 'own'
      ),
      allowOrganizationIds: uniqueSortedStrings(
        matchingPermissions.flatMap((permission) =>
          permission.organizationId ? [permission.organizationId] : []
        )
      ),
      allowOwn: matchingPermissions.some(hasOwnFallback),
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

  const ownMatch = Boolean(actorAccountId && row.ownerUserId === actorAccountId);
  const organizationMatch = Boolean(
    row.ownerOrganizationId && rule.allowOrganizationIds.includes(row.ownerOrganizationId)
  );

  const allowed = rule.allowGlobal || organizationMatch || (rule.allowOwn && ownMatch);
  return allowed;
};
