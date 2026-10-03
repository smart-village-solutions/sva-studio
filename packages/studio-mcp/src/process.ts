import { randomUUID } from 'node:crypto';
import { runParentProvisioning } from './process-parent.js';
import type { z } from 'zod';
import type { StudioApiClient } from './api-client.js';
import { runKeycloakPhase, type ProcessContext } from './process-keycloak.js';
import type { schemas } from './contracts.js';
import {
  assignMissingModules,
  mutation,
  request,
} from './process-requests.js';
import {
  unwrap,
} from './process-state.js';

export type ProcessInput = z.infer<typeof schemas.process>;

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

export const runStudioInstanceProcess = async (
  client: StudioApiClient,
  input: ProcessInput,
  options: { readonly timeoutMs: number }
): Promise<StudioInstanceProcessResult> => {
  const requestId = randomUUID();
  const idempotencyKey = input.idempotencyKey ?? randomUUID();
  const basePath = `/api/v1/iam/instances/${encodeURIComponent(input.instanceId)}`;
  const moduleIds = input.moduleIds ?? input.create?.moduleIds ?? [];
  const completedSteps: string[] = [];
  const context: ProcessContext = {
    client, input, basePath, requestId, idempotencyKey, completedSteps,
    timeoutMs: options.timeoutMs,
    currentStep: input.mode === 'create' ? 'registry_create' : 'keycloak_plan',
  };

  try {
    let automatedParentRunId: string | undefined;
    if (input.mode === 'create') {
      const created = unwrap(
        await request(
          client,
          mutation(
            '/api/v1/iam/instances',
            { ...input.create, moduleIds },
            requestId,
            idempotencyKey
          )
        )
      );
      const parentRun = unwrap(created.latestProvisioningRun);
      automatedParentRunId = typeof parentRun.id === 'string' ? parentRun.id : undefined;
      completedSteps.push('registry_created_or_idempotently_reused');
    }

    if (automatedParentRunId) {
      context.currentStep = 'parent_provisioning';
      return await runParentProvisioning({ ...context, automatedParentRunId });
    }

    context.currentStep = 'modules_and_iam';
    if (
      await assignMissingModules({
        client,
        basePath,
        moduleIds,
        requestId,
        idempotencyKey,
      })
    ) {
      completedSteps.push('modules_and_iam_ready');
    }

    return await runKeycloakPhase(context);
  } catch (error) {
    throw new StudioInstanceProcessError(error, {
      completed: false,
      status: 'blocked',
      instanceId: input.instanceId,
      currentStep: context.currentStep,
      completedSteps,
      openSteps: [context.currentStep],
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
