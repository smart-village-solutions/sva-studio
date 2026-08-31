import type {
  InstanceRegistryRepository,
  SqlExecutor,
  SqlExecutionResult,
  SqlStatement,
} from '@sva/data-repositories';
import { createSdkLogger } from '@sva/server-runtime';

import { createInstanceRegistryService } from './service.js';
import { createReconcileModuleActivationPoliciesHandler } from './service-module-activation.js';
import type { InstanceRegistryService, InstanceRegistryServiceDeps } from './service-types.js';

const logger = createSdkLogger({ component: 'iam-instance-registry-runtime', level: 'info' });

export type InstanceRegistryQueryClient = {
  query<TRow = Record<string, unknown>>(
    text: string,
    values?: readonly unknown[]
  ): Promise<{ rowCount: number; rows: TRow[] }>;
  release(): void;
};

export type InstanceRegistryPool = {
  connect(): Promise<InstanceRegistryQueryClient>;
};

type ScopedRegistryServiceOptions = Readonly<{
  forceIamSync?: boolean;
  awaitActivationPolicyFollowUp?: boolean;
}>;

export type InstanceRegistryRuntimeDeps = {
  readonly resolvePool: () => InstanceRegistryPool | null;
  readonly createRepository: (executor: SqlExecutor) => InstanceRegistryRepository;
  readonly serviceDeps: Omit<InstanceRegistryServiceDeps, 'repository'>;
  readonly provisioningWorkerServiceDeps?: Omit<InstanceRegistryServiceDeps, 'repository'>;
  readonly afterModuleActivationPolicyReconcile?: (input: {
    readonly instanceId: string;
    readonly changedModuleIds: readonly string[];
  }) => void | Promise<void>;
};

const createExecutor = (client: InstanceRegistryQueryClient): SqlExecutor => ({
  execute: async <TRow = Record<string, unknown>>(
    statement: SqlStatement
  ): Promise<SqlExecutionResult<TRow>> => {
    const result = await client.query<TRow>(statement.text, statement.values);
    return {
      rowCount: result.rowCount,
      rows: result.rows,
    };
  },
});

const logActivationPolicyFollowUpError = (error: unknown, instanceId: string): void => {
  logger.error('instance_registry_activation_follow_up_failed', {
    operation: 'instance_registry_activation_follow_up',
    result: 'failed',
    error_code: 'activation_follow_up_failed',
    error_type: error instanceof Error ? error.name : typeof error,
    instance_id: instanceId,
  });
};

const runActivationPolicyFollowUp = (
  deps: InstanceRegistryRuntimeDeps,
  input: { readonly instanceId: string; readonly changedModuleIds: readonly string[] }
): void => {
  try {
    const followUp = deps.afterModuleActivationPolicyReconcile?.(input);
    if (followUp) {
      void followUp.catch((error) => logActivationPolicyFollowUpError(error, input.instanceId));
    }
  } catch (error) {
    logActivationPolicyFollowUpError(error, input.instanceId);
  }
};

const completeActivationPolicyFollowUp = async (
  deps: InstanceRegistryRuntimeDeps,
  input: { readonly instanceId: string; readonly changedModuleIds: readonly string[] },
  awaitFollowUp: boolean
): Promise<void> => {
  if (awaitFollowUp) {
    await deps.afterModuleActivationPolicyReconcile?.(input);
    return;
  }
  runActivationPolicyFollowUp(deps, input);
};

export const createInstanceRegistryRuntime = (deps: InstanceRegistryRuntimeDeps) => {
  const withScopedClient = async <T>(
    instanceId: string,
    work: (client: InstanceRegistryQueryClient) => Promise<T>
  ): Promise<T> => {
    const pool = deps.resolvePool();
    if (!pool) {
      throw new Error('IAM database not configured');
    }
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT set_config($1, $2, true);', ['app.instance_id', instanceId]);
      const result = await work(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  };
  const withRegistryRepository = async <T>(
    work: (repository: InstanceRegistryRepository) => Promise<T>
  ): Promise<T> => {
    const pool = deps.resolvePool();
    if (!pool) {
      throw new Error('IAM database not configured');
    }
    const client = await pool.connect();
    try {
      return await work(deps.createRepository(createExecutor(client)));
    } finally {
      client.release();
    }
  };
  const withScopedRegistryRepository = async <T>(
    instanceId: string,
    work: (repository: InstanceRegistryRepository) => Promise<T>
  ): Promise<T> =>
    withScopedClient(instanceId, (client) => work(deps.createRepository(createExecutor(client))));
  const createService = (
    repository: InstanceRegistryRepository,
    serviceDeps: Omit<InstanceRegistryServiceDeps, 'repository'>
  ): InstanceRegistryService =>
    createInstanceRegistryService({
      repository,
      ...serviceDeps,
    });
  const withRegistryService = async <T>(
    work: (service: InstanceRegistryService) => Promise<T>
  ): Promise<T> =>
    withRegistryRepository((repository) => work(createService(repository, deps.serviceDeps)));
  const withScopedRegistryService = async <T>(
    instanceId: string,
    work: (service: InstanceRegistryService) => Promise<T>,
    options: ScopedRegistryServiceOptions = {}
  ): Promise<T> => {
    const scopedResult = await withScopedRegistryRepository(instanceId, async (repository) => {
      const serviceDeps = { repository, ...deps.serviceDeps };
      const service = createInstanceRegistryService(serviceDeps);
      const reconcileResult = await createReconcileModuleActivationPoliciesHandler(
        serviceDeps,
        options
      )({ instanceId });
      return { reconcileResult, result: await work(service) };
    });
    await completeActivationPolicyFollowUp(
      deps,
      { instanceId, changedModuleIds: scopedResult.reconcileResult.changedModuleIds },
      options.awaitActivationPolicyFollowUp === true
    );
    return scopedResult.result;
  };
  const getProvisioningWorkerServiceDeps = (
    repository: InstanceRegistryRepository
  ): InstanceRegistryServiceDeps => ({
    repository,
    ...(deps.provisioningWorkerServiceDeps ?? deps.serviceDeps),
  });
  const withRegistryProvisioningWorkerService = async <T>(
    work: (service: InstanceRegistryService) => Promise<T>
  ): Promise<T> =>
    withRegistryRepository((repository) =>
      work(createInstanceRegistryService(getProvisioningWorkerServiceDeps(repository)))
    );
  const withRegistryProvisioningWorkerDeps = async <T>(
    work: (serviceDeps: InstanceRegistryServiceDeps) => Promise<T>
  ): Promise<T> =>
    withRegistryRepository((repository) => work(getProvisioningWorkerServiceDeps(repository)));
  return {
    withRegistryRepository,
    withScopedRegistryRepository,
    withRegistryService,
    withScopedRegistryService,
    withRegistryProvisioningWorkerService,
    withRegistryProvisioningWorkerDeps,
  };
};
