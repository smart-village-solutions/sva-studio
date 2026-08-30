import type { StudioJobRecord } from '@sva/core';
import type {
  PluginTenantLifecycleRecord,
  PluginTenantLifecycleRepository,
} from '@sva/data-repositories';
import type {
  PluginTenantLifecycleOperation,
  PluginTenantLifecycleRegistryEntry,
} from '@sva/plugin-sdk';

export const pluginTenantLifecycleHostErrorCodes = {
  notDeclared: 'plugin_tenant_lifecycle_not_declared',
  inactive: 'plugin_tenant_lifecycle_inactive',
  operationNotDeclared: 'plugin_tenant_lifecycle_operation_not_declared',
  handlerMissing: 'plugin_tenant_lifecycle_handler_missing',
  cancellationMismatch: 'plugin_tenant_lifecycle_cancellation_mismatch',
  claimConflict: 'plugin_tenant_lifecycle_claim_conflict',
  enqueueFailed: 'plugin_tenant_lifecycle_enqueue_failed',
} as const;

type PluginTenantLifecycleJobRegistration = {
  readonly queueName: string;
  readonly supportsCancellation?: boolean;
};

export type PluginTenantLifecycleOrchestratorDependencies = {
  readonly lifecycleRegistry: ReadonlyMap<string, PluginTenantLifecycleRegistryEntry>;
  readonly resolveActivation: (
    instanceId: string,
    pluginId: string
  ) => Promise<{ readonly effectiveActive: boolean } | null>;
  readonly repository: Pick<
    PluginTenantLifecycleRepository,
    'requestLifecycle' | 'claimLifecycle' | 'failLifecycle'
  >;
  readonly resolveJobRegistration: (
    jobTypeId: string
  ) => PluginTenantLifecycleJobRegistration | undefined;
  readonly createJob: (input: {
    readonly instanceId: string;
    readonly pluginId: string;
    readonly jobTypeId: string;
    readonly queueName: string;
    readonly operation: PluginTenantLifecycleOperation;
    readonly generation: number;
    readonly actorAccountId?: string;
    readonly requestId?: string;
    readonly scheduledAt: string;
  }) => Promise<StudioJobRecord>;
  readonly queueJob: (input: {
    readonly instanceId: string;
    readonly jobId: string;
    readonly queueName: string;
    readonly maxAttempts: number;
  }) => Promise<void>;
  readonly markEnqueueFailed: (input: {
    readonly instanceId: string;
    readonly job: StudioJobRecord;
  }) => Promise<void>;
};

export type StartPluginTenantLifecycleInput = {
  readonly instanceId: string;
  readonly pluginId: string;
  readonly operation: PluginTenantLifecycleOperation;
  readonly actorAccountId?: string;
  readonly requestId?: string;
  readonly scheduledAt: string;
};

export type StartPluginTenantLifecycleResult = {
  readonly lifecycle: PluginTenantLifecycleRecord;
  readonly job: StudioJobRecord;
};

const lifecycleError = (code: string, pluginId: string, operation?: string): Error =>
  new Error([code, pluginId, operation].filter(Boolean).join(':'));

export const createPluginTenantLifecycleOrchestrator = (
  dependencies: PluginTenantLifecycleOrchestratorDependencies
) => ({
  async start(input: StartPluginTenantLifecycleInput): Promise<StartPluginTenantLifecycleResult> {
    const lifecycle = dependencies.lifecycleRegistry.get(input.pluginId);
    if (!lifecycle) {
      throw lifecycleError(pluginTenantLifecycleHostErrorCodes.notDeclared, input.pluginId);
    }

    const activation = await dependencies.resolveActivation(input.instanceId, input.pluginId);
    if (!activation?.effectiveActive) {
      throw lifecycleError(pluginTenantLifecycleHostErrorCodes.inactive, input.pluginId);
    }

    const operationDefinition = lifecycle.operations.find(
      ({ operation }) => operation === input.operation
    );
    if (!operationDefinition) {
      throw lifecycleError(
        pluginTenantLifecycleHostErrorCodes.operationNotDeclared,
        input.pluginId,
        input.operation
      );
    }

    const registration = dependencies.resolveJobRegistration(operationDefinition.jobTypeId);
    if (!registration) {
      throw lifecycleError(
        pluginTenantLifecycleHostErrorCodes.handlerMissing,
        input.pluginId,
        input.operation
      );
    }
    if (
      (operationDefinition.supportsCancellation === true) !==
      (registration.supportsCancellation === true)
    ) {
      throw lifecycleError(
        pluginTenantLifecycleHostErrorCodes.cancellationMismatch,
        input.pluginId,
        input.operation
      );
    }

    const requestedLifecycle = await dependencies.repository.requestLifecycle({
      instanceId: input.instanceId,
      pluginId: input.pluginId,
      operation: input.operation,
    });
    const generation = requestedLifecycle.desiredGeneration;
    const job = await dependencies.createJob({
      instanceId: input.instanceId,
      pluginId: input.pluginId,
      jobTypeId: operationDefinition.jobTypeId,
      queueName: registration.queueName,
      operation: input.operation,
      generation,
      actorAccountId: input.actorAccountId,
      requestId: input.requestId,
      scheduledAt: input.scheduledAt,
    });
    const claimedLifecycle = await dependencies.repository.claimLifecycle({
      instanceId: input.instanceId,
      pluginId: input.pluginId,
      jobId: job.id,
      generation,
      operation: input.operation,
    });
    if (!claimedLifecycle) {
      throw lifecycleError(
        pluginTenantLifecycleHostErrorCodes.claimConflict,
        input.pluginId,
        input.operation
      );
    }

    try {
      await dependencies.queueJob({
        instanceId: input.instanceId,
        jobId: job.id,
        queueName: job.queueName,
        maxAttempts: job.maxAttempts,
      });
    } catch {
      await Promise.allSettled([
        dependencies.markEnqueueFailed({ instanceId: input.instanceId, job }),
        dependencies.repository.failLifecycle({
          instanceId: input.instanceId,
          pluginId: input.pluginId,
          jobId: job.id,
          generation,
          readinessStatus: 'blocked',
          errorCode: pluginTenantLifecycleHostErrorCodes.enqueueFailed,
          retryKind: 'retryable',
        }),
      ]);
      throw lifecycleError(
        pluginTenantLifecycleHostErrorCodes.enqueueFailed,
        input.pluginId,
        input.operation
      );
    }

    return { lifecycle: claimedLifecycle, job };
  },
});
