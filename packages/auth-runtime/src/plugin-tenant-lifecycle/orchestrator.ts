import type { StudioJobRecord } from '@sva/core';
import type {
  PluginTenantLifecycleRecord,
  PluginTenantLifecycleRepository,
} from '@sva/data-repositories';
import type {
  PluginExecutionLogger,
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
  claimFailed: 'plugin_tenant_lifecycle_claim_failed',
  jobCreationFailed: 'plugin_tenant_lifecycle_job_creation_failed',
  enqueueFailed: 'plugin_tenant_lifecycle_enqueue_failed',
} as const;

type PluginTenantLifecycleJobRegistration = {
  readonly queueName: string;
  readonly executionLane?: 'default' | 'privileged';
  readonly supportsCancellation?: boolean;
};

export type PluginTenantLifecycleOrchestratorDependencies = {
  readonly logger: PluginExecutionLogger;
  readonly lifecycleRegistry: ReadonlyMap<string, PluginTenantLifecycleRegistryEntry>;
  readonly resolveActivation: (
    instanceId: string,
    pluginId: string
  ) => Promise<{ readonly effectiveActive: boolean } | null>;
  readonly repository: Pick<
    PluginTenantLifecycleRepository,
    'requestLifecycle' | 'claimLifecycle' | 'failUnclaimedLifecycle'
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
    readonly executionLane?: 'default' | 'privileged';
    readonly runAt?: Date;
  }) => Promise<void>;
  readonly persistEnqueueFailure: (input: {
    readonly instanceId: string;
    readonly pluginId: string;
    readonly job: StudioJobRecord;
    readonly generation: number;
  }) => Promise<void>;
  readonly markUnclaimedJobFailed: (input: {
    readonly instanceId: string;
    readonly job: StudioJobRecord;
    readonly errorCode: string;
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

const resolveLifecycleOperation = async (
  dependencies: PluginTenantLifecycleOrchestratorDependencies,
  input: StartPluginTenantLifecycleInput
) => {
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
  return { operationDefinition, registration };
};

const handleEnqueueFailure = async (
  dependencies: PluginTenantLifecycleOrchestratorDependencies,
  input: StartPluginTenantLifecycleInput,
  job: StudioJobRecord,
  generation: number
): Promise<never> => {
  try {
    await dependencies.persistEnqueueFailure({
      instanceId: input.instanceId,
      pluginId: input.pluginId,
      job,
      generation,
    });
  } catch (persistenceError) {
    dependencies.logger.error(
      'Plugin-Tenant-Lifecycle konnte einen Enqueue-Fehler nicht vollständig persistieren',
      {
        operation: 'plugin_tenant_lifecycle_enqueue_cleanup',
        result: 'secondary_failure',
        error_code: 'plugin_tenant_lifecycle_enqueue_cleanup_failed',
        instance_id: input.instanceId,
        plugin_id: input.pluginId,
        job_id: job.id,
        persistence_error_type:
          persistenceError instanceof Error ? persistenceError.name : typeof persistenceError,
      }
    );
  }
  throw lifecycleError(
    pluginTenantLifecycleHostErrorCodes.enqueueFailed,
    input.pluginId,
    input.operation
  );
};

const createLifecycleJob = async (
  dependencies: PluginTenantLifecycleOrchestratorDependencies,
  input: StartPluginTenantLifecycleInput,
  jobInput: Parameters<PluginTenantLifecycleOrchestratorDependencies['createJob']>[0]
): Promise<StudioJobRecord> => {
  try {
    return await dependencies.createJob(jobInput);
  } catch (error) {
    try {
      await dependencies.repository.failUnclaimedLifecycle({
        instanceId: input.instanceId,
        pluginId: input.pluginId,
        generation: jobInput.generation,
        readinessStatus: 'blocked',
        errorCode: pluginTenantLifecycleHostErrorCodes.jobCreationFailed,
        retryKind: 'retryable',
      });
    } catch (persistenceError) {
      dependencies.logger.error(
        'Plugin-Tenant-Lifecycle konnte einen Job-Erstellungsfehler nicht persistieren',
        {
          operation: 'plugin_tenant_lifecycle_job_creation_cleanup',
          result: 'secondary_failure',
          error_code: 'plugin_tenant_lifecycle_job_creation_cleanup_failed',
          instance_id: input.instanceId,
          plugin_id: input.pluginId,
          job_creation_error_type: error instanceof Error ? error.name : typeof error,
          persistence_error_type:
            persistenceError instanceof Error ? persistenceError.name : typeof persistenceError,
        }
      );
    }
    throw lifecycleError(
      pluginTenantLifecycleHostErrorCodes.jobCreationFailed,
      input.pluginId,
      input.operation
    );
  }
};

const terminalizeUnclaimedJob = async (
  dependencies: PluginTenantLifecycleOrchestratorDependencies,
  input: StartPluginTenantLifecycleInput,
  job: StudioJobRecord,
  errorCode: string
): Promise<void> => {
  try {
    await dependencies.markUnclaimedJobFailed({ instanceId: input.instanceId, job, errorCode });
  } catch (persistenceError) {
    dependencies.logger.error(
      'Plugin-Tenant-Lifecycle konnte einen nicht beanspruchten Job nicht terminalisieren',
      {
        operation: 'plugin_tenant_lifecycle_claim_cleanup',
        result: 'secondary_failure',
        error_code: 'plugin_tenant_lifecycle_claim_cleanup_failed',
        instance_id: input.instanceId,
        plugin_id: input.pluginId,
        job_id: job.id,
        persistence_error_type:
          persistenceError instanceof Error ? persistenceError.name : typeof persistenceError,
      }
    );
  }
};

export const createPluginTenantLifecycleOrchestrator = (
  dependencies: PluginTenantLifecycleOrchestratorDependencies
) => ({
  async start(input: StartPluginTenantLifecycleInput): Promise<StartPluginTenantLifecycleResult> {
    const { operationDefinition, registration } = await resolveLifecycleOperation(
      dependencies,
      input
    );
    const requestedLifecycle = await dependencies.repository.requestLifecycle({
      instanceId: input.instanceId,
      pluginId: input.pluginId,
      operation: input.operation,
    });
    const generation = requestedLifecycle.desiredGeneration;
    const job = await createLifecycleJob(dependencies, input, {
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
    let claimedLifecycle;
    try {
      claimedLifecycle = await dependencies.repository.claimLifecycle({
        instanceId: input.instanceId,
        pluginId: input.pluginId,
        jobId: job.id,
        generation,
        operation: input.operation,
      });
    } catch {
      await terminalizeUnclaimedJob(
        dependencies,
        input,
        job,
        pluginTenantLifecycleHostErrorCodes.claimFailed
      );
      throw lifecycleError(
        pluginTenantLifecycleHostErrorCodes.claimFailed,
        input.pluginId,
        input.operation
      );
    }
    if (!claimedLifecycle) {
      await terminalizeUnclaimedJob(
        dependencies,
        input,
        job,
        pluginTenantLifecycleHostErrorCodes.claimConflict
      );
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
        executionLane: registration.executionLane ?? 'default',
        runAt: new Date(input.scheduledAt),
      });
    } catch {
      return handleEnqueueFailure(dependencies, input, job, generation);
    }

    return { lifecycle: claimedLifecycle, job };
  },
});
