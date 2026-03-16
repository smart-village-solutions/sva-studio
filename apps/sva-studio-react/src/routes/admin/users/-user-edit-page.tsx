import React from 'react';

import { ConfirmDialog } from '../../../components/ConfirmDialog';
import { Alert, AlertDescription } from '../../../components/ui/alert';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { Card } from '../../../components/ui/card';
import { Checkbox } from '../../../components/ui/checkbox';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Select } from '../../../components/ui/select';
import { Textarea } from '../../../components/ui/textarea';
import { useRoles } from '../../../hooks/use-roles';
import { useUser } from '../../../hooks/use-user';
import { t } from '../../../i18n';
import { getUserTimeline } from '../../../lib/iam-api';
import { userErrorMessage } from './-user-error-message';

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
  mainserverUserApplicationId: string;
  mainserverUserApplicationSecret: string;
  mainserverUserApplicationSecretSet: boolean;
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
  mainserverUserApplicationId: input?.mainserverUserApplicationId ?? '',
  mainserverUserApplicationSecret: '',
  mainserverUserApplicationSecretSet: input?.mainserverUserApplicationSecretSet ?? false,
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

const formatDateTime = (value?: string) => {
  if (!value) {
    return '—';
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
};

const formatRoleValidity = (input: { validFrom?: string; validTo?: string }) => {
  if (input.validFrom && input.validTo) {
    return t('admin.users.edit.roleValidityRange', {
      from: formatDateTime(input.validFrom),
      to: formatDateTime(input.validTo),
    });
  }
  if (input.validFrom) {
    return t('admin.users.edit.roleValidityFrom', { from: formatDateTime(input.validFrom) });
  }
  if (input.validTo) {
    return t('admin.users.edit.roleValidityTo', { to: formatDateTime(input.validTo) });
  }
  return null;
};

const formatMetadata = (metadata: Readonly<Record<string, unknown>>) => {
  if (Object.keys(metadata).length === 0) {
    return null;
  }
  return Object.entries(metadata)
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join(', ');
};

export const UserEditPage = ({ userId }: UserEditPageProps) => {
  const userApi = useUser(userId);
  const rolesApi = useRoles();

  const [activeTab, setActiveTab] = React.useState<UserEditTabKey>('personal');
  const [formValues, setFormValues] = React.useState<UserFormValues>(() => toFormValues(userApi.user));
  const [isSaving, setIsSaving] = React.useState(false);
  const [saveSuccess, setSaveSuccess] = React.useState(false);
  const [timeline, setTimeline] = React.useState<Awaited<ReturnType<typeof getUserTimeline>>['data']>([]);
  const [isLoadingTimeline, setIsLoadingTimeline] = React.useState(false);
  const [timelineError, setTimelineError] = React.useState<string | null>(null);
  const [hasLoadedTimeline, setHasLoadedTimeline] = React.useState(false);

  const [unsavedDialogOpen, setUnsavedDialogOpen] = React.useState(false);
  const [pendingTab, setPendingTab] = React.useState<UserEditTabKey | null>(null);

  React.useEffect(() => {
    if (!userApi.user) {
      return;
    }

    setFormValues(toFormValues(userApi.user));
  }, [userApi.user]);

  React.useEffect(() => {
    setTimeline([]);
    setTimelineError(null);
    setHasLoadedTimeline(false);
  }, [userId]);

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

  React.useEffect(() => {
    if (activeTab !== 'history' || hasLoadedTimeline) {
      return;
    }

    let active = true;
    setIsLoadingTimeline(true);
    setTimelineError(null);

    void getUserTimeline(userId)
      .then((response) => {
        if (!active) {
          return;
        }
        setTimeline(response.data);
        setHasLoadedTimeline(true);
      })
      .catch((error) => {
        if (!active) {
          return;
        }
        setTimeline([]);
        setTimelineError(error instanceof Error ? error.message : String(error));
      })
      .finally(() => {
        if (active) {
          setIsLoadingTimeline(false);
        }
      });

    return () => {
      active = false;
    };
  }, [activeTab, hasLoadedTimeline, userId]);

  const reloadTimeline = React.useCallback(async () => {
    setIsLoadingTimeline(true);
    setTimelineError(null);

    try {
      const response = await getUserTimeline(userId);
      setTimeline(response.data);
      setHasLoadedTimeline(true);
    } catch (error) {
      setTimeline([]);
      setTimelineError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsLoadingTimeline(false);
    }
  }, [userId]);

  const onTabIntent = (nextTab: UserEditTabKey) => {
    if (nextTab === activeTab) {
      return;
    }

    if (hasUnsavedChanges && activeTab !== 'personal') {
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
      mainserverUserApplicationId: formValues.mainserverUserApplicationId.trim(),
      mainserverUserApplicationSecret: formValues.mainserverUserApplicationSecret.trim() || undefined,
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
        <Alert className="border-destructive/40 bg-destructive/10 text-destructive">
          <AlertDescription>{userErrorMessage(userApi.error)}</AlertDescription>
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
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              <Badge variant="outline">
                {t(statusTranslationKeyByValue[userApi.user.status])}
              </Badge>
              {userApi.user.roles.map((role) => (
                <Badge key={role.roleId} variant="outline" className="h-auto items-start py-1">
                  <span className="block">{role.roleName}</span>
                  {formatRoleValidity(role) ? (
                    <span className="block text-[11px] text-muted-foreground">{formatRoleValidity(role)}</span>
                  ) : null}
                </Badge>
              ))}
            </div>
          </div>
        </div>
        <Button type="button" variant="outline" onClick={() => void userApi.refetch()}>
          {t('admin.users.actions.retry')}
        </Button>
      </Card>

      <Card role="tablist" aria-label={t('admin.users.edit.tabsAriaLabel')} className="flex overflow-x-auto p-1">
        {TABS.map((tab, index) => {
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
              {t(tabTranslationKeyByValue[tab.labelKey])}
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
              onChange={(event) =>
                setFormValues((current) => ({ ...current, preferredLanguage: event.target.value }))
              }
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
              {rolesApi.roles.map((role) => {
                const selected = formValues.roleIds.includes(role.id);
                return (
                  <Label key={role.id} className="flex items-center gap-2 rounded border border-border bg-background px-3 py-2 text-sm text-foreground">
                    <Checkbox
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
            <span className="text-xs text-muted-foreground">{t('admin.users.edit.notesCounter', { count: formValues.notes.length })}</span>
          </div>
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
                          {t(`admin.users.edit.historyCategory.${entry.category}` as const)}
                        </Badge>
                        <Badge className="rounded-full" variant="outline">
                          {t(`admin.users.edit.historyPerspective.${entry.perspective}` as const)}
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

        {userApi.error ? (
          <Alert className="border-destructive/40 bg-destructive/10 text-destructive">
            <AlertDescription>{userErrorMessage(userApi.error)}</AlertDescription>
          </Alert>
        ) : null}
        {saveSuccess ? (
          <Alert className="border-primary/40 bg-primary/10 text-primary" role="status">
            <AlertDescription>{t('admin.users.edit.saveSuccess')}</AlertDescription>
          </Alert>
        ) : null}

        <div className="flex flex-wrap justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => setFormValues(toFormValues(userApi.user))}>
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
