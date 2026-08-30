import * as React from 'react';
import { useLocation, useNavigate } from '@tanstack/react-router';
import {
  Button,
  getStudioFormFieldProps,
  hasStudioCreatedSaveFeedback,
  removeStudioSaveFeedback,
  StudioField,
  StudioFormActionBar,
  StudioFormSummaryErrors,
  StudioPageTitle,
  StudioPersistentFormError,
  StudioSaveButton,
} from '@sva/studio-ui-react';
import { Controller } from 'react-hook-form';

import { ConfirmDialog } from '../../../components/ConfirmDialog';
import { Alert, AlertDescription } from '../../../components/ui/alert';
import { Badge } from '../../../components/ui/badge';
import { Card } from '../../../components/ui/card';
import { Checkbox } from '../../../components/ui/checkbox';
import { IamRuntimeDiagnosticDetails } from '../../../components/iam-runtime-diagnostic-details';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { SearchableSelect } from '../../../components/ui/searchable-select';
import { Select } from '../../../components/ui/select';
import { Textarea } from '../../../components/ui/textarea';
import type { IamUserPermissionTraceItem } from '@sva/core';
import { t } from '../../../i18n';
import { userErrorMessage } from './-user-error-message';
import { useUserEditController } from './use-user-edit-controller';
import { isIamAccessAllowed, useIamResourceAccess } from '../../../hooks/use-iam-resource-access';
import {
  appendUnique,
  buildPermissionTraceDetails,
  describePermissionTraceRuntimeScope,
  describePermissionTraceSource,
  formatDateTime,
  formatMetadata,
  formatRoleValidity,
  formatScope,
  formatTraceValidity,
  pickInitials,
  USER_EDIT_TABS,
  userEditTranslationKeys,
} from './user-edit-model';

type UserEditPageProps = {
  readonly userId: string;
  readonly invitationStatus?: 'failed';
  readonly invitationErrorMessage?: string;
};

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

