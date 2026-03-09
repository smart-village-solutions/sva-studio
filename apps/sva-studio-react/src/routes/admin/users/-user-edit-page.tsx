import React from 'react';

import { ConfirmDialog } from '../../../components/ConfirmDialog';
import { useRoles } from '../../../hooks/use-roles';
import { useUser } from '../../../hooks/use-user';
import { t } from '../../../i18n';
import type { IamHttpError } from '../../../lib/iam-api';

type UserEditPageProps = {
  readonly userId: string;
};

type UserEditTabKey = 'personal' | 'management' | 'permissions' | 'history';

type UserFormValues = {
  firstName: string;
  lastName: string;
  displayName: string;
  email: string;
  phone: string;
  position: string;
  department: string;
  status: 'active' | 'inactive' | 'pending';
  preferredLanguage: string;
  timezone: string;
  notes: string;
  roleIds: string[];
};

const TABS: ReadonlyArray<{ key: UserEditTabKey; labelKey: 'personal' | 'management' | 'permissions' | 'history' }> = [
  { key: 'personal', labelKey: 'personal' },
  { key: 'management', labelKey: 'management' },
  { key: 'permissions', labelKey: 'permissions' },
  { key: 'history', labelKey: 'history' },
];

const tabTranslationKeyByValue = {
  personal: 'admin.users.edit.tab.personal',
  management: 'admin.users.edit.tab.management',
  permissions: 'admin.users.edit.tab.permissions',
  history: 'admin.users.edit.tab.history',
} as const;

const statusTranslationKeyByValue = {
  active: 'account.status.active',
  inactive: 'account.status.inactive',
  pending: 'account.status.pending',
} as const;

const toFormValues = (input: ReturnType<typeof useUser>['user']): UserFormValues => ({
  firstName: input?.firstName ?? '',
  lastName: input?.lastName ?? '',
  displayName: input?.displayName ?? '',
  email: input?.email ?? '',
  phone: input?.phone ?? '',
  position: input?.position ?? '',
  department: input?.department ?? '',
  status: input?.status ?? 'pending',
  preferredLanguage: input?.preferredLanguage ?? 'de',
  timezone: input?.timezone ?? 'Europe/Berlin',
  notes: input?.notes ?? '',
  roleIds: input?.roles.map((entry) => entry.roleId) ?? [],
});

const pickInitials = (displayName: string) => {
  const parts = displayName
    .split(' ')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .slice(0, 2);

  if (parts.length === 0) {
    return 'NA';
  }

  return parts.map((entry) => entry.charAt(0).toUpperCase()).join('');
};

export const userErrorMessage = (error: IamHttpError | null): string => {
  if (!error) {
    return t('admin.users.messages.error');
  }

  switch (error.code) {
    case 'forbidden':
      return t('admin.users.errors.forbidden');
    case 'csrf_validation_failed':
      return t('admin.users.errors.csrfValidationFailed');
    case 'rate_limited':
      return t('admin.users.errors.rateLimited');
    case 'conflict':
      return t('admin.users.errors.conflict');
    case 'keycloak_unavailable':
      return t('admin.users.errors.keycloakUnavailable');
    case 'database_unavailable':
      return t('admin.users.errors.databaseUnavailable');
    case 'last_admin_protection':
      return t('admin.users.errors.lastAdminProtection');
    case 'self_protection':
      return t('admin.users.errors.selfProtection');
    default:
      return t('admin.users.messages.error');
  }
};

