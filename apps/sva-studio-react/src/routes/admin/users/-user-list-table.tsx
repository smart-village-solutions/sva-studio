import type {
  IamKeycloakMappingStatus,
  IamKeycloakObjectDiagnostic,
  IamKeycloakObjectEditability,
} from '@sva/core';
import { Button, type StudioColumnDef } from '@sva/studio-ui-react';
import { IconAlertTriangle, IconEdit, IconTrash } from '@tabler/icons-react';
import { Link } from '@tanstack/react-router';

import { Badge } from '../../../components/ui/badge';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Select } from '../../../components/ui/select';
import { Switch } from '../../../components/ui/switch';
import { t } from '../../../i18n';
import { UserKeycloakRolesDialog } from './-user-keycloak-roles';
import { type SyncStatusState, type UsersApiState } from './user-list-model';

const statusClassByValue: Record<'active' | 'inactive' | 'pending', string> = {
  active: 'border-primary/40 bg-primary/15 text-primary',
  inactive: 'border-destructive/40 bg-destructive/10 text-destructive',
  pending: 'border-secondary/40 bg-secondary/10 text-secondary',
};

const statusTranslationKeyByValue = {
  active: 'account.status.active',
  inactive: 'account.status.inactive',
  pending: 'account.status.pending',
} as const;

const mappingStatusTranslationKey: Record<IamKeycloakMappingStatus, string> = {
  mapped: 'admin.users.mapping.mapped',
  unmapped: 'admin.users.mapping.unmapped',
  manual_review: 'admin.users.mapping.manualReview',
};

const editabilityTranslationKey: Record<IamKeycloakObjectEditability, string> = {
  editable: 'admin.users.editability.editable',
  read_only: 'admin.users.editability.readOnly',
  blocked: 'admin.users.editability.blocked',
};

const editabilityClassByValue: Record<IamKeycloakObjectEditability, string> = {
  editable: 'border-primary/40 bg-primary/10 text-primary',
  read_only: 'border-secondary/40 bg-secondary/10 text-secondary',
  blocked: 'border-destructive/40 bg-destructive/10 text-destructive',
};

const renderDiagnosticCodes = (diagnostics: readonly IamKeycloakObjectDiagnostic[] | undefined) =>
  diagnostics && diagnostics.length > 0 ? (
    <span className="block text-xs text-muted-foreground">
      {t('admin.users.messages.diagnosticCodes', {
        codes: diagnostics.map((diagnostic) => diagnostic.code).join(', '),
      })}
    </span>
  ) : null;

type UserListUser = UsersApiState['users'][number];

const mainserverCredentialWarningTranslationKey = {
  missing_application_id: 'admin.users.messages.mainserverApplicationIdMissing',
  missing_application_secret: 'admin.users.messages.mainserverApplicationSecretMissing',
  missing_both: 'admin.users.messages.mainserverCredentialsMissing',
} as const;

const UserDisplayNameCell = ({ user }: { user: UserListUser }) => {
  const status = user.mainserverCredentialStatus ?? 'unknown';
  const warningTranslationKey =
    status === 'missing_application_id' ||
    status === 'missing_application_secret' ||
    status === 'missing_both'
      ? mainserverCredentialWarningTranslationKey[status]
      : undefined;

  const warningLabel = warningTranslationKey ? t(warningTranslationKey) : undefined;
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <span>{user.displayName}</span>
      {user.isTechnicalAccount ? (
        <Badge variant="outline">{t('admin.users.messages.technicalAccountBadge')}</Badge>
      ) : null}
      {warningLabel ? (
        <span
          role="img"
          aria-label={warningLabel}
          title={warningLabel}
          className="inline-flex text-amber-600"
        >
          <IconAlertTriangle aria-hidden="true" className="h-4 w-4 stroke-current" />
        </span>
      ) : null}
    </span>
  );
};

