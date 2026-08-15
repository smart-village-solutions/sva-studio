import { Button } from '@sva/studio-ui-react';
import React from 'react';

import { IamRuntimeDiagnosticDetails } from '../../components/iam-runtime-diagnostic-details';
import { Alert, AlertDescription, AlertTitle } from '../../components/ui/alert';
import { t } from '../../i18n';
import type { IamHttpError } from '../../lib/iam-api';
import { createLoginHref, resolveCurrentReturnTo } from '../../lib/auth-navigation';
import { hasPlatformInstanceAdminAccess } from '../../lib/iam-admin-access';
import { useAuth } from '../../providers/auth-provider';
import { AccountProfileForm } from './-account-profile-form';
import {
  getProfileLoadErrorTranslationKey,
  readAccountActionStatus,
} from './-account-profile-model';
import { AccountProfileSummary } from './-account-profile-summary';
import { useAccountProfile } from './-use-account-profile';

const statusTranslationKeyByValue = {
  active: 'account.status.active',
  inactive: 'account.status.inactive',
  pending: 'account.status.pending',
} as const;

const AccountProfileLoading = () => (
  <section aria-busy="true" className="space-y-3">
    <h1 className="text-3xl font-semibold text-foreground">{t('account.profile.title')}</h1>
    <p role="status" className="text-sm text-muted-foreground">
      {t('account.messages.loading')}
    </p>
  </section>
);

const AccountProfileUnauthenticated = ({ loginHref }: { loginHref: string }) => (
  <Alert className="border-secondary/40 bg-secondary/10 text-sm text-secondary" role="status">
    <AlertDescription className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
      <span>{t('account.messages.notAuthenticated')}</span>
      <Button asChild variant="secondary">
        <a href={loginHref}>{t('shell.header.login')}</a>
      </Button>
    </AlertDescription>
  </Alert>
);

type LoadErrorProps = Readonly<{
  error: IamHttpError;
  loginHref: string;
  onRetry: () => void;
}>;

const AccountProfileLoadError = ({ error, loginHref, onRetry }: LoadErrorProps) => {
  const isUnauthorized = error.status === 401;
  return (
    <section className="space-y-4">
      <h1 className="text-3xl font-semibold text-foreground">{t('account.profile.title')}</h1>
      <Alert className="border-destructive/40 bg-destructive/10 text-destructive">
        <AlertTitle>
          {isUnauthorized
            ? t('account.messages.notAuthenticated')
            : t('account.messages.loadError')}
        </AlertTitle>
        <AlertDescription className="mt-3">
          <div className="space-y-3">
            <p>{t(getProfileLoadErrorTranslationKey(error))}</p>
            <IamRuntimeDiagnosticDetails error={error} />
            <div className="flex flex-wrap gap-3">
              {isUnauthorized ? (
                <Button asChild type="button" variant="secondary">
                  <a href={loginHref}>{t('shell.header.login')}</a>
                </Button>
              ) : (
                <Button type="button" variant="secondary" onClick={onRetry}>
                  {t('account.actions.retry')}
                </Button>
              )}
            </div>
          </div>
        </AlertDescription>
      </Alert>
    </section>
  );
};

export const AccountProfilePage = () => {
  const { user, isAuthenticated, isLoading: isAuthLoading, hasResolvedSession } = useAuth();
  const isProfileReadOnly =
    user !== null && !user.instanceId && hasPlatformInstanceAdminAccess(user);
  const accountActionStatus = readAccountActionStatus(
    typeof window === 'undefined' ? undefined : window.location.search
  );
  const loginHref = React.useMemo(() => createLoginHref(resolveCurrentReturnTo()), []);
  const accountProfile = useAccountProfile({
    hasResolvedSession,
    isAuthenticated,
    isAuthLoading,
    isProfileReadOnly,
  });

  if (accountProfile.isLoading || isAuthLoading || !hasResolvedSession) {
    return <AccountProfileLoading />;
  }
  if (!isAuthenticated && !accountProfile.profile) {
    return <AccountProfileUnauthenticated loginHref={loginHref} />;
  }
  if (accountProfile.loadError && !accountProfile.profile) {
    return (
      <AccountProfileLoadError
        error={accountProfile.loadError}
        loginHref={loginHref}
        onRetry={() => void accountProfile.retryLoad()}
      />
    );
  }

  const statusKey = accountProfile.profile?.status
    ? statusTranslationKeyByValue[accountProfile.profile.status]
    : statusTranslationKeyByValue.pending;
  const roleNames = accountProfile.profile?.roles.map((role) => role.roleName).join(', ') || '-';
  const keycloakRoleNames = accountProfile.profile?.keycloakRoles?.join(', ') || '-';

  return (
    <section className="space-y-5" aria-busy={accountProfile.saveFeedback.status === 'saving'}>
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold text-foreground">{t('account.profile.title')}</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">{t('account.profile.subtitle')}</p>
      </header>
      <AccountProfileSummary
        accountActionStatus={accountActionStatus}
        fallbackUserId={user?.id}
        formValues={accountProfile.formValues}
        isProfileReadOnly={isProfileReadOnly}
        profile={accountProfile.profile}
      />
      <AccountProfileForm
        errorSummaryRef={accountProfile.errorSummaryRef}
        formValues={accountProfile.formValues}
        isProfileReadOnly={isProfileReadOnly}
        keycloakRoleNames={keycloakRoleNames}
        onFieldChange={accountProfile.onFieldChange}
        onSave={() => void accountProfile.saveProfile()}
        roleNames={roleNames}
        saveError={accountProfile.saveError}
        saveStatus={accountProfile.saveFeedback.status}
        statusLabel={t(statusKey)}
        validationErrors={accountProfile.validationErrors}
      />
    </section>
  );
};