export const UserEditPage = ({ userId }: UserEditPageProps) => {
  const userApi = useUser(userId);
  const rolesApi = useRoles();

  const [activeTab, setActiveTab] = React.useState<UserEditTabKey>('personal');
  const [formValues, setFormValues] = React.useState<UserFormValues>(toFormValues(null));
  const [isSaving, setIsSaving] = React.useState(false);
  const [saveSuccess, setSaveSuccess] = React.useState(false);

  const [unsavedDialogOpen, setUnsavedDialogOpen] = React.useState(false);
  const [pendingTab, setPendingTab] = React.useState<UserEditTabKey | null>(null);

  React.useEffect(() => {
    if (!userApi.user) {
      return;
    }

    setFormValues(toFormValues(userApi.user));
  }, [userApi.user]);

  const baselineSignature = React.useMemo(() => JSON.stringify(toFormValues(userApi.user)), [userApi.user]);
  const currentSignature = React.useMemo(() => JSON.stringify(formValues), [formValues]);
  const hasUnsavedChanges = baselineSignature !== currentSignature;

  React.useEffect(() => {
    if (!hasUnsavedChanges) {
      return;
    }

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, [hasUnsavedChanges]);

  const onTabIntent = (nextTab: UserEditTabKey) => {
    if (nextTab === activeTab) {
      return;
    }

    if (hasUnsavedChanges) {
      setPendingTab(nextTab);
      setUnsavedDialogOpen(true);
      return;
    }

    setActiveTab(nextTab);
  };

  const onTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, tabIndex: number) => {
    const key = event.key;
    if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(key)) {
      return;
    }

    event.preventDefault();
    if (key === 'Home') {
      onTabIntent(TABS[0].key);
      return;
    }

    if (key === 'End') {
      onTabIntent(TABS[TABS.length - 1].key);
      return;
    }

    const direction = key === 'ArrowRight' ? 1 : -1;
    const nextIndex = (tabIndex + direction + TABS.length) % TABS.length;
    onTabIntent(TABS[nextIndex].key);
  };

  const onSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);
    setSaveSuccess(false);

    const result = await userApi.save({
      firstName: formValues.firstName || undefined,
      lastName: formValues.lastName || undefined,
      displayName: formValues.displayName || undefined,
      email: formValues.email || undefined,
      phone: formValues.phone || undefined,
      position: formValues.position || undefined,
      department: formValues.department || undefined,
      status: formValues.status,
      preferredLanguage: formValues.preferredLanguage || undefined,
      timezone: formValues.timezone || undefined,
      notes: formValues.notes.slice(0, 2000) || undefined,
      roleIds: formValues.roleIds,
    });

    if (result) {
      setFormValues(toFormValues(result));
      setSaveSuccess(true);
    }

    setIsSaving(false);
  };

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
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive" role="alert">
          {userErrorMessage(userApi.error)}
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-5" aria-busy={isSaving}>
      <header className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 shadow-shell sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full border border-border bg-background text-lg font-semibold text-foreground">
            {pickInitials(userApi.user.displayName)}
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-foreground">{userApi.user.displayName}</h1>
            <p className="text-sm text-muted-foreground">{userApi.user.email ?? '-'}</p>
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              <span className="rounded border border-border bg-background px-2 py-1 text-foreground">
                {t(statusTranslationKeyByValue[userApi.user.status])}
              </span>
              {userApi.user.roles.map((role) => (
                <span key={role.roleId} className="rounded border border-border bg-background px-2 py-1 text-foreground">
                  {role.roleName}
                </span>
              ))}
            </div>
          </div>
        </div>
        <button
          type="button"
          className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground transition hover:bg-muted"
          onClick={() => void userApi.refetch()}
        >
          {t('admin.users.actions.retry')}
        </button>
      </header>

      <div role="tablist" aria-label={t('admin.users.edit.tabsAriaLabel')} className="flex overflow-x-auto rounded-lg border border-border bg-card p-1 shadow-shell">
        {TABS.map((tab, index) => {
          const selected = tab.key === activeTab;
          return (
            <button
              key={tab.key}
              id={`user-edit-tab-${tab.key}`}
              role="tab"
              type="button"
              aria-selected={selected}
              aria-controls={`user-edit-panel-${tab.key}`}
              className={`rounded-md px-3 py-2 text-sm transition ${
                selected
                  ? 'bg-primary text-primary-foreground font-semibold'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
              onClick={() => onTabIntent(tab.key)}
              onKeyDown={(event) => onTabKeyDown(event, index)}
            >
              {t(tabTranslationKeyByValue[tab.labelKey])}
            </button>
          );
        })}
      </div>

      <form className="space-y-4" onSubmit={onSave}>
        <section
          id="user-edit-panel-personal"
          role="tabpanel"
          aria-labelledby="user-edit-tab-personal"
          hidden={activeTab !== 'personal'}
          className="grid gap-4 rounded-xl border border-border bg-card p-4 shadow-shell md:grid-cols-2"
        >
          <label className="flex flex-col gap-2 text-sm text-foreground">
            <span>{t('account.fields.firstName')}</span>
            <input
              value={formValues.firstName}
              onChange={(event) => setFormValues((current) => ({ ...current, firstName: event.target.value }))}
              className="rounded-md border border-border bg-background px-3 py-2 text-foreground"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm text-foreground">
            <span>{t('account.fields.lastName')}</span>
            <input
              value={formValues.lastName}
              onChange={(event) => setFormValues((current) => ({ ...current, lastName: event.target.value }))}
              className="rounded-md border border-border bg-background px-3 py-2 text-foreground"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm text-foreground">
            <span>{t('account.fields.displayName')}</span>
            <input
              value={formValues.displayName}
              onChange={(event) => setFormValues((current) => ({ ...current, displayName: event.target.value }))}
              className="rounded-md border border-border bg-background px-3 py-2 text-foreground"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm text-foreground">
            <span>{t('account.fields.email')}</span>
            <input
              type="email"
              value={formValues.email}
              onChange={(event) => setFormValues((current) => ({ ...current, email: event.target.value }))}
              className="rounded-md border border-border bg-background px-3 py-2 text-foreground"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm text-foreground md:col-span-2">
            <span>{t('account.fields.phone')}</span>
            <input
              value={formValues.phone}
              onChange={(event) => setFormValues((current) => ({ ...current, phone: event.target.value }))}
              className="rounded-md border border-border bg-background px-3 py-2 text-foreground"
            />
          </label>
        </section>

        <section
          id="user-edit-panel-management"
          role="tabpanel"
          aria-labelledby="user-edit-tab-management"
          hidden={activeTab !== 'management'}
          className="grid gap-4 rounded-xl border border-border bg-card p-4 shadow-shell md:grid-cols-2"
        >
          <label className="flex flex-col gap-2 text-sm text-foreground">
            <span>{t('account.fields.status')}</span>
            <select
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
            </select>
          </label>
          <label className="flex flex-col gap-2 text-sm text-foreground">
            <span>{t('account.fields.language')}</span>
            <input
              value={formValues.preferredLanguage}
              onChange={(event) =>
                setFormValues((current) => ({ ...current, preferredLanguage: event.target.value }))
              }
              className="rounded-md border border-border bg-background px-3 py-2 text-foreground"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm text-foreground">
            <span>{t('account.fields.timezone')}</span>
            <input
              value={formValues.timezone}
              onChange={(event) => setFormValues((current) => ({ ...current, timezone: event.target.value }))}
              className="rounded-md border border-border bg-background px-3 py-2 text-foreground"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm text-foreground md:col-span-2">
            <span>{t('admin.users.edit.rolesLabel')}</span>
            <div className="grid gap-2 sm:grid-cols-2">
              {rolesApi.roles.map((role) => {
                const selected = formValues.roleIds.includes(role.id);
                return (
                  <label key={role.id} className="flex items-center gap-2 rounded border border-border bg-background px-3 py-2 text-sm text-foreground">
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={(event) => {
                        setFormValues((current) => ({
                          ...current,
                          roleIds: event.target.checked
                            ? [...current.roleIds, role.id]
                            : current.roleIds.filter((entry) => entry !== role.id),
                        }));
                      }}
                    />
                    <span>{role.roleName}</span>
                  </label>
                );
              })}
            </div>
          </label>
          <label className="flex flex-col gap-2 text-sm text-foreground md:col-span-2">
            <span>{t('admin.users.edit.notesLabel')}</span>
            <textarea
              value={formValues.notes}
              maxLength={2000}
              onChange={(event) => setFormValues((current) => ({ ...current, notes: event.target.value }))}
              className="min-h-[120px] rounded-md border border-border bg-background px-3 py-2 text-foreground"
            />
            <span className="text-xs text-muted-foreground">{t('admin.users.edit.notesCounter', { count: formValues.notes.length })}</span>
          </label>
        </section>

        <section
          id="user-edit-panel-permissions"
          role="tabpanel"
          aria-labelledby="user-edit-tab-permissions"
          hidden={activeTab !== 'permissions'}
          className="rounded-xl border border-border bg-card p-4 shadow-shell"
        >
          {userApi.user.permissions && userApi.user.permissions.length > 0 ? (
            <ul className="grid gap-2 text-sm text-foreground sm:grid-cols-2">
              {userApi.user.permissions.map((permission) => (
                <li key={permission} className="rounded border border-border bg-background px-3 py-2">
                  {permission}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">{t('admin.users.edit.permissionsEmpty')}</p>
          )}
        </section>

        <section
          id="user-edit-panel-history"
          role="tabpanel"
          aria-labelledby="user-edit-tab-history"
          hidden={activeTab !== 'history'}
          className="rounded-xl border border-border bg-card p-4 shadow-shell"
        >
          <p className="text-sm text-muted-foreground">{t('admin.users.edit.historyEmpty')}</p>
        </section>

        {userApi.error ? (
          <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive" role="alert">
            {userErrorMessage(userApi.error)}
          </div>
        ) : null}
        {saveSuccess ? (
          <div className="rounded-xl border border-primary/40 bg-primary/10 p-4 text-sm text-primary" role="status">
            {t('admin.users.edit.saveSuccess')}
          </div>
        ) : null}

        <div className="flex flex-wrap justify-end gap-3">
          <button
            type="button"
            className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground transition hover:bg-muted"
            onClick={() => setFormValues(toFormValues(userApi.user))}
          >
            {t('account.actions.cancel')}
          </button>
          <button
            type="submit"
            className="rounded-md border border-primary/40 bg-primary/15 px-3 py-2 text-sm font-semibold text-primary transition hover:bg-primary/20"
            disabled={isSaving}
          >
            {isSaving ? t('account.actions.saving') : t('admin.users.edit.save')}
          </button>
        </div>
      </form>

      <ConfirmDialog
        open={unsavedDialogOpen}
        title={t('admin.users.edit.unsavedDialog.title')}
        description={t('admin.users.edit.unsavedDialog.description')}
        confirmLabel={t('admin.users.edit.unsavedDialog.confirm')}
        cancelLabel={t('admin.users.edit.unsavedDialog.cancel')}
        onCancel={() => {
          setUnsavedDialogOpen(false);
          setPendingTab(null);
        }}
        onConfirm={() => {
          if (pendingTab) {
            setActiveTab(pendingTab);
          }
          setUnsavedDialogOpen(false);
          setPendingTab(null);
          setFormValues(toFormValues(userApi.user));
        }}
      />
    </section>
  );
};
