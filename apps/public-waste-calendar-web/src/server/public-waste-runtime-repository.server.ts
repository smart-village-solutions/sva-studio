import { Pool } from 'pg';
import { type PublicWasteConfig } from '../lib/public-waste-config.server.js';
import { createPublicWasteRepository } from '../lib/public-waste-repository.server.js';
import type { RepositoryHandle } from './public-waste-runtime.js';

export const createRepositoryHandle = async (
  config: PublicWasteConfig
): Promise<RepositoryHandle> => {
  const pool = new Pool({
    connectionString: config.database.databaseUrl,
    max: 4,
    idleTimeoutMillis: 5_000,
    connectionTimeoutMillis: 5_000,
  });

  return {
    pool,
    schemaName: config.database.schemaName,
    repository: createPublicWasteRepository({
      schemaName: config.database.schemaName,
      execute: async <TRow = Record<string, unknown>>(input: {
        readonly text: string;
        readonly values?: readonly unknown[];
      }) => {
        const result = await pool.query(input.text, input.values ? [...input.values] : undefined);
        return {
          rowCount: result.rowCount ?? 0,
          rows: result.rows as readonly TRow[],
        };
      },
    }),
    dispose: async () => {
      await pool.end();
    },
  };
};
