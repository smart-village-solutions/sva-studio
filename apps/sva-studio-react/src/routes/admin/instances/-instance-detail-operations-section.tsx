import { Button } from '../../../components/ui/button';
import { Card } from '../../../components/ui/card';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { t } from '../../../i18n';
import { getKeycloakStatusEntries, getSetupWorkflowSteps } from './-instance-detail-models';
import { KeycloakStatusBadge, WorkflowStatusBadge } from './-instance-status-badges';
import { TENANT_IAM_AXIS_TITLE_KEYS, TenantIamStatusBadge, type WorkflowAction } from './-instance-detail-view-shared';

import type { OperationsSectionProps } from './-instance-detail-view-shared';

const TenantIamCard = ({
  effectiveTenantIamStatus,
}: Pick<OperationsSectionProps, 'effectiveTenantIamStatus'>) =>
  effectiveTenantIamStatus ? (
    <Card className="space-y-3 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="font-medium text-foreground">{t('admin.instances.tenantIam.title')}</div>
          <p className="text-sm text-muted-foreground">{t('admin.instances.tenantIam.subtitle')}</p>
        </div>
        <TenantIamStatusBadge status={effectiveTenantIamStatus.overall.status} />
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {(['configuration', 'access', 'reconcile'] as const).map((axisKey) => {
          const axis = effectiveTenantIamStatus[axisKey];
          return (
            <div key={axisKey} className="rounded-md border border-border bg-muted/20 p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">
                  {t(TENANT_IAM_AXIS_TITLE_KEYS[axisKey])}
                </div>
                <TenantIamStatusBadge status={axis?.status} />
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{axis?.summary}</p>
              {axis?.requestId ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  {t('admin.instances.tenantIam.requestId', { value: axis.requestId })}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>
    </Card>
  ) : null;

const ModuleIamCard = ({
  selectedInstance,
  onSeedIamBaseline,
  statusLoading,
}: Pick<OperationsSectionProps, 'selectedInstance' | 'onSeedIamBaseline' | 'statusLoading'>) =>
  selectedInstance.moduleIamStatus ? (
    <Card className="space-y-4 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="font-medium text-foreground">{t('admin.instances.instanceModules.detail.title')}</div>
          <p className="text-sm text-muted-foreground">{t('admin.instances.instanceModules.detail.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <TenantIamStatusBadge status={selectedInstance.moduleIamStatus.overall.status} />
          <Button type="button" variant="outline" size="sm" onClick={() => void onSeedIamBaseline()} disabled={statusLoading}>
            {t('admin.instances.instanceModules.actions.seedIamBaseline')}
          </Button>
        </div>
      </div>
      {selectedInstance.moduleIamStatus.modules.length > 0 ? (
        <div className="grid gap-3 md:grid-cols-2">
          {selectedInstance.moduleIamStatus.modules.map((module) => (
            <div key={module.moduleId} className="rounded-md border border-border bg-muted/20 p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="font-medium text-foreground">{module.moduleId}</div>
                <TenantIamStatusBadge status={module.status} />
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{module.summary}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                {t('admin.instances.instanceModules.module.permissions', {
                  value: module.permissionIds.join(', ') || '—',
                })}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-md border border-dashed border-border p-3 text-sm text-muted-foreground">
          {t('admin.instances.instanceModules.assigned.empty')}
        </div>
      )}
    </Card>
  ) : null;

const WorkflowCard = ({
  selectedInstance,
  mutationError,
  onTriggerWorkflowAction,
  statusLoading,
}: Pick<OperationsSectionProps, 'selectedInstance' | 'mutationError' | 'onTriggerWorkflowAction' | 'statusLoading'>) => (
  <Card className="space-y-4 p-4">
    <div className="space-y-1">
      <div className="font-medium text-foreground">{t('admin.instances.workflow.title')}</div>
      <p className="text-xs text-muted-foreground">{t('admin.instances.workflow.subtitle')}</p>
    </div>
    <div className="grid gap-2">
      {getSetupWorkflowSteps(selectedInstance, mutationError).map((step) => (
        <div key={step.key} className="rounded-lg border border-border p-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="font-medium text-foreground">{step.title}</div>
              <p className="mt-1 text-xs text-muted-foreground">{step.description}</p>
            </div>
            <WorkflowStatusBadge status={step.status} />
          </div>
          {step.action && step.actionLabel ? (
            <div className="mt-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void onTriggerWorkflowAction(step.action as WorkflowAction)}
                disabled={statusLoading}
              >
                {step.actionLabel}
              </Button>
            </div>
          ) : null}
        </div>
      ))}
    </div>
  </Card>
);

const ExecuteProvisioningCard = ({
  detailFormValues,
  setDetailFormValues,
  onExecuteProvisioning,
}: Pick<OperationsSectionProps, 'detailFormValues' | 'setDetailFormValues' | 'onExecuteProvisioning'>) => (
  <Card className="space-y-3 p-4">
    <div className="space-y-1">
      <div className="font-medium text-foreground">{t('admin.instances.flow.executeTitle')}</div>
      <p className="text-xs text-muted-foreground">{t('admin.instances.flow.executeSubtitle')}</p>
    </div>
    <div className="space-y-1">
      <Label htmlFor="tenant-admin-password">{t('admin.instances.keycloakPanel.temporaryPassword')}</Label>
      <Input
        id="tenant-admin-password"
        type="password"
        value={detailFormValues.tenantAdminTemporaryPassword}
        onChange={(event) =>
          setDetailFormValues((current) =>
            current ? { ...current, tenantAdminTemporaryPassword: event.target.value } : current
          )
        }
      />
      <p className="text-xs text-muted-foreground">{t('admin.instances.keycloakPanel.passwordHint')}</p>
    </div>
    <div className="flex flex-wrap gap-2">
      <Button type="button" onClick={() => void onExecuteProvisioning('provision')}>
        {t('admin.instances.actions.executeProvisioning')}
      </Button>
      <Button type="button" variant="outline" onClick={() => void onExecuteProvisioning('provision_admin_client')}>
        {t('admin.instances.actions.provisionAdminClient')}
      </Button>
      <Button type="button" variant="outline" onClick={() => void onExecuteProvisioning('reset_tenant_admin')}>
        {t('admin.instances.actions.resetTenantAdmin')}
      </Button>
      <Button type="button" variant="outline" onClick={() => void onExecuteProvisioning('rotate_client_secret')}>
        {t('admin.instances.actions.rotateClientSecret')}
      </Button>
    </div>
  </Card>
);

const PreflightCard = ({
  selectedInstance,
  onTriggerWorkflowAction,
  statusLoading,
}: Pick<OperationsSectionProps, 'selectedInstance' | 'onTriggerWorkflowAction' | 'statusLoading'>) => (
  <Card className="space-y-3 p-4">
    <div className="space-y-1">
      <div className="font-medium text-foreground">{t('admin.instances.flow.preflightTitle')}</div>
      <p className="text-xs text-muted-foreground">{t('admin.instances.flow.preflightSubtitle')}</p>
    </div>
    <div className="flex flex-wrap gap-2">
      <Button type="button" variant="outline" onClick={() => void onTriggerWorkflowAction('check_preflight')} disabled={statusLoading}>
        {t('admin.instances.actions.checkPreflight')}
      </Button>
      <Button type="button" variant="outline" onClick={() => void onTriggerWorkflowAction('check_keycloak_status')} disabled={statusLoading}>
        {t('admin.instances.actions.checkKeycloakStatus')}
      </Button>
    </div>
    <div className="grid gap-2">
      {selectedInstance.keycloakPreflight?.checks.map((check) => (
        <div key={check.checkKey} className="rounded-md border border-border p-3">
          <div className="flex items-center justify-between gap-3">
            <span className="font-medium text-foreground">{check.title}</span>
            <KeycloakStatusBadge ready={check.status === 'ready'} />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{check.summary}</p>
        </div>
      )) ?? <p className="text-sm text-muted-foreground">{t('admin.instances.flow.preflightEmpty')}</p>}
    </div>
  </Card>
);

const PlanPreviewCard = ({
  selectedInstance,
  onTriggerWorkflowAction,
  statusLoading,
}: Pick<OperationsSectionProps, 'selectedInstance' | 'onTriggerWorkflowAction' | 'statusLoading'>) => (
  <Card className="space-y-3 p-4">
    <div className="space-y-1">
      <div className="font-medium text-foreground">{t('admin.instances.flow.previewTitle')}</div>
      <p className="text-xs text-muted-foreground">{t('admin.instances.flow.previewSubtitle')}</p>
    </div>
    <div className="flex flex-wrap gap-2">
      <Button type="button" variant="outline" onClick={() => void onTriggerWorkflowAction('plan_provisioning')} disabled={statusLoading}>
        {t('admin.instances.actions.planProvisioning')}
      </Button>
    </div>
    <div className="grid gap-2">
      {selectedInstance.keycloakPlan?.steps.length ? (
        selectedInstance.keycloakPlan.steps.map((step) => (
          <div key={step.stepKey} className="rounded-md border border-border p-3">
            <div className="flex items-center justify-between gap-3">
              <span className="font-medium text-foreground">{step.title}</span>
              <span className="text-xs text-muted-foreground">{step.action}</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{step.summary}</p>
          </div>
        ))
      ) : (
        <p className="text-sm text-muted-foreground">{t('admin.instances.flow.previewEmpty')}</p>
      )}
    </div>
  </Card>
);

const KeycloakStatusCard = ({ selectedInstance }: Pick<OperationsSectionProps, 'selectedInstance'>) => (
  <Card className="space-y-3 p-4">
    <div className="space-y-1">
      <div className="font-medium text-foreground">{t('admin.instances.keycloakPanel.title')}</div>
      <p className="text-xs text-muted-foreground">{t('admin.instances.keycloakPanel.subtitle')}</p>
    </div>
    <div className="grid gap-2">
      {getKeycloakStatusEntries(selectedInstance).length ? (
        getKeycloakStatusEntries(selectedInstance).map(([labelKey, ready]) => (
          <div key={labelKey} className="flex items-center justify-between gap-3 rounded-md border border-border p-2">
            <span>{t(labelKey)}</span>
            <KeycloakStatusBadge ready={ready} />
          </div>
        ))
      ) : (
        <p className="text-sm text-muted-foreground">{t('admin.instances.keycloakPanel.empty')}</p>
      )}
    </div>
  </Card>
);

export const InstanceDetailOperationsSection = (props: OperationsSectionProps) => (
  <>
    <TenantIamCard effectiveTenantIamStatus={props.effectiveTenantIamStatus} />
    <ModuleIamCard
      selectedInstance={props.selectedInstance}
      onSeedIamBaseline={props.onSeedIamBaseline}
      statusLoading={props.statusLoading}
    />
    <WorkflowCard
      selectedInstance={props.selectedInstance}
      mutationError={props.mutationError}
      onTriggerWorkflowAction={props.onTriggerWorkflowAction}
      statusLoading={props.statusLoading}
    />
    <ExecuteProvisioningCard
      detailFormValues={props.detailFormValues}
      setDetailFormValues={props.setDetailFormValues}
      onExecuteProvisioning={props.onExecuteProvisioning}
    />
    <PreflightCard
      selectedInstance={props.selectedInstance}
      onTriggerWorkflowAction={props.onTriggerWorkflowAction}
      statusLoading={props.statusLoading}
    />
    <PlanPreviewCard
      selectedInstance={props.selectedInstance}
      onTriggerWorkflowAction={props.onTriggerWorkflowAction}
      statusLoading={props.statusLoading}
    />
    <KeycloakStatusCard selectedInstance={props.selectedInstance} />
  </>
);
