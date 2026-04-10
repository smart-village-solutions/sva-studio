import type { InstanceRegistryServiceDeps } from './service-types.js';
import { appendRunStep } from './service-keycloak-run-steps.js';

export const failRun = async (
  deps: InstanceRegistryServiceDeps,
  input: {
    runId: string;
    requestId?: string;
    error: unknown;
  }
) => {
  const message = input.error instanceof Error ? input.error.message : String(input.error);
  await appendRunStep(deps, {
    runId: input.runId,
    stepKey: 'execution',
    title: 'Provisioning ausführen',
    status: 'failed',
    summary: message,
    details: { error: message },
    requestId: input.requestId,
  });
  await deps.repository.updateKeycloakProvisioningRun({
    runId: input.runId,
    overallStatus: 'failed',
    driftSummary: 'Provisioning wurde mit einem Fehler abgebrochen.',
  });
};

export const failClaimedRun = async (
  deps: InstanceRegistryServiceDeps,
  input: {
    runId: string;
    requestId?: string;
    summary: string;
    details?: Readonly<Record<string, unknown>>;
  }
) => {
  await appendRunStep(deps, {
    runId: input.runId,
    stepKey: 'worker',
    title: 'Provisioning-Worker',
    status: 'failed',
    summary: input.summary,
    details: input.details,
    requestId: input.requestId,
  });
  await deps.repository.updateKeycloakProvisioningRun({
    runId: input.runId,
    overallStatus: 'failed',
    driftSummary: input.summary,
  });
};
