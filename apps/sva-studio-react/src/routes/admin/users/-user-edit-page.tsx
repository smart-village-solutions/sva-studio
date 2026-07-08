import { ConfirmDialog } from '../../../components/ConfirmDialog';
import { Alert, AlertDescription } from '../../../components/ui/alert';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
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
  <li className={`rounded-lg border border-border bg-background p-3 ${dashed ? 'border-dashed' : ''}`}>
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="font-medium text-foreground">{entry.permissionKey}</p>
        <p className="mt-1 text-sm text-muted-foreground">{describePermissionTraceSource(entry)}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Badge variant="outline">{t(userEditTranslationKeys.permissionTraceStatus[entry.status])}</Badge>
        {runtimeScopeText ? <Badge variant="outline">{runtimeScopeText}</Badge> : null}
      </div>
    </div>
    {scopeText !== undefined ? (
      <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
        <span>{t('admin.users.edit.permissionTrace.resourceType', { value: entry.resourceType })}</span>
        {entry.organizationId ? (
          <span>{t('admin.users.edit.permissionTrace.organization', { value: entry.organizationId })}</span>
        ) : null}
        {scopeText ? <span>{t('admin.users.edit.permissionTrace.scope', { value: scopeText })}</span> : null}
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

export const UserEditPage = ({ userId, invitationStatus, invitationErrorMessage }: UserEditPageProps) => {
  const {
    activeTab,
    closeUnsavedDialog,
    confirmPendingTab,
    effectivePermissionTrace,
    organizationAssignment,
    organizationMembershipDrafts,
    organizationMutationError,
    availableOrganizations,
    assignOrganizationMembership,
    formValues,
    groupMembershipById,
    inactivePermissionTrace,
    isLoadingTimeline,
    isSaving,
    isSendingPasswordSetupEmail,
    onSave,
    onSendPasswordSetupEmail,
    onTabIntent,
    onTabKeyDown,
    passwordSetupEmailSuccess,
    reloadTimeline,
    removeOrganizationMembership,
    resetFormValues,
    retryUserLoad,
    saveSuccess,
    saveOrganizationMembership,
    selectableGroups,
    selectableRoles,
    setFormValues,
    setOrganizationAssignment,
    timeline,
    timelineError,
    unsavedDialogOpen,
    updateOrganizationMembershipDraft,
    userApi,
  } = useUserEditController({ userId });

  const mutationError = userApi.mutationError ?? organizationMutationError;

  if (userApi.isLoading) {
    return (
      <section className="space-y-3" aria-busy="true">
        <h1 className="text-3xl font-semibold text-foreground">{t('admin.users.edit.title')}</h1>
        <p role="status" className="text-sm text-muted-foreground">
          {t('admin.users.messages.loading')}
        </p>
      </section>
    );
  }

  if (!userApi.user) {
    return (
      <section className="space-y-3">
        <h1 className="text-3xl font-semibold text-foreground">{t('admin.users.edit.title')}</h1>
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
            <h1 className="text-2xl font-semibold text-foreground">{userApi.user.displayName}</h1>
            <p className="text-sm text-muted-foreground">{userApi.user.email ?? '-'}</p>
            <p className="text-sm text-muted-foreground">
              {t('account.fields.username')}: {userApi.user.username ?? '-'}
            </p>
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              <Badge variant="outline">{t(userEditTranslationKeys.status[userApi.user.status])}</Badge>
              {userApi.user.roles.map((role) => {
                const validityLabel = formatRoleValidity(role);
                return (
                  <Badge key={role.roleId} variant="outline" className="h-auto items-start py-1">
                    <span className="block">{role.roleName}</span>
                    {validityLabel ? (
                      <span className="block text-[11px] text-muted-foreground">{validityLabel}</span>
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
          <Button
            type="button"
            variant="outline"
            onClick={() => void onSendPasswordSetupEmail()}
            disabled={isSendingPasswordSetupEmail}
          >
            {isSendingPasswordSetupEmail
              ? t('admin.users.actions.sendingPasswordSetupEmail')
              : t('admin.users.actions.sendPasswordSetupEmail')}
          </Button>
          <Button type="button" variant="outline" onClick={retryUserLoad}>
            {t('admin.users.actions.retry')}
          </Button>
        </div>
      </Card>

      <Card role="tablist" aria-label={t('admin.users.edit.tabsAriaLabel')} className="flex overflow-x-auto p-1">
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
              variant={selected ? 'default' : 'ghost'}
            >
              {t(userEditTranslationKeys.tab[tab.labelKey])}
            </Button>
          );
        })}
      </Card>

      <form className="space-y-4" onSubmit={onSave}>
        <section
          id="user-edit-panel-personal"
          role="tabpanel"
          aria-labelledby="user-edit-tab-personal"
          hidden={activeTab !== 'personal'}
          className="grid gap-4 rounded-xl border border-border bg-card p-4 shadow-shell md:grid-cols-2"
        >
          <div className="grid gap-2 text-sm text-foreground">
            <Label htmlFor="user-username">{t('account.fields.username')}</Label>
            <Input id="user-username" value={userApi.user.username ?? ''} readOnly aria-readonly="true" />
          </div>
          <div className="grid gap-2 text-sm text-foreground">
            <Label htmlFor="user-first-name">{t('account.fields.firstName')}</Label>
            <Input
              id="user-first-name"
              value={formValues.firstName}
              onChange={(event) => setFormValues((current) => ({ ...current, firstName: event.target.value }))}
            />
          </div>
          <div className="grid gap-2 text-sm text-foreground">
            <Label htmlFor="user-last-name">{t('account.fields.lastName')}</Label>
            <Input
              id="user-last-name"
              value={formValues.lastName}
              onChange={(event) => setFormValues((current) => ({ ...current, lastName: event.target.value }))}
            />
          </div>
          <div className="grid gap-2 text-sm text-foreground">
            <Label htmlFor="user-display-name">{t('account.fields.displayName')}</Label>
            <Input
              id="user-display-name"
              value={formValues.displayName}
              onChange={(event) => setFormValues((current) => ({ ...current, displayName: event.target.value }))}
            />
          </div>
          <div className="grid gap-2 text-sm text-foreground">
            <Label htmlFor="user-email">{t('account.fields.email')}</Label>
            <Input
              id="user-email"
              type="email"
              value={formValues.email}
              onChange={(event) => setFormValues((current) => ({ ...current, email: event.target.value }))}
            />
          </div>
          <div className="grid gap-2 text-sm text-foreground md:col-span-2">
            <Label htmlFor="user-phone">{t('account.fields.phone')}</Label>
            <Input
              id="user-phone"
              value={formValues.phone}
              onChange={(event) => setFormValues((current) => ({ ...current, phone: event.target.value }))}
            />
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
            <Select
              id="user-status"
              value={formValues.status}
              onChange={(event) =>
                setFormValues((current) => ({
                  ...current,
                  status: event.target.value as 'active' | 'inactive' | 'pending',
                }))
              }
              className="rounded-md border border-border bg-background px-3 py-2 text-foreground"
            >
              <option value="active">{t('account.status.active')}</option>
              <option value="inactive">{t('account.status.inactive')}</option>
              <option value="pending">{t('account.status.pending')}</option>
            </Select>
          </div>
          <div className="grid gap-2 text-sm text-foreground">
            <Label htmlFor="user-language">{t('account.fields.language')}</Label>
            <Input
              id="user-language"
              value={formValues.preferredLanguage}
              onChange={(event) => setFormValues((current) => ({ ...current, preferredLanguage: event.target.value }))}
            />
          </div>
          <div className="grid gap-2 text-sm text-foreground">
            <Label htmlFor="user-timezone">{t('account.fields.timezone')}</Label>
            <Input
              id="user-timezone"
              value={formValues.timezone}
              onChange={(event) => setFormValues((current) => ({ ...current, timezone: event.target.value }))}
            />
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
                        setFormValues((current) => ({
                          ...current,
                          roleIds: event.target.checked
                            ? appendUnique(current.roleIds, role.id)
                            : current.roleIds.filter((entry) => entry !== role.id),
                        }));
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
                const membershipValidity = currentMembership ? formatTraceValidity(currentMembership) : null;
                return (
                  <Label
                    key={group.id}
                    className="flex items-start gap-2 rounded border border-border bg-background px-3 py-2 text-sm text-foreground"
                  >
                    <Checkbox
                      type="checkbox"
                      checked={selected}
                      onChange={(event) => {
                        setFormValues((current) => ({
                          ...current,
                          groupIds: event.target.checked
                            ? appendUnique(current.groupIds, group.id)
                            : current.groupIds.filter((entry) => entry !== group.id),
                        }));
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
            <Label htmlFor="user-mainserver-app-id">{t('admin.users.edit.mainserverApplicationIdLabel')}</Label>
            <Input
              id="user-mainserver-app-id"
              value={formValues.mainserverUserApplicationId}
              onChange={(event) =>
                setFormValues((current) => ({
                  ...current,
                  mainserverUserApplicationId: event.target.value,
                }))
              }
            />
          </div>
          <div className="grid gap-2 text-sm text-foreground md:col-span-2">
            <Label htmlFor="user-mainserver-app-secret">{t('admin.users.edit.mainserverApplicationSecretLabel')}</Label>
            <Input
              id="user-mainserver-app-secret"
              type="password"
              autoComplete="new-password"
              value={formValues.mainserverUserApplicationSecret}
              placeholder={t('admin.users.edit.mainserverApplicationSecretPlaceholder')}
              onChange={(event) =>
                setFormValues((current) => ({
                  ...current,
                  mainserverUserApplicationSecret: event.target.value,
                }))
              }
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
          <div className="grid gap-2 text-sm text-foreground md:col-span-2">
            <Label htmlFor="user-notes">{t('admin.users.edit.notesLabel')}</Label>
            <Textarea
              id="user-notes"
              value={formValues.notes}
              maxLength={2000}
              onChange={(event) => setFormValues((current) => ({ ...current, notes: event.target.value }))}
            />
            <span className="text-xs text-muted-foreground">
              {t('admin.users.edit.notesCounter', { count: formValues.notes.length })}
            </span>
          </div>
        </section>

        <section
          id="user-edit-panel-permissions"
          role="tabpanel"
          aria-labelledby="user-edit-tab-permissions"
          hidden={activeTab !== 'permissions'}
          className="space-y-4 rounded-xl border border-border bg-card p-4 shadow-shell"
        >
          <div className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">{t('admin.users.edit.permissionTrace.title')}</h2>
            <p className="text-sm text-muted-foreground">{t('admin.users.edit.permissionTrace.description')}</p>
          </div>

          {effectivePermissionTrace.length > 0 ? (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-foreground">{t('admin.users.edit.permissionTrace.effectiveTitle')}</h3>
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
              <h3 className="text-sm font-medium text-foreground">{t('admin.users.edit.permissionTrace.inactiveTitle')}</h3>
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
                <li key={permission} className="rounded border border-border bg-background px-3 py-2">
                  {permission}
                </li>
              ))}
            </ul>
          ) : null}

          {effectivePermissionTrace.length === 0 &&
          inactivePermissionTrace.length === 0 &&
          (!userApi.user.permissions || userApi.user.permissions.length === 0) ? (
            <p className="text-sm text-muted-foreground">{t('admin.users.edit.permissionsEmpty')}</p>
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
            <h2 className="text-lg font-semibold text-foreground">{t('admin.users.edit.organizations.title')}</h2>
            <p className="text-sm text-muted-foreground">{t('admin.users.edit.organizations.description')}</p>
          </div>

          <div className="grid gap-3 rounded-lg border border-border bg-background p-3 md:grid-cols-2">
            <div className="md:col-span-2">
              <SearchableSelect
                id="user-organization-select"
                label={t('admin.users.edit.organizations.selectLabel')}
                value={organizationAssignment.organizationId}
                placeholder={t('admin.users.edit.organizations.selectPlaceholder')}
                searchPlaceholder={t('admin.users.edit.organizations.searchPlaceholder')}
                emptyText={t('admin.users.edit.organizations.empty')}
                options={availableOrganizations.map((organization) => ({
                  value: organization.id,
                  label: `${organization.displayName} (${organization.organizationKey})`,
                  keywords: [organization.displayName, organization.organizationKey],
                }))}
                onValueChange={(organizationId) =>
                  setOrganizationAssignment((current) => ({ ...current, organizationId }))
                }
              />
            </div>
            <Label htmlFor="user-organization-default" className="flex items-center gap-2 text-sm text-foreground">
              <Checkbox
                id="user-organization-default"
                checked={organizationAssignment.isDefaultContext}
                onChange={(event) =>
                  setOrganizationAssignment((current) => ({ ...current, isDefaultContext: event.target.checked }))
                }
              />
              <span>{t('admin.users.edit.organizations.assignDefaultLabel')}</span>
            </Label>
            <div className="md:col-span-2 flex justify-end">
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
                  visibility: membership.visibility,
                  isDefaultContext: membership.isDefaultContext,
                };

                return (
                  <li
                    key={membership.organizationId}
                    className="grid gap-3 rounded-lg border border-border bg-background p-3 md:grid-cols-2"
                  >
                    <div className="space-y-1 md:col-span-2">
                      <p className="font-medium text-foreground">{membership.displayName}</p>
                      <p className="text-xs text-muted-foreground">{membership.organizationKey}</p>
                      <p className="text-xs text-muted-foreground">
                        {t('admin.users.edit.organizations.createdAt', { value: formatDateTime(membership.createdAt) })}
                      </p>
                    </div>
                    <div className="grid gap-1 text-sm text-foreground">
                      <Label htmlFor={`organization-visibility-${membership.organizationId}`}>
                        {t('admin.users.edit.organizations.membershipVisibilityLabel', { name: membership.displayName })}
                      </Label>
                      <Select
                        id={`organization-visibility-${membership.organizationId}`}
                        value={draft.visibility}
                        onChange={(event) =>
                          updateOrganizationMembershipDraft(membership.organizationId, {
                            visibility: event.target.value as 'internal' | 'external',
                          })
                        }
                      >
                        <option value="internal">{t('admin.users.edit.organizations.visibility.internal')}</option>
                        <option value="external">{t('admin.users.edit.organizations.visibility.external')}</option>
                      </Select>
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
                    <div className="md:col-span-2 flex flex-wrap justify-end gap-3">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => void saveOrganizationMembership(membership.organizationId)}
                      >
                        {t('admin.users.edit.organizations.updateAction', { name: membership.displayName })}
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        onClick={() => void removeOrganizationMembership(membership.organizationId)}
                      >
                        {t('admin.users.edit.organizations.removeAction', { name: membership.displayName })}
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">{t('admin.users.edit.organizations.empty')}</p>
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
                  <Button type="button" size="sm" variant="outline" onClick={() => void reloadTimeline()}>
                    {t('admin.users.edit.historyRetry')}
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          ) : isLoadingTimeline ? (
            <p className="text-sm text-muted-foreground">{t('admin.users.edit.historyLoading')}</p>
          ) : timeline.length > 0 ? (
            <ul className="space-y-3">
              {timeline.map((entry) => {
                const metadataText = formatMetadata(entry.metadata);
                return (
                  <li key={entry.id} className="rounded-lg border border-border bg-background p-3">
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
                      <span>{t('admin.users.edit.historyOccurredAt', { value: formatDateTime(entry.occurredAt) })}</span>
                      {metadataText ? <span>{t('admin.users.edit.historyMetadata', { value: metadataText })}</span> : null}
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
          <Alert className="border-destructive/40 bg-destructive/10 text-destructive">
            <AlertDescription className="flex flex-col gap-3">
              <span>{userErrorMessage(mutationError, 'mutation')}</span>
              <IamRuntimeDiagnosticDetails error={mutationError} />
            </AlertDescription>
          </Alert>
        ) : null}
        {invitationStatus === 'failed' ? (
          <Alert className="border-secondary/40 bg-secondary/10 text-secondary" role="status">
            <AlertDescription>{invitationErrorMessage ?? t('admin.users.edit.invitationWarning')}</AlertDescription>
          </Alert>
        ) : null}
        {saveSuccess ? (
          <Alert className="border-primary/40 bg-primary/10 text-primary" role="status">
            <AlertDescription>{t('admin.users.edit.saveSuccess')}</AlertDescription>
          </Alert>
        ) : null}
        {passwordSetupEmailSuccess ? (
          <Alert className="border-primary/40 bg-primary/10 text-primary" role="status">
            <AlertDescription>{t('admin.users.edit.passwordSetupEmailSuccess')}</AlertDescription>
          </Alert>
        ) : null}

        <div className="flex flex-wrap justify-end gap-3">
          <Button type="button" variant="outline" onClick={resetFormValues}>
            {t('account.actions.cancel')}
          </Button>
          <Button type="submit" disabled={isSaving}>
            {isSaving ? t('account.actions.saving') : t('admin.users.edit.save')}
          </Button>
        </div>
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
