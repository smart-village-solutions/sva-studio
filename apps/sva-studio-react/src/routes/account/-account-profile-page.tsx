import type { IamUserDetail } from '@sva/core';
import { Link } from '@tanstack/react-router';
import React from 'react';

import { asIamError, getMyProfile, IamHttpError, updateMyProfile } from '../../lib/iam-api';
import { IamRuntimeDiagnosticDetails } from '../../components/iam-runtime-diagnostic-details';
import { Alert, AlertDescription, AlertTitle } from '../../components/ui/alert';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select } from '../../components/ui/select';
import { t } from '../../i18n';
import { createLoginHref, resolveCurrentReturnTo } from '../../lib/auth-navigation';
import { notifyIamUsersUpdated } from '../../lib/iam-user-events';
import { useAuth } from '../../providers/auth-provider';

type ProfileFormValues = {
  firstName: string;
  lastName: string;
  phone: string;
  position: string;
  department: string;
  preferredLanguage: string;
};

type ProfileErrors = Partial<Record<keyof ProfileFormValues, string>>;

const EMPTY_FORM: ProfileFormValues = {
  firstName: '',
  lastName: '',
  phone: '',
  position: '',
  department: '',
  preferredLanguage: '',
};

const statusTranslationKeyByValue = {
  active: 'account.status.active',
  inactive: 'account.status.inactive',
  pending: 'account.status.pending',
} as const;

const toFormValues = (profile: IamUserDetail): ProfileFormValues => ({
  firstName: profile.firstName ?? '',
  lastName: profile.lastName ?? '',
  phone: profile.phone ?? '',
  position: profile.position ?? '',
  department: profile.department ?? '',
  preferredLanguage: profile.preferredLanguage ?? 'de',
});

const deriveDisplayName = (firstName: string, lastName: string): string =>
  [firstName.trim(), lastName.trim()].filter(Boolean).join(' ');

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

const validateForm = (values: ProfileFormValues): ProfileErrors => {
  const errors: ProfileErrors = {};

  if (!values.firstName.trim()) {
    errors.firstName = t('account.validation.firstNameRequired');
  }
  if (!values.lastName.trim()) {
    errors.lastName = t('account.validation.lastNameRequired');
  }

  if (values.phone.trim() && !/^\+?[0-9()\-\s]{6,20}$/.test(values.phone.trim())) {
    errors.phone = t('account.validation.phoneInvalid');
  }

  return errors;
};

const getLoadErrorDescription = (error: IamHttpError) => {
  if (error.recommendedAction === 'erneut_anmelden' || error.status === 401) {
    return t('account.diagnostics.sessionRecovery');
  }

  switch (error.classification) {
    case 'actor_resolution_or_membership':
      return t('account.diagnostics.actorResolutionOrMembership');
    case 'database_or_schema_drift':
      return t('account.diagnostics.databaseOrSchemaDrift');
    case 'registry_or_provisioning_drift':
      return t('account.diagnostics.registryOrProvisioningDrift');
    case 'keycloak_dependency':
    case 'keycloak_reconcile':
      return t('account.diagnostics.keycloakDependency');
    default:
      return t('account.messages.loadError');
  }
};