export const UserEditPage = ({
  userId,
  invitationStatus,
  invitationErrorMessage,
}: UserEditPageProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const access = useIamResourceAccess('user');
  const canUpdateUser = isIamAccessAllowed(access.update);
  const {
    activeTab,
    activateFormFieldTab,
    closeUnsavedDialog,
    confirmPendingTab,
    effectivePermissionTrace,
    form,
    organizationAssignment,
    organizationMembershipDrafts,
    organizationSearchValue,
    organizationMutationError,
    availableOrganizations,
    assignOrganizationMembership,
    formValues,
    groupMembershipById,
    inactivePermissionTrace,
    isLoadingTimeline,
    isReprovisioningMainserverData,
    isSaving,
    isSendingPasswordSetupEmail,
    mainserverReprovisionSuccess,
    onReprovisionMainserverData,
    onSave,
    onSendPasswordSetupEmail,
    onTabIntent,
    onTabKeyDown,
    passwordSetupEmailSuccess,
    reloadTimeline,
    removeOrganizationMembership,
    resetFormValues,
    retryUserLoad,
    saveStatus,
    showSaved,
    saveOrganizationMembership,
    selectOrganizationAssignment,
    selectableGroups,
    selectableRoles,
    setOrganizationAssignment,
    setOrganizationSearchValue,
    selectedAssignableOrganization,
    timeline,
    timelineError,
    unsavedDialogOpen,
    updateOrganizationMembershipDraft,
    userApi,
  } = useUserEditController({ userId });
  const {
    control,
    formState: { errors },
    register,
    setValue,
  } = form;
  const emailField = getStudioFormFieldProps({ id: 'user-email', error: errors.email });
  const notesField = getStudioFormFieldProps({
    id: 'user-notes',
    error: errors.notes,
    hasDescription: true,
  });
  const summaryErrors = [emailField.summaryError, notesField.summaryError].filter(
    (error): error is NonNullable<typeof error> => error !== undefined
  );
  const initialSaveFeedbackShownRef = React.useRef(false);
  React.useEffect(() => {
    if (
      userApi.isLoading ||
      !userApi.user ||
      initialSaveFeedbackShownRef.current ||
      !hasStudioCreatedSaveFeedback(location.state, 'users', userId)
    ) {
      return;
    }

    initialSaveFeedbackShownRef.current = true;
    showSaved();
    void navigate({
      to: '/admin/users/$userId',
      params: { userId },
      search: true,
      replace: true,
      state: (previous) => removeStudioSaveFeedback(previous),
    });
  }, [location.state, navigate, showSaved, userApi.isLoading, userApi.user, userId]);

  const mutationError = userApi.mutationError ?? organizationMutationError;
  const organizationOptions = React.useMemo(
    () =>
      availableOrganizations.map((organization) => ({
        value: organization.id,
        label: `${organization.displayName} (${organization.organizationKey})`,
        keywords: [organization.displayName, organization.organizationKey],
      })),
    [availableOrganizations]
  );
  const selectedOrganizationOption = React.useMemo(() => {
    if (selectedAssignableOrganization) {
      return {
        value: selectedAssignableOrganization.id,
        label: `${selectedAssignableOrganization.displayName} (${selectedAssignableOrganization.organizationKey})`,
        keywords: [
          selectedAssignableOrganization.displayName,
          selectedAssignableOrganization.organizationKey,
        ],
      };
    }

    if (!organizationAssignment.organizationId || !organizationAssignment.organizationLabel) {
      return null;
    }

    return {
      value: organizationAssignment.organizationId,
      label: organizationAssignment.organizationLabel,
      keywords: [organizationAssignment.organizationLabel],
    };
  }, [
    organizationAssignment.organizationId,
    organizationAssignment.organizationLabel,
    selectedAssignableOrganization,
  ]);

  if (userApi.isLoading) {
    return (
      <section className="space-y-3" aria-busy="true">
        <StudioPageTitle withAccessory>{t('admin.users.edit.title')}</StudioPageTitle>
        <p role="status" className="text-sm text-muted-foreground">
          {t('admin.users.messages.loading')}
        </p>
      </section>
    );
  }

  if (!userApi.user) {
    return (
      <section className="space-y-3">
        <StudioPageTitle withAccessory>{t('admin.users.edit.title')}</StudioPageTitle>
        <Alert className="border-destructive/40 bg-destructive/10 text-destructive">
          <AlertDescription className="flex flex-col gap-3">
            <span>{userErrorMessage(userApi.error)}</span>
            {userApi.error ? <IamRuntimeDiagnosticDetails error={userApi.error} /> : null}
          </AlertDescription>
        </Alert>
      </section>
    );
  }

  return (
    <section className="space-y-5" aria-busy={isSaving}>
      <Card className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          {userApi.user.avatarUrl ? (
            <img
              src={userApi.user.avatarUrl}
              alt={t('admin.users.edit.avatarAlt', { name: userApi.user.displayName })}
              className="h-14 w-14 rounded-full border border-border object-cover"
            />
          ) : (
            <div className="flex h-14 w-14 items-center justify-center rounded-full border border-border bg-background text-lg font-semibold text-foreground">
              {pickInitials(userApi.user.displayName)}
            </div>
          )}
          <div>
            <StudioPageTitle withAccessory className="text-2xl">
              {userApi.user.displayName}
            </StudioPageTitle>
            <p className="text-sm text-muted-foreground">{userApi.user.email ?? '-'}</p>
            <p className="text-sm text-muted-foreground">
              {t('account.fields.username')}: {userApi.user.username ?? '-'}
            </p>
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              <Badge variant="outline">
                {t(userEditTranslationKeys.status[userApi.user.status])}
              </Badge>
              {userApi.user.roles.map((role) => {
                const validityLabel = formatRoleValidity(role);
                return (
                  <Badge key={role.roleId} variant="outline" className="h-auto items-start py-1">
                    <span className="block">{role.roleName}</span>
                    {validityLabel ? (
                      <span className="block text-[11px] text-muted-foreground">
                        {validityLabel}
                      </span>
                    ) : null}
                  </Badge>
                );
              })}
              {userApi.user.groups?.map((group) => (
                <Badge key={group.groupId} variant="outline" className="h-auto items-start py-1">
                  <span className="block">{group.displayName}</span>
                  <span className="block text-[11px] text-muted-foreground">
                    {t('admin.users.edit.groupOrigin', { value: group.origin })}
                  </span>
                </Badge>
              ))}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          {canUpdateUser ? (
            <>
              <Button
                type="button"
                variant="secondary"
                onClick={() => void onSendPasswordSetupEmail()}
                disabled={isSendingPasswordSetupEmail}
              >
                {isSendingPasswordSetupEmail
                  ? t('admin.users.actions.sendingPasswordSetupEmail')
                  : t('admin.users.actions.sendPasswordSetupEmail')}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => void onReprovisionMainserverData()}
                disabled={isReprovisioningMainserverData}
              >
                {isReprovisioningMainserverData
                  ? t('admin.users.actions.reprovisioningMainserverData')
                  : t('admin.users.actions.reprovisionMainserverData')}
              </Button>
            </>
          ) : null}
          <Button type="button" variant="secondary" onClick={retryUserLoad}>
            {t('admin.users.actions.retry')}
          </Button>
        </div>
      </Card>

      {canUpdateUser ? (
        <StudioFormActionBar position="start">
          <StudioSaveButton
            type="submit"
            form="user-edit-form"
            status={saveStatus}
            labels={{
              idle: t('admin.users.edit.save'),
              saving: t('account.actions.saving'),
              saved: t('account.actions.saved'),
            }}
          />
        </StudioFormActionBar>
      ) : null}

      <Card
        role="tablist"
        aria-label={t('admin.users.edit.tabsAriaLabel')}
        className="flex overflow-x-auto p-1"
      >
        {USER_EDIT_TABS.map((tab, index) => {
          const selected = tab.key === activeTab;
          return (
            <Button
              key={tab.key}
              id={`user-edit-tab-${tab.key}`}
              role="tab"
              type="button"
              aria-selected={selected}
              aria-controls={`user-edit-panel-${tab.key}`}
              className={`text-sm transition ${
                selected
                  ? 'bg-primary text-primary-foreground font-semibold hover:bg-primary/90'
                  : 'text-muted-foreground'
              }`}
              onClick={() => onTabIntent(tab.key)}
              onKeyDown={(event) => onTabKeyDown(event, index)}
              variant={selected ? 'primary' : 'tertiary'}
            >
              {t(userEditTranslationKeys.tab[tab.labelKey])}
            </Button>
          );
        })}
      </Card>

      <form
        id="user-edit-form"
        className="space-y-4"
        aria-readonly={!canUpdateUser}
        onSubmit={canUpdateUser ? onSave : (event) => event.preventDefault()}
        noValidate
      >
        <fieldset className="contents" disabled={!canUpdateUser}>
          <StudioFormSummaryErrors
            errors={summaryErrors}
            title={t('account.messages.validationSummary')}
            onSelectError={({ field }) => activateFormFieldTab(field)}
          />
          <section
            id="user-edit-panel-personal"
            role="tabpanel"
            aria-labelledby="user-edit-tab-personal"
            hidden={activeTab !== 'personal'}
            className="grid gap-4 rounded-xl border border-border bg-card p-4 shadow-shell md:grid-cols-2"
          >
            <div className="grid gap-2 text-sm text-foreground">
              <Label htmlFor="user-username">{t('account.fields.username')}</Label>
              <Input
                id="user-username"
                value={userApi.user.username ?? ''}
                readOnly
                aria-readonly="true"
              />
            </div>
            <div className="grid gap-2 text-sm text-foreground">
              <Label htmlFor="user-first-name">{t('account.fields.firstName')}</Label>
              <Input {...register('firstName')} id="user-first-name" />
            </div>
            <div className="grid gap-2 text-sm text-foreground">
              <Label htmlFor="user-last-name">{t('account.fields.lastName')}</Label>
              <Input {...register('lastName')} id="user-last-name" />
            </div>
            <div className="grid gap-2 text-sm text-foreground">
              <Label htmlFor="user-display-name">{t('account.fields.displayName')}</Label>
              <Input {...register('displayName')} id="user-display-name" />
            </div>
            <StudioField {...emailField} label={t('account.fields.email')}>
              <Input {...register('email')} type="email" />
            </StudioField>
            <div className="grid gap-2 text-sm text-foreground md:col-span-2">
              <Label htmlFor="user-phone">{t('account.fields.phone')}</Label>
              <Input {...register('phone')} id="user-phone" />
            </div>
          </section>

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
                <span className="block font-medium">
                  {t('admin.users.edit.isTechnicalAccount')}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {t('admin.users.edit.isTechnicalAccountHint')}
                </span>
              </Label>
            </div>
            {userApi.user.isTechnicalAccount && !formValues.isTechnicalAccount ? (
              <Alert className="border-amber-500/40 bg-amber-500/10 md:col-span-2" role="status">
                <AlertDescription>
                  {t('admin.users.edit.removeTechnicalAccountWarning')}
                </AlertDescription>
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
                          <span className="text-xs text-muted-foreground">
                            {membershipValidity}
                          </span>
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
            userApi.user.permissions &&
            userApi.user.permissions.length > 0 ? (
              <ul className="grid gap-2 text-sm text-foreground sm:grid-cols-2">
                {userApi.user.permissions.map((permission) => (
                  <li
                    key={permission}
                    className="rounded border border-border bg-background px-3 py-2"
                  >
                    {permission}
                  </li>
                ))}
              </ul>
            ) : null}

            {effectivePermissionTrace.length === 0 &&
            inactivePermissionTrace.length === 0 &&
            (!userApi.user.permissions || userApi.user.permissions.length === 0) ? (
              <p className="text-sm text-muted-foreground">
                {t('admin.users.edit.permissionsEmpty')}
              </p>
            ) : null}
          </section>

          <section
            id="user-edit-panel-organizations"
            role="tabpanel"
            aria-labelledby="user-edit-tab-organizations"
            hidden={activeTab !== 'organizations'}
            className="space-y-4 rounded-xl border border-border bg-card p-4 shadow-shell"
          >
            <div className="space-y-2">
              <h2 className="text-lg font-semibold text-foreground">
                {t('admin.users.edit.organizations.title')}
              </h2>
              <p className="text-sm text-muted-foreground">
                {t('admin.users.edit.organizations.description')}
              </p>
            </div>

            <div className="grid gap-3 rounded-lg border border-border bg-background p-3">
              <div>
                <SearchableSelect
                  id="user-organization-select"
                  label={t('admin.users.edit.organizations.selectLabel')}
                  value={organizationAssignment.organizationId}
                  placeholder={t('admin.users.edit.organizations.selectPlaceholder')}
                  searchPlaceholder={t('admin.users.edit.organizations.searchPlaceholder')}
                  emptyText={t('admin.users.edit.organizations.empty')}
                  options={organizationOptions}
                  selectedOption={selectedOrganizationOption}
                  searchValue={organizationSearchValue}
                  onSearchValueChange={setOrganizationSearchValue}
                  onValueChange={selectOrganizationAssignment}
                />
              </div>
              <Label
                htmlFor="user-organization-default"
                className="flex items-center gap-2 text-sm text-foreground"
              >
                <Checkbox
                  id="user-organization-default"
                  checked={organizationAssignment.isDefaultContext}
                  onChange={(event) =>
                    setOrganizationAssignment((current) => ({
                      ...current,
                      isDefaultContext: event.target.checked,
                    }))
                  }
                />
                <span>{t('admin.users.edit.organizations.assignDefaultLabel')}</span>
              </Label>
              <div className="flex justify-end">
                <Button
                  type="button"
                  onClick={() => void assignOrganizationMembership()}
                  disabled={!organizationAssignment.organizationId}
                >
                  {t('admin.users.edit.organizations.assignAction')}
                </Button>
              </div>
            </div>

            {userApi.user.organizationMemberships?.length ? (
              <ul className="grid gap-3">
                {userApi.user.organizationMemberships.map((membership) => {
                  const draft = organizationMembershipDrafts[membership.organizationId] ?? {
                    isDefaultContext: membership.isDefaultContext,
                  };

                  return (
                    <li
                      key={membership.organizationId}
                      className="grid gap-3 rounded-lg border border-border bg-background p-3"
                    >
                      <div className="space-y-1">
                        <p className="font-medium text-foreground">{membership.displayName}</p>
                        <p className="text-xs text-muted-foreground">
                          {membership.organizationKey}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {t('admin.users.edit.organizations.createdAt', {
                            value: formatDateTime(membership.createdAt),
                          })}
                        </p>
                      </div>
                      <Label
                        htmlFor={`organization-default-${membership.organizationId}`}
                        className="flex items-center gap-2 text-sm text-foreground"
                      >
                        <Checkbox
                          id={`organization-default-${membership.organizationId}`}
                          checked={draft.isDefaultContext}
                          onChange={(event) =>
                            updateOrganizationMembershipDraft(membership.organizationId, {
                              isDefaultContext: event.target.checked,
                            })
                          }
                        />
                        <span>{t('admin.users.edit.organizations.defaultContextLabel')}</span>
                      </Label>
                      <div className="flex flex-wrap justify-end gap-3">
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => void saveOrganizationMembership(membership.organizationId)}
                        >
                          {t('admin.users.edit.organizations.updateAction', {
                            name: membership.displayName,
                          })}
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          onClick={() =>
                            void removeOrganizationMembership(membership.organizationId)
                          }
                        >
                          {t('admin.users.edit.organizations.removeAction', {
                            name: membership.displayName,
                          })}
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                {t('admin.users.edit.organizations.empty')}
              </p>
            )}
          </section>

          <section
            id="user-edit-panel-history"
            role="tabpanel"
            aria-labelledby="user-edit-tab-history"
            hidden={activeTab !== 'history'}
            className="rounded-xl border border-border bg-card p-4 shadow-shell"
          >
            {timelineError ? (
              <Alert className="border-destructive/40 bg-destructive/10 text-destructive">
                <AlertDescription className="flex flex-col gap-3">
                  <span>{timelineError}</span>
                  <div>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => void reloadTimeline()}
                    >
                      {t('admin.users.edit.historyRetry')}
                    </Button>
                  </div>
                </AlertDescription>
              </Alert>
            ) : isLoadingTimeline ? (
              <p className="text-sm text-muted-foreground">
                {t('admin.users.edit.historyLoading')}
              </p>
            ) : timeline.length > 0 ? (
              <ul className="space-y-3">
                {timeline.map((entry) => {
                  const metadataText = formatMetadata(entry.metadata);
                  return (
                    <li
                      key={entry.id}
                      className="rounded-lg border border-border bg-background p-3"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-medium text-foreground">{entry.title}</p>
                          <p className="mt-1 text-sm text-muted-foreground">{entry.description}</p>
                        </div>
                        <div className="flex flex-wrap gap-2 text-xs">
                          <Badge className="rounded-full" variant="outline">
                            {t(userEditTranslationKeys.historyCategory[entry.category])}
                          </Badge>
                          <Badge className="rounded-full" variant="outline">
                            {t(userEditTranslationKeys.historyPerspective[entry.perspective])}
                          </Badge>
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
                        <span>
                          {t('admin.users.edit.historyOccurredAt', {
                            value: formatDateTime(entry.occurredAt),
                          })}
                        </span>
                        {metadataText ? (
                          <span>
                            {t('admin.users.edit.historyMetadata', { value: metadataText })}
                          </span>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">{t('admin.users.edit.historyEmpty')}</p>
            )}
          </section>

          {mutationError ? (
            <StudioPersistentFormError
              message={userErrorMessage(mutationError, 'mutation')}
              details={<IamRuntimeDiagnosticDetails error={mutationError} />}
            />
          ) : null}
          {invitationStatus === 'failed' ? (
            <Alert className="border-secondary/40 bg-secondary/10 text-secondary" role="status">
              <AlertDescription>
                {invitationErrorMessage ?? t('admin.users.edit.invitationWarning')}
              </AlertDescription>
            </Alert>
          ) : null}
          {passwordSetupEmailSuccess ? (
            <Alert className="border-primary/40 bg-primary/10 text-primary" role="status">
              <AlertDescription>{t('admin.users.edit.passwordSetupEmailSuccess')}</AlertDescription>
            </Alert>
          ) : null}
          {mainserverReprovisionSuccess ? (
            <Alert className="border-primary/40 bg-primary/10 text-primary" role="status">
              <AlertDescription>
                {t('admin.users.edit.mainserverReprovisionSuccess')}
              </AlertDescription>
            </Alert>
          ) : null}

          <StudioFormActionBar>
            <Button type="button" variant="secondary" onClick={resetFormValues}>
              {t('account.actions.cancel')}
            </Button>
            <StudioSaveButton
              type="submit"
              status={saveStatus}
              labels={{
                idle: t('admin.users.edit.save'),
                saving: t('account.actions.saving'),
                saved: t('account.actions.saved'),
              }}
            />
          </StudioFormActionBar>
        </fieldset>
      </form>

      <ConfirmDialog
        open={unsavedDialogOpen}
        title={t('admin.users.edit.unsavedDialog.title')}
        description={t('admin.users.edit.unsavedDialog.description')}
        confirmLabel={t('admin.users.edit.unsavedDialog.confirm')}
        cancelLabel={t('admin.users.edit.unsavedDialog.cancel')}
        onCancel={closeUnsavedDialog}
        onConfirm={confirmPendingTab}
      />
    </section>
  );
};