const UserStatusCell = ({
  user,
  isAuthLoading,
  isPlatformScope,
  canUpdateUsers,
  onStatusAction,
}: {
  user: UserListUser;
  isAuthLoading: boolean;
  isPlatformScope: boolean;
  canUpdateUsers: boolean;
  onStatusAction: (action: 'activate' | 'deactivate', userId: string) => void;
}) =>
  isPlatformScope || isAuthLoading ? (
    <Badge className={`rounded-full ${statusClassByValue[user.status]}`} variant="outline">
      {t(statusTranslationKeyByValue[user.status])}
    </Badge>
  ) : (
    <div className="flex items-center gap-2">
      <Switch
        checked={user.status !== 'inactive'}
        disabled={
          !canUpdateUsers || user.editability === 'blocked' || user.editability === 'read_only'
        }
        aria-label={t('admin.users.messages.statusSwitchLabel', {
          name: user.displayName,
        })}
        onCheckedChange={(checked) => onStatusAction(checked ? 'activate' : 'deactivate', user.id)}
      />
      {user.status === 'pending' ? (
        <Badge className={`rounded-full ${statusClassByValue[user.status]}`} variant="outline">
          {t(statusTranslationKeyByValue[user.status])}
        </Badge>
      ) : null}
    </div>
  );

const UserKeycloakCell = ({ user }: { user: UserListUser }) => {
  const mappingStatus = user.mappingStatus ?? 'mapped';
  const editability = user.editability ?? 'editable';
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <Badge className="rounded-full" variant="outline">
          {t(mappingStatusTranslationKey[mappingStatus])}
        </Badge>
        <Badge className={`rounded-full ${editabilityClassByValue[editability]}`} variant="outline">
          {t(editabilityTranslationKey[editability])}
        </Badge>
      </div>
      {renderDiagnosticCodes(user.diagnostics)}
      {user.keycloakRoles && user.keycloakRoles.length > 0 ? (
        <span className="block text-xs text-muted-foreground">
          {t('admin.users.keycloakRoles.directSummary', {
            roles: user.keycloakRoles.join(', '),
          })}
        </span>
      ) : null}
    </div>
  );
};

export const buildUserColumns = (
  isAuthLoading: boolean,
  isPlatformScope: boolean,
  canUpdateUsers: boolean,
  onStatusAction: (action: 'activate' | 'deactivate', userId: string) => void
): readonly StudioColumnDef<UserListUser>[] => [
  {
    id: 'displayName',
    header: t('admin.users.table.headerName'),
    cell: (user) => <UserDisplayNameCell user={user} />,
  },
  {
    id: 'email',
    header: t('admin.users.table.headerEmail'),
    cell: (user) => user.email ?? '-',
  },
  {
    id: 'role',
    header: t('admin.users.table.headerRole'),
    cell: (user) => user.roles[0]?.roleName ?? '-',
  },
  {
    id: 'status',
    header: t('admin.users.table.headerStatus'),
    cell: (user) => (
      <UserStatusCell
        user={user}
        isAuthLoading={isAuthLoading}
        isPlatformScope={isPlatformScope}
        canUpdateUsers={canUpdateUsers}
        onStatusAction={onStatusAction}
      />
    ),
  },
  {
    id: 'keycloak',
    header: t('admin.users.table.headerKeycloak'),
    cell: (user) => <UserKeycloakCell user={user} />,
  },
  {
    id: 'lastLoginAt',
    header: t('admin.users.table.headerLastLogin'),
    cell: (user) => user.lastLoginAt ?? '-',
  },
];

