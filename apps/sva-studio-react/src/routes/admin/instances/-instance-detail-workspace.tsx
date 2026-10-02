import type React from 'react';
import type { UseFormReturn } from 'react-hook-form';
import type { AccountInvitationTemplateSaveResult } from './-account-invitation-template-card';
import type {
  DetailFormValues,
  DetailWorkflowAction,
  InstanceConfigurationAssessment,
  InstanceDetailCockpitModel,
  SelectedInstance,
} from './-instances-shared-types';
import type {
  HistoryWorkspaceModel,
  RealmOperationsModel,
} from './-instance-detail-operations-types';
import type { buildInstanceDoctorModel } from './-instance-detail-doctor-model';
import type { useInstances } from '../../../hooks/use-instances';
import type { usePluginTenantReadiness } from '../../../hooks/use-plugin-tenant-readiness';
import { StudioField, type StudioSaveStatus } from '@sva/studio-ui-react';
import { Input } from '../../../components/ui/input';
import { ConfirmDialog } from '../../../components/ConfirmDialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../components/ui/tabs';
import { t } from '../../../i18n';
import { InstanceDetailHeader } from './-instance-detail-header';
import { InstanceDetailCockpitSection } from './-instance-detail-cockpit-section';
import { InstanceDetailBetriebSection } from './-instance-detail-betrieb-section';
import { InstanceDetailDoctorSection } from './-instance-detail-doctor-section';
import { InstanceDetailAuditSection } from './-instance-detail-audit-section';
import { InstanceDetailConfigurationSection } from './-instance-detail-configuration-section';

type WorkspaceTab = 'betrieb' | 'doctor' | 'einstellungen';

type InstanceDetailWorkspaceProps = {
  selectedInstance: SelectedInstance;
  detailFormValues: DetailFormValues;
  operationsModel: RealmOperationsModel;
  cockpitModel: InstanceDetailCockpitModel;
  doctorModel: ReturnType<typeof buildInstanceDoctorModel> | null;
  historyModel: HistoryWorkspaceModel | null;
  configurationAssessment: InstanceConfigurationAssessment | null;
  pluginReadiness: ReturnType<typeof usePluginTenantReadiness>;
  instancesApi: ReturnType<typeof useInstances>;
  activeWorkspaceTab: WorkspaceTab;
  setActiveWorkspaceTab: React.Dispatch<React.SetStateAction<WorkspaceTab>>;
  runDetailAction: (action: DetailWorkflowAction | 'focus_configuration') => Promise<void>;
  statusLoading: boolean;
  actionBusy: boolean;
  assignModuleAndRefreshReadiness: ReturnType<typeof useInstances>['assignModule'];
  revokeModuleAndRefreshReadiness: ReturnType<typeof useInstances>['revokeModule'];
  openActivation: () => void;
  detailForm: UseFormReturn<DetailFormValues>;
  settingsSaving: boolean;
  tenantSecretUserInputRequired: boolean;
  setDetailFormValues: React.Dispatch<React.SetStateAction<DetailFormValues | null>>;
  onUpdateSubmit: (event: React.FormEvent<HTMLFormElement>) => Promise<void>;
  onSaveAccountInvitationTemplate: (
    template: Omit<NonNullable<SelectedInstance['accountInvitationTemplate']>, 'revision'> | null
  ) => Promise<AccountInvitationTemplateSaveResult>;
  saveStatus: StudioSaveStatus;
  markDirty: () => void;
  activationConfirmation: string | null;
  setActivationConfirmation: React.Dispatch<React.SetStateAction<string | null>>;
  actionBusyRef: React.RefObject<boolean>;
  setActionBusy: React.Dispatch<React.SetStateAction<boolean>>;
};

const InstanceActivationConfirmation = ({
  selectedInstance,
  instancesApi,
  activationConfirmation,
  setActivationConfirmation,
  actionBusyRef,
  setActionBusy,
}: Pick<
  InstanceDetailWorkspaceProps,
  | 'selectedInstance'
  | 'instancesApi'
  | 'activationConfirmation'
  | 'setActivationConfirmation'
  | 'actionBusyRef'
  | 'setActionBusy'
>) => (
  <ConfirmDialog
    open={activationConfirmation !== null}
    title={t('admin.instances.actions.activate')}
    description={t('admin.instances.detail.confirmActivation')}
    confirmLabel={t('admin.instances.actions.activate')}
    cancelLabel={t('account.actions.cancel')}
    onCancel={() => setActivationConfirmation(null)}
    onConfirm={() => {
      const stillCurrent =
        activationConfirmation === selectedInstance.updatedAt &&
        selectedInstance.provisioningReadiness?.nextAction?.action === 'instance.status.activate';
      setActivationConfirmation(null);
      if (stillCurrent && !actionBusyRef.current) {
        actionBusyRef.current = true;
        setActionBusy(true);
        void instancesApi.activateInstance(selectedInstance.instanceId).finally(() => {
          actionBusyRef.current = false;
          setActionBusy(false);
        });
      }
    }}
  />
);

