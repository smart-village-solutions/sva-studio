import type { StudioInstanceProcessResult } from './process.js';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

export const unwrap = (value: unknown): Record<string, unknown> =>
  isRecord(value) && isRecord(value.data) ? value.data : isRecord(value) ? value : {};

export const isTerminalRun = (value: Record<string, unknown>): boolean =>
  value.overallStatus === 'succeeded' || value.overallStatus === 'failed';

const isDoctorReady = (detail: Record<string, unknown>): boolean => {
  const tenantIam = unwrap(detail.tenantIamStatus);
  const moduleIam = unwrap(detail.moduleIamStatus);
  const status = unwrap(detail.keycloakStatus);
  const provisioningReadiness = unwrap(detail.provisioningReadiness);
  const provisioningNextAction = unwrap(provisioningReadiness.nextAction);
  const provisioningAllowsActivation =
    Object.keys(provisioningReadiness).length === 0 ||
    detail.status === 'active' ||
    provisioningNextAction.action === 'instance.status.activate';
  return (
    provisioningAllowsActivation &&
    status.realmExists === true &&
    status.clientExists === true &&
    tenantIam.overall !== undefined &&
    unwrap(tenantIam.overall).status === 'ready' &&
    (readAssignedModuleIds(detail).size === 0 || unwrap(moduleIam.overall).status === 'ready')
  );
};

export const readAssignedModuleIds = (detail: Record<string, unknown>): ReadonlySet<string> =>
  new Set(
    (Array.isArray(detail.assignedModules) ? detail.assignedModules : []).flatMap((value) => {
      if (typeof value === 'string') return [value];
      const record = unwrap(value);
      return typeof record.moduleId === 'string' ? [record.moduleId] : [];
    })
  );

export const readRunId = (detail: Record<string, unknown>): string | undefined => {
  const latestRun = unwrap(detail.latestKeycloakProvisioningRun);
  if (typeof latestRun.id === 'string') return latestRun.id;
  const runs = Array.isArray(detail.keycloakProvisioningRuns)
    ? detail.keycloakProvisioningRuns
    : [];
  const firstRun = unwrap(runs[0]);
  return typeof firstRun.id === 'string' ? firstRun.id : undefined;
};

export const readParentRun = (
  detail: Record<string, unknown>,
  runId: string
): Record<string, unknown> => {
  const latestRun = unwrap(detail.latestProvisioningRun);
  if (latestRun.id === runId) return latestRun;
  const runs = Array.isArray(detail.provisioningRuns) ? detail.provisioningRuns : [];
  return unwrap(runs.find((candidate) => unwrap(candidate).id === runId));
};

export const readProvisioningAction = (detail: Record<string, unknown>): string | undefined => {
  const action = unwrap(unwrap(detail.provisioningReadiness).nextAction).action;
  return typeof action === 'string' ? action : undefined;
};

export const evaluateDoctor = (input: {
  detail: Record<string, unknown>;
  instanceId: string;
  completedSteps: readonly string[];
  requestId: string;
  idempotencyKey: string;
}): StudioInstanceProcessResult => {
  const doctor = {
    keycloakStatus: input.detail.keycloakStatus,
    tenantIamStatus: input.detail.tenantIamStatus,
    moduleIamStatus: input.detail.moduleIamStatus,
    provisioningReadiness: input.detail.provisioningReadiness,
  };
  if (!isDoctorReady(input.detail)) {
    return {
      completed: false,
      status: 'blocked',
      instanceId: input.instanceId,
      currentStep: 'doctor_validation',
      completedSteps: input.completedSteps,
      openSteps: ['doctor_validation'],
      doctor,
      nextAction: {
        actionId: 'instance.diagnose',
        summary: 'Die aktuelle Doctor-Abnahme ist nicht vollständig bereit.',
      },
      requestId: input.requestId,
      idempotencyKey: input.idempotencyKey,
    };
  }
  if (input.detail.status !== 'active') {
    return {
      completed: false,
      status: 'awaiting_human_action',
      instanceId: input.instanceId,
      currentStep: 'activation',
      completedSteps: input.completedSteps,
      openSteps: ['activation'],
      doctor,
      nextAction: {
        actionId: 'instance.status.activate',
        summary:
          'Die technische Abnahme ist abgeschlossen; Aktivierung verlangt eine serverseitige Bestätigungs-Challenge.',
      },
      requestId: input.requestId,
      idempotencyKey: input.idempotencyKey,
    };
  }
  return {
    completed: true,
    status: 'completed',
    instanceId: input.instanceId,
    currentStep: 'completed',
    completedSteps: input.completedSteps,
    openSteps: [],
    doctor,
    nextAction: {
      actionId: 'instance.read',
      summary: 'Die Instanz ist aktiv und vollständig abgenommen.',
    },
    requestId: input.requestId,
    idempotencyKey: input.idempotencyKey,
  };
};
