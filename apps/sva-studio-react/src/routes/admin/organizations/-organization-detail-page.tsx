import type { OrganizationDetailRouteTab } from '@sva/routing/route-search';
import {
  Button,
  hasStudioCreatedSaveFeedback,
  removeStudioSaveFeedback,
  StudioDetailPageTemplate,
  StudioDetailTabs,
  StudioPersistentFormError,
  useStudioSaveFeedback,
} from '@sva/studio-ui-react';
import { Link, useLocation, useNavigate } from '@tanstack/react-router';
import React from 'react';
import {
  buildMembershipDrafts,
  DEFAULT_MEMBERSHIP_FORM,
  OrganizationMembershipPanel,
  type MembershipAssignmentForm,
  type OrganizationMembershipDraft,
} from './-organization-detail-memberships';
import { OrganizationOverviewPanel } from './-organization-detail-overview';
import { useOrganizationMembershipCandidates } from './-organization-membership-candidates';
import { ConfirmDialog } from '../../../components/ConfirmDialog';
import { Alert, AlertDescription } from '../../../components/ui/alert';
import { Card } from '../../../components/ui/card';
import { isIamAccessAllowed, useIamResourceAccess } from '../../../hooks/use-iam-resource-access';
import { useOrganizations } from '../../../hooks/use-organizations';
import { t } from '../../../i18n';
import { listOrganizations } from '../../../lib/iam-api';
import {
  areOrganizationParentOptionsEqual,
  createOrganizationFormValues,
  loadAllOrganizationParentOptions,
  mergeOrganizationParentOptions,
  organizationErrorMessage,
  toOrganizationFormValues,
  toOrganizationMutationPayload,
  type OrganizationParentOption,
} from './-organization-shared';

export { sortMembershipUsersByLabel } from './-organization-membership-candidates';

type OrganizationDetailPageProps = {
  readonly organizationId: string;
  readonly activeTab: OrganizationDetailRouteTab;
  readonly onTabChange: (tab: OrganizationDetailRouteTab) => void;
};

