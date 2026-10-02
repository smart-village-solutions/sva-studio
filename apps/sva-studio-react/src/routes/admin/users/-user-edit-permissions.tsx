import type { IamUserPermissionTraceItem } from '@sva/core';
import { Badge } from '../../../components/ui/badge';
import { t } from '../../../i18n';
import type { useUserEditController } from './use-user-edit-controller';
import {
  buildPermissionTraceDetails,
  describePermissionTraceRuntimeScope,
  describePermissionTraceSource,
  formatScope,
  userEditTranslationKeys,
} from './user-edit-model';

type UserEditController = ReturnType<typeof useUserEditController>;
type UserEditUser = NonNullable<UserEditController['userApi']['user']>;

type PermissionTraceEntryCardProps = {
  readonly dashed?: boolean;
  readonly detailLines: readonly string[];
  readonly entry: IamUserPermissionTraceItem;
  readonly runtimeScopeText: string | null;
  readonly scopeText?: string | null;
};

const PermissionTraceEntryCard = ({
  dashed = false,
  detailLines,
  entry,
  runtimeScopeText,
  scopeText,
}: PermissionTraceEntryCardProps) => (
  <li
    className={`rounded-lg border border-border bg-background p-3 ${dashed ? 'border-dashed' : ''}`}
  >
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="font-medium text-foreground">{entry.permissionKey}</p>
        <p className="mt-1 text-sm text-muted-foreground">{describePermissionTraceSource(entry)}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Badge variant="outline">
          {t(userEditTranslationKeys.permissionTraceStatus[entry.status])}
        </Badge>
        {runtimeScopeText ? <Badge variant="outline">{runtimeScopeText}</Badge> : null}
      </div>
    </div>
    {scopeText !== undefined ? (
      <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
        <span>
          {t('admin.users.edit.permissionTrace.resourceType', { value: entry.resourceType })}
        </span>
        {entry.organizationId ? (
          <span>
            {t('admin.users.edit.permissionTrace.organization', { value: entry.organizationId })}
          </span>
        ) : null}
        {scopeText ? (
          <span>{t('admin.users.edit.permissionTrace.scope', { value: scopeText })}</span>
        ) : null}
      </div>
    ) : null}
    {detailLines.length > 0 ? (
      <ul className="mt-3 grid gap-1 text-xs text-muted-foreground">
        {detailLines.map((detail) => (
          <li key={detail}>{detail}</li>
        ))}
      </ul>
    ) : null}
  </li>
);

export const UserPermissionsPanel = ({
  controller,
  user,
}: {
  controller: UserEditController;
  user: UserEditUser;
}) => {
  const { activeTab, effectivePermissionTrace, inactivePermissionTrace } = controller;
  return (
    <section
      id="user-edit-panel-permissions"
      role="tabpanel"
      aria-labelledby="user-edit-tab-permissions"
      hidden={activeTab !== 'permissions'}
      className="space-y-4 rounded-xl border border-border bg-card p-4 shadow-shell"
    >
      <div className="space-y-2">
        <h2 className="text-lg font-semibold text-foreground">
          {t('admin.users.edit.permissionTrace.title')}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t('admin.users.edit.permissionTrace.description')}
        </p>
      </div>

      {effectivePermissionTrace.length > 0 ? (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-foreground">
            {t('admin.users.edit.permissionTrace.effectiveTitle')}
          </h3>
          <ul className="grid gap-3">
            {effectivePermissionTrace.map((entry, index) => {
              const scopeText = formatScope(entry.scope);
              const detailLines = buildPermissionTraceDetails(entry);
              const runtimeScopeText = describePermissionTraceRuntimeScope(entry);
              return (
                <PermissionTraceEntryCard
                  key={`${entry.permissionKey}:${entry.sourceKind}:${entry.roleId ?? 'none'}:${entry.groupId ?? 'none'}:${index}`}
                  detailLines={detailLines}
                  entry={entry}
                  runtimeScopeText={runtimeScopeText}
                  scopeText={scopeText}
                />
              );
            })}
          </ul>
        </div>
      ) : null}

      {inactivePermissionTrace.length > 0 ? (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-foreground">
            {t('admin.users.edit.permissionTrace.inactiveTitle')}
          </h3>
          <ul className="grid gap-3">
            {inactivePermissionTrace.map((entry, index) => {
              const detailLines = buildPermissionTraceDetails(entry);
              const runtimeScopeText = describePermissionTraceRuntimeScope(entry);
              return (
                <PermissionTraceEntryCard
                  key={`${entry.permissionKey}:${entry.sourceKind}:${entry.roleId ?? 'none'}:${entry.groupId ?? 'none'}:inactive:${index}`}
                  dashed
                  detailLines={detailLines}
                  entry={entry}
                  runtimeScopeText={runtimeScopeText}
                />
              );
            })}
          </ul>
        </div>
      ) : null}

      {effectivePermissionTrace.length === 0 &&
      inactivePermissionTrace.length === 0 &&
      user.permissions &&
      user.permissions.length > 0 ? (
        <ul className="grid gap-2 text-sm text-foreground sm:grid-cols-2">
          {user.permissions.map((permission) => (
            <li key={permission} className="rounded border border-border bg-background px-3 py-2">
              {permission}
            </li>
          ))}
        </ul>
      ) : null}

      {effectivePermissionTrace.length === 0 &&
      inactivePermissionTrace.length === 0 &&
      (!user.permissions || user.permissions.length === 0) ? (
        <p className="text-sm text-muted-foreground">{t('admin.users.edit.permissionsEmpty')}</p>
      ) : null}
    </section>
  );
};
