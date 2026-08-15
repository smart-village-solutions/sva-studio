import {
  StudioPersistentFormError,
  StudioSaveButton,
  type StudioSaveStatus,
} from '@sva/studio-ui-react';
import React from 'react';

import { IamRuntimeDiagnosticDetails } from '../../components/iam-runtime-diagnostic-details';
import { Alert, AlertTitle } from '../../components/ui/alert';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select } from '../../components/ui/select';
import { t } from '../../i18n';
import type { IamHttpError } from '../../lib/iam-api';
import type {
  ProfileErrors,
  ProfileField,
  ProfileFormValues,
  ProfileValidationError,
} from './-account-profile-model';

const validationTranslationKeyByError: Record<
  ProfileValidationError,
  | 'account.validation.firstNameRequired'
  | 'account.validation.lastNameRequired'
  | 'account.validation.phoneInvalid'
> = {
  firstNameRequired: 'account.validation.firstNameRequired',
  lastNameRequired: 'account.validation.lastNameRequired',
  phoneInvalid: 'account.validation.phoneInvalid',
};

type ProfileFeedbackProps = Readonly<{
  errorSummaryRef: React.RefObject<HTMLDivElement | null>;
  onRetrySave: () => void;
  saveError: IamHttpError | null;
  saveStatus: StudioSaveStatus;
  validationErrors: ProfileErrors;
}>;

const AccountProfileFeedback = ({
  errorSummaryRef,
  onRetrySave,
  saveError,
  saveStatus,
  validationErrors,
}: ProfileFeedbackProps) => (
  <>
    {Object.keys(validationErrors).length > 0 ? (
      <Alert
        ref={errorSummaryRef}
        tabIndex={-1}
        className="border-destructive/40 bg-destructive/10 text-destructive"
      >
        <AlertTitle>{t('account.messages.validationSummary')}</AlertTitle>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          {Object.values(validationErrors).map((error) => (
            <li key={error}>{t(validationTranslationKeyByError[error])}</li>
          ))}
        </ul>
      </Alert>
    ) : null}
    {saveError ? (
      <StudioPersistentFormError
        message={t('account.messages.saveError')}
        details={<IamRuntimeDiagnosticDetails error={saveError} />}
        retryLabel={t('account.actions.retry')}
        retryDisabled={saveStatus === 'saving'}
        onRetry={onRetrySave}
      />
    ) : null}
  </>
);

type EditableFieldsProps = Readonly<{
  formValues: ProfileFormValues;
  isProfileReadOnly: boolean;
  onFieldChange: (field: ProfileField, value: string) => void;
  validationErrors: ProfileErrors;
}>;

const AccountProfileIdentityFields = ({
  formValues,
  isProfileReadOnly,
  onFieldChange,
  validationErrors,
}: EditableFieldsProps) => (
  <section className="grid gap-4 rounded-xl border border-border bg-card p-4 shadow-shell md:grid-cols-2">
    <div className="grid gap-2 text-sm text-foreground">
      <Label htmlFor="account-first-name">{t('account.fields.firstName')}</Label>
      <Input
        id="account-first-name"
        autoComplete="given-name"
        value={formValues.firstName}
        disabled={isProfileReadOnly}
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
        disabled={isProfileReadOnly}
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
        disabled={isProfileReadOnly}
        onChange={(event) => onFieldChange('phone', event.target.value)}
        aria-invalid={Boolean(validationErrors.phone)}
      />
    </div>
  </section>
);

type MetadataFieldsProps = EditableFieldsProps &
  Readonly<{
    keycloakRoleNames: string;
    roleNames: string;
    statusLabel: string;
  }>;

