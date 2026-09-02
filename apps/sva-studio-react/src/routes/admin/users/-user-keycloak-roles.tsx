import type { IamKeycloakRealmRoleAssignment } from '@sva/core';
import { Button } from '@sva/studio-ui-react';
import { IconKey } from '@tabler/icons-react';
import React from 'react';

import { Alert, AlertDescription } from '../../../components/ui/alert';
import { Badge } from '../../../components/ui/badge';
import { Checkbox } from '../../../components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../../../components/ui/dialog';
import { Label } from '../../../components/ui/label';
import { t } from '../../../i18n';
import {
  asIamError,
  getUserKeycloakRoles,
  mutateUserKeycloakRole,
  type IamHttpError,
} from '../../../lib/iam-api';

const categoryTranslationKey: Record<IamKeycloakRealmRoleAssignment['category'], string> = {
  assignable: 'admin.users.keycloakRoles.category.assignable',
  system_admin: 'admin.users.keycloakRoles.category.systemAdmin',
  keycloak_builtin: 'admin.users.keycloakRoles.category.builtin',
  client_role: 'admin.users.keycloakRoles.category.client',
  service_role: 'admin.users.keycloakRoles.category.service',
  platform_role: 'admin.users.keycloakRoles.category.platform',
};

const roleHint = (role: IamKeycloakRealmRoleAssignment): string => {
  if (role.category === 'system_admin') {
    return t('admin.users.keycloakRoles.systemAdminHint');
  }
  if (!role.assignable) {
    return t('admin.users.keycloakRoles.protectedHint');
  }
  if (role.origin === 'composite') {
    return t('admin.users.keycloakRoles.inheritedHint');
  }
  return role.direct
    ? t('admin.users.keycloakRoles.directHint')
    : t('admin.users.keycloakRoles.unassignedHint');
};

export const UserKeycloakRolesPanel = ({
  canWrite,
  userRef,
}: {
  readonly canWrite: boolean;
  readonly userRef: string;
}) => {
  const [roles, setRoles] = React.useState<readonly IamKeycloakRealmRoleAssignment[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [pendingRole, setPendingRole] = React.useState<string | null>(null);
  const [error, setError] = React.useState<IamHttpError | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await getUserKeycloakRoles(userRef);
      setRoles(response.data.roles);
    } catch (cause) {
      setError(asIamError(cause));
      setRoles([]);
    } finally {
      setIsLoading(false);
    }
  }, [userRef]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const changeRole = async (role: IamKeycloakRealmRoleAssignment, assigned: boolean) => {
    setPendingRole(role.roleName);
    setError(null);
    setSuccess(null);
    try {
      await mutateUserKeycloakRole(userRef, {
        roleName: role.roleName,
        operation: assigned ? 'assign' : 'remove',
      });
      setSuccess(
        t(
          assigned
            ? 'admin.users.keycloakRoles.assignSuccess'
            : 'admin.users.keycloakRoles.removeSuccess',
          { role: role.roleName }
        )
      );
      await load();
    } catch (cause) {
      setError(asIamError(cause));
    } finally {
      setPendingRole(null);
    }
  };

  return (
    <div className="space-y-3" aria-busy={isLoading}>
      <div>
        <h3 className="font-medium text-foreground">{t('admin.users.keycloakRoles.title')}</h3>
        <p className="text-sm text-muted-foreground">
          {t('admin.users.keycloakRoles.description')}
        </p>
      </div>
      {isLoading ? (
        <p role="status" aria-live="polite" className="text-sm text-muted-foreground">
          {t('admin.users.keycloakRoles.loading')}
        </p>
      ) : null}
      {!isLoading && roles.length === 0 && !error ? (
        <p role="status" className="text-sm text-muted-foreground">
          {t('admin.users.keycloakRoles.empty')}
        </p>
      ) : null}
      {error ? (
        <Alert role="alert" className="border-destructive/40 bg-destructive/10 text-destructive">
          <AlertDescription>{t('admin.users.keycloakRoles.error')}</AlertDescription>
        </Alert>
      ) : null}
      {success ? (
        <Alert role="status" className="border-primary/40 bg-primary/10 text-primary">
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      ) : null}
      <ul className="grid max-h-80 gap-2 overflow-y-auto pr-1">
        {roles.map((role) => {
          const inputId = `keycloak-role-${userRef}-${role.id}`.replace(/[^a-zA-Z0-9_-]/g, '-');
          const disabled = !canWrite || !role.assignable || pendingRole !== null;
          return (
            <li key={role.id} className="rounded-md border border-border bg-background p-3">
              <div className="flex items-start gap-3">
                <Checkbox
                  id={inputId}
                  checked={role.direct}
                  disabled={disabled}
                  aria-describedby={`${inputId}-hint`}
                  onChange={(event) => void changeRole(role, event.target.checked)}
                />
                <Label htmlFor={inputId} className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="break-all font-medium">{role.roleName}</span>
                    <Badge variant="outline">{t(categoryTranslationKey[role.category])}</Badge>
                    {role.origin === 'composite' ? (
                      <Badge variant="outline">{t('admin.users.keycloakRoles.inherited')}</Badge>
                    ) : null}
                    {role.direct ? (
                      <Badge variant="outline">{t('admin.users.keycloakRoles.direct')}</Badge>
                    ) : null}
                  </span>
                  <span id={`${inputId}-hint`} className="mt-1 block text-xs text-muted-foreground">
                    {roleHint(role)}
                  </span>
                </Label>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export const UserKeycloakRolesDialog = ({
  canWrite,
  userName,
  userRef,
}: {
  readonly canWrite: boolean;
  readonly userName: string;
  readonly userRef: string;
}) => (
  <Dialog>
    <DialogTrigger asChild>
      <Button
        type="button"
        size="icon"
        variant="secondary"
        aria-label={t('admin.users.keycloakRoles.openForUser', { name: userName })}
        title={t('admin.users.keycloakRoles.open')}
      >
        <IconKey aria-hidden="true" className="h-4 w-4" />
      </Button>
    </DialogTrigger>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{t('admin.users.keycloakRoles.dialogTitle', { name: userName })}</DialogTitle>
        <DialogDescription>{t('admin.users.keycloakRoles.dialogDescription')}</DialogDescription>
      </DialogHeader>
      <UserKeycloakRolesPanel canWrite={canWrite} userRef={userRef} />
    </DialogContent>
  </Dialog>
);
