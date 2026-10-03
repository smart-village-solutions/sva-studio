import React from 'react';
import { getStudioFormFieldProps, StudioPersistentFormError } from '@sva/studio-ui-react';
import { IamRuntimeDiagnosticDetails } from '../../../components/iam-runtime-diagnostic-details';
import { Alert, AlertDescription } from '../../../components/ui/alert';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { SearchableSelect } from '../../../components/ui/searchable-select';
import { t } from '../../../i18n';
import type { IamHttpError } from '../../../lib/iam-api';
import { FieldHelp, INSTANCE_FIELD_HELP } from './-field-help';
import { getErrorMessage } from './-instance-error-messages';
import { ReviewRow } from './-instance-create-review';
import type { CreateFormValues } from './-instances-shared-types';

type FieldProps = {
  formValues: CreateFormValues;
  updateForm: (updater: (current: CreateFormValues) => CreateFormValues) => void;
  fieldErrorProps: (fieldId: string) => ReturnType<typeof getStudioFormFieldProps>['controlProps'];
  renderFieldError: (fieldId: string) => React.ReactNode;
};

const FormLabelWithHelp = ({
  htmlFor,
  label,
  helpKey,
}: {
  htmlFor: string;
  label: string;
  helpKey: keyof typeof INSTANCE_FIELD_HELP;
}) => {
  const help = INSTANCE_FIELD_HELP[helpKey];
  return (
    <div className="flex items-center gap-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      <FieldHelp {...help} />
    </div>
  );
};

export const CreateBasicsStep = ({
  formValues,
  updateForm,
  fieldErrorProps,
  renderFieldError,
  branding,
  suggestedParentDomain,
}: FieldProps & {
  branding: string;
  suggestedParentDomain: string;
}) => (
  <div className="space-y-4">
    <ReviewRow
      label={t('admin.instances.wizard.studioInstanceLabel')}
      value={
        branding === 'kassel-dialog'
          ? t('admin.instances.wizard.studioInstanceKassel')
          : t('admin.instances.wizard.studioInstanceSva')
      }
    />
    <div className="grid gap-3 md:grid-cols-2">
      <div className="space-y-1">
        <FormLabelWithHelp
          htmlFor="instance-id"
          label={t('admin.instances.form.instanceId')}
          helpKey="instanceId"
        />
        <Input
          {...fieldErrorProps('instance-id')}
          value={formValues.instanceId}
          onChange={(event) =>
            updateForm((current) => ({
              ...current,
              instanceId: event.target.value,
              authRealm: current.realmMode === 'new' ? event.target.value : current.authRealm,
            }))
          }
        />
        {renderFieldError('instance-id')}
      </div>
      <div className="space-y-1">
        <FormLabelWithHelp
          htmlFor="instance-display-name"
          label={t('admin.instances.form.displayName')}
          helpKey="displayName"
        />
        <Input
          {...fieldErrorProps('instance-display-name')}
          value={formValues.displayName}
          onChange={(event) =>
            updateForm((current) => ({ ...current, displayName: event.target.value }))
          }
        />
        {renderFieldError('instance-display-name')}
      </div>
    </div>
    <div className="space-y-1">
      <FormLabelWithHelp
        htmlFor="instance-parent-domain"
        label={t('admin.instances.form.parentDomain')}
        helpKey="parentDomain"
      />
      <Input
        {...fieldErrorProps('instance-parent-domain')}
        value={formValues.parentDomain}
        placeholder={suggestedParentDomain || undefined}
        onChange={(event) =>
          updateForm((current) => ({ ...current, parentDomain: event.target.value }))
        }
      />
      {renderFieldError('instance-parent-domain')}
      <p className="break-all text-sm text-muted-foreground" aria-live="polite">
        {formValues.instanceId && formValues.parentDomain
          ? `${formValues.instanceId.trim()}.${formValues.parentDomain.trim()}`
          : null}
      </p>
    </div>
  </div>
);

