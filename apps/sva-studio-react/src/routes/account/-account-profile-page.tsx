import type { IamUserDetail } from '@sva/core';
import { Link } from '@tanstack/react-router';
import React from 'react';

import { asIamError, getMyProfile, IamHttpError, updateMyProfile } from '../../lib/iam-api';
import { Alert, AlertDescription, AlertTitle } from '../../components/ui/alert';
import { Button } from '../../components/ui/button';
import { Card, CardContent } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select } from '../../components/ui/select';
import { t } from '../../i18n';
import { notifyIamUsersUpdated } from '../../lib/iam-user-events';
import { useAuth } from '../../providers/auth-provider';

type ProfileFormValues = {
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  displayName: string;
  phone: string;
  position: string;
  department: string;
  preferredLanguage: string;
  timezone: string;
};

type ProfileErrors = Partial<Record<keyof ProfileFormValues, string>>;

const EMPTY_FORM: ProfileFormValues = {
  username: '',
  email: '',
  firstName: '',
  lastName: '',
  displayName: '',
  phone: '',
  position: '',
  department: '',
  preferredLanguage: '',
  timezone: '',
};

const statusTranslationKeyByValue = {
  active: 'account.status.active',
  inactive: 'account.status.inactive',
  pending: 'account.status.pending',
} as const;

const toFormValues = (profile: IamUserDetail): ProfileFormValues => ({
  username: profile.username ?? profile.email ?? '',
  email: profile.email ?? '',
  firstName: profile.firstName ?? '',
  lastName: profile.lastName ?? '',
  displayName: profile.displayName,
  phone: profile.phone ?? '',
  position: profile.position ?? '',
  department: profile.department ?? '',
  preferredLanguage: profile.preferredLanguage ?? 'de',
  timezone: profile.timezone ?? 'Europe/Berlin',
});

const normalize = (value?: string | null): string => value?.trim() ?? '';

const deriveDisplayName = (firstName: string, lastName: string): string =>
  [firstName.trim(), lastName.trim()].filter(Boolean).join(' ');

