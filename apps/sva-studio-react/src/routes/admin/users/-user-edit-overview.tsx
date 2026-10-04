import {
  Button,
  getStudioFormFieldProps,
  StudioField,
  StudioPageTitle,
} from '@sva/studio-ui-react';

import { Alert, AlertDescription } from '../../../components/ui/alert';
import { Badge } from '../../../components/ui/badge';
import { Card } from '../../../components/ui/card';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { t } from '../../../i18n';
import type { useUserEditController } from './use-user-edit-controller';
import {
  formatDateTime,
  formatMetadata,
  formatRoleValidity,
  pickInitials,
  USER_EDIT_TABS,
  userEditTranslationKeys,
} from './user-edit-model';

type UserEditController = ReturnType<typeof useUserEditController>;
type UserEditUser = NonNullable<UserEditController['userApi']['user']>;

export const UserEditHeader = ({
  controller,
  user,
  canUpdateUser,
}: {
  controller: UserEditController;
  user: UserEditUser;
  canUpdateUser: boolean;
}) => {
  const {
    onSendPasswordSetupEmail,
    isSendingPasswordSetupEmail,
    onReprovisionMainserverData,
    isReprovisioningMainserverData,
    retryUserLoad,
  } = controller;
  return (
    <Card className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-4">
        {user.avatarUrl ? (
          <img
            src={user.avatarUrl}
            alt={t('admin.users.edit.avatarAlt', { name: user.displayName })}
            className="h-14 w-14 rounded-full border border-border object-cover"
          />
        ) : (
          <div className="flex h-14 w-14 items-center justify-center rounded-full border border-border bg-background text-lg font-semibold text-foreground">
            {pickInitials(user.displayName)}
          </div>
        )}
        <div>
          <StudioPageTitle withAccessory className="text-2xl">
            {user.displayName}
          </StudioPageTitle>
          <p className="text-sm text-muted-foreground">{user.email ?? '-'}</p>
          <p className="text-sm text-muted-foreground">
            {t('account.fields.username')}: {user.username ?? '-'}
          </p>
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            <Badge variant="outline">{t(userEditTranslationKeys.status[user.status])}</Badge>
            {user.roles.map((role) => {
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
            {user.groups?.map((group) => (
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
  );
};

export const UserEditTabs = ({ controller }: { controller: UserEditController }) => {
  const { activeTab, onTabIntent, onTabKeyDown } = controller;
  return (
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
  );
};

export const UserPersonalPanel = ({
  controller,
  user,
  emailField,
}: {
  controller: UserEditController;
  user: UserEditUser;
  emailField: ReturnType<typeof getStudioFormFieldProps>;
}) => {
  const { register } = controller.form;
  const { activeTab } = controller;
  return (
    <section
      id="user-edit-panel-personal"
      role="tabpanel"
      aria-labelledby="user-edit-tab-personal"
      hidden={activeTab !== 'personal'}
      className="grid gap-4 rounded-xl border border-border bg-card p-4 shadow-shell md:grid-cols-2"
    >
      <div className="grid gap-2 text-sm text-foreground">
        <Label htmlFor="user-username">{t('account.fields.username')}</Label>
        <Input id="user-username" value={user.username ?? ''} readOnly aria-readonly="true" />
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
  );
};

export const UserHistoryPanel = ({ controller }: { controller: UserEditController }) => {
  const { activeTab, timelineError, reloadTimeline, isLoadingTimeline, timeline } = controller;
  return (
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
                  <span>
                    {t('admin.users.edit.historyOccurredAt', {
                      value: formatDateTime(entry.occurredAt),
                    })}
                  </span>
                  {metadataText ? (
                    <span>{t('admin.users.edit.historyMetadata', { value: metadataText })}</span>
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
  );
};
