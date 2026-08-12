import {
  addStudioCreatedSaveFeedback,
  Button,
  StudioDetailPageTemplate,
  StudioPersistentFormError,
  StudioSaveButton,
  useStudioSaveFeedback,
} from '@sva/studio-ui-react';
import { Link, useNavigate } from '@tanstack/react-router';
import React from 'react';

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
  const saveFeedback = useStudioSaveFeedback();
  const [formValues, setFormValues] = React.useState(createOrganizationFormValues);
  const [organizationKeyMode, setOrganizationKeyMode] = React.useState<'auto' | 'manual'>('auto');
  const [parentOrganizations, setParentOrganizations] = React.useState<
    readonly OrganizationParentOption[]
  >(() => organizationsApi.organizations);

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
        const organizations = await loadAllOrganizationParentOptions((query) =>
          listOrganizations({ ...query, sortBy: 'displayName', sortDirection: 'asc' })
        );
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
    saveFeedback.markDirty();
    const nextKey = value;
    const normalizedTypedKey = nextKey.trim().toLocaleLowerCase();
    const normalizedGeneratedKey = generatedOrganizationKey.trim().toLocaleLowerCase();
    setOrganizationKeyMode(
      normalizedTypedKey.length === 0 || normalizedTypedKey === normalizedGeneratedKey
        ? 'auto'
        : 'manual'
    );
    setFormValues((current) => ({ ...current, organizationKey: nextKey }));
  };

  const onDisplayNameChange = (value: string) => {
    saveFeedback.markDirty();
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

  const saveOrganization = async () => {
    const submittedValues =
      organizationKeyMode === 'auto'
        ? {
            ...formValues,
            organizationKey: suggestOrganizationKey(formValues.displayName, parentOrganizations),
          }
        : formValues;
    const operationId = saveFeedback.beginSaving();
    const created = await organizationsApi.createOrganization(
      toOrganizationMutationPayload(submittedValues)
    );

    if (!created) {
      saveFeedback.markFailed(operationId);
      return;
    }

    saveFeedback.markSaved(operationId);
    await navigate({
      to: '/admin/organizations/$organizationId',
      params: { organizationId: created.id },
      state: (previous) => addStudioCreatedSaveFeedback(previous, 'organizations', created.id),
    });
  };

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void saveOrganization();
  };

  const updateFormValues: typeof setFormValues = (value) => {
    saveFeedback.markDirty();
    setFormValues(value);
  };

  return (
    <section className="space-y-5" aria-busy={organizationsApi.isLoading}>
      <div>
        <Button asChild type="button" variant="secondary">
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
            setFormValues={updateFormValues}
            submitAction={
              <StudioSaveButton
                type="submit"
                status={saveFeedback.status}
                labels={{
                  idle: t('admin.organizations.actions.create'),
                  saving: t('account.actions.saving'),
                  saved: t('account.actions.saved'),
                }}
              />
            }
            formValues={formValues}
            actions={
              <Button asChild type="button" variant="secondary">
                <Link to="/admin/organizations">{t('account.actions.cancel')}</Link>
              </Button>
            }
          />
        </Card>

        {organizationsApi.mutationError ? (
          <StudioPersistentFormError
            message={organizationErrorMessage(organizationsApi.mutationError)}
            retryLabel={t('account.actions.retry')}
            retryDisabled={saveFeedback.status === 'saving'}
            onRetry={() => void saveOrganization()}
          />
        ) : null}
      </StudioDetailPageTemplate>
    </section>
  );
};
