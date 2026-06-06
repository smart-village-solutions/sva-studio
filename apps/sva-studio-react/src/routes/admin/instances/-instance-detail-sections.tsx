import React from 'react';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../components/ui/tabs';
import { t } from '../../../i18n';
import { InstanceDetailBetriebSection } from './-instance-detail-betrieb-section';
import { InstanceDetailCockpitSection } from './-instance-detail-cockpit-section';
import { InstanceDetailConfigurationSection } from './-instance-detail-configuration-section';
import { InstanceDetailHistorySection } from './-instance-detail-history-section';
import { InstanceDetailOperationsSection } from './-instance-detail-operations-section';

import type {
  CockpitSectionProps,
  ProvisioningIntent,
  WorkflowAction,
  WorkspaceTabKey,
} from './-instance-detail-view-shared';
import type { DetailFormValues, InstanceConfigurationAssessment, SelectedInstance } from './-instances-shared-types';
import type { IamHttpError } from '../../../lib/iam-api';
import type { IamTenantIamStatus } from '@sva/core';

type WorkspaceSectionsProps = {
  readonly activeWorkspaceTab: WorkspaceTabKey;
  readonly selectedInstance: SelectedInstance;
  readonly detailFormValues: DetailFormValues;
  readonly configurationAssessment: InstanceConfigurationAssessment | null;
  readonly effectiveTenantIamStatus: IamTenantIamStatus | undefined;
  readonly tenantSecretUserInputRequired: boolean;
  readonly mutationError: IamHttpError | null;
  readonly statusLoading: boolean;
  readonly setActiveWorkspaceTab: (value: WorkspaceTabKey) => void;
  readonly setDetailFormValues: React.Dispatch<React.SetStateAction<DetailFormValues | null>>;
  readonly onUpdateSubmit: (event: React.FormEvent<HTMLFormElement>) => Promise<void>;
  readonly onTriggerWorkflowAction: (action: WorkflowAction) => Promise<void>;
  readonly onExecuteProvisioning: (intent: ProvisioningIntent) => Promise<void>;
  readonly onAssignModule: (instanceId: string, moduleId: string) => Promise<unknown>;
  readonly onRevokeModule: (instanceId: string, moduleId: string) => Promise<unknown>;
  readonly onSeedIamBaseline: () => Promise<void>;
  readonly onBootstrapAdminStructure: (instanceId: string, moduleIds: readonly string[]) => Promise<unknown>;
  readonly onLoadProvisioningRun: (runId: string) => Promise<void>;
};

export { InstanceDetailCockpitSection };
export type { CockpitSectionProps };

export const InstanceDetailWorkspaceSections = ({
  activeWorkspaceTab,
  selectedInstance,
  detailFormValues,
  configurationAssessment,
  effectiveTenantIamStatus,
  tenantSecretUserInputRequired,
  mutationError,
  statusLoading,
  setActiveWorkspaceTab,
  setDetailFormValues,
  onUpdateSubmit,
  onTriggerWorkflowAction,
  onExecuteProvisioning,
  onAssignModule,
  onRevokeModule,
  onSeedIamBaseline,
  onBootstrapAdminStructure,
  onLoadProvisioningRun,
}: WorkspaceSectionsProps) => (
  <Tabs value={activeWorkspaceTab} onValueChange={(value) => setActiveWorkspaceTab(value as WorkspaceTabKey)} className="space-y-4">
    <TabsList aria-label={t('admin.instances.cockpit.tabsAriaLabel')} className="h-auto flex-wrap justify-start">
      <TabsTrigger value="betrieb" onClick={() => setActiveWorkspaceTab('betrieb')}>
        {t('admin.instances.detail.tabs.betrieb')}
      </TabsTrigger>
      <TabsTrigger value="doctor" onClick={() => setActiveWorkspaceTab('doctor')}>
        {t('admin.instances.detail.tabs.doctor')}
      </TabsTrigger>
      <TabsTrigger value="einstellungen" onClick={() => setActiveWorkspaceTab('einstellungen')}>
        {t('admin.instances.detail.tabs.einstellungen')}
      </TabsTrigger>
    </TabsList>

    <TabsContent value="betrieb" className="space-y-5">
      <InstanceDetailBetriebSection
        selectedInstance={selectedInstance}
        statusLoading={statusLoading}
        mutationError={mutationError}
        onAssignModule={onAssignModule}
        onRevokeModule={onRevokeModule}
        onSeedIamBaseline={async () => onSeedIamBaseline()}
        onBootstrapAdminStructure={onBootstrapAdminStructure}
      />
    </TabsContent>

    <TabsContent value="doctor" forceMount className="space-y-5 data-[state=inactive]:hidden">
      <InstanceDetailOperationsSection
        selectedInstance={selectedInstance}
        detailFormValues={detailFormValues}
        effectiveTenantIamStatus={effectiveTenantIamStatus}
        mutationError={mutationError}
        statusLoading={statusLoading}
        setDetailFormValues={setDetailFormValues}
        onTriggerWorkflowAction={onTriggerWorkflowAction}
        onExecuteProvisioning={onExecuteProvisioning}
        onSeedIamBaseline={onSeedIamBaseline}
      />
      <InstanceDetailHistorySection
        selectedInstance={selectedInstance}
        onLoadProvisioningRun={onLoadProvisioningRun}
      />
    </TabsContent>

    <TabsContent value="einstellungen" className="space-y-5">
      <InstanceDetailConfigurationSection
        selectedInstance={selectedInstance}
        detailFormValues={detailFormValues}
        configurationAssessment={configurationAssessment}
        tenantSecretUserInputRequired={tenantSecretUserInputRequired}
        statusLoading={statusLoading}
        setDetailFormValues={setDetailFormValues}
        onUpdateSubmit={onUpdateSubmit}
      />
    </TabsContent>
  </Tabs>
);
