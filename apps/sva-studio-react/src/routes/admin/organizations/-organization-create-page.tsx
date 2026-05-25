import { StudioDetailPageTemplate } from '@sva/studio-ui-react';
import { Link, useNavigate } from '@tanstack/react-router';
import React from 'react';

import { Alert, AlertDescription } from '../../../components/ui/alert';
import { Button } from '../../../components/ui/button';
import { Card } from '../../../components/ui/card';
import { useOrganizations } from '../../../hooks/use-organizations';
import { t } from '../../../i18n';
import { listOrganizations } from '../../../lib/iam-api';
import {
  areOrganizationParentOptionsEqual,
  createOrganizationFormValues,
  loadAllOrganizationParentOptions,
  mergeOrganizationParentOptions,
  OrganizationForm,
  type OrganizationParentOption,
  organizationErrorMessage,
  suggestOrganizationKey,
  toOrganizationMutationPayload,
} from './-organization-shared';

export const OrganizationCreatePage = () => {
  const navigate = useNavigate();
  const organizationsApi = useOrganizations();
  const [formValues, setFormValues] = React.useState(createOrganizationFormValues);
  const [organizationKeyMode, setOrganizationKeyMode] = React.useState<'auto' | 'manual'>('auto');
  const [parentOrganizations, setParentOrganizations] = React.useState<readonly OrganizationParentOption[]>(
    () => organizationsApi.organizations
  );

  React.useEffect(() => {
    setParentOrganizations((current) => {
      const next = mergeOrganizationParentOptions(current, organizationsApi.organizations);
      return areOrganizationParentOptionsEqual(current, next) ? current : next;
    });
  }, [organizationsApi.organizations]);

  React.useEffect(() => {
    let active = true;

    const loadParentOrganizations = async () => {
      try {
        const organizations = await loadAllOrganizationParentOptions((query) => listOrganizations(query));
        if (!active) {
          return;
        }
        setParentOrganizations((current) => {
          const next = mergeOrganizationParentOptions(current, organizations);
          return areOrganizationParentOptionsEqual(current, next) ? current : next;
        });
      } catch {
        // Fall back to the currently loaded page when the full options load is unavailable.
      }
    };

    void loadParentOrganizations();

    return () => {
      active = false;
    };
  }, []);

  const generatedOrganizationKey = React.useMemo(
    () => suggestOrganizationKey(formValues.displayName, parentOrganizations),
    [formValues.displayName, parentOrganizations]
  );

  React.useEffect(() => {
    if (organizationKeyMode !== 'auto') {
      return;
    }

    setFormValues((current) =>
      current.organizationKey === generatedOrganizationKey
        ? current
        : { ...current, organizationKey: generatedOrganizationKey }
    );
  }, [generatedOrganizationKey, organizationKeyMode]);

  const onOrganizationKeyChange = (value: string) => {
    const nextKey = value;
    const normalizedTypedKey = nextKey.trim().toLocaleLowerCase();
    const normalizedGeneratedKey = generatedOrganizationKey.trim().toLocaleLowerCase();
    setOrganizationKeyMode(normalizedTypedKey.length === 0 || normalizedTypedKey === normalizedGeneratedKey ? 'auto' : 'manual');
    setFormValues((current) => ({ ...current, organizationKey: nextKey }));
  };

  const onDisplayNameChange = (value: string) => {
    setFormValues((current) => ({
      ...current,
      displayName: value,
      ...(organizationKeyMode === 'auto'
        ? {
            organizationKey: suggestOrganizationKey(value, parentOrganizations),
          }
        : {}),
    }));
  };

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const submittedValues =
      organizationKeyMode === 'auto'
        ? {
            ...formValues,
            organizationKey: suggestOrganizationKey(formValues.displayName, parentOrganizations),
          }
        : formValues;
    const created = await organizationsApi.createOrganization(toOrganizationMutationPayload(submittedValues));

    if (!created) {
      return;
    }

    await navigate({
      to: '/admin/organizations/$organizationId',
      params: { organizationId: created.id },
    });
  };

  return (
    <section className="space-y-5" aria-busy={organizationsApi.isLoading}>
      <div>
        <Button asChild type="button" variant="outline">
          <Link to="/admin/organizations">{t('admin.organizations.detail.backToList')}</Link>
        </Button>
      </div>

      <StudioDetailPageTemplate
        title={t('admin.organizations.createDialog.title')}
        description={t('admin.organizations.createDialog.description')}
      >
        <Card className="space-y-4 p-5">
          <OrganizationForm
            organizations={parentOrganizations}
            onSubmit={(event) => void onSubmit(event)}
            onDisplayNameChange={onDisplayNameChange}
            onOrganizationKeyChange={onOrganizationKeyChange}
            setFormValues={setFormValues}
            submitLabel={t('admin.organizations.actions.create')}
            formValues={formValues}
            actions={
              <Button asChild type="button" variant="outline">
                <Link to="/admin/organizations">{t('account.actions.cancel')}</Link>
              </Button>
            }
          />
        </Card>

        {organizationsApi.mutationError ? (
          <Alert className="border-destructive/40 bg-destructive/10 text-destructive">
            <AlertDescription>{organizationErrorMessage(organizationsApi.mutationError)}</AlertDescription>
          </Alert>
        ) : null}
      </StudioDetailPageTemplate>
    </section>
  );
};
