import { Button, StudioSaveButton, useStudioSaveFeedback } from '@sva/studio-ui-react';
import React from 'react';

import { Alert, AlertDescription } from '../../../components/ui/alert';
import { Badge } from '../../../components/ui/badge';
import { Card } from '../../../components/ui/card';
import type { useOrganizations } from '../../../hooks/use-organizations';
import { t } from '../../../i18n';
import {
  getOrganizationTypeTranslationKey,
  OrganizationForm,
  type OrganizationParentOption,
} from './-organization-shared';

type Organization = NonNullable<ReturnType<typeof useOrganizations>['selectedOrganization']>;

const getMainserverProvisioningStatusKey = (
  status: NonNullable<
    ReturnType<typeof useOrganizations>['selectedOrganization']
  >['mainserverProvisioning']['status']
) => `admin.organizations.mainserverProvisioning.status.${status}`;

const OrganizationProvisioningCard = ({
  selectedOrganization,
  canUpdateOrganization,
  provisioningConfirmed,
  provisioningPending,
  onProvisionMainserver,
}: {
  selectedOrganization: Organization;
  canUpdateOrganization: boolean;
  provisioningConfirmed: boolean;
  provisioningPending: boolean;
  onProvisionMainserver: () => Promise<void>;
}) => (
  <Card className="space-y-4 p-5">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-foreground">
          {t('admin.organizations.mainserverProvisioning.title')}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t('admin.organizations.mainserverProvisioning.description')}
        </p>
      </div>
      <Badge className="w-fit rounded-full" variant="outline">
        {t(getMainserverProvisioningStatusKey(selectedOrganization.mainserverProvisioning.status))}
      </Badge>
    </div>
    <div className="grid gap-3 text-sm md:grid-cols-2">
      <div>
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          {t('admin.organizations.mainserverProvisioning.account')}
        </p>
        <p className="text-foreground">
          {selectedOrganization.mainserverProvisioning.technicalAccountId ??
            t('admin.organizations.mainserverProvisioning.notAvailable')}
        </p>
      </div>
      <div>
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          {t('admin.organizations.mainserverProvisioning.attempts')}
        </p>
        <p className="text-foreground">
          {selectedOrganization.mainserverProvisioning.attemptCount}
        </p>
      </div>
    </div>
    {selectedOrganization.mainserverProvisioning.lastErrorCode ? (
      <Alert className="border-warning/40 bg-warning/10">
        <AlertDescription>
          {t('admin.organizations.mainserverProvisioning.error', {
            code: selectedOrganization.mainserverProvisioning.lastErrorCode,
          })}
        </AlertDescription>
      </Alert>
    ) : null}
    {provisioningConfirmed ? (
      <Alert className="border-primary/40 bg-primary/10 text-primary" role="status">
        <AlertDescription>
          {t('admin.organizations.mainserverProvisioning.current')}
        </AlertDescription>
      </Alert>
    ) : null}
    {canUpdateOrganization ? (
      <Button
        type="button"
        onClick={() => void onProvisionMainserver()}
        disabled={
          provisioningPending || selectedOrganization.mainserverProvisioning.operationInProgress
        }
      >
        {provisioningPending || selectedOrganization.mainserverProvisioning.operationInProgress
          ? t('admin.organizations.mainserverProvisioning.running')
          : selectedOrganization.mainserverProvisioning.status === 'ready'
            ? t('admin.organizations.mainserverProvisioning.refresh')
            : t('admin.organizations.mainserverProvisioning.retry')}
      </Button>
    ) : null}
  </Card>
);

export const OrganizationOverviewPanel = ({
  selectedOrganization,
  organizationId,
  parentOrganizations,
  canUpdateOrganization,
  formValues,
  updateFormValues,
  onSubmitOrganization,
  saveFeedback,
  provisioningConfirmed,
  provisioningPending,
  onProvisionMainserver,
}: {
  selectedOrganization: Organization;
  organizationId: string;
  parentOrganizations: readonly OrganizationParentOption[];
  canUpdateOrganization: boolean;
  formValues: React.ComponentProps<typeof OrganizationForm>['formValues'];
  updateFormValues: React.ComponentProps<typeof OrganizationForm>['setFormValues'];
  onSubmitOrganization: (event: React.FormEvent<HTMLFormElement>) => Promise<void>;
  saveFeedback: ReturnType<typeof useStudioSaveFeedback>;
  provisioningConfirmed: boolean;
  provisioningPending: boolean;
  onProvisionMainserver: () => Promise<void>;
}) => (
  <div className="space-y-4">
    <Card className="space-y-4 p-5">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-foreground">
          {t('admin.organizations.sections.overviewTitle')}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t('admin.organizations.sections.overviewDescription')}
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {t('admin.organizations.form.keyLabel')}
          </p>
          <p className="text-sm text-foreground">{selectedOrganization.organizationKey}</p>
        </div>
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {t('admin.organizations.table.headerStatus')}
          </p>
          <Badge className="rounded-full" variant="outline">
            {selectedOrganization.isActive
              ? t('admin.organizations.filters.statusActive')
              : t('admin.organizations.filters.statusInactive')}
          </Badge>
        </div>
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {t('admin.organizations.table.headerType')}
          </p>
          <p className="text-sm text-foreground">
            {t(getOrganizationTypeTranslationKey(selectedOrganization.organizationType))}
          </p>
        </div>
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {t('admin.organizations.table.headerParent')}
          </p>
          <p className="text-sm text-foreground">
            {selectedOrganization.parentDisplayName ?? t('admin.organizations.messages.root')}
          </p>
        </div>
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {t('admin.organizations.table.headerChildren')}
          </p>
          <p className="text-sm text-foreground">{selectedOrganization.childCount}</p>
        </div>
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {t('admin.organizations.table.headerMembers')}
          </p>
          <p className="text-sm text-foreground">{selectedOrganization.membershipCount}</p>
        </div>
        <div className="space-y-1 xl:col-span-2">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {t('admin.organizations.messages.hierarchyPath', { value: '' }).replace(': ', '')}
          </p>
          <p className="text-sm text-foreground">
            {(selectedOrganization.hierarchyPath ?? []).join(' > ') ||
              t('admin.organizations.messages.root')}
          </p>
        </div>
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {t('admin.organizations.messages.metadataCount', { value: '' }).replace(': ', '')}
          </p>
          <p className="text-sm text-foreground">
            {Object.keys(selectedOrganization.metadata ?? {}).length}
          </p>
        </div>
      </div>
    </Card>

    <OrganizationProvisioningCard
      selectedOrganization={selectedOrganization}
      canUpdateOrganization={canUpdateOrganization}
      provisioningConfirmed={provisioningConfirmed}
      provisioningPending={provisioningPending}
      onProvisionMainserver={onProvisionMainserver}
    />

    <Card className="space-y-4 p-5">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-foreground">
          {t('admin.organizations.sections.baseDataTitle')}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t('admin.organizations.sections.baseDataDescription')}
        </p>
      </div>
      <OrganizationForm
        excludeOrganizationId={organizationId}
        organizations={parentOrganizations}
        onSubmit={(event) => void onSubmitOrganization(event)}
        setFormValues={updateFormValues}
        submitAction={
          <StudioSaveButton
            type="submit"
            status={saveFeedback.status}
            labels={{
              idle: t('admin.organizations.actions.save'),
              saving: t('account.actions.saving'),
              saved: t('account.actions.saved'),
            }}
          />
        }
        formValues={formValues}
        readOnly={!canUpdateOrganization}
      />
    </Card>
  </div>
);
