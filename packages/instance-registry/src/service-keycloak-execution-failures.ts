import { createSdkLogger } from '@sva/server-runtime';

import { appendRunStep } from './service-keycloak-run-steps.js';
import { buildInstanceRegistryFailureLog, readInstanceRegistryStepKey } from './observability.js';
import type { InstanceRegistryServiceDeps } from './service-types.js';

const logger = createSdkLogger({ component: 'keycloak-provisioning-failures', level: 'error' });

const classifyError = (error: unknown): { reasonCode: string; safeSummary: string } => {
  if (error instanceof Error) {
    const message = error.message || '';

    if (message.includes('Keycloak') || message.includes('keycloak')) {
      return {
        reasonCode: 'KEYCLOAK_EXECUTION_FAILED',
        safeSummary: 'Provisioning bei externer Abhängigkeit (Keycloak) fehlgeschlagen.',
      };
    }
    if (message.includes('Postgres') || message.includes('postgres') || message.includes('database')) {
      return {
        reasonCode: 'DATABASE_EXECUTION_FAILED',
        safeSummary: 'Provisioning bei Datenbankzugriff fehlgeschlagen.',
      };
    }
    if (message.includes('timeout') || message.includes('Timeout')) {
      return {
        reasonCode: 'TIMEOUT_EXECUTION_FAILED',
        safeSummary: 'Provisioning aufgrund von Timeout abgebrochen.',
      };
    }
  }

  return {
    reasonCode: 'UNKNOWN_EXECUTION_FAILED',
    safeSummary: 'Provisioning mit unbekanntem Fehler fehlgeschlagen.',
  };
};

export const failRun = async (
  deps: InstanceRegistryServiceDeps,
  input: {
    runId: string;
    requestId?: string;
    instanceId: string;
    intent: string;
    error: unknown;
  }
) => {
  const { reasonCode, safeSummary } = classifyError(input.error);
  const stepKey = readInstanceRegistryStepKey(input.error) ?? 'keycloak_execution';
  const dependency = stepKey === 'keycloak_execution'
    ? 'keycloak'
    : stepKey === 'secret_sync' || stepKey === 'admin_bootstrap'
      ? 'instance_registry'
      : undefined;

  logger.error('provisioning_run_failed', buildInstanceRegistryFailureLog(input.error, {
    operation: 'process_keycloak_provisioning_run',
    requestId: input.requestId,
    instanceId: input.instanceId,
    runId: input.runId,
    intent: input.intent,
    stepKey,
    dependency,
  }, {
    code: 'internal_unclassified',
    status: 500,
  }));

  await appendRunStep(deps, {
    runId: input.runId,
    stepKey,
    title: 'Provisioning ausführen',
    status: 'failed',
    summary: safeSummary,
    details: { reasonCode },
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
    instanceId: string;
    intent: string;
    summary: string;
    details?: Readonly<Record<string, unknown>>;
  }
) => {
  const reasonCode = typeof input.details?.reason === 'string'
    ? input.details.reason.toUpperCase()
    : 'WORKER_PRECONDITION_FAILED';
  logger.error('provisioning_run_failed', {
    operation: 'process_keycloak_provisioning_run',
    result: 'failed',
    request_id: input.requestId,
    instance_id: input.instanceId,
    run_id: input.runId,
    intent: input.intent,
    step_key: 'worker_preflight',
    error_type: 'ProvisioningPreconditionError',
    error_code: reasonCode,
    classification: reasonCode,
  });
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
