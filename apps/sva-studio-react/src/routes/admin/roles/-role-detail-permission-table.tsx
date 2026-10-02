import { useStudioSaveFeedback, type StudioColumnDef } from '@sva/studio-ui-react';
import React from 'react';

import { Checkbox } from '../../../components/ui/checkbox';
import { Label } from '../../../components/ui/label';
import { Select } from '../../../components/ui/select';
import { useRolePermissions } from '../../../hooks/use-role-permissions';
import { t } from '../../../i18n';
import { resolvePermissionTitle } from '../../../lib/permission-labels';

import {
  PermissionAccessScope,
  ROLE_PERMISSION_DESCRIPTION_LABELS,
  ROLE_PERMISSION_SCOPE_LABELS,
  RolePermissionTableRow,
  normalizePermissionAccessScope,
  normalizePermissionSearch,
  normalizeSupportedAccessScopes,
  summarizePermission,
} from './-role-detail-permission-model';
const filterRolePermissionRows = (
  rows: readonly RolePermissionTableRow[],
  permissionSearch: string
) => {
  const normalizedSearch = normalizePermissionSearch(permissionSearch);
  if (!normalizedSearch) {
    return rows;
  }

  return rows.filter((permission) =>
    [
      permission.resourceLabel,
      permission.actionLabel,
      permission.detailLabel,
      permission.permissionKey,
      permission.description,
    ]
      .join(' ')
      .toLowerCase()
      .includes(normalizedSearch)
  );
};

