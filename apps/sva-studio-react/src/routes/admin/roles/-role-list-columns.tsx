import type { IamKeycloakRealmRole, IamKeycloakRoleCategory, IamRoleListItem } from '@sva/core';
import type { StudioColumnDef } from '@sva/studio-ui-react';

import { Badge } from '../../../components/ui/badge';
import { t } from '../../../i18n';
import { roleStatusLabel, roleStatusTone, roleTypeLabel } from './-roles-shared';

const editabilityClassByValue = {
  editable: 'border-primary/40 bg-primary/10 text-primary',
  read_only: 'border-secondary/40 bg-secondary/10 text-secondary',
  blocked: 'border-destructive/40 bg-destructive/10 text-destructive',
} as const;

const editabilityLabelKey = {
  editable: 'admin.roles.editability.editable',
  read_only: 'admin.roles.editability.readOnly',
  blocked: 'admin.roles.editability.blocked',
} as const;

export type RoleRow = Readonly<{
  id: string;
  roleName: string;
  roleKey: string;
  description?: string;
  managedBy: 'studio' | 'external' | 'keycloak_builtin';
  isSystemRole: boolean;
  editability: 'editable' | 'read_only' | 'blocked';
  keycloakCategory?: IamKeycloakRoleCategory;
  reasonCode?: string;
  localRole?: IamRoleListItem;
}>;

export const toLocalRoleRow = (role: IamRoleListItem): RoleRow => ({
  id: role.id,
  roleName: role.roleName,
  roleKey: role.roleKey,
  ...(role.description ? { description: role.description } : {}),
  managedBy: role.managedBy,
  isSystemRole: role.isSystemRole,
  editability: role.editability ?? 'editable',
  localRole: role,
});

export const toKeycloakRoleRow = (role: IamKeycloakRealmRole): RoleRow => ({
  id: role.id,
  roleName: role.roleName,
  roleKey: role.roleName,
  ...(role.description ? { description: role.description } : {}),
  managedBy: role.managedBy,
  isSystemRole: ['system_admin', 'service_role', 'platform_role'].includes(role.category),
  editability: role.assignable || role.category === 'keycloak_builtin' ? 'read_only' : 'blocked',
  keycloakCategory: role.category,
  ...(role.reasonCode ? { reasonCode: role.reasonCode } : {}),
});

export const createRoleListColumns = (
  showsStudioRoleDetails: boolean
): readonly StudioColumnDef<RoleRow>[] => {
  const columns: StudioColumnDef<RoleRow>[] = [
    {
      id: 'roleName',
      header: t('admin.roles.table.headerName'),
      cell: (role) => (
        <div className="space-y-1">
          <span className="block font-semibold">{role.roleName}</span>
          {role.localRole ? (
            <span className="block text-xs text-muted-foreground">{role.roleKey}</span>
          ) : null}
          <span className="block text-xs text-muted-foreground">
            {role.description?.trim() || t('admin.roles.messages.noDescription')}
          </span>
        </div>
      ),
      sortable: true,
      sortLabel: t('admin.roles.table.headerName'),
      sortValue: (role) => role.roleName.toLowerCase(),
    },
    {
      id: 'type',
      header: t('admin.roles.table.headerType'),
      cell: (role) => (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">
              {role.keycloakCategory &&
              !['assignable', 'keycloak_builtin'].includes(role.keycloakCategory)
                ? t('admin.roles.labels.protectedRole')
                : roleTypeLabel(role)}
            </span>
            <Badge
              className={`rounded-full ${editabilityClassByValue[role.editability]}`}
              variant="outline"
            >
              {t(editabilityLabelKey[role.editability])}
            </Badge>
          </div>
          {role.reasonCode ? (
            <p className="text-xs text-muted-foreground">
              {t('admin.roles.labels.protectionReason', { reason: role.reasonCode })}
            </p>
          ) : null}
        </div>
      ),
    },
  ];

  if (!showsStudioRoleDetails) return columns;

  columns.push({
    id: 'sync',
    header: t('admin.roles.table.headerSync'),
    cell: (role) =>
      role.localRole ? (
        <div className="space-y-2">
          <Badge
            className={`rounded-full ${roleStatusTone(role.localRole.syncState)}`}
            aria-label={`${t('admin.roles.table.headerSync')}: ${roleStatusLabel(role.localRole.syncState)}`}
            variant="outline"
          >
            {roleStatusLabel(role.localRole.syncState)}
          </Badge>
          {role.localRole.syncError ? (
            <p className="text-xs text-destructive" role="status">
              {t('admin.roles.messages.syncErrorCode', { code: role.localRole.syncError.code })}
            </p>
          ) : null}
          {!role.localRole.syncError &&
          role.localRole.diagnostics &&
          role.localRole.diagnostics.length > 0 ? (
            <p className="text-xs text-muted-foreground">
              {t('admin.roles.messages.diagnosticCodes', {
                codes: role.localRole.diagnostics.map((entry) => entry.code).join(', '),
              })}
            </p>
          ) : null}
        </div>
      ) : null,
  });
  columns.push({
    id: 'permissions',
    header: t('admin.roles.table.headerPermissions'),
    cell: (role) => String(role.localRole?.permissions.length ?? 0),
    sortable: true,
    sortLabel: t('admin.roles.table.headerPermissions'),
    sortValue: (role) => role.localRole?.permissions.length ?? 0,
  });
  columns.push({
    id: 'memberCount',
    header: t('admin.roles.table.headerUserCount'),
    cell: (role) => String(role.localRole?.memberCount ?? 0),
    sortable: true,
    sortLabel: t('admin.roles.table.headerUserCount'),
    sortValue: (role) => role.localRole?.memberCount ?? 0,
  });
  return columns;
};
