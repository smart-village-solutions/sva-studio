import type { IamDsrCaseListItem, IamGovernanceCaseListItem } from '@sva/core';
import type { EffectivePermission } from '@sva/iam-core';
import { Badge } from '../../components/ui/badge';
import { t } from '../../i18n';
import { formatPermissionAreaLabel, formatPermissionSourceKinds } from './-iam.models';

export const formatObjectEntries = (value: Readonly<Record<string, unknown>> | undefined) => {
  if (!value || Object.keys(value).length === 0) {
    return '—';
  }
  return Object.entries(value)
    .map(([key, entry]) => `${key}: ${String(entry)}`)
    .join(', ');
};

export const formatSourceRoles = (permission: EffectivePermission) =>
  (permission.sourceRoleIds ?? []).length > 0 ? (permission.sourceRoleIds ?? []).join(', ') : '—';

export const formatSourceGroups = (permission: EffectivePermission) => {
  if (permission.groupName && permission.groupName.trim().length > 0) {
    return permission.groupName;
  }
  return (permission.sourceGroupIds ?? []).length > 0
    ? (permission.sourceGroupIds ?? []).join(', ')
    : '—';
};

export const formatGovernanceActors = (item: IamGovernanceCaseListItem) =>
  [item.actorDisplayName ?? item.actorAccountId, item.targetDisplayName ?? item.targetAccountId]
    .filter(Boolean)
    .join(' -> ') || '—';

export const formatDsrPeople = (item: IamDsrCaseListItem) =>
  [
    item.targetDisplayName ?? item.targetAccountId,
    item.requesterDisplayName ??
      item.requesterAccountId ??
      item.actorDisplayName ??
      item.actorAccountId,
  ]
    .filter(Boolean)
    .join(' / ') || '—';

export const PermissionTable = ({
  permissions,
}: Readonly<{
  permissions: readonly EffectivePermission[];
}>) => {
  if (permissions.length === 0) {
    return <p className="text-sm text-muted-foreground">{t('admin.iam.rights.empty')}</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table
        className="min-w-full border-collapse text-left text-xs sm:text-sm"
        aria-label={t('admin.iam.rights.tableAriaLabel')}
      >
        <thead>
          <tr className="border-b border-border text-muted-foreground">
            <th className="py-2 pr-4 font-semibold">{t('admin.iam.rights.columns.action')}</th>
            <th className="py-2 pr-4 font-semibold">{t('admin.iam.rights.columns.area')}</th>
            <th className="py-2 pr-4 font-semibold">
              {t('admin.iam.rights.columns.resourceType')}
            </th>
            <th className="py-2 pr-4 font-semibold">{t('admin.iam.rights.columns.resourceId')}</th>
            <th className="py-2 pr-4 font-semibold">
              {t('admin.iam.rights.columns.organization')}
            </th>
            <th className="py-2 pr-4 font-semibold">{t('admin.iam.rights.columns.scope')}</th>
            <th className="py-2 font-semibold">{t('admin.iam.rights.columns.sourceRoles')}</th>
            <th className="py-2 font-semibold">{t('admin.iam.rights.columns.sourceGroups')}</th>
            <th className="py-2 font-semibold">{t('admin.iam.rights.columns.origin')}</th>
          </tr>
        </thead>
        <tbody>
          {permissions.map((permission, index) => (
            <tr
              key={`${permission.action}-${permission.resourceType}-${permission.resourceId ?? 'none'}-${index}`}
              className="border-b border-border align-top text-foreground"
            >
              <td className="py-2 pr-4">{permission.action}</td>
              <td className="py-2 pr-4">{formatPermissionAreaLabel(permission)}</td>
              <td className="py-2 pr-4">{permission.resourceType}</td>
              <td className="py-2 pr-4">{permission.resourceId ?? '—'}</td>
              <td className="py-2 pr-4">
                {permission.organizationId ?? t('admin.iam.rights.noOrganization')}
              </td>
              <td className="py-2 pr-4">{formatObjectEntries(permission.scope)}</td>
              <td className="py-2">{formatSourceRoles(permission)}</td>
              <td className="py-2">{formatSourceGroups(permission)}</td>
              <td className="py-2">{formatPermissionSourceKinds(permission)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export const StatusBadge = ({ label, tone }: Readonly<{ label: string; tone: string }>) => (
  <Badge className={tone} variant="outline">
    {label}
  </Badge>
);
