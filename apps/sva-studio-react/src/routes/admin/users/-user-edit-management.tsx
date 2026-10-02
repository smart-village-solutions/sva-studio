import { getStudioFormFieldProps, StudioField } from '@sva/studio-ui-react';
import { Controller } from 'react-hook-form';

import { Alert, AlertDescription } from '../../../components/ui/alert';
import { Checkbox } from '../../../components/ui/checkbox';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Select } from '../../../components/ui/select';
import { Textarea } from '../../../components/ui/textarea';
import { t } from '../../../i18n';
import { UserKeycloakRolesPanel } from './-user-keycloak-roles';
import type { useUserEditController } from './use-user-edit-controller';
import { appendUnique, formatTraceValidity } from './user-edit-model';

type UserEditController = ReturnType<typeof useUserEditController>;
type UserEditUser = NonNullable<UserEditController['userApi']['user']>;

const UserRoleSelection = ({ controller }: { controller: UserEditController }) => {
  const {
    selectableRoles,
    formValues,
    form: { setValue },
  } = controller;
  return (
    <fieldset className="flex flex-col gap-2 text-sm text-foreground md:col-span-2">
      <legend>{t('admin.users.edit.rolesLabel')}</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {selectableRoles.map((role) => {
          const selected = formValues.roleIds.includes(role.id);
          return (
            <Label
              key={role.id}
              className="flex items-center gap-2 rounded border border-border bg-background px-3 py-2 text-sm text-foreground"
            >
              <Checkbox
                type="checkbox"
                checked={selected}
                onChange={(event) => {
                  setValue(
                    'roleIds',
                    event.target.checked
                      ? appendUnique(formValues.roleIds, role.id)
                      : formValues.roleIds.filter((entry) => entry !== role.id),
                    { shouldDirty: true }
                  );
                }}
              />
              <span>{role.roleName}</span>
            </Label>
          );
        })}
      </div>
    </fieldset>
  );
};