export const CreateAuthStep = ({
  formValues,
  updateForm,
  fieldErrorProps,
  renderFieldError,
  realmOptions,
  selectedRealmOption,
  realmSearch,
  setRealmSearch,
  realmCatalogError,
  errorFor,
}: FieldProps & {
  realmOptions: React.ComponentProps<typeof SearchableSelect>['options'];
  selectedRealmOption: React.ComponentProps<typeof SearchableSelect>['selectedOption'];
  realmSearch: string;
  setRealmSearch: (value: string) => void;
  realmCatalogError: IamHttpError | null;
  errorFor: (fieldId: string) => { readonly message: string } | undefined;
}) => (
  <div className="space-y-4">
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-medium text-foreground">
          {t('admin.instances.flow.realmModeTitle')}
        </h2>
        <FieldHelp {...INSTANCE_FIELD_HELP.realmMode} />
      </div>
      <p className="text-xs text-muted-foreground">{t('admin.instances.flow.realmModeSubtitle')}</p>
    </div>
    <div className="grid gap-2 md:grid-cols-2">
      <label className="flex items-start gap-2 rounded-md border border-border p-3 text-sm">
        <input
          type="radio"
          name="instance-realm-mode"
          checked={formValues.realmMode === 'new'}
          onChange={() =>
            updateForm((current) => ({
              ...current,
              realmMode: 'new',
              authRealm: current.instanceId,
              authClientId: 'sva-studio-login',
              authIssuerUrl: '',
              authClientSecret: '',
              tenantAdminClient: {
                clientId: 'sva-studio-realm-admin',
                secret: '',
              },
            }))
          }
        />
        <span>{t('admin.instances.flow.realmModeNew')}</span>
      </label>
      <label className="flex items-start gap-2 rounded-md border border-border p-3 text-sm">
        <input
          type="radio"
          name="instance-realm-mode"
          checked={formValues.realmMode === 'existing'}
          onChange={() =>
            updateForm((current) => ({
              ...current,
              realmMode: 'existing',
              authRealm: '',
            }))
          }
        />
        <span>{t('admin.instances.flow.realmModeExisting')}</span>
      </label>
    </div>
    {formValues.realmMode === 'new' ? (
      <>
        <Input
          readOnly
          aria-label={t('admin.instances.form.authRealm')}
          value={formValues.authRealm}
          {...fieldErrorProps('instance-auth-realm')}
        />
        {renderFieldError('instance-auth-realm')}
        <Alert>
          <AlertDescription>{t('admin.instances.wizard.newRealmBaselineSummary')}</AlertDescription>
        </Alert>
        <details className="rounded-lg border border-border p-3">
          <summary className="cursor-pointer text-sm font-medium text-foreground">
            {t('admin.instances.wizard.technicalDetails')}
          </summary>
          <p className="mt-2 text-xs text-muted-foreground">
            {t('admin.instances.wizard.existingRealmTechnicalDetails', {
              loginClient: 'sva-studio-login',
              adminClient: 'sva-studio-realm-admin',
            })}
          </p>
        </details>
      </>
    ) : (
      <>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Label htmlFor="instance-auth-realm">{t('admin.instances.form.authRealm')}</Label>
            <FieldHelp {...INSTANCE_FIELD_HELP.authRealm} />
          </div>
          <SearchableSelect
            id="instance-auth-realm"
            label={t('admin.instances.form.authRealm')}
            showLabel={false}
            value={formValues.authRealm}
            placeholder={t('admin.instances.wizard.realmCatalog.placeholder')}
            searchPlaceholder={t('admin.instances.wizard.realmCatalog.search')}
            emptyText={t('admin.instances.wizard.realmCatalog.empty')}
            options={realmOptions}
            selectedOption={selectedRealmOption}
            searchValue={realmSearch}
            onSearchValueChange={setRealmSearch}
            onValueChange={(value) => updateForm((current) => ({ ...current, authRealm: value }))}
            ariaInvalid={Boolean(errorFor('instance-auth-realm')) || undefined}
            describedBy={errorFor('instance-auth-realm') ? 'instance-auth-realm-error' : undefined}
          />
          {renderFieldError('instance-auth-realm')}
          {realmCatalogError ? (
            <StudioPersistentFormError
              message={getErrorMessage(realmCatalogError)}
              details={<IamRuntimeDiagnosticDetails error={realmCatalogError} />}
            />
          ) : null}
        </div>
        <details className="rounded-lg border border-border p-3">
          <summary className="cursor-pointer text-sm font-medium text-foreground">
            {t('admin.instances.wizard.technicalDetails')}
          </summary>
          <p className="mt-2 text-xs text-muted-foreground">
            {t('admin.instances.wizard.existingRealmTechnicalDetails', {
              loginClient: 'sva-studio-login',
              adminClient: 'sva-studio-realm-admin',
            })}
          </p>
        </details>
      </>
    )}
  </div>
);