const validateForm = (values: ProfileFormValues): ProfileErrors => {
  const errors: ProfileErrors = {};

  if (!values.username.trim() || /\s/.test(values.username.trim())) {
    errors.username = t('account.validation.usernameInvalid');
  }
  if (!values.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(values.email.trim())) {
    errors.email = t('account.validation.emailInvalid');
  }
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

export const AccountProfilePage = () => {
  const { user, isAuthenticated, updateProfile } = useAuth();

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

  const loadProfile = React.useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);

    try {
      const response = await getMyProfile();
      setProfile(response.data);
      setFormValues(toFormValues(response.data));
    } catch (cause) {
      const resolvedError = asIamError(cause);
      setLoadError(resolvedError);
      setProfile(null);
      if (user) {
        setFormValues((current) => ({
          ...current,
          displayName: user.name,
        }));
      }
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  React.useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

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
      const previousDisplayName = normalize(profile?.displayName);
      const previousDerivedDisplayName = deriveDisplayName(profile?.firstName ?? '', profile?.lastName ?? '');
      const nextDerivedDisplayName = deriveDisplayName(formValues.firstName, formValues.lastName);
      const nextDisplayName = (() => {
        const trimmedDisplayName = formValues.displayName.trim();
        if (!trimmedDisplayName) {
          return nextDerivedDisplayName;
        }
        if (trimmedDisplayName === previousDisplayName && previousDisplayName === previousDerivedDisplayName) {
          return nextDerivedDisplayName;
        }
        return trimmedDisplayName;
      })();

      const response = await updateMyProfile({
        username: formValues.username.trim(),
        email: formValues.email.trim(),
        firstName: formValues.firstName.trim(),
        lastName: formValues.lastName.trim(),
        displayName: nextDisplayName,
        phone: formValues.phone.trim() || undefined,
        position: formValues.position.trim() || undefined,
        department: formValues.department.trim() || undefined,
        preferredLanguage: formValues.preferredLanguage.trim() || undefined,
        timezone: formValues.timezone.trim() || undefined,
      });

      setProfile(response.data);
      setFormValues(toFormValues(response.data));
      updateProfile({
        name: response.data.displayName,
        email: response.data.email,
      });
      notifyIamUsersUpdated();
      setSaveSuccess(true);
      setValidationErrors({});
    } catch (cause) {
      setSaveError(asIamError(cause));
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
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
        <AlertDescription>{t('account.messages.notAuthenticated')}</AlertDescription>
      </Alert>
    );
  }

  if (loadError && !profile) {
    return (
      <section className="space-y-4">
        <h1 className="text-3xl font-semibold text-foreground">{t('account.profile.title')}</h1>
        <Alert className="border-destructive/40 bg-destructive/10 text-destructive">
          <AlertTitle>{t('account.messages.loadError')}</AlertTitle>
          <AlertDescription className="mt-3">
            <Button type="button" variant="outline" onClick={() => void loadProfile()}>
              {t('account.actions.retry')}
            </Button>
          </AlertDescription>
        </Alert>
      </section>
    );
  }

  const statusKey = profile?.status ? statusTranslationKeyByValue[profile.status] : statusTranslationKeyByValue.pending;

  return (
    <section className="space-y-6" aria-busy={isSaving}>
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold text-foreground">{t('account.profile.title')}</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">{t('account.profile.subtitle')}</p>
      </header>

      <Card>
        <CardContent className="grid gap-4 p-4 text-sm text-foreground sm:grid-cols-2">
          <p>
          <span className="font-semibold">{t('account.fields.username')}: </span>
          {profile?.username ?? profile?.email ?? '-'}
          </p>
          <p>
          <span className="font-semibold">{t('account.fields.email')}: </span>
          {profile?.email ?? user?.email ?? '-'}
          </p>
          <p>
          <span className="font-semibold">{t('account.fields.role')}: </span>
          {profile?.roles.map((role) => role.roleName).join(', ') || '-'}
          </p>
          <p>
          <span className="font-semibold">{t('account.fields.status')}: </span>
          {t(statusKey)}
          </p>
          <p>
          <span className="font-semibold">{t('account.fields.lastLogin')}: </span>
          {profile?.lastLoginAt ?? '-'}
          </p>
        </CardContent>
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
          <AlertDescription>{t('account.messages.saveError')}</AlertDescription>
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

      <form className="grid gap-4 md:grid-cols-2" onSubmit={onSubmit} noValidate>
        <div className="grid gap-2 text-sm text-foreground">
          <Label htmlFor="account-username">{t('account.fields.username')}</Label>
          <Input
            id="account-username"
            autoComplete="username"
            value={formValues.username}
            onChange={(event) => onFieldChange('username', event.target.value)}
            aria-invalid={Boolean(validationErrors.username)}
          />
        </div>
        <div className="grid gap-2 text-sm text-foreground">
          <Label htmlFor="account-email">{t('account.fields.email')}</Label>
          <Input
            id="account-email"
            type="email"
            autoComplete="email"
            value={formValues.email}
            onChange={(event) => onFieldChange('email', event.target.value)}
            aria-invalid={Boolean(validationErrors.email)}
          />
        </div>
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
        <div className="grid gap-2 text-sm text-foreground">
          <Label htmlFor="account-display-name">{t('account.fields.displayName')}</Label>
          <Input
            id="account-display-name"
            autoComplete="name"
            value={formValues.displayName}
            onChange={(event) => onFieldChange('displayName', event.target.value)}
          />
        </div>
        <div className="grid gap-2 text-sm text-foreground">
          <Label htmlFor="account-phone">{t('account.fields.phone')}</Label>
          <Input
            id="account-phone"
            autoComplete="tel"
            value={formValues.phone}
            onChange={(event) => onFieldChange('phone', event.target.value)}
            aria-invalid={Boolean(validationErrors.phone)}
          />
        </div>
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
          <Label htmlFor="account-timezone">{t('account.fields.timezone')}</Label>
          <Input
            id="account-timezone"
            value={formValues.timezone}
            onChange={(event) => onFieldChange('timezone', event.target.value)}
          />
        </div>

        <div className="md:col-span-2 flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={isSaving}>
            {isSaving ? t('account.actions.saving') : t('account.actions.save')}
          </Button>
        </div>
      </form>
    </section>
  );
};