export const InstanceDetailWorkspace = ({
  selectedInstance,
  detailFormValues,
  operationsModel,
  cockpitModel,
  doctorModel,
  historyModel,
  configurationAssessment,
  pluginReadiness,
  instancesApi,
  activeWorkspaceTab,
  setActiveWorkspaceTab,
  runDetailAction,
  statusLoading,
  actionBusy,
  assignModuleAndRefreshReadiness,
  revokeModuleAndRefreshReadiness,
  openActivation,
  detailForm,
  settingsSaving,
  tenantSecretUserInputRequired,
  setDetailFormValues,
  onUpdateSubmit,
  onSaveAccountInvitationTemplate,
  saveStatus,
  markDirty,
  activationConfirmation,
  setActivationConfirmation,
  actionBusyRef,
  setActionBusy,
}: InstanceDetailWorkspaceProps) => {
  const tenantAdminPasswordInput = cockpitModel?.secondaryActions.some(
    ({ action }) => action === 'reset_tenant_admin'
  ) ? (
    <StudioField
      id="tenant-admin-password"
      label={t('admin.instances.keycloakPanel.temporaryPassword')}
      description={t('admin.instances.keycloakPanel.passwordHint')}
    >
      <Input
        id="tenant-admin-password"
        type="password"
        autoComplete="new-password"
        aria-describedby="tenant-admin-password-description"
        disabled={statusLoading || actionBusy}
        value={detailFormValues?.tenantAdminTemporaryPassword ?? ''}
        onChange={(event) =>
          detailForm.setValue('tenantAdminTemporaryPassword', event.target.value, {
            shouldDirty: true,
          })
        }
      />
    </StudioField>
  ) : null;

  return (
    <div className="space-y-5">
      <InstanceDetailHeader
        selectedInstance={selectedInstance}
        operationalTitle={cockpitModel.overallTitle}
        operationalSummary={operationsModel.summary}
        onOpenDoctor={() => {
          setActiveWorkspaceTab('doctor');
        }}
        doctorWarning={doctorModel?.warning}
      />

      {!['active', 'suspended', 'archived'].includes(selectedInstance.status) &&
      activeWorkspaceTab === 'betrieb' ? (
        <InstanceDetailCockpitSection
          selectedInstance={selectedInstance}
          configurationAssessment={configurationAssessment}
          cockpitModel={cockpitModel}
          tenantAdminPasswordInput={tenantAdminPasswordInput}
          mutationError={instancesApi.mutationError}
          onRunDetailAction={runDetailAction}
          statusLoading={instancesApi.statusLoading || actionBusy}
        />
      ) : null}

      <Tabs
        value={activeWorkspaceTab}
        onValueChange={(value) => setActiveWorkspaceTab(value as WorkspaceTab)}
        className="space-y-4"
      >
        <TabsList
          aria-label={t('admin.instances.cockpit.tabsAriaLabel')}
          className="h-auto flex-wrap justify-start"
        >
          <TabsTrigger value="betrieb">{t('admin.instances.detail.tabs.betrieb')}</TabsTrigger>
          <TabsTrigger value="doctor">{t('admin.instances.detail.tabs.doctor')}</TabsTrigger>
          <TabsTrigger value="einstellungen">
            {t('admin.instances.detail.tabs.einstellungen')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="betrieb" className="space-y-5">
          <InstanceDetailBetriebSection
            selectedInstance={selectedInstance}
            statusLoading={instancesApi.statusLoading}
            mutationError={instancesApi.mutationError}
            pluginReadiness={pluginReadiness}
            onAssignModule={assignModuleAndRefreshReadiness}
            onRevokeModule={revokeModuleAndRefreshReadiness}
            onSeedIamBaseline={instancesApi.seedIamBaseline}
            onBootstrapAdminStructure={instancesApi.bootstrapAdminStructure}
          />
        </TabsContent>

        <TabsContent value="doctor" className="space-y-5">
          {doctorModel && historyModel ? (
            <InstanceDetailDoctorSection
              doctorModel={doctorModel}
              tenantAdminPasswordInput={tenantAdminPasswordInput}
              secondaryActions={cockpitModel.secondaryActions}
              onRunDetailAction={runDetailAction}
              onOpenActivation={openActivation}
              statusLoading={statusLoading || actionBusy}
              auditContent={
                <InstanceDetailAuditSection
                  auditRun={instancesApi.instanceAuditRun}
                  auditLoading={instancesApi.auditLoading}
                  onRefresh={async () =>
                    instancesApi.refreshInstanceAudit(selectedInstance.instanceId)
                  }
                />
              }
              historyModel={historyModel}
              selectedInstance={selectedInstance}
              onLoadProvisioningRun={(runId) =>
                instancesApi.loadKeycloakProvisioningRun(selectedInstance.instanceId, runId)
              }
            />
          ) : null}
        </TabsContent>

        <TabsContent
          value="einstellungen"
          forceMount
          hidden={activeWorkspaceTab !== 'einstellungen'}
          className="space-y-5"
        >
          <InstanceDetailConfigurationSection
            selectedInstance={selectedInstance}
            form={detailForm}
            saving={settingsSaving}
            detailFormValues={detailFormValues}
            statusLoading={statusLoading}
            configurationAssessment={configurationAssessment}
            tenantSecretUserInputRequired={tenantSecretUserInputRequired}
            setDetailFormValues={(value) => {
              markDirty();
              setDetailFormValues(value);
            }}
            onUpdateSubmit={onUpdateSubmit}
            onSaveAccountInvitationTemplate={onSaveAccountInvitationTemplate}
            saveStatus={saveStatus}
          />
        </TabsContent>
      </Tabs>

      <InstanceActivationConfirmation
        selectedInstance={selectedInstance}
        instancesApi={instancesApi}
        activationConfirmation={activationConfirmation}
        setActivationConfirmation={setActivationConfirmation}
        actionBusyRef={actionBusyRef}
        setActionBusy={setActionBusy}
      />
    </div>
  );
};