export const useRolePermissionTable = ({
  permissionsApi,
  permissionDraft,
  permissionScopeDraft,
  permissionSearch,
  isReadOnly,
  permissionsSaveFeedback,
  showTechnicalDetails,
  setPermissionScopeDraft,
  togglePermissionDraft,
}: Readonly<{
  permissionsApi: ReturnType<typeof useRolePermissions>;
  permissionDraft: string[];
  permissionScopeDraft: Record<string, PermissionAccessScope>;
  permissionSearch: string;
  isReadOnly: boolean;
  permissionsSaveFeedback: ReturnType<typeof useStudioSaveFeedback>;
  showTechnicalDetails: boolean;
  setPermissionScopeDraft: React.Dispatch<
    React.SetStateAction<Record<string, PermissionAccessScope>>
  >;
  togglePermissionDraft: (permissionId: string) => void;
}>) => {
  const permissionTableRows = React.useMemo<readonly RolePermissionTableRow[]>(
    () =>
      permissionsApi.permissions.map((permission) => {
        const summary = summarizePermission(permission.permissionKey);
        return {
          id: permission.id,
          permissionKey: permission.permissionKey,
          description:
            (ROLE_PERMISSION_DESCRIPTION_LABELS[permission.permissionKey]
              ? t(ROLE_PERMISSION_DESCRIPTION_LABELS[permission.permissionKey])
              : permission.description?.trim()) ||
            t('admin.roles.detail.permissions.permissionDescriptionFallback'),
          resourceLabel: summary.resourceLabel,
          actionLabel: summary.actionLabel,
          detailLabel: resolvePermissionTitle(permission.permissionKey) ?? summary.detailLabel,
          isAssigned: permissionDraft.includes(permission.id),
          isScopeAssignable: permission.isScopeAssignable ?? false,
          supportedAccessScopes: normalizeSupportedAccessScopes(
            permission.supportedAccessScopes as readonly PermissionAccessScope[] | undefined
          ),
          accessScope: normalizePermissionAccessScope(
            permissionScopeDraft[permission.id],
            permission
          ),
        };
      }),
    [permissionDraft, permissionScopeDraft, permissionsApi.permissions]
  );

  const filteredPermissionTableRows = React.useMemo(
    () => filterRolePermissionRows(permissionTableRows, permissionSearch),
    [permissionSearch, permissionTableRows]
  );

  const permissionTableColumns = React.useMemo<readonly StudioColumnDef<RolePermissionTableRow>[]>(
    () => [
      {
        id: 'assignedToggle',
        header: t('admin.roles.detail.permissions.table.columns.assignment'),
        cell: (permission) => (
          <Label className="flex items-center gap-3">
            <Checkbox
              type="checkbox"
              checked={permission.isAssigned}
              disabled={isReadOnly}
              aria-label={t('admin.roles.detail.permissions.toggleAssignment', {
                permission: permission.detailLabel,
              })}
              onChange={() => togglePermissionDraft(permission.id)}
            />
            <span className="text-sm text-foreground">
              {permission.isAssigned
                ? t('admin.roles.detail.permissions.assigned')
                : t('admin.roles.detail.permissions.notAssigned')}
            </span>
          </Label>
        ),
        sortable: true,
        sortLabel: t('admin.roles.detail.permissions.table.columns.assignment'),
        sortValue: (permission) => (permission.isAssigned ? '0' : '1'),
      },
      {
        id: 'detail',
        header: t('admin.roles.detail.permissions.table.columns.permission'),
        cell: (permission) => (
          <div className="space-y-1">
            <span className="block font-medium text-foreground">{permission.detailLabel}</span>
            <span className="block text-xs text-muted-foreground">{permission.description}</span>
          </div>
        ),
        sortable: true,
        sortLabel: t('admin.roles.detail.permissions.table.columns.permission'),
        sortValue: (permission) => permission.detailLabel.toLowerCase(),
      },
      {
        id: 'resource',
        header: t('admin.roles.detail.permissions.table.columns.resource'),
        cell: (permission) => permission.resourceLabel,
        sortable: true,
        sortLabel: t('admin.roles.detail.permissions.table.columns.resource'),
        sortValue: (permission) => permission.resourceLabel.toLowerCase(),
      },
      {
        id: 'action',
        header: t('admin.roles.detail.permissions.table.columns.action'),
        cell: (permission) => permission.actionLabel,
        sortable: true,
        sortLabel: t('admin.roles.detail.permissions.table.columns.action'),
        sortValue: (permission) => permission.actionLabel.toLowerCase(),
      },
      {
        id: 'scope',
        header: t('admin.iam.rights.columns.scope'),
        cell: (permission) =>
          permission.isAssigned && permission.isScopeAssignable ? (
            <Select
              value={permission.accessScope}
              disabled={isReadOnly}
              aria-label={t('admin.roles.detail.permissions.selectScope', {
                permission: permission.detailLabel,
              })}
              onChange={(event) => {
                permissionsSaveFeedback.markDirty();
                setPermissionScopeDraft((current) => ({
                  ...current,
                  [permission.id]: event.target.value as PermissionAccessScope,
                }));
              }}
            >
              {permission.supportedAccessScopes.map((scope) => (
                <option key={scope} value={scope}>
                  {t(ROLE_PERMISSION_SCOPE_LABELS[scope])}
                </option>
              ))}
            </Select>
          ) : (
            <span className="text-sm text-muted-foreground">
              {permission.isAssigned
                ? t(ROLE_PERMISSION_SCOPE_LABELS[permission.accessScope])
                : '-'}
            </span>
          ),
        sortable: true,
        sortLabel: t('admin.iam.rights.columns.scope'),
        sortValue: (permission) => permission.accessScope,
      },
      ...(showTechnicalDetails
        ? ([
            {
              id: 'technical',
              header: t('admin.roles.detail.permissions.table.columns.technicalKey'),
              cell: (permission) => (
                <code className="rounded bg-muted px-2 py-1 text-xs text-foreground">
                  {permission.permissionKey}
                </code>
              ),
              sortable: true,
              sortLabel: t('admin.roles.detail.permissions.table.columns.technicalKey'),
              sortValue: (permission) => permission.permissionKey.toLowerCase(),
            },
          ] satisfies readonly StudioColumnDef<RolePermissionTableRow>[])
        : []),
    ],
    [isReadOnly, permissionsSaveFeedback, showTechnicalDetails]
  );

  return { permissionTableRows, filteredPermissionTableRows, permissionTableColumns };
};
