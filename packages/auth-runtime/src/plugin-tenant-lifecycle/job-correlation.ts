import type { StudioJobError, StudioJobRecord } from '@sva/core';
import type { PluginTenantLifecycleRepository } from '@sva/data-repositories';
import {
  createPluginTenantReadinessSnapshot,
  pluginTenantLifecycleOperations,
  type PluginJobExecutionResult,
  type PluginTenantLifecycleOperation,
  type PluginTenantLifecycleRegistryEntry,
} from '@sva/plugin-sdk';

const lifecycleOperations = new Set<string>(pluginTenantLifecycleOperations);

export const pluginTenantLifecycleJobInputKey = 'studioTenantLifecycle';

export type PluginTenantLifecycleJobMetadata = {
  readonly operation: PluginTenantLifecycleOperation;
  readonly generation: number;
};

const permanentLifecycleError = (code: string, job: StudioJobRecord): Error => {
  const error = new Error(`${code}:${job.pluginId ?? 'unknown'}:${job.id}`);
  (error as Error & { cause: Readonly<Record<string, string>> }).cause = {
    category: 'permanent',
    code,
  };
  return error;
};

export const readPluginTenantLifecycleJobMetadata = (
  job: Pick<StudioJobRecord, 'inputPayload'>
): PluginTenantLifecycleJobMetadata | null => {
  const value = job.inputPayload[pluginTenantLifecycleJobInputKey];
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const operation = (value as { readonly operation?: unknown }).operation;
  const generation = (value as { readonly generation?: unknown }).generation;
  if (
    typeof operation !== 'string' ||
    !lifecycleOperations.has(operation) ||
    !Number.isSafeInteger(generation) ||
    Number(generation) < 1
  ) {
    throw new Error('invalid_plugin_tenant_lifecycle_job_metadata');
  }

  return {
    operation: operation as PluginTenantLifecycleOperation,
    generation: Number(generation),
  };
};

type CorrelationDependencies = {
  readonly lifecycleRegistry: ReadonlyMap<string, PluginTenantLifecycleRegistryEntry>;
  readonly withRepository: <T>(
    instanceId: string,
    work: (repository: PluginTenantLifecycleRepository) => Promise<T>
  ) => Promise<T>;
  readonly now?: () => string;
};

const resolveLifecycleContext = (
  dependencies: Pick<CorrelationDependencies, 'lifecycleRegistry'>,
  job: StudioJobRecord
) => {
  let metadata: PluginTenantLifecycleJobMetadata | null;
  try {
    metadata = readPluginTenantLifecycleJobMetadata(job);
  } catch {
    throw permanentLifecycleError('plugin_tenant_lifecycle_job_metadata_invalid', job);
  }
  if (!metadata) {
    return null;
  }
  if (job.source !== 'plugin' || !job.pluginId) {
    throw permanentLifecycleError('plugin_tenant_lifecycle_job_identity_invalid', job);
  }

  const definition = dependencies.lifecycleRegistry.get(job.pluginId);
  const operation = definition?.operations.find(
    (candidate) => candidate.operation === metadata.operation
  );
  if (!definition || operation?.jobTypeId !== job.jobTypeId) {
    throw permanentLifecycleError('plugin_tenant_lifecycle_job_contract_mismatch', job);
  }

  return { definition, metadata, pluginId: job.pluginId };
};

export const createPluginTenantLifecycleJobCorrelation = (
  dependencies: CorrelationDependencies
) => ({
  async complete(input: {
    readonly job: StudioJobRecord;
    readonly result: PluginJobExecutionResult | void;
  }): Promise<void> {
    const context = resolveLifecycleContext(dependencies, input.job);
    if (!context) {
      return;
    }
    if (!input.result?.tenantLifecycle) {
      throw permanentLifecycleError('plugin_tenant_lifecycle_result_missing', input.job);
    }

    let snapshot;
    try {
      snapshot = createPluginTenantReadinessSnapshot({
        definition: context.definition,
        pluginId: context.pluginId,
        instanceId: input.job.instanceId,
        generation: context.metadata.generation,
        result: input.result.tenantLifecycle,
        updatedAt: (dependencies.now ?? (() => new Date().toISOString()))(),
      });
    } catch {
      throw permanentLifecycleError('plugin_tenant_lifecycle_result_invalid', input.job);
    }
    await dependencies.withRepository(input.job.instanceId, async (repository) => {
      const completed = await repository.completeLifecycle({
        instanceId: input.job.instanceId,
        pluginId: context.pluginId,
        jobId: input.job.id,
        generation: context.metadata.generation,
        operation: context.metadata.operation,
        readinessStatus: snapshot.status,
        readinessRevision: snapshot.revision,
        readinessChecks: snapshot.checks,
      });
      if (completed) {
        return;
      }

      const current = await repository.getLifecycle(input.job.instanceId, context.pluginId);
      if (current?.completedGeneration === context.metadata.generation) {
        return;
      }
      throw permanentLifecycleError('plugin_tenant_lifecycle_completion_stale', input.job);
    });
  },

  async fail(input: {
    readonly job: StudioJobRecord;
    readonly error: StudioJobError;
    readonly reason: 'failed' | 'missing_handler' | 'cancelled';
  }): Promise<void> {
    const context = resolveLifecycleContext(dependencies, input.job);
    if (!context) {
      return;
    }
    await dependencies.withRepository(input.job.instanceId, (repository) =>
      repository.failLifecycle({
        instanceId: input.job.instanceId,
        pluginId: context.pluginId,
        jobId: input.job.id,
        generation: context.metadata.generation,
        readinessStatus: input.reason === 'cancelled' ? 'degraded' : 'blocked',
        errorCode: input.error.code,
        retryKind: 'terminal',
      })
    );
  },
});
