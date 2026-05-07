import { areAllInstanceKeycloakRequirementsSatisfied } from '@sva/core';

import type { ExecuteInstanceKeycloakProvisioningInput } from './mutation-types.js';
import type { InstanceRegistryServiceDeps } from './service-types.js';
import { loadInstanceWithSecret } from './service-keycloak-secrets.js';
import { appendRunStep, buildFinalRunSteps } from './service-keycloak-run-steps.js';
import { buildProvisioningInput } from './service-keycloak-execution-payload.js';

export const completeRun = async (
  deps: InstanceRegistryServiceDeps,
  input: {
    loaded: NonNullable<Awaited<ReturnType<typeof loadInstanceWithSecret>>>;
    runId: string;
    requestId?: string;
    actorId?: string;
    intent: ExecuteInstanceKeycloakProvisioningInput['intent'];
    tenantAdminTemporaryPassword?: string;
  }
) => {
  const getKeycloakStatus = deps.getKeycloakStatus;
  if (!getKeycloakStatus) {
    throw new Error('dependency_missing_getKeycloakStatus');
  }
  const status = await getKeycloakStatus(buildProvisioningInput(input.loaded));

  await appendRunStep(deps, {
    runId: input.runId,
    stepKey: 'status_snapshot',
    title: 'Keycloak-Status aufnehmen',
    status: 'done',
    summary: 'Der Worker hat den Keycloak-Istzustand nach dem Lauf gespeichert.',
    details: { status },
    requestId: input.requestId,
  });

  const completionSteps = buildFinalRunSteps({
    status,
    intent: input.intent,
    usedTemporaryPassword: Boolean(input.tenantAdminTemporaryPassword),
  });

  for (const step of completionSteps) {
    await appendRunStep(deps, {
      runId: input.runId,
      stepKey: step.stepKey,
      title: step.title,
      status: step.ok ? 'done' : 'failed',
      summary: step.summary,
      details: step.details,
      requestId: input.requestId,
    });
  }

  const finalRunStatus =
    completionSteps.every((step) => step.ok) && areAllInstanceKeycloakRequirementsSatisfied(status)
      ? 'succeeded'
      : 'failed';

  if (finalRunStatus === 'succeeded' && input.loaded.instance.status !== 'active') {
    await deps.repository.setInstanceStatus({
      instanceId: input.loaded.instance.instanceId,
      status: 'provisioning',
      actorId: input.actorId,
      requestId: input.requestId,
    });
  }

  await deps.repository.updateKeycloakProvisioningRun({
    runId: input.runId,
    overallStatus: finalRunStatus,
    driftSummary:
      finalRunStatus === 'succeeded'
        ? 'Provisioning erfolgreich abgeschlossen.'
        : 'Provisioning abgeschlossen, aber einzelne Sollzustände weichen weiterhin ab.',
  });
  return finalRunStatus;
};
