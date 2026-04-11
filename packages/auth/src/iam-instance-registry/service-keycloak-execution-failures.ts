import type { InstanceRegistryServiceDeps } from './service-types.js';
import { appendRunStep } from './service-keycloak-run-steps.js';
import { createSdkLogger } from '@sva/sdk/server';

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
    error: unknown;
  }
) => {
  const { reasonCode, safeSummary } = classifyError(input.error);

  // Log the detailed error for operators with structured context.
  // rawErrorMessage is deliberately omitted to avoid leaking PII or secrets
  // from upstream error messages (HTTP responses, Keycloak errors, etc.).
  logger.error('provisioning_run_failed', {
    runId: input.runId,
    reasonCode,
  });

  await appendRunStep(deps, {
    runId: input.runId,
    stepKey: 'execution',
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