const AccountProfileMetadataFields = ({
  formValues,
  isProfileReadOnly,
  keycloakRoleNames,
  onFieldChange,
  roleNames,
  statusLabel,
}: MetadataFieldsProps) => (
  <section className="grid gap-4 rounded-xl border border-border bg-card p-4 shadow-shell md:grid-cols-2">
    <div className="grid gap-2 text-sm text-foreground">
      <Label htmlFor="account-position">{t('account.fields.position')}</Label>
      <Input
        id="account-position"
        value={formValues.position}
        disabled={isProfileReadOnly}
        onChange={(event) => onFieldChange('position', event.target.value)}
      />
    </div>
    <div className="grid gap-2 text-sm text-foreground">
      <Label htmlFor="account-department">{t('account.fields.department')}</Label>
      <Input
        id="account-department"
        value={formValues.department}
        disabled={isProfileReadOnly}
        onChange={(event) => onFieldChange('department', event.target.value)}
      />
    </div>
    <div className="grid gap-2 text-sm text-foreground">
      <Label htmlFor="account-language">{t('account.fields.language')}</Label>
      <Select
        id="account-language"
        value={formValues.preferredLanguage}
        disabled={isProfileReadOnly}
        onChange={(event) => onFieldChange('preferredLanguage', event.target.value)}
      >
        <option value="de">Deutsch</option>
        <option value="en">English</option>
      </Select>
    </div>
    <div className="grid gap-2 text-sm text-foreground">
      <Label htmlFor="account-status-readonly">{t('account.fields.status')}</Label>
      <Input id="account-status-readonly" value={statusLabel} readOnly aria-readonly="true" />
    </div>
    <div className="grid gap-2 text-sm text-foreground md:col-span-2">
      <Label htmlFor="account-roles-readonly">{t('account.fields.role')}</Label>
      <Input id="account-roles-readonly" value={roleNames} readOnly aria-readonly="true" />
    </div>
    <div className="grid gap-2 text-sm text-foreground md:col-span-2">
      <Label htmlFor="account-keycloak-roles-readonly">{t('account.fields.keycloakRoles')}</Label>
      <Input
        id="account-keycloak-roles-readonly"
        value={keycloakRoleNames}
        readOnly
        aria-readonly="true"
      />
    </div>
  </section>
);

type AccountProfileFormProps = Readonly<{
  errorSummaryRef: React.RefObject<HTMLDivElement | null>;
  formValues: ProfileFormValues;
  isProfileReadOnly: boolean;
  keycloakRoleNames: string;
  onFieldChange: (field: ProfileField, value: string) => void;
  onSave: () => void;
  roleNames: string;
  saveError: IamHttpError | null;
  saveStatus: StudioSaveStatus;
  statusLabel: string;
  validationErrors: ProfileErrors;
}>;

export const AccountProfileForm = ({
  errorSummaryRef,
  formValues,
  isProfileReadOnly,
  keycloakRoleNames,
  onFieldChange,
  onSave,
  roleNames,
  saveError,
  saveStatus,
  statusLabel,
  validationErrors,
}: AccountProfileFormProps) => {
  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSave();
  };

  return (
    <>
      <AccountProfileFeedback
        errorSummaryRef={errorSummaryRef}
        onRetrySave={onSave}
        saveError={saveError}
        saveStatus={saveStatus}
        validationErrors={validationErrors}
      />
      <form className="space-y-4" onSubmit={onSubmit} noValidate>
        <AccountProfileIdentityFields
          formValues={formValues}
          isProfileReadOnly={isProfileReadOnly}
          onFieldChange={onFieldChange}
          validationErrors={validationErrors}
        />
        <AccountProfileMetadataFields
          formValues={formValues}
          isProfileReadOnly={isProfileReadOnly}
          keycloakRoleNames={keycloakRoleNames}
          onFieldChange={onFieldChange}
          roleNames={roleNames}
          statusLabel={statusLabel}
          validationErrors={validationErrors}
        />
        <div className="flex flex-wrap items-center gap-3">
          <StudioSaveButton
            type="submit"
            status={saveStatus}
            disabled={isProfileReadOnly}
            labels={{
              idle: t('account.actions.save'),
              saving: t('account.actions.saving'),
              saved: t('account.actions.saved'),
            }}
          />
        </div>
      </form>
    </>
  );
};
