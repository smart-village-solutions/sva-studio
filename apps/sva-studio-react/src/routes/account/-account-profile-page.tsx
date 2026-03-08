import type { IamUserDetail } from '@sva/core';
import React from 'react';

import { asIamError, getMyProfile, IamHttpError, updateMyProfile } from '../../lib/iam-api';
import { t } from '../../i18n';
import { useAuth } from '../../providers/auth-provider';

type ProfileFormValues = {
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
  firstName: profile.firstName ?? '',
  lastName: profile.lastName ?? '',
  displayName: profile.displayName,
  phone: profile.phone ?? '',
  position: profile.position ?? '',
  department: profile.department ?? '',
  preferredLanguage: profile.preferredLanguage ?? 'de',
  timezone: profile.timezone ?? 'Europe/Berlin',
});

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

const getSecuritySettingsHref = () => {
  return import.meta.env.VITE_KEYCLOAK_ACCOUNT_URL ?? '/auth/login?redirect=%2Faccount';
};

export const AccountProfilePage = () => {
  const { user, isAuthenticated } = useAuth();

  const [profile, setProfile] = React.useState<IamUserDetail | null>(null);
  const [formValues, setFormValues] = React.useState<ProfileFormValues>(EMPTY_FORM);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [loadError, setLoadError] = React.useState<IamHttpError | null>(null);
  const [saveError, setSaveError] = React.useState<IamHttpError | null>(null);
  const [saveSuccess, setSaveSuccess] = React.useState(false);
  const [validationErrors, setValidationErrors] = React.useState<ProfileErrors>({});
  const errorSummaryRef = React.useRef<HTMLDivElement>(null);

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
      const response = await updateMyProfile({
        firstName: formValues.firstName.trim(),
        lastName: formValues.lastName.trim(),
        displayName: formValues.displayName.trim(),
        phone: formValues.phone.trim() || undefined,
        position: formValues.position.trim() || undefined,
        department: formValues.department.trim() || undefined,
        preferredLanguage: formValues.preferredLanguage.trim() || undefined,
        timezone: formValues.timezone.trim() || undefined,
      });

      setProfile(response.data);
      setFormValues(toFormValues(response.data));
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
        <h1 className="text-3xl font-semibold text-slate-100">{t('account.profile.title')}</h1>
        <p role="status" className="text-sm text-slate-300">
          {t('account.messages.loading')}
        </p>
      </section>
    );
  }

  if (!isAuthenticated && !profile) {
    return (
      <div className="rounded-xl border border-amber-600/40 bg-amber-500/10 p-4 text-sm text-amber-100" role="status">
        {t('account.messages.notAuthenticated')}
      </div>
    );
  }

  if (loadError && !profile) {
    return (
      <section className="space-y-4">
        <h1 className="text-3xl font-semibold text-slate-100">{t('account.profile.title')}</h1>
        <div className="rounded-xl border border-red-600/40 bg-red-500/10 p-4 text-sm text-red-100" role="alert">
          <p>{t('account.messages.loadError')}</p>
          <button
            type="button"
            className="mt-3 rounded-md border border-red-500/60 px-3 py-2 text-xs font-semibold uppercase tracking-wide"
            onClick={() => void loadProfile()}
          >
            {t('account.actions.retry')}
          </button>
        </div>
      </section>
    );
  }

  const statusKey = profile?.status ? statusTranslationKeyByValue[profile.status] : statusTranslationKeyByValue.pending;

  return (
    <section className="space-y-6" aria-busy={isSaving}>
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold text-slate-100">{t('account.profile.title')}</h1>
        <p className="max-w-2xl text-sm text-slate-300">{t('account.profile.subtitle')}</p>
      </header>

      <div className="grid gap-4 rounded-xl border border-slate-700 bg-slate-900/50 p-4 text-sm text-slate-200 sm:grid-cols-2">
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
      </div>

      {Object.keys(validationErrors).length > 0 ? (
        <div
          ref={errorSummaryRef}
          tabIndex={-1}
          role="alert"
          className="rounded-xl border border-red-600/40 bg-red-500/10 p-4 text-sm text-red-100"
        >
          <p className="font-semibold">{t('account.messages.validationSummary')}</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {Object.values(validationErrors).map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {saveError ? (
        <div className="rounded-xl border border-red-600/40 bg-red-500/10 p-4 text-sm text-red-100" role="alert">
          {t('account.messages.saveError')}
        </div>
      ) : null}
      {saveSuccess ? (
        <div className="rounded-xl border border-emerald-600/40 bg-emerald-500/10 p-4 text-sm text-emerald-100" role="status">
          {t('account.messages.saveSuccess')}
        </div>
      ) : null}

      <form className="grid gap-4 md:grid-cols-2" onSubmit={onSubmit} noValidate>
        <label className="flex flex-col gap-2 text-sm text-slate-200">
          <span>{t('account.fields.firstName')}</span>
          <input
            value={formValues.firstName}
            onChange={(event) => onFieldChange('firstName', event.target.value)}
            className="rounded-md border border-slate-600 bg-slate-950 px-3 py-2"
            aria-invalid={Boolean(validationErrors.firstName)}
          />
        </label>
        <label className="flex flex-col gap-2 text-sm text-slate-200">
          <span>{t('account.fields.lastName')}</span>
          <input
            value={formValues.lastName}
            onChange={(event) => onFieldChange('lastName', event.target.value)}
            className="rounded-md border border-slate-600 bg-slate-950 px-3 py-2"
            aria-invalid={Boolean(validationErrors.lastName)}
          />
        </label>
        <label className="flex flex-col gap-2 text-sm text-slate-200">
          <span>{t('account.fields.displayName')}</span>
          <input
            value={formValues.displayName}
            onChange={(event) => onFieldChange('displayName', event.target.value)}
            className="rounded-md border border-slate-600 bg-slate-950 px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-2 text-sm text-slate-200">
          <span>{t('account.fields.phone')}</span>
          <input
            value={formValues.phone}
            onChange={(event) => onFieldChange('phone', event.target.value)}
            className="rounded-md border border-slate-600 bg-slate-950 px-3 py-2"
            aria-invalid={Boolean(validationErrors.phone)}
          />
        </label>
        <label className="flex flex-col gap-2 text-sm text-slate-200">
          <span>{t('account.fields.position')}</span>
          <input
            value={formValues.position}
            onChange={(event) => onFieldChange('position', event.target.value)}
            className="rounded-md border border-slate-600 bg-slate-950 px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-2 text-sm text-slate-200">
          <span>{t('account.fields.department')}</span>
          <input
            value={formValues.department}
            onChange={(event) => onFieldChange('department', event.target.value)}
            className="rounded-md border border-slate-600 bg-slate-950 px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-2 text-sm text-slate-200">
          <span>{t('account.fields.language')}</span>
          <select
            value={formValues.preferredLanguage}
            onChange={(event) => onFieldChange('preferredLanguage', event.target.value)}
            className="rounded-md border border-slate-600 bg-slate-950 px-3 py-2"
          >
            <option value="de">Deutsch</option>
            <option value="en">English</option>
          </select>
        </label>
        <label className="flex flex-col gap-2 text-sm text-slate-200">
          <span>{t('account.fields.timezone')}</span>
          <input
            value={formValues.timezone}
            onChange={(event) => onFieldChange('timezone', event.target.value)}
            className="rounded-md border border-slate-600 bg-slate-950 px-3 py-2"
          />
        </label>

        <div className="md:col-span-2 flex flex-wrap items-center gap-3">
          <button
            type="submit"
            className="rounded-md border border-emerald-600 bg-emerald-500/20 px-4 py-2 text-sm font-semibold text-emerald-100"
            disabled={isSaving}
          >
            {isSaving ? t('account.actions.saving') : t('account.actions.save')}
          </button>
          <a
            href={getSecuritySettingsHref()}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-md border border-slate-600 px-4 py-2 text-sm font-semibold text-slate-100"
            aria-label={t('account.actions.openSecuritySettingsAria')}
          >
            {t('account.actions.openSecuritySettings')} [extern]
          </a>
          <p className="text-xs text-slate-400">{t('account.messages.keycloakRedirectHint')}</p>
        </div>
      </form>
    </section>
  );
};