export const OrganizationDetailPage = ({
  organizationId,
  activeTab,
  onTabChange,
}: OrganizationDetailPageProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const organizationsApi = useOrganizations();
  const access = useIamResourceAccess('organization');
  const canUpdateOrganization = isIamAccessAllowed(access.update);
  const canDeleteOrganization = isIamAccessAllowed(access.delete);
  const { loadOrganization } = organizationsApi;
  const [membershipForm, setMembershipForm] =
    React.useState<MembershipAssignmentForm>(DEFAULT_MEMBERSHIP_FORM);
  const [membershipAssignmentPending, setMembershipAssignmentPending] = React.useState(false);
  const [membershipDrafts, setMembershipDrafts] = React.useState<
    Record<string, OrganizationMembershipDraft>
  >({});
  const [deleteConfirmOpen, setDeleteConfirmOpen] = React.useState(false);
  const [provisioningPending, setProvisioningPending] = React.useState(false);
  const [provisioningConfirmed, setProvisioningConfirmed] = React.useState(false);
  const [formValues, setFormValues] = React.useState(createOrganizationFormValues);
  const saveFeedback = useStudioSaveFeedback();
  const initialSaveFeedbackShownRef = React.useRef(false);
  const updateFormValues: typeof setFormValues = (value) => {
    saveFeedback.markDirty();
    setFormValues(value);
  };
  const [parentOrganizations, setParentOrganizations] = React.useState<
    readonly OrganizationParentOption[]
  >(() => organizationsApi.organizations);

  React.useEffect(() => {
    void loadOrganization(organizationId);
  }, [loadOrganization, organizationId]);

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

  React.useEffect(() => {
    const detail = organizationsApi.selectedOrganization;
    if (!detail || detail.id !== organizationId) {
      return;
    }

    setFormValues(toOrganizationFormValues(detail));
    setMembershipDrafts(buildMembershipDrafts(detail.memberships));
  }, [organizationId, organizationsApi.selectedOrganization]);

  React.useEffect(() => {
    setMembershipForm(DEFAULT_MEMBERSHIP_FORM);
    setProvisioningConfirmed(false);
  }, [organizationId]);

  const selectedOrganization =
    organizationsApi.selectedOrganization?.id === organizationId
      ? organizationsApi.selectedOrganization
      : null;

  const candidates = useOrganizationMembershipCandidates({
    canUpdateOrganization,
    memberships: selectedOrganization?.memberships,
    organizationId,
  });
  const { setMembershipSearch } = candidates;

  React.useEffect(() => {
    if (
      organizationsApi.isLoading ||
      !selectedOrganization ||
      initialSaveFeedbackShownRef.current ||
      !hasStudioCreatedSaveFeedback(location.state, 'organizations', organizationId)
    ) {
      return;
    }

    initialSaveFeedbackShownRef.current = true;
    saveFeedback.showSaved();
    void navigate({
      to: '/admin/organizations/$organizationId',
      params: { organizationId },
      replace: true,
      state: (previous) => removeStudioSaveFeedback(previous),
    });
  }, [
    location.state,
    navigate,
    organizationId,
    organizationsApi.isLoading,
    saveFeedback,
    selectedOrganization,
  ]);

  const onSubmitOrganization = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canUpdateOrganization) {
      return;
    }
    const operationId = saveFeedback.beginSaving();
    const updated = await organizationsApi.updateOrganization(
      organizationId,
      toOrganizationMutationPayload(formValues)
    );
    (updated ? saveFeedback.markSaved : saveFeedback.markFailed)(operationId);
  };

  const onAssignMembership = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canUpdateOrganization || !membershipForm.accounts.length || membershipAssignmentPending) {
      return;
    }

    const { accounts, isDefaultContext } = membershipForm;
    setMembershipAssignmentPending(true);
    try {
      let firstUnassignedIndex = accounts.length;
      for (const [index, account] of accounts.entries()) {
        const success = await organizationsApi.assignMembership(
          organizationId,
          {
            accountId: account.value,
            isDefaultContext,
          },
          { reload: false }
        );
        if (!success) {
          firstUnassignedIndex = index;
          break;
        }
      }

      await Promise.all([
        organizationsApi.refetch(),
        organizationsApi.loadOrganization(organizationId, { preserveMutationError: true }),
      ]);
      const remainingAccounts = accounts.slice(firstUnassignedIndex);
      setMembershipForm(
        remainingAccounts.length
          ? { ...membershipForm, accounts: remainingAccounts }
          : DEFAULT_MEMBERSHIP_FORM
      );
      setMembershipSearch('');
    } finally {
      setMembershipAssignmentPending(false);
    }
  };

  const onConfirmDelete = async () => {
    if (!canDeleteOrganization) {
      return;
    }
    const success = await organizationsApi.deleteOrganization(organizationId);
    if (success) {
      setDeleteConfirmOpen(false);
    }
  };

  const onProvisionMainserver = async () => {
    if (!canUpdateOrganization || provisioningPending) {
      return;
    }
    setProvisioningConfirmed(false);
    setProvisioningPending(true);
    try {
      const result = await organizationsApi.provisionMainserver(organizationId);
      setProvisioningConfirmed(
        result?.mainserverProvisioning.status === 'ready' &&
          !result.mainserverProvisioning.lastErrorCode
      );
    } finally {
      setProvisioningPending(false);
    }
  };

  const updateMembershipDraft = React.useCallback(
    (accountId: string, patch: Partial<OrganizationMembershipDraft>) => {
      setMembershipDrafts((current) => ({
        ...current,
        [accountId]: {
          isDefaultContext: patch.isDefaultContext ?? current[accountId]?.isDefaultContext ?? false,
        },
      }));
    },
    []
  );

  const saveMembership = React.useCallback(
    async (accountId: string) => {
      if (!canUpdateOrganization) {
        return;
      }
      const draft = membershipDrafts[accountId];
      if (!draft) {
        return;
      }

      await organizationsApi.updateMembership(organizationId, accountId, draft);
    },
    [canUpdateOrganization, membershipDrafts, organizationId, organizationsApi]
  );

  if (organizationsApi.error) {
    return (
      <section className="space-y-4">
        <Alert className="border-destructive/40 bg-destructive/10 text-destructive">
          <AlertDescription>{organizationErrorMessage(organizationsApi.error)}</AlertDescription>
        </Alert>
        <Button asChild type="button" variant="secondary">
          <Link to="/admin/organizations">{t('admin.organizations.detail.backToList')}</Link>
        </Button>
      </section>
    );
  }

  return (
    <section className="space-y-5" aria-busy={organizationsApi.detailLoading}>
      <div>
        <Button asChild type="button" variant="secondary">
          <Link to="/admin/organizations">{t('admin.organizations.detail.backToList')}</Link>
        </Button>
      </div>

      <StudioDetailPageTemplate
        title={selectedOrganization?.displayName ?? t('admin.organizations.editDialog.title')}
        description={t('admin.organizations.editDialog.description')}
        actions={
          selectedOrganization && canDeleteOrganization ? (
            <Button
              type="button"
              variant="destructive"
              onClick={() => setDeleteConfirmOpen(true)}
              disabled={selectedOrganization.childCount > 0}
            >
              {t('admin.organizations.actions.delete')}
            </Button>
          ) : undefined
        }
      >
        {!selectedOrganization && !organizationsApi.detailLoading ? (
          <Card className="p-6 text-sm text-muted-foreground">
            {t('admin.organizations.detail.notFound')}
          </Card>
        ) : null}

        {selectedOrganization ? (
          <StudioDetailTabs
            ariaLabel={t('admin.organizations.tabs.ariaLabel')}
            mobileSelectLabel={t('admin.organizations.tabs.mobileLabel')}
            value={activeTab}
            onValueChange={onTabChange}
            tabs={[
              {
                id: 'organization',
                label: t('admin.organizations.tabs.organization'),
                icon: 'basis',
                description: t('admin.organizations.editDialog.description'),
                panel: (
                  <OrganizationOverviewPanel
                    selectedOrganization={selectedOrganization}
                    organizationId={organizationId}
                    parentOrganizations={parentOrganizations}
                    canUpdateOrganization={canUpdateOrganization}
                    formValues={formValues}
                    updateFormValues={updateFormValues}
                    onSubmitOrganization={onSubmitOrganization}
                    saveFeedback={saveFeedback}
                    provisioningConfirmed={provisioningConfirmed}
                    provisioningPending={provisioningPending}
                    onProvisionMainserver={onProvisionMainserver}
                  />
                ),
              },
              {
                id: 'memberships',
                label: t('admin.organizations.tabs.memberships'),
                icon: 'settings',
                description: t('admin.organizations.sections.membershipsDescription'),
                panel: (
                  <OrganizationMembershipPanel
                    selectedOrganization={selectedOrganization}
                    organizationId={organizationId}
                    organizationsApi={organizationsApi}
                    canUpdateOrganization={canUpdateOrganization}
                    membershipForm={membershipForm}
                    setMembershipForm={setMembershipForm}
                    membershipAssignmentPending={membershipAssignmentPending}
                    candidates={candidates}
                    membershipDrafts={membershipDrafts}
                    updateMembershipDraft={updateMembershipDraft}
                    saveMembership={saveMembership}
                    onAssignMembership={onAssignMembership}
                  />
                ),
              },
            ]}
          />
        ) : null}

        {organizationsApi.mutationError && selectedOrganization ? (
          <StudioPersistentFormError
            message={organizationErrorMessage(organizationsApi.mutationError)}
          />
        ) : null}
      </StudioDetailPageTemplate>

      <ConfirmDialog
        open={canDeleteOrganization && deleteConfirmOpen}
        title={t('admin.organizations.confirm.deleteTitle')}
        description={t('admin.organizations.confirm.deleteDescription')}
        confirmLabel={t('admin.organizations.actions.delete')}
        cancelLabel={t('account.actions.cancel')}
        onConfirm={() => void onConfirmDelete()}
        onCancel={() => setDeleteConfirmOpen(false)}
      />
    </section>
  );
};
