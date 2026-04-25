import type { InstanceRegistryRepository, SqlExecutor, SqlExecutionResult, SqlStatement } from '@sva/data-repositories';

import { createInstanceRegistryService } from './service.js';
import type { InstanceRegistryService, InstanceRegistryServiceDeps } from './service-types.js';

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

export type InstanceRegistryRuntimeDeps = {
  readonly resolvePool: () => InstanceRegistryPool | null;
  readonly createRepository: (executor: SqlExecutor) => InstanceRegistryRepository;
  readonly serviceDeps: Omit<InstanceRegistryServiceDeps, 'repository'>;
  readonly provisioningWorkerServiceDeps?: Omit<InstanceRegistryServiceDeps, 'repository'>;
};

const createExecutor = (client: InstanceRegistryQueryClient): SqlExecutor => ({
  execute: async <TRow = Record<string, unknown>>(statement: SqlStatement): Promise<SqlExecutionResult<TRow>> => {
    const result = await client.query<TRow>(statement.text, statement.values);
    return {
      rowCount: result.rowCount,
      rows: result.rows,
    };
  },
});

export const createInstanceRegistryRuntime = (deps: InstanceRegistryRuntimeDeps) => {
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
    withRegistryService,
    withRegistryProvisioningWorkerService,
    withRegistryProvisioningWorkerDeps,
  };
};
