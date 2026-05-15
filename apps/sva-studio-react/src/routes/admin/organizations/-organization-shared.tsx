import type {
  IamOrganizationDetail,
  IamOrganizationListItem,
  IamOrganizationType,
} from '@sva/core';
import React from 'react';

import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Select } from '../../../components/ui/select';
import { t, type TranslationKey } from '../../../i18n';
import type { IamHttpError } from '../../../lib/iam-api';

export type OrganizationContentAuthorPolicy = 'org_only' | 'org_or_personal';

export type OrganizationFormValues = {
  organizationKey: string;
  displayName: string;
  organizationType: IamOrganizationType;
  parentOrganizationId: string;
  contentAuthorPolicy: OrganizationContentAuthorPolicy;
};

type OrganizationParentOption = Pick<IamOrganizationListItem, 'id' | 'displayName'>;

const ORGANIZATION_TYPE_KEYS = {
  county: 'admin.organizations.types.county',
  municipality: 'admin.organizations.types.municipality',
  district: 'admin.organizations.types.district',
  company: 'admin.organizations.types.company',
  agency: 'admin.organizations.types.agency',
  other: 'admin.organizations.types.other',
} satisfies Record<IamOrganizationType, TranslationKey>;

export const organizationTypeOptions = Object.keys(ORGANIZATION_TYPE_KEYS) as IamOrganizationType[];
export const getOrganizationTypeTranslationKey = (type: IamOrganizationType) => ORGANIZATION_TYPE_KEYS[type];

export const createOrganizationFormValues = (): OrganizationFormValues => ({
  organizationKey: '',
  displayName: '',
  organizationType: 'other',
  parentOrganizationId: '',
  contentAuthorPolicy: 'org_only',
});

export const toOrganizationFormValues = (
  organization: Pick<
    IamOrganizationDetail,
    'organizationKey' | 'displayName' | 'organizationType' | 'parentOrganizationId' | 'contentAuthorPolicy'
  >
): OrganizationFormValues => ({
  organizationKey: organization.organizationKey,
  displayName: organization.displayName,
  organizationType: organization.organizationType,
  parentOrganizationId: organization.parentOrganizationId ?? '',
  contentAuthorPolicy: organization.contentAuthorPolicy,
});

export const toOrganizationMutationPayload = (values: OrganizationFormValues) => ({
  organizationKey: values.organizationKey.trim(),
  displayName: values.displayName.trim(),
  organizationType: values.organizationType,
  parentOrganizationId: values.parentOrganizationId || undefined,
  contentAuthorPolicy: values.contentAuthorPolicy,
});

export const getOrganizationParentOptions = (
  organizations: readonly OrganizationParentOption[],
  excludeOrganizationId?: string
) =>
  organizations.filter((organization) => organization.id !== excludeOrganizationId);

export const organizationErrorMessage = (error: IamHttpError | null): string => {
  if (!error) {
    return t('admin.organizations.messages.error');
  }

  switch (error.code) {
    case 'forbidden':
      return t('admin.organizations.errors.forbidden');
    case 'csrf_validation_failed':
      return t('admin.organizations.errors.csrfValidationFailed');
    case 'rate_limited':
      return t('admin.organizations.errors.rateLimited');
    case 'conflict':
      return t('admin.organizations.errors.conflict');
    case 'invalid_organization_id':
      return t('admin.organizations.errors.invalidOrganization');
    case 'organization_inactive':
      return t('admin.organizations.errors.organizationInactive');
    case 'database_unavailable':
      return t('admin.organizations.errors.databaseUnavailable');
    default:
      return t('admin.organizations.messages.error');
  }
};

type OrganizationFormProps = {
  readonly actions?: React.ReactNode;
  readonly excludeOrganizationId?: string;
  readonly organizations: readonly OrganizationParentOption[];
  readonly onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  readonly setFormValues: React.Dispatch<React.SetStateAction<OrganizationFormValues>>;
  readonly submitLabel: string;
  readonly formValues: OrganizationFormValues;
};

export const OrganizationForm = ({
  actions,
  excludeOrganizationId,
  organizations,
  onSubmit,
  setFormValues,
  submitLabel,
  formValues,
}: OrganizationFormProps) => {
  const parentOptions = getOrganizationParentOptions(organizations, excludeOrganizationId);

  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <div className="grid gap-1 text-sm text-foreground">
        <Label htmlFor="organization-key">{t('admin.organizations.form.keyLabel')}</Label>
        <Input
          id="organization-key"
          value={formValues.organizationKey}
          onChange={(event) => setFormValues((current) => ({ ...current, organizationKey: event.target.value }))}
        />
      </div>
      <div className="grid gap-1 text-sm text-foreground">
        <Label htmlFor="organization-name">{t('admin.organizations.form.nameLabel')}</Label>
        <Input
          id="organization-name"
          value={formValues.displayName}
          onChange={(event) => setFormValues((current) => ({ ...current, displayName: event.target.value }))}
        />
      </div>
      <div className="grid gap-1 text-sm text-foreground md:grid-cols-2 md:gap-4">
        <div className="grid gap-1">
          <Label htmlFor="organization-type">{t('admin.organizations.form.typeLabel')}</Label>
          <Select
            id="organization-type"
            value={formValues.organizationType}
            onChange={(event) =>
              setFormValues((current) => ({
                ...current,
                organizationType: event.target.value as IamOrganizationType,
              }))
            }
          >
            {organizationTypeOptions.map((type) => (
              <option key={type} value={type}>
                {t(ORGANIZATION_TYPE_KEYS[type])}
              </option>
            ))}
          </Select>
        </div>
        <div className="grid gap-1">
          <Label htmlFor="organization-policy">{t('admin.organizations.form.policyLabel')}</Label>
          <Select
            id="organization-policy"
            value={formValues.contentAuthorPolicy}
            onChange={(event) =>
              setFormValues((current) => ({
                ...current,
                contentAuthorPolicy: event.target.value as OrganizationContentAuthorPolicy,
              }))
            }
          >
            <option value="org_only">{t('admin.organizations.policies.orgOnly')}</option>
            <option value="org_or_personal">{t('admin.organizations.policies.orgOrPersonal')}</option>
          </Select>
        </div>
      </div>
      <div className="grid gap-1 text-sm text-foreground">
        <Label htmlFor="organization-parent">{t('admin.organizations.form.parentLabel')}</Label>
        <Select
          id="organization-parent"
          value={formValues.parentOrganizationId}
          onChange={(event) => setFormValues((current) => ({ ...current, parentOrganizationId: event.target.value }))}
        >
          <option value="">{t('admin.organizations.form.parentNone')}</option>
          {parentOptions.map((organization) => (
            <option key={organization.id} value={organization.id}>
              {organization.displayName}
            </option>
          ))}
        </Select>
      </div>
      <div className="flex justify-end gap-2">
        {actions}
        <Button type="submit">{submitLabel}</Button>
      </div>
    </form>
  );
};