export const CreateTenantAdminStep = ({
  formValues,
  updateForm,
  fieldErrorProps,
  renderFieldError,
}: FieldProps) => (
  <div className="space-y-4">
    <div className="space-y-1">
      <h2 className="text-sm font-medium text-foreground">
        {t('admin.instances.form.tenantAdminTitle')}
      </h2>
      <p className="text-xs text-muted-foreground">
        {t('admin.instances.form.tenantAdminSubtitle')}
      </p>
    </div>
    <div className="grid gap-3 md:grid-cols-2">
      <div className="space-y-1">
        <FormLabelWithHelp
          htmlFor="instance-admin-username"
          label={t('admin.instances.form.tenantAdminUsername')}
          helpKey="tenantAdminUsername"
        />
        <Input
          {...fieldErrorProps('instance-admin-username')}
          value={formValues.tenantAdminBootstrap.username}
          onChange={(event) =>
            updateForm((current) => ({
              ...current,
              tenantAdminBootstrap: {
                ...current.tenantAdminBootstrap,
                username: event.target.value,
              },
            }))
          }
        />
        {renderFieldError('instance-admin-username')}
      </div>
      <div className="space-y-1">
        <FormLabelWithHelp
          htmlFor="instance-admin-email"
          label={t('admin.instances.form.tenantAdminEmail')}
          helpKey="tenantAdminEmail"
        />
        <Input
          type="email"
          {...fieldErrorProps('instance-admin-email')}
          value={formValues.tenantAdminBootstrap.email}
          onChange={(event) =>
            updateForm((current) => ({
              ...current,
              tenantAdminBootstrap: {
                ...current.tenantAdminBootstrap,
                email: event.target.value,
              },
            }))
          }
        />
        {renderFieldError('instance-admin-email')}
      </div>
    </div>
    <div className="grid gap-3 md:grid-cols-2">
      <div className="space-y-1">
        <FormLabelWithHelp
          htmlFor="instance-admin-first-name"
          label={t('admin.instances.form.tenantAdminFirstName')}
          helpKey="tenantAdminFirstName"
        />
        <Input
          {...fieldErrorProps('instance-admin-first-name')}
          value={formValues.tenantAdminBootstrap.firstName}
          onChange={(event) =>
            updateForm((current) => ({
              ...current,
              tenantAdminBootstrap: {
                ...current.tenantAdminBootstrap,
                firstName: event.target.value,
              },
            }))
          }
        />
        {renderFieldError('instance-admin-first-name')}
      </div>
      <div className="space-y-1">
        <FormLabelWithHelp
          htmlFor="instance-admin-last-name"
          label={t('admin.instances.form.tenantAdminLastName')}
          helpKey="tenantAdminLastName"
        />
        <Input
          {...fieldErrorProps('instance-admin-last-name')}
          value={formValues.tenantAdminBootstrap.lastName}
          onChange={(event) =>
            updateForm((current) => ({
              ...current,
              tenantAdminBootstrap: {
                ...current.tenantAdminBootstrap,
                lastName: event.target.value,
              },
            }))
          }
        />
        {renderFieldError('instance-admin-last-name')}
      </div>
    </div>
    <p className="text-xs text-muted-foreground">
      {t('admin.instances.wizard.tenantAdminOptional')}
    </p>
  </div>
);
