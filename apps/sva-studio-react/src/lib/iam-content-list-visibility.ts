import type { EffectivePermission } from '@sva/iam-core';

import { isMainserverContentType } from './iam-content-list-api.shared.js';

type ProjectionRowReadView = {
  readonly contentType: string;
  readonly organizationId?: string;
  readonly ownerUserId?: string;
  readonly ownerOrganizationId?: string;
  readonly sourceSystem?: 'iam' | 'mainserver';
  readonly authorizationMode?: 'credential_visible_compatibility' | 'exact';
};

export type ProjectionReadVisibilityRule = {
  readonly contentType: string;
  readonly allowGlobal: boolean;
  readonly allowOrganizationIds: readonly string[];
  readonly allowOwn: boolean;
  readonly allowCredentialCompatibility: boolean;
};

const buildReadAction = (contentType: string): string =>
  isMainserverContentType(contentType)
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
    const matchingPermissions = permissions.filter((permission) =>
      matchesReadPermission(permission, action)
    );
    const hasOwnFallback = (permission: EffectivePermission): boolean =>
      permission.accessScope === 'own' || permission.accessScope === 'organization';

    return {
      contentType,
      allowGlobal: matchingPermissions.some(
        (permission) =>
          !permission.organizationId &&
          (permission.accessScope === undefined || permission.accessScope === 'all')
      ),
      allowOrganizationIds: uniqueSortedStrings(
        matchingPermissions.flatMap((permission) =>
          permission.organizationId ? [permission.organizationId] : []
        )
      ),
      allowOwn: matchingPermissions.some(hasOwnFallback),
      allowCredentialCompatibility: matchingPermissions.some(
        (permission) =>
          permission.accessScope === 'own' || permission.accessScope === 'organization'
      ),
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

  const compatibilityMatch =
    row.sourceSystem === 'mainserver' &&
    row.authorizationMode === 'credential_visible_compatibility' &&
    rule.allowCredentialCompatibility;
  const allowed =
    rule.allowGlobal || compatibilityMatch || organizationMatch || (rule.allowOwn && ownMatch);
  return allowed;
};