export const UserListToolbarStart = ({ usersApi }: { usersApi: UsersApiState }) => (
  <>
    <div className="flex flex-col gap-1 text-xs uppercase tracking-wide text-muted-foreground">
      <Label htmlFor="users-search">{t('admin.users.filters.searchLabel')}</Label>
      <Input
        id="users-search"
        placeholder={t('admin.users.filters.searchPlaceholder')}
        value={usersApi.filters.search}
        onChange={(event) => usersApi.setSearch(event.target.value)}
      />
    </div>
    <div className="flex flex-col gap-1 text-xs uppercase tracking-wide text-muted-foreground">
      <Label htmlFor="users-status">{t('admin.users.filters.statusLabel')}</Label>
      <Select
        id="users-status"
        value={usersApi.filters.status}
        onChange={(event) =>
          usersApi.setStatus(event.target.value as 'active' | 'inactive' | 'pending' | 'all')
        }
      >
        <option value="all">{t('admin.users.filters.statusAll')}</option>
        <option value="active">{t('admin.users.filters.statusActive')}</option>
        <option value="inactive">{t('admin.users.filters.statusInactive')}</option>
        <option value="pending">{t('admin.users.filters.statusPending')}</option>
      </Select>
    </div>
    <div className="flex items-center gap-2 self-end py-2 text-sm text-foreground">
      <Switch
        id="users-include-technical-accounts"
        checked={usersApi.filters.includeTechnicalAccounts}
        onCheckedChange={usersApi.setIncludeTechnicalAccounts}
        aria-label={t('admin.users.filters.includeTechnicalAccounts')}
      />
      <Label htmlFor="users-include-technical-accounts">
        {t('admin.users.filters.includeTechnicalAccounts')}
      </Label>
    </div>
  </>
);

export const UserListToolbarEnd = ({
  canUpdateUsers,
  syncStatus,
  total,
  onSyncUsers,
}: {
  canUpdateUsers: boolean;
  syncStatus: SyncStatusState;
  total: number;
  onSyncUsers: () => Promise<void>;
}) => (
  <>
    <p role="status" className="text-xs text-muted-foreground">
      {t('admin.users.messages.resultCount', { count: total })}
    </p>
    {canUpdateUsers ? (
      <Button
        type="button"
        variant="secondary"
        disabled={syncStatus === 'pending'}
        onClick={() => void onSyncUsers()}
      >
        {syncStatus === 'pending'
          ? t('admin.users.actions.syncing')
          : t('admin.users.actions.syncKeycloak')}
      </Button>
    ) : null}
  </>
);

const hasSystemAdminTargetRole = (user: UserListUser): boolean =>
  user.roles.some((role) => role.roleKey === 'system_admin');

export const UserListRowActions = ({
  canManageKeycloakRoles,
  canDeleteUsers,
  onDeleteAction,
  user,
}: {
  canManageKeycloakRoles: boolean;
  canDeleteUsers: boolean;
  onDeleteAction: (userId: string) => void;
  user: UserListUser;
}) => {
  const editBlocked = user.editability === 'blocked';
  const deleteBlocked =
    editBlocked || user.editability === 'read_only' || hasSystemAdminTargetRole(user);
  const deleteDisabledReason = hasSystemAdminTargetRole(user)
    ? t('admin.users.confirm.deleteSystemAdminDisabled')
    : t('admin.users.actions.delete');

  return (
    <>
      <UserKeycloakRolesDialog
        canWrite={canManageKeycloakRoles}
        userName={user.displayName}
        userRef={user.id}
      />
      {editBlocked ? (
        <Button
          type="button"
          size="icon"
          variant="secondary"
          disabled
          aria-label={t('admin.users.actions.edit')}
          title={t('admin.users.actions.edit')}
        >
          <IconEdit aria-hidden="true" className="h-4 w-4" />
        </Button>
      ) : (
        <Button asChild type="button" size="icon" variant="secondary">
          <Link
            to="/admin/users/$userId"
            params={{ userId: user.id }}
            aria-label={t('admin.users.actions.edit')}
            title={t('admin.users.actions.edit')}
          >
            <IconEdit aria-hidden="true" className="h-4 w-4" />
          </Link>
        </Button>
      )}
      {canDeleteUsers ? (
        <Button
          type="button"
          size="icon"
          variant="destructive"
          disabled={deleteBlocked}
          aria-label={t('admin.users.actions.delete')}
          title={deleteBlocked ? deleteDisabledReason : t('admin.users.actions.delete')}
          onClick={() => onDeleteAction(user.id)}
        >
          <IconTrash aria-hidden="true" className="h-4 w-4" />
        </Button>
      ) : null}
    </>
  );
};
