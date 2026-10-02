import { useRoles } from '../../../hooks/use-roles';
import { t } from '../../../i18n';
import type { TranslationKey } from '../../../i18n/translate';

export type PermissionAccessScope = 'all' | 'own' | 'organization';

export const ASSIGNABLE_PERMISSION_ACCESS_SCOPES: readonly PermissionAccessScope[] = [
  'all',
  'own',
  'organization',
];

export const ROLE_PERMISSION_ACTION_LABELS = {
  read: 'admin.roles.permissionActions.read',
  create: 'admin.roles.permissionActions.create',
  write: 'admin.roles.permissionActions.write',
  update: 'admin.roles.permissionActions.update',
  updatemetadata: 'admin.roles.permissionActions.updateMetadata',
  updatepayload: 'admin.roles.permissionActions.updatePayload',
  changestatus: 'admin.roles.permissionActions.changeStatus',
  publish: 'admin.roles.permissionActions.publish',
  archive: 'admin.roles.permissionActions.archive',
  restore: 'admin.roles.permissionActions.restore',
  readhistory: 'admin.roles.permissionActions.readHistory',
  managerevisions: 'admin.roles.permissionActions.manageRevisions',
  delete: 'admin.roles.permissionActions.delete',
  configure: 'admin.roles.permissionActions.configure',
  export: 'admin.roles.permissionActions.export',
  manage: 'admin.roles.permissionActions.manage',
  execute: 'admin.roles.permissionActions.execute',
  moderate: 'admin.roles.permissionActions.moderate',
  pushnotification: 'admin.roles.permissionActions.pushNotification',
} as const;

export const ROLE_PERMISSION_DESCRIPTION_LABELS: Readonly<Record<string, TranslationKey>> = {
  'content.publish': 'admin.roles.permissionDescriptions.contentPublish',
  'content.changeStatus': 'admin.roles.permissionDescriptions.contentChangeStatus',
  'news.pushNotification': 'admin.roles.permissionDescriptions.newsPushNotification',
};

export const ROLE_PERMISSION_SCOPE_LABELS: Record<PermissionAccessScope, TranslationKey> = {
  all: 'admin.roles.permissionScopes.all',
  own: 'admin.roles.permissionScopes.own',
  organization: 'admin.roles.permissionScopes.organization',
};

export const ROLE_PERMISSION_RESOURCE_LABELS = {
  content: 'admin.roles.permissionResources.content',
  iam: 'admin.roles.permissionResources.iam',
  users: 'admin.roles.permissionResources.users',
  user: 'admin.roles.permissionResources.users',
  roles: 'admin.roles.permissionResources.roles',
  role: 'admin.roles.permissionResources.roles',
  groups: 'admin.roles.permissionResources.groups',
  group: 'admin.roles.permissionResources.groups',
  organizations: 'admin.roles.permissionResources.organizations',
  organization: 'admin.roles.permissionResources.organizations',
  legal: 'admin.roles.permissionResources.legal',
  app: 'admin.roles.permissionResources.app',
  cockpit: 'admin.roles.permissionResources.cockpit',
  interfaces: 'admin.roles.permissionResources.interfaces',
  media: 'admin.roles.permissionResources.media',
  news: 'admin.roles.permissionResources.news',
  events: 'admin.roles.permissionResources.events',
  poi: 'admin.roles.permissionResources.poi',
  'waste-management': 'admin.roles.permissionResources.wasteManagement',
} as const;

