import type { ProcessContext } from './process-keycloak.js';
import type { StudioInstanceProcessResult } from './process.js';
import { deriveIdempotencyKey, mutation, request } from './process-requests.js';
import { evaluateDoctor, unwrap } from './process-state.js';

export const completeIam = async (
  context: ProcessContext, run: Record<string, unknown>
): Promise<StudioInstanceProcessResult> => {
  const { client, input, basePath, requestId, idempotencyKey, completedSteps } = context;
  if (!input.planFingerprint) {
    context.currentStep = 'keycloak_plan_confirmation';
    return {
      completed: false, status: 'awaiting_human_action', instanceId: input.instanceId,
      currentStep: context.currentStep, completedSteps,
      openSteps: ['keycloak_plan_confirmation', 'tenant_iam_roles_reconcile'],
      doctor: { keycloakRun: run },
      nextAction: {
        actionId: 'instance.keycloak.plan.confirm',
        summary: 'Den am abgeschlossenen Keycloak-Lauf bestätigten Plan-Fingerprint für die Rollenänderung erneut übergeben.',
      }, requestId, idempotencyKey,
    };
  }
  context.currentStep = 'tenant_iam_roles_reconcile';
  const roleReconcile = unwrap(await request(client, mutation(
    `${basePath}/tenant-iam/roles/reconcile`,
    { planFingerprint: input.planFingerprint }, requestId,
    deriveIdempotencyKey(idempotencyKey, 'roles-reconcile')
  )));
  if (roleReconcile.outcome !== 'success') {
    return {
      completed: false, status: 'blocked', instanceId: input.instanceId,
      currentStep: context.currentStep, completedSteps, openSteps: [context.currentStep],
      doctor: roleReconcile,
      nextAction: {
        actionId: 'instance.iam.roles.reconcile',
        summary: 'Der Rollenabgleich ist nicht vollständig erfolgreich; Ergebnis prüfen.',
      }, requestId, idempotencyKey,
    };
  }
  completedSteps.push('tenant_iam_roles_reconciled');
  context.currentStep = 'tenant_iam_access_probe';
  await request(client, mutation(
    `${basePath}/tenant-iam/access-probe`, {}, requestId,
    deriveIdempotencyKey(idempotencyKey, 'access-probe')
  ));
  completedSteps.push('tenant_iam_access_probed');
  context.currentStep = 'doctor_validation';
  const detail = unwrap(await request(client, { path: basePath, requestId }));
  return evaluateDoctor({
    detail, instanceId: input.instanceId, completedSteps, requestId, idempotencyKey,
  });
};