export const UserManagementPanel = ({
  controller,
  user,
  userId,
  canManageKeycloakRoles,
  notesField,
}: {
  controller: UserEditController;
  user: UserEditUser;
  userId: string;
  canManageKeycloakRoles: boolean;
  notesField: ReturnType<typeof getStudioFormFieldProps>;
}) => {
  const { activeTab, form, formValues, selectableGroups, groupMembershipById } = controller;
  const { control, register, setValue } = form;
  return (
    <section
      id="user-edit-panel-management"
      role="tabpanel"
      aria-labelledby="user-edit-tab-management"
      hidden={activeTab !== 'management'}
      className="grid gap-4 rounded-xl border border-border bg-card p-4 shadow-shell md:grid-cols-2"
    >
      <div className="grid gap-2 text-sm text-foreground">
        <Label htmlFor="user-status">{t('account.fields.status')}</Label>
        <Controller
          control={control}
          name="status"
          render={({ field }) => (
            <Select
              {...field}
              id="user-status"
              className="rounded-md border border-border bg-background px-3 py-2 text-foreground"
            >
              <option value="active">{t('account.status.active')}</option>
              <option value="inactive">{t('account.status.inactive')}</option>
              <option value="pending">{t('account.status.pending')}</option>
            </Select>
          )}
        />
      </div>
      <div className="flex items-start gap-3 rounded-md border border-border bg-background px-3 py-3 text-sm text-foreground">
        <Checkbox
          id="user-is-technical-account"
          checked={formValues.isTechnicalAccount}
          onChange={(event) =>
            setValue('isTechnicalAccount', event.target.checked, { shouldDirty: true })
          }
        />
        <Label htmlFor="user-is-technical-account" className="cursor-pointer">
          <span className="block font-medium">{t('admin.users.edit.isTechnicalAccount')}</span>
          <span className="block text-xs text-muted-foreground">
            {t('admin.users.edit.isTechnicalAccountHint')}
          </span>
        </Label>
      </div>
      {user.isTechnicalAccount && !formValues.isTechnicalAccount ? (
        <Alert className="border-amber-500/40 bg-amber-500/10 md:col-span-2" role="status">
          <AlertDescription>{t('admin.users.edit.removeTechnicalAccountWarning')}</AlertDescription>
        </Alert>
      ) : null}
      <div className="grid gap-2 text-sm text-foreground">
        <Label htmlFor="user-language">{t('account.fields.language')}</Label>
        <Input {...register('preferredLanguage')} id="user-language" />
      </div>
      <div className="grid gap-2 text-sm text-foreground">
        <Label htmlFor="user-timezone">{t('account.fields.timezone')}</Label>
        <Input {...register('timezone')} id="user-timezone" />
      </div>
      <UserRoleSelection controller={controller} />
      <div className="md:col-span-2">
        {activeTab === 'management' ? (
          <UserKeycloakRolesPanel canWrite={canManageKeycloakRoles} userRef={userId} />
        ) : null}
      </div>
      <fieldset className="flex flex-col gap-2 text-sm text-foreground md:col-span-2">
        <legend>{t('admin.users.edit.groupsLabel')}</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {selectableGroups.map((group) => {
            const selected = formValues.groupIds.includes(group.id);
            const currentMembership = groupMembershipById.get(group.id);
            const membershipValidity = currentMembership
              ? formatTraceValidity(currentMembership)
              : null;
            return (
              <Label
                key={group.id}
                className="flex items-start gap-2 rounded border border-border bg-background px-3 py-2 text-sm text-foreground"
              >
                <Checkbox
                  type="checkbox"
                  checked={selected}
                  onChange={(event) => {
                    setValue(
                      'groupIds',
                      event.target.checked
                        ? appendUnique(formValues.groupIds, group.id)
                        : formValues.groupIds.filter((entry) => entry !== group.id),
                      { shouldDirty: true }
                    );
                  }}
                />
                <span className="flex flex-col gap-1">
                  <span>{group.displayName}</span>
                  <span className="text-xs text-muted-foreground">{group.groupKey}</span>
                  {currentMembership ? (
                    <span className="text-xs text-muted-foreground">
                      {t('admin.users.edit.groupOrigin', { value: currentMembership.origin })}
                    </span>
                  ) : null}
                  {membershipValidity ? (
                    <span className="text-xs text-muted-foreground">{membershipValidity}</span>
                  ) : null}
                </span>
              </Label>
            );
          })}
        </div>
      </fieldset>
      <div className="grid gap-2 text-sm text-foreground md:col-span-2">
        <Label htmlFor="user-mainserver-app-id">
          {t('admin.users.edit.mainserverApplicationIdLabel')}
        </Label>
        <Input {...register('mainserverUserApplicationId')} id="user-mainserver-app-id" />
      </div>
      <div className="grid gap-2 text-sm text-foreground md:col-span-2">
        <Label htmlFor="user-mainserver-app-secret">
          {t('admin.users.edit.mainserverApplicationSecretLabel')}
        </Label>
        <Input
          {...register('mainserverUserApplicationSecret')}
          id="user-mainserver-app-secret"
          type="password"
          autoComplete="new-password"
          placeholder={t('admin.users.edit.mainserverApplicationSecretPlaceholder')}
        />
        <span className="text-xs text-muted-foreground">
          {formValues.mainserverUserApplicationSecretSet
            ? t('admin.users.edit.mainserverApplicationSecretConfigured')
            : t('admin.users.edit.mainserverApplicationSecretMissing')}
        </span>
        <span className="text-xs text-muted-foreground">
          {t('admin.users.edit.mainserverApplicationSecretHint')}
        </span>
      </div>
      <StudioField
        {...notesField}
        className="md:col-span-2"
        label={t('admin.users.edit.notesLabel')}
        description={t('admin.users.edit.notesCounter', { count: formValues.notes.length })}
      >
        <Textarea {...register('notes')} maxLength={2000} />
      </StudioField>
    </section>
  );
};