export const humanizePermissionSegment = (value: string): string =>
  value
    .split(/[_-]+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');

export const mapPermissionActionLabel = (action: string): string => {
  const normalizedAction = action.toLowerCase() as keyof typeof ROLE_PERMISSION_ACTION_LABELS;
  return normalizedAction in ROLE_PERMISSION_ACTION_LABELS
    ? t(ROLE_PERMISSION_ACTION_LABELS[normalizedAction])
    : humanizePermissionSegment(action);
};

export const mapPermissionResourceLabel = (resource: string): string => {
  const normalizedResource = resource.toLowerCase() as keyof typeof ROLE_PERMISSION_RESOURCE_LABELS;
  return normalizedResource in ROLE_PERMISSION_RESOURCE_LABELS
    ? t(ROLE_PERMISSION_RESOURCE_LABELS[normalizedResource])
    : humanizePermissionSegment(resource);
};

export const summarizePermission = (permissionKey: string) => {
  const [resourceSegment, actionSegment = 'access'] = permissionKey.split('.');
  return {
    resourceLabel: mapPermissionResourceLabel(resourceSegment),
    actionLabel: mapPermissionActionLabel(actionSegment),
    detailLabel: `${mapPermissionActionLabel(actionSegment)} ${mapPermissionResourceLabel(resourceSegment)}`,
  };
};

export type RolePermissionTableRow = Readonly<{
  id: string;
  permissionKey: string;
  description: string;
  resourceLabel: string;
  actionLabel: string;
  detailLabel: string;
  isAssigned: boolean;
  isScopeAssignable: boolean;
  supportedAccessScopes: readonly PermissionAccessScope[];
  accessScope: PermissionAccessScope;
}>;

export const normalizePermissionSearch = (value: string) => value.trim().toLowerCase();

export const sortPermissionIdsByCatalog = (
  permissionIds: readonly string[],
  catalog: readonly { id: string; permissionKey: string }[]
) => {
  const permissionKeyById = new Map(
    catalog.map((permission) => [permission.id, permission.permissionKey] as const)
  );

  return [...permissionIds].sort((left, right) => {
    const leftKey = permissionKeyById.get(left) ?? left;
    const rightKey = permissionKeyById.get(right) ?? right;
    return leftKey.localeCompare(rightKey);
  });
};

export const sortPermissionAssignmentsByCatalog = (
  permissionIds: readonly string[],
  assignments: Readonly<Record<string, PermissionAccessScope>>,
  catalog: readonly {
    id: string;
    permissionKey: string;
    isScopeAssignable?: boolean;
    supportedAccessScopes?: readonly PermissionAccessScope[];
  }[]
) => {
  const permissionById = new Map(catalog.map((permission) => [permission.id, permission] as const));

  return sortPermissionIdsByCatalog(permissionIds, catalog).map((permissionId) => {
    const permission = permissionById.get(permissionId);
    const accessScope = normalizePermissionAccessScope(assignments[permissionId], permission);
    return permission?.isScopeAssignable ? { permissionId, accessScope } : { permissionId };
  });
};

export const normalizeSupportedAccessScopes = (
  scopes: readonly PermissionAccessScope[] | undefined
): readonly PermissionAccessScope[] => {
  const normalized = (scopes ?? []).filter((scope, index, values) => {
    return ASSIGNABLE_PERMISSION_ACCESS_SCOPES.includes(scope) && values.indexOf(scope) === index;
  });

  return normalized.length > 0 ? normalized : ['all'];
};

export const normalizePermissionAccessScope = (
  accessScope: PermissionAccessScope | undefined,
  permission:
    | {
        isScopeAssignable?: boolean;
        supportedAccessScopes?: readonly PermissionAccessScope[];
      }
    | undefined
): PermissionAccessScope => {
  if (!permission?.isScopeAssignable) {
    return 'all';
  }

  const supportedAccessScopes = normalizeSupportedAccessScopes(permission.supportedAccessScopes);
  return accessScope && supportedAccessScopes.includes(accessScope) ? accessScope : 'all';
};

export const buildPermissionScopeDraft = (
  role: NonNullable<ReturnType<typeof useRoles>['roles'][number]>,
  catalog: readonly {
    id: string;
    permissionKey: string;
    isScopeAssignable?: boolean;
    supportedAccessScopes?: readonly PermissionAccessScope[];
  }[]
): Record<string, PermissionAccessScope> => {
  const byAssignment = Object.fromEntries(
    (role.permissionAssignments ?? []).map(
      (assignment) => [assignment.permissionId, assignment.accessScope] as const
    )
  ) as Record<string, PermissionAccessScope>;
  const permissionById = new Map(catalog.map((permission) => [permission.id, permission] as const));

  return role.permissions.reduce<Record<string, PermissionAccessScope>>(
    (acc, permission) => {
      acc[permission.id] = normalizePermissionAccessScope(
        byAssignment[permission.id] ?? permission.accessScope ?? 'all',
        {
          isScopeAssignable:
            permission.isScopeAssignable ?? permissionById.get(permission.id)?.isScopeAssignable,
          supportedAccessScopes:
            permission.supportedAccessScopes ??
            permissionById.get(permission.id)?.supportedAccessScopes,
        }
      );
      return acc;
    },
    { ...Object.fromEntries(catalog.map((permission) => [permission.id, 'all'] as const)) }
  );
};
