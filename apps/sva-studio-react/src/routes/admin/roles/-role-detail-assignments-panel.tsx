import { Button } from '@sva/studio-ui-react';
import { Link } from '@tanstack/react-router';

import { Alert, AlertDescription } from '../../../components/ui/alert';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../../../components/ui/card';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { t } from '../../../i18n';

import { DetailMetaItem } from './-role-detail-meta-item';
import type { RoleDetailTab } from './-role-detail-page';
import type { RoleDetailState } from './-role-detail-state';

export const RoleAssignmentsPanel = ({
  state,
  role,
  activeTab,
}: Readonly<{
  state: RoleDetailState;
  role: NonNullable<RoleDetailState['role']>;
  activeTab: RoleDetailTab;
}>) => {
  const {
    usersApi,
    assignedUsers,
    unassignedUsers,
    isUpdatingAssignmentsForUserIds,
    isReadOnly,
    removeRoleFromUser,
    assignRoleToUser,
  } = state;
  return (
    <section
      id="role-detail-panel-assignments"
      role="tabpanel"
      aria-labelledby="role-detail-tab-assignments"
      hidden={activeTab !== 'assignments'}
      className="grid gap-4 md:grid-cols-2"
    >
      <Card>
        <CardHeader>
          <CardTitle>{t('admin.roles.detail.assignments.summaryTitle')}</CardTitle>
          <CardDescription>{t('admin.roles.detail.assignments.summaryBody')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <dl className="grid gap-4">
            <DetailMetaItem
              label={t('admin.roles.workspace.assignmentCountLabel')}
              value={t('admin.roles.workspace.assignmentCountValue', {
                count: String(role.memberCount),
              })}
            />
            <DetailMetaItem
              label={t('admin.roles.detail.assignments.managedBy')}
              value={role.managedBy}
            />
          </dl>
          <div className="grid gap-2 text-sm text-foreground">
            <Label htmlFor="role-assignment-search">
              {t('admin.roles.detail.assignments.searchLabel')}
            </Label>
            <Input
              id="role-assignment-search"
              value={usersApi.filters.search}
              onChange={(event) => usersApi.setSearch(event.target.value)}
              placeholder={t('admin.roles.detail.assignments.searchPlaceholder')}
            />
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="gap-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle>{t('admin.roles.detail.assignments.managementTitle')}</CardTitle>
              <CardDescription>
                {t('admin.roles.detail.assignments.managementBody')}
              </CardDescription>
            </div>
            <Button asChild type="button" variant="secondary">
              <Link to="/admin/users">{t('admin.roles.detail.assignments.openUsers')}</Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {usersApi.error ? (
            <Alert className="border-destructive/40 bg-destructive/10 text-destructive">
              <AlertDescription>{t('admin.roles.detail.assignments.loadError')}</AlertDescription>
            </Alert>
          ) : null}

          <div className="grid gap-4 xl:grid-cols-2">
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-foreground">
                {t('admin.roles.detail.assignments.currentTitle')}
              </h3>
              {usersApi.isLoading ? (
                <p className="text-sm text-muted-foreground">
                  {t('admin.roles.detail.assignments.loading')}
                </p>
              ) : assignedUsers.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t('admin.roles.detail.assignments.emptyAssigned')}
                </p>
              ) : (
                <ul className="space-y-2">
                  {assignedUsers.map((user) => {
                    const roleIds = user.roles.map((assignment) => assignment.roleId);
                    const isBusy = isUpdatingAssignmentsForUserIds.includes(user.id);
                    return (
                      <li
                        key={user.id}
                        className="flex items-start justify-between gap-3 rounded-lg border border-border p-3"
                      >
                        <div className="min-w-0">
                          <p className="font-medium text-foreground">{user.displayName}</p>
                          <p className="text-xs text-muted-foreground">
                            {user.email ?? user.keycloakSubject}
                          </p>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          disabled={isReadOnly || isBusy}
                          onClick={() => void removeRoleFromUser(user.id, roleIds)}
                        >
                          {isBusy
                            ? t('admin.roles.detail.assignments.updating')
                            : t('admin.roles.detail.assignments.remove')}
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-medium text-foreground">
                {t('admin.roles.detail.assignments.availableTitle')}
              </h3>
              {usersApi.isLoading ? (
                <p className="text-sm text-muted-foreground">
                  {t('admin.roles.detail.assignments.loading')}
                </p>
              ) : unassignedUsers.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t('admin.roles.detail.assignments.emptyAvailable')}
                </p>
              ) : (
                <ul className="space-y-2">
                  {unassignedUsers.map((user) => {
                    const roleIds = user.roles.map((assignment) => assignment.roleId);
                    const isBusy = isUpdatingAssignmentsForUserIds.includes(user.id);
                    return (
                      <li
                        key={user.id}
                        className="flex items-start justify-between gap-3 rounded-lg border border-border p-3"
                      >
                        <div className="min-w-0">
                          <p className="font-medium text-foreground">{user.displayName}</p>
                          <p className="text-xs text-muted-foreground">
                            {user.email ?? user.keycloakSubject}
                          </p>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          disabled={isReadOnly || isBusy}
                          onClick={() => void assignRoleToUser(user.id, roleIds)}
                        >
                          {isBusy
                            ? t('admin.roles.detail.assignments.updating')
                            : t('admin.roles.detail.assignments.assign')}
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </section>
  );
};
