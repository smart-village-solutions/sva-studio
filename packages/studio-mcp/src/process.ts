import { createHash, randomUUID } from 'node:crypto';
import type { z } from 'zod';
import { StudioApiError, type StudioApiClient, type StudioApiRequest } from './api-client.js';
import type { schemas } from './contracts.js';

type ProcessInput = z.infer<typeof schemas.process>;

export type StudioInstanceProcessResult = {
  readonly completed: boolean;
  readonly status: 'completed' | 'awaiting_human_action' | 'blocked' | 'in_progress';
  readonly instanceId: string;
  readonly currentStep: string;
  readonly completedSteps: readonly string[];
  readonly openSteps: readonly string[];
  readonly doctor: unknown;
  readonly nextAction: { readonly actionId: string; readonly summary: string };
  readonly requestId: string;
  readonly idempotencyKey?: string;
};

export class StudioInstanceProcessError extends Error {
  constructor(
    readonly cause: unknown,
    readonly progress: StudioInstanceProcessResult
  ) {
    super('studio_instance_process_failed');
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const unwrap = (value: unknown): Record<string, unknown> =>
  isRecord(value) && isRecord(value.data) ? value.data : isRecord(value) ? value : {};

const isTerminalRun = (value: Record<string, unknown>): boolean =>
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

const readAssignedModuleIds = (detail: Record<string, unknown>): ReadonlySet<string> =>
  new Set(
    (Array.isArray(detail.assignedModules) ? detail.assignedModules : []).flatMap((value) => {
      if (typeof value === 'string') return [value];
      const record = unwrap(value);
      return typeof record.moduleId === 'string' ? [record.moduleId] : [];
    })
  );

const deriveIdempotencyKey = (base: string, suffix: string): string => {
  const candidate = `${base}:${suffix}`;
  return candidate.length <= 200 ? candidate : createHash('sha256').update(candidate).digest('hex');
};

const readRunId = (detail: Record<string, unknown>): string | undefined => {
  const latestRun = unwrap(detail.latestKeycloakProvisioningRun);
  if (typeof latestRun.id === 'string') return latestRun.id;
  const runs = Array.isArray(detail.keycloakProvisioningRuns)
    ? detail.keycloakProvisioningRuns
    : [];
  const firstRun = unwrap(runs[0]);
  return typeof firstRun.id === 'string' ? firstRun.id : undefined;
};

const readParentRun = (detail: Record<string, unknown>, runId: string): Record<string, unknown> => {
  const latestRun = unwrap(detail.latestProvisioningRun);
  if (latestRun.id === runId) return latestRun;
  const runs = Array.isArray(detail.provisioningRuns) ? detail.provisioningRuns : [];
  return unwrap(runs.find((candidate) => unwrap(candidate).id === runId));
};

const request = (client: StudioApiClient, input: StudioApiRequest) => client.request(input);

const mutation = (
  path: string,
  body: unknown,
  requestId: string,
  idempotencyKey: string
): StudioApiRequest => ({
  method: 'POST',
  path,
  body,
  requestId,
  idempotencyKey,
});

const waitForRun = async (
  client: StudioApiClient,
  instanceId: string,
  runId: string,
  requestId: string,
  timeoutMs: number
): Promise<Record<string, unknown>> => {
  const deadline = Date.now() + timeoutMs;
  let run = unwrap(
    await request(client, {
      path: `/api/v1/iam/instances/${encodeURIComponent(instanceId)}/keycloak/runs/${encodeURIComponent(runId)}`,
      requestId,
    })
  );
  let delayMs = 1_000;
  while (!isTerminalRun(run) && Date.now() < deadline) {
    await new Promise<void>((resolve) =>
      setTimeout(resolve, Math.min(delayMs, Math.max(0, deadline - Date.now())))
    );
    run = unwrap(
      await request(client, {
        path: `/api/v1/iam/instances/${encodeURIComponent(instanceId)}/keycloak/runs/${encodeURIComponent(runId)}`,
        requestId,
      })
    );
    delayMs = Math.min(delayMs * 2, 5_000);
  }
  return run;
};

const waitForParentProvisioning = async (
  client: StudioApiClient,
  basePath: string,
  runId: string,
  requestId: string,
  timeoutMs: number
): Promise<Record<string, unknown>> => {
  const deadline = Date.now() + timeoutMs;
  let detail = unwrap(await request(client, { path: basePath, requestId }));
  let delayMs = 1_000;
  while (Date.now() < deadline) {
    const run = readParentRun(detail, runId);
    if (run.completedAt !== undefined || run.status === 'failed') break;
    await new Promise<void>((resolve) =>
      setTimeout(resolve, Math.min(delayMs, Math.max(0, deadline - Date.now())))
    );
    detail = unwrap(await request(client, { path: basePath, requestId }));
    delayMs = Math.min(delayMs * 2, 5_000);
  }
  return detail;
};

const assignMissingModules = async (input: {
  client: StudioApiClient;
  basePath: string;
  moduleIds: readonly string[];
  requestId: string;
  idempotencyKey: string;
}): Promise<boolean> => {
  const detail = unwrap(
    await request(input.client, { path: input.basePath, requestId: input.requestId })
  );
  const requestedModuleIds = [...new Set(input.moduleIds)];
  const missingModuleIds = requestedModuleIds.filter(
    (moduleId) => !readAssignedModuleIds(detail).has(moduleId)
  );
  for (const moduleId of missingModuleIds) {
    await request(
      input.client,
      mutation(
        `${input.basePath}/modules/assign`,
        { moduleId },
        input.requestId,
        deriveIdempotencyKey(input.idempotencyKey, `module:${moduleId}`)
      )
    );
  }
  await request(
    input.client,
    mutation(
      `${input.basePath}/modules/seed-iam-baseline`,
      {},
      input.requestId,
      deriveIdempotencyKey(input.idempotencyKey, 'iam-baseline')
    )
  );
  if (requestedModuleIds.length === 0) return false;
  await request(
    input.client,
    mutation(
      `${input.basePath}/modules/bootstrap-admin-structure`,
      { moduleIds: requestedModuleIds },
      input.requestId,
      deriveIdempotencyKey(input.idempotencyKey, 'admin-bootstrap')
    )
  );
  return true;
};

const evaluateDoctor = (input: {
  detail: Record<string, unknown>;
  instanceId: string;
  completedSteps: readonly string[];
  requestId: string;
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
  };
};

export const runStudioInstanceProcess = async (
  client: StudioApiClient,
  input: ProcessInput,
  options: { readonly timeoutMs: number }
): Promise<StudioInstanceProcessResult> => {
  const requestId = randomUUID();
  const idempotencyKey = input.idempotencyKey ?? randomUUID();
  const basePath = `/api/v1/iam/instances/${encodeURIComponent(input.instanceId)}`;
  const completedSteps: string[] = [];
  let currentStep = input.mode === 'create' ? 'registry_create' : 'keycloak_plan';

  try {
    let automatedParentRunId: string | undefined;
    if (input.mode === 'create') {
      const created = unwrap(
        await request(
          client,
          mutation('/api/v1/iam/instances', input.create, requestId, idempotencyKey)
        )
      );
      const parentRun = unwrap(created.latestProvisioningRun);
      automatedParentRunId = typeof parentRun.id === 'string' ? parentRun.id : undefined;
      completedSteps.push('registry_created_or_idempotently_reused');
    }

    if (automatedParentRunId) {
      currentStep = 'parent_provisioning';
      const detail = await waitForParentProvisioning(
        client,
        basePath,
        automatedParentRunId,
        requestId,
        options.timeoutMs
      );
      const parentRun = readParentRun(detail, automatedParentRunId);
      if (parentRun.status === 'failed') {
        return {
          completed: false,
          status: 'blocked',
          instanceId: input.instanceId,
          currentStep,
          completedSteps,
          openSteps: [currentStep],
          doctor: parentRun,
          nextAction: {
            actionId: 'instance.provisioning.retry',
            summary: 'Den automatischen Provisioning-Lauf prüfen und gezielt fortsetzen.',
          },
          requestId,
        };
      }
      if (parentRun.completedAt === undefined) {
        return {
          completed: false,
          status: 'in_progress',
          instanceId: input.instanceId,
          currentStep,
          completedSteps,
          openSteps: [currentStep],
          doctor: parentRun,
          nextAction: {
            actionId: 'instance.readiness.refresh',
            summary: 'Der automatische Provisioning-Lauf wird serverseitig weitergeführt.',
          },
          requestId,
        };
      }
      completedSteps.push('parent_provisioning_completed');
      return evaluateDoctor({ detail, instanceId: input.instanceId, completedSteps, requestId });
    }

    let runId: string | undefined = input.keycloakRunId;
    if (!runId) {
      currentStep = 'keycloak_plan';
      const plan = unwrap(
        await request(
          client,
          mutation(
            `${basePath}/keycloak/plan`,
            {},
            requestId,
            deriveIdempotencyKey(idempotencyKey, 'plan')
          )
        )
      );
      const planFingerprint = typeof plan.fingerprint === 'string' ? plan.fingerprint : undefined;
      if (!input.planFingerprint) {
        return {
          completed: false,
          status: 'awaiting_human_action',
          instanceId: input.instanceId,
          currentStep: 'keycloak_plan_confirmation',
          completedSteps,
          openSteps: ['keycloak_plan_confirmation', 'keycloak_provisioning'],
          doctor: { keycloakPlan: plan },
          nextAction: {
            actionId: 'instance.keycloak.plan.confirm',
            summary:
              'Den aktuellen Keycloak-Plan prüfen und seinen Fingerprint ausdrücklich bestätigen.',
          },
          requestId,
          idempotencyKey,
        };
      }
      if (planFingerprint !== input.planFingerprint) {
        throw new StudioApiError(
          409,
          {
            error: {
              code: 'keycloak_plan_fingerprint_stale',
              message: 'Der bestätigte Keycloak-Plan ist nicht mehr aktuell.',
            },
          },
          requestId,
          idempotencyKey
        );
      }
      currentStep = 'keycloak_provisioning';
      if (input.mode === 'repair') {
        await request(
          client,
          mutation(
            `${basePath}/keycloak/reconcile`,
            { planFingerprint: input.planFingerprint },
            requestId,
            deriveIdempotencyKey(idempotencyKey, 'reconcile')
          )
        );
        runId = readRunId(unwrap(await request(client, { path: basePath, requestId })));
      } else {
        const execute = unwrap(
          await request(
            client,
            mutation(
              `${basePath}/keycloak/execute`,
              { intent: 'provision', planFingerprint: input.planFingerprint },
              requestId,
              deriveIdempotencyKey(idempotencyKey, 'provision')
            )
          )
        );
        runId = typeof execute.id === 'string' ? execute.id : undefined;
      }
    }
    if (!runId) {
      return {
        completed: false,
        status: 'blocked',
        instanceId: input.instanceId,
        currentStep: 'keycloak_provisioning',
        completedSteps,
        openSteps: ['keycloak_provisioning'],
        doctor: null,
        nextAction: {
          actionId: 'instance.provision.run.read',
          summary: 'Der Provisioning-Lauf wurde nicht eindeutig zurückgegeben.',
        },
        requestId,
      };
    }
    currentStep = 'keycloak_provisioning';
    const run = await waitForRun(client, input.instanceId, runId, requestId, options.timeoutMs);
    if (run.overallStatus !== 'succeeded') {
      return {
        completed: false,
        status: run.overallStatus === 'failed' ? 'blocked' : 'in_progress',
        instanceId: input.instanceId,
        currentStep: 'keycloak_provisioning',
        completedSteps,
        openSteps: ['keycloak_provisioning'],
        doctor: run,
        nextAction: {
          actionId: 'instance.provision.run.read',
          summary:
            'Den Provisioning-Lauf prüfen und erst dann eine gezielte Folgeaktion ausführen.',
        },
        requestId,
      };
    }
    completedSteps.push('keycloak_provisioned');

    if (!input.planFingerprint) {
      currentStep = 'keycloak_plan_confirmation';
      return {
        completed: false,
        status: 'awaiting_human_action',
        instanceId: input.instanceId,
        currentStep,
        completedSteps,
        openSteps: ['keycloak_plan_confirmation', 'tenant_iam_roles_reconcile'],
        doctor: { keycloakRun: run },
        nextAction: {
          actionId: 'instance.keycloak.plan.confirm',
          summary:
            'Den am abgeschlossenen Keycloak-Lauf bestätigten Plan-Fingerprint für die Rollenänderung erneut übergeben.',
        },
        requestId,
        idempotencyKey,
      };
    }

    currentStep = 'modules_and_iam';
    if (
      await assignMissingModules({
        client,
        basePath,
        moduleIds: input.moduleIds ?? [],
        requestId,
        idempotencyKey,
      })
    ) {
      completedSteps.push('modules_and_iam_ready');
    }

    currentStep = 'tenant_iam_roles_reconcile';
    const roleReconcile = unwrap(
      await request(
        client,
        mutation(
          `${basePath}/tenant-iam/roles/reconcile`,
          { planFingerprint: input.planFingerprint },
          requestId,
          deriveIdempotencyKey(idempotencyKey, 'roles-reconcile')
        )
      )
    );
    if (roleReconcile.outcome !== 'success') {
      return {
        completed: false,
        status: 'blocked',
        instanceId: input.instanceId,
        currentStep,
        completedSteps,
        openSteps: [currentStep],
        doctor: roleReconcile,
        nextAction: {
          actionId: 'instance.iam.roles.reconcile',
          summary: 'Der Rollenabgleich ist nicht vollständig erfolgreich; Ergebnis prüfen.',
        },
        requestId,
      };
    }
    completedSteps.push('tenant_iam_roles_reconciled');
    currentStep = 'tenant_iam_access_probe';
    await request(
      client,
      mutation(
        `${basePath}/tenant-iam/access-probe`,
        {},
        requestId,
        deriveIdempotencyKey(idempotencyKey, 'access-probe')
      )
    );
    completedSteps.push('tenant_iam_access_probed');
    currentStep = 'doctor_validation';
    const detail = unwrap(await request(client, { path: basePath, requestId }));
    return evaluateDoctor({ detail, instanceId: input.instanceId, completedSteps, requestId });
  } catch (error) {
    throw new StudioInstanceProcessError(error, {
      completed: false,
      status: 'blocked',
      instanceId: input.instanceId,
      currentStep,
      completedSteps,
      openSteps: [currentStep],
      doctor: null,
      nextAction: {
        actionId: 'instance.process.resume',
        summary:
          'Den korrelierten Fehler prüfen und den Prozess ab dem ersten nicht nachgewiesenen Schritt fortsetzen.',
      },
      requestId,
      idempotencyKey,
    });
  }
};
