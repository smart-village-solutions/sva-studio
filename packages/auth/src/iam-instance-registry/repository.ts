import { createPoolResolver } from '../shared/db-helpers.js';
import { createInstanceRegistryRepository } from '@sva/data';
import { invalidateInstanceRegistryHost } from '@sva/data/server';

import { getInstanceKeycloakStatus, provisionInstanceAuthArtifacts } from './provisioning-auth.js';
import { createInstanceRegistryService } from './service.js';
import { getIamDatabaseUrl } from '../runtime-secrets.server.js';

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
        provisionInstanceAuth: provisionInstanceAuthArtifacts,
        getKeycloakStatus: getInstanceKeycloakStatus,
      })
    )
  );
