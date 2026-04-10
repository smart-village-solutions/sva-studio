import { createPoolResolver } from '../shared/db-helpers.js';
import { createInstanceRegistryRepository } from '@sva/data';
import { invalidateInstanceRegistryHost } from '@sva/data/server';

import {
  getInstanceKeycloakPlan,
  getInstanceKeycloakPreflight,
  getInstanceKeycloakStatus,
} from './provisioning-auth.js';
import { createInstanceRegistryService } from './service.js';
import { getIamDatabaseUrl } from '../runtime-secrets.server.js';
import {
  getInstanceKeycloakPlanViaProvisioner,
  getInstanceKeycloakPreflightViaProvisioner,
  getInstanceKeycloakStatusViaProvisioner,
  provisionInstanceAuthArtifactsViaProvisioner,
} from './provisioning-auth.js';

const getWorkerKeycloakPreflight = async (input: Parameters<typeof getInstanceKeycloakPreflight>[0]) =>
  getInstanceKeycloakPreflightViaProvisioner(input);

const getWorkerKeycloakPlan = async (input: Parameters<typeof getInstanceKeycloakPlan>[0]) =>
  getInstanceKeycloakPlanViaProvisioner(input);

const getWorkerKeycloakStatus = async (input: Parameters<typeof getInstanceKeycloakStatus>[0]) =>
  getInstanceKeycloakStatusViaProvisioner(input);

const resolvePool = createPoolResolver(getIamDatabaseUrl);

type QueryClient = {
  query<TRow = Record<string, unknown>>(text: string, values?: readonly unknown[]): Promise<{ rowCount: number; rows: TRow[] }>;
  release(): void;
};

const createExecutor = (client: QueryClient) => ({
  execute: async <TRow = Record<string, unknown>>(statement: { text: string; values: readonly unknown[] }) => {
    const result = await client.query<TRow>(statement.text, statement.values);
    return {
      rowCount: result.rowCount,
      rows: result.rows,
    };
  },
});

const createProvisioningWorkerDeps = (repository: ReturnType<typeof createInstanceRegistryRepository>) => ({
  repository,
  invalidateHost: invalidateInstanceRegistryHost,
  provisionInstanceAuth: provisionInstanceAuthArtifactsViaProvisioner,
  getKeycloakPreflight: getWorkerKeycloakPreflight,
  planKeycloakProvisioning: getWorkerKeycloakPlan,
  getKeycloakStatus: getWorkerKeycloakStatus,
});

export const withRegistryRepository = async <T>(
  work: (repository: ReturnType<typeof createInstanceRegistryRepository>) => Promise<T>
): Promise<T> => {
  const pool = resolvePool();
  if (!pool) {
    throw new Error('IAM database not configured');
  }

  const client = await pool.connect();
  try {
    return await work(createInstanceRegistryRepository(createExecutor(client)));
  } finally {
    client.release();
  }
};

export const withRegistryService = async <T>(work: (service: ReturnType<typeof createInstanceRegistryService>) => Promise<T>): Promise<T> =>
  withRegistryRepository((repository) =>
    work(
      createInstanceRegistryService({
        repository,
        invalidateHost: invalidateInstanceRegistryHost,
      })
    )
  );

export const withRegistryProvisioningWorkerService = async <T>(
  work: (service: ReturnType<typeof createInstanceRegistryService>) => Promise<T>
): Promise<T> =>
  withRegistryRepository((repository) =>
    work(createInstanceRegistryService(createProvisioningWorkerDeps(repository)))
  );

export const withRegistryProvisioningWorkerDeps = async <T>(
  work: (deps: ReturnType<typeof createProvisioningWorkerDeps>) => Promise<T>
): Promise<T> => withRegistryRepository((repository) => work(createProvisioningWorkerDeps(repository)));
