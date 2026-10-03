import { Button, StudioPersistentFormError } from '@sva/studio-ui-react';
import type { IamInstanceDraftReadiness } from '@sva/core';
import { IamRuntimeDiagnosticDetails } from '../../../components/iam-runtime-diagnostic-details';
import { Alert, AlertDescription } from '../../../components/ui/alert';
import { t } from '../../../i18n';
import type { IamHttpError } from '../../../lib/iam-api';
import { getErrorMessage } from './-instance-error-messages';
import { WorkflowStatusBadge } from './-instance-status-badges';
import { CREATE_WIZARD_STEPS } from './-instance-form-models';
import type { CreateWizardStepKey } from './-instances-shared-types';

const readinessFindingKeys = new Set([
  'platform_access',
  'keycloak_admin_access',
  'realm_mode',
  'tenant_secret',
  'tenant_admin_client',
  'tenant_admin_profile',
  'realm_ownership',
  'registry_instance_id',
  'registry_hostname',
  'realm_selection',
  'realm_create_capability',
]);
const readinessCapabilityReasonCodes = new Set([
  'worker_heartbeat_unavailable',
  'durable_queue_available',
  'callback_readiness_unavailable',
  'provisioner_adapter_available',
  'provisioner_worker_readiness_unavailable',
  'ingress_automation_available',
  'ingress_worker_readiness_unavailable',
  'ingress_automation_not_required',
  'plugin_lifecycle_registry_available',
  'plugin_lifecycle_registry_unavailable',
]);

const getReadinessFindingTitle = (checkKey: string) =>
  t(
    `admin.instances.wizard.readiness.findings.titles.${readinessFindingKeys.has(checkKey) ? checkKey : 'unknown'}`
  );
const getReadinessFindingSummary = (status: string) =>
  t(
    `admin.instances.wizard.readiness.findings.status.${['ready', 'warning', 'blocked'].includes(status) ? status : 'unknown'}`
  );
const getReadinessCapabilitySummary = (reasonCode: string) =>
  t(
    `admin.instances.wizard.readiness.capabilityReasons.${readinessCapabilityReasonCodes.has(reasonCode) ? reasonCode : 'unknown'}`
  );
const findingStep = (checkKey: string): CreateWizardStepKey | undefined => {
  if (['registry_instance_id', 'registry_hostname'].includes(checkKey)) return 'basics';
  if (['realm_mode', 'realm_selection'].includes(checkKey)) return 'auth';
  if (checkKey === 'tenant_admin_profile') return 'tenantAdmin';
  return undefined;
};

export const CreateReadinessFindings = ({
  draftReadiness,
  draftReadinessError,
  readinessLoading,
  setReturnToReview,
  moveToStep,
}: {
  draftReadiness: IamInstanceDraftReadiness | null;
  draftReadinessError: IamHttpError | null;
  readinessLoading: boolean;
  setReturnToReview: (value: boolean) => void;
  moveToStep: (step: CreateWizardStepKey) => void;
}) => (
  <>
    {readinessLoading ? (
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {t('admin.instances.wizard.readiness.serverChecking')}
      </p>
    ) : draftReadiness ? (
      <div className="space-y-4">
        {[
          {
            key: 'create',
            title: t('admin.instances.wizard.readiness.createGroup'),
            findings: draftReadiness.createBlockers.map((finding) => ({
              ...finding,
              displayTitle: getReadinessFindingTitle(finding.checkKey),
              displaySummary: getReadinessFindingSummary(finding.status),
            })),
          },
          {
            key: 'provisioning',
            title: t('admin.instances.wizard.readiness.provisioningGroup'),
            findings: [
              ...draftReadiness.provisioningBlockers.map((finding) => ({
                ...finding,
                displayTitle: getReadinessFindingTitle(finding.checkKey),
                displaySummary: getReadinessFindingSummary(finding.status),
              })),
              ...draftReadiness.backgroundCapabilities
                .filter(
                  (capability) =>
                    capability.status !== 'ready' && capability.status !== 'not_required'
                )
                .map((capability) => ({
                  checkKey: capability.capability,
                  displayTitle: t(`admin.instances.wizard.capabilities.${capability.capability}`),
                  status:
                    capability.status === 'blocked' ? ('blocked' as const) : ('warning' as const),
                  displaySummary: getReadinessCapabilitySummary(capability.reasonCode),
                  details: { reasonCode: capability.reasonCode },
                })),
            ],
          },
          {
            key: 'activation',
            title: t('admin.instances.wizard.readiness.activationGroup'),
            findings: draftReadiness.activationBlockers.map((finding) => ({
              ...finding,
              displayTitle: getReadinessFindingTitle(finding.checkKey),
              displaySummary: getReadinessFindingSummary(finding.status),
            })),
          },
        ].map((group) => (
          <section key={group.key} className="space-y-2" aria-labelledby={`readiness-${group.key}`}>
            <h3 id={`readiness-${group.key}`} className="text-sm font-medium text-foreground">
              {group.title}
            </h3>
            {group.findings.length ? (
              <p className="text-sm text-muted-foreground">
                {t(`admin.instances.wizard.readiness.impacts.${group.key}`)}
              </p>
            ) : null}
            {group.findings.length > 0 ? (
              group.findings.map((finding) => (
                <div
                  key={`${group.key}-${finding.checkKey}`}
                  className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-border p-3"
                >
                  <div>
                    <div className="font-medium text-foreground">{finding.displayTitle}</div>
                    <p className="mt-1 text-xs text-muted-foreground">{finding.displaySummary}</p>
                    {findingStep(finding.checkKey) ? (
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => {
                          setReturnToReview(true);
                          const step = findingStep(finding.checkKey);
                          if (step) moveToStep(step);
                        }}
                      >
                        {t('admin.instances.wizard.editGroup', {
                          group:
                            CREATE_WIZARD_STEPS.find(
                              ({ key }) => key === findingStep(finding.checkKey)
                            )?.title ?? '',
                        })}
                      </Button>
                    ) : (
                      <p className="mt-1 text-sm">
                        {t('admin.instances.wizard.readiness.resolveTechnical')}
                      </p>
                    )}
                    <details className="mt-2">
                      <summary className="cursor-pointer text-xs">
                        {t('admin.instances.wizard.technicalDetails')}
                      </summary>
                      <p className="break-all text-xs">
                        {finding.checkKey} · {draftReadiness.checkedAt}
                      </p>
                    </details>
                  </div>
                  <WorkflowStatusBadge
                    status={finding.status === 'blocked' ? 'blocked' : 'pending'}
                  />
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">
                {t('admin.instances.wizard.readiness.noBlockers')}
              </p>
            )}
          </section>
        ))}
        {draftReadiness.realmSuitability ? (
          <Alert>
            <AlertDescription>
              {t(
                `admin.instances.wizard.realmSuitability.${draftReadiness.realmSuitability.classification}`
              )}{' '}
              {t(
                `admin.instances.wizard.realmSuitabilityRemediation.${draftReadiness.realmSuitability.classification}`
              )}
            </AlertDescription>
          </Alert>
        ) : null}
      </div>
    ) : draftReadinessError ? (
      <>
        <Alert className="border-destructive/40 bg-destructive/10 text-destructive">
          <AlertDescription>
            {t('admin.instances.wizard.readiness.serverUnavailable')}
          </AlertDescription>
        </Alert>
        <StudioPersistentFormError
          message={getErrorMessage(draftReadinessError)}
          details={<IamRuntimeDiagnosticDetails error={draftReadinessError} />}
        />
      </>
    ) : null}
  </>
);