export const AccountProfilePage = () => {
  const { user, isAuthenticated, isLoading: isAuthLoading, hasResolvedSession } = useAuth();

  const [profile, setProfile] = React.useState<IamUserDetail | null>(null);
  const [formValues, setFormValues] = React.useState<ProfileFormValues>(EMPTY_FORM);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [loadError, setLoadError] = React.useState<IamHttpError | null>(null);
  const [saveError, setSaveError] = React.useState<IamHttpError | null>(null);
  const [saveSuccess, setSaveSuccess] = React.useState(false);
  const [validationErrors, setValidationErrors] = React.useState<ProfileErrors>({});
  const errorSummaryRef = React.useRef<HTMLDivElement>(null);
  const successMessageRef = React.useRef<HTMLDivElement>(null);
  const loginHref = React.useMemo(() => createLoginHref(resolveCurrentReturnTo()), []);

  const loadProfile = React.useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);

    try {
      const response = await getMyProfile();
      setProfile(response.data);
      setFormValues(toFormValues(response.data));
    } catch (cause) {
      setLoadError(asIamError(cause));
      setProfile(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (isAuthLoading || !hasResolvedSession) {
      return;
    }

    if (!isAuthenticated) {
      setProfile(null);
      setLoadError(null);
      setIsLoading(false);
      return;
    }

    void loadProfile();
  }, [hasResolvedSession, isAuthenticated, isAuthLoading, loadProfile]);

  React.useEffect(() => {
    if (Object.keys(validationErrors).length > 0) {
      errorSummaryRef.current?.focus();
    }
  }, [validationErrors]);

  React.useEffect(() => {
    if (saveSuccess) {
      successMessageRef.current?.focus();
    }
  }, [saveSuccess]);

  const onFieldChange = (field: keyof ProfileFormValues, value: string) => {
    setFormValues((current) => ({
      ...current,
      [field]: value,
    }));
    setSaveSuccess(false);
    setSaveError(null);
  };

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const nextErrors = validateForm(formValues);
    setValidationErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      const nextDerivedDisplayName = deriveDisplayName(formValues.firstName, formValues.lastName);

      const response = await updateMyProfile({
        firstName: formValues.firstName.trim(),
        lastName: formValues.lastName.trim(),
        displayName: nextDerivedDisplayName,
        phone: formValues.phone.trim() || undefined,
        position: formValues.position.trim() || undefined,
        department: formValues.department.trim() || undefined,
        preferredLanguage: formValues.preferredLanguage.trim() || undefined,
      });

      setProfile(response.data);
      setFormValues(toFormValues(response.data));
      notifyIamUsersUpdated();
      setSaveSuccess(true);
      setValidationErrors({});
    } catch (cause) {
      setSaveError(asIamError(cause));
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading || isAuthLoading || !hasResolvedSession) {
    return (
      <section aria-busy="true" className="space-y-3">
        <h1 className="text-3xl font-semibold text-foreground">{t('account.profile.title')}</h1>
        <p role="status" className="text-sm text-muted-foreground">
          {t('account.messages.loading')}
        </p>
      </section>
    );
  }

  if (!isAuthenticated && !profile) {
    return (
      <Alert className="border-secondary/40 bg-secondary/10 text-sm text-secondary" role="status">
        <AlertDescription className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <span>{t('account.messages.notAuthenticated')}</span>
          <Button asChild variant="outline">
            <a href={loginHref}>{t('shell.header.login')}</a>
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  if (loadError && !profile) {
    const isUnauthorized = loadError.status === 401;
    return (
      <section className="space-y-4">
        <h1 className="text-3xl font-semibold text-foreground">{t('account.profile.title')}</h1>
        <Alert className="border-destructive/40 bg-destructive/10 text-destructive">
          <AlertTitle>{isUnauthorized ? t('account.messages.notAuthenticated') : t('account.messages.loadError')}</AlertTitle>
          <AlertDescription className="mt-3">
            <div className="space-y-3">
              <p>{getLoadErrorDescription(loadError)}</p>
              <IamRuntimeDiagnosticDetails error={loadError} />
              <div className="flex flex-wrap gap-3">
                {isUnauthorized ? (
                  <Button asChild type="button" variant="outline">
                    <a href={loginHref}>{t('shell.header.login')}</a>
                  </Button>
                ) : (
                  <Button type="button" variant="outline" onClick={() => void loadProfile()}>
                    {t('account.actions.retry')}
                  </Button>
                )}
              </div>
            </div>
          </AlertDescription>
        </Alert>
      </section>
    );
  }

  const statusKey = profile?.status ? statusTranslationKeyByValue[profile.status] : statusTranslationKeyByValue.pending;
  const displayName =
    profile?.displayName ??
    deriveDisplayName(formValues.firstName, formValues.lastName) ??
    user?.id ??
    '-';
  const email = profile?.email ?? '-';
  const roleNames = profile?.roles.map((role) => role.roleName).join(', ') || '-';

  return (
    <section className="space-y-5" aria-busy={isSaving}>
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold text-foreground">{t('account.profile.title')}</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">{t('account.profile.subtitle')}</p>
      </header>

      <Card className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full border border-border bg-background text-lg font-semibold text-foreground">
            {pickInitials(displayName)}
          </div>
          <div>
            <h2 className="text-2xl font-semibold text-foreground">{displayName}</h2>
            <p className="text-sm text-muted-foreground">{email}</p>
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              <Badge variant="outline">{t(statusKey)}</Badge>
              {profile?.roles.length ? (
                profile.roles.map((role) => (
                  <Badge key={role.roleId} variant="outline" className="h-auto items-start py-1">
                    <span className="block">{role.roleName}</span>
                  </Badge>
                ))
              ) : (
                <Badge variant="outline">{t('account.fields.role')}: -</Badge>
              )}
            </div>
          </div>
        </div>
        <div className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{t('account.fields.lastLogin')}: </span>
          {formatDateTime(profile?.lastLoginAt)}
        </div>
      </Card>

      {Object.keys(validationErrors).length > 0 ? (
        <Alert
          ref={errorSummaryRef}
          tabIndex={-1}
          className="border-destructive/40 bg-destructive/10 text-destructive"
        >
          <AlertTitle>{t('account.messages.validationSummary')}</AlertTitle>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {Object.values(validationErrors).map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        </Alert>
      ) : null}

      {saveError ? (
        <Alert className="border-destructive/40 bg-destructive/10 text-destructive">
          <AlertDescription className="flex flex-col gap-3">
            <span>{t('account.messages.saveError')}</span>
            <IamRuntimeDiagnosticDetails error={saveError} />
          </AlertDescription>
        </Alert>
      ) : null}
      {saveSuccess ? (
        <Alert
          ref={successMessageRef}
          tabIndex={-1}
          className="border-primary/40 bg-primary/10 text-primary"
          role="status"
        >
          <AlertDescription>{t('account.messages.saveSuccess')}</AlertDescription>
        </Alert>
      ) : null}

      <Card className="border-secondary/40 bg-secondary/10">
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">{t('account.privacy.cta.title')}</h2>
            <p className="text-sm text-muted-foreground">{t('account.privacy.cta.body')}</p>
          </div>
          <Button asChild variant="outline">
            <Link to="/account/privacy">{t('account.privacy.cta.action')}</Link>
          </Button>
        </CardContent>
      </Card>

      <form className="space-y-4" onSubmit={onSubmit} noValidate>
        <section className="grid gap-4 rounded-xl border border-border bg-card p-4 shadow-shell md:grid-cols-2">
          <div className="grid gap-2 text-sm text-foreground">
            <Label htmlFor="account-first-name">{t('account.fields.firstName')}</Label>
            <Input
              id="account-first-name"
              autoComplete="given-name"
              value={formValues.firstName}
              onChange={(event) => onFieldChange('firstName', event.target.value)}
              aria-invalid={Boolean(validationErrors.firstName)}
            />
          </div>
          <div className="grid gap-2 text-sm text-foreground">
            <Label htmlFor="account-last-name">{t('account.fields.lastName')}</Label>
            <Input
              id="account-last-name"
              autoComplete="family-name"
              value={formValues.lastName}
              onChange={(event) => onFieldChange('lastName', event.target.value)}
              aria-invalid={Boolean(validationErrors.lastName)}
            />
          </div>
          <div className="grid gap-2 text-sm text-foreground md:col-span-2">
            <Label htmlFor="account-phone">{t('account.fields.phone')}</Label>
            <Input
              id="account-phone"
              autoComplete="tel"
              value={formValues.phone}
              onChange={(event) => onFieldChange('phone', event.target.value)}
              aria-invalid={Boolean(validationErrors.phone)}
            />
          </div>
        </section>

        <section className="grid gap-4 rounded-xl border border-border bg-card p-4 shadow-shell md:grid-cols-2">
          <div className="grid gap-2 text-sm text-foreground">
            <Label htmlFor="account-position">{t('account.fields.position')}</Label>
            <Input
              id="account-position"
              value={formValues.position}
              onChange={(event) => onFieldChange('position', event.target.value)}
            />
          </div>
          <div className="grid gap-2 text-sm text-foreground">
            <Label htmlFor="account-department">{t('account.fields.department')}</Label>
            <Input
              id="account-department"
              value={formValues.department}
              onChange={(event) => onFieldChange('department', event.target.value)}
            />
          </div>
          <div className="grid gap-2 text-sm text-foreground">
            <Label htmlFor="account-language">{t('account.fields.language')}</Label>
            <Select
              id="account-language"
              value={formValues.preferredLanguage}
              onChange={(event) => onFieldChange('preferredLanguage', event.target.value)}
            >
              <option value="de">Deutsch</option>
              <option value="en">English</option>
            </Select>
          </div>
          <div className="grid gap-2 text-sm text-foreground">
            <Label htmlFor="account-status-readonly">{t('account.fields.status')}</Label>
            <Input id="account-status-readonly" value={t(statusKey)} readOnly aria-readonly="true" />
          </div>
          <div className="grid gap-2 text-sm text-foreground md:col-span-2">
            <Label htmlFor="account-roles-readonly">{t('account.fields.role')}</Label>
            <Input id="account-roles-readonly" value={roleNames} readOnly aria-readonly="true" />
          </div>
        </section>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={isSaving}>
            {isSaving ? t('account.actions.saving') : t('account.actions.save')}
          </Button>
        </div>
      </form>
    </section>
  );
};
