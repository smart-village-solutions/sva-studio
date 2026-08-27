import type { WasteMainserverSourceRevisionRecord } from '@sva/core';

import type { SqlExecutor, SqlStatement } from '../iam/repositories/types.js';
import type { WasteMasterDataRepository } from './master-data.contract.js';

type WasteMainserverSourceStateRow = Readonly<{
  source_revision: string;
  changed_at: string | null;
}>;

const getWasteMainserverSourceRevisionStatement = (): SqlStatement => ({
  text: `
SELECT source_revision::text, changed_at::text
FROM waste_mainserver_source_state
WHERE id = TRUE
LIMIT 1;
`,
  values: [],
});

const mapSourceState = (
  row: WasteMainserverSourceStateRow
): WasteMainserverSourceRevisionRecord => ({
  sourceRevision: row.source_revision,
  ...(row.changed_at ? { changedAt: row.changed_at } : {}),
});

export const createWasteMainserverSourceStateRepositoryPart = (
  executor: SqlExecutor
): Pick<WasteMasterDataRepository, 'getWasteMainserverSourceRevision'> => ({
  async getWasteMainserverSourceRevision() {
    const result = await executor.execute<WasteMainserverSourceStateRow>(
      getWasteMainserverSourceRevisionStatement()
    );
    return result.rows[0] ? mapSourceState(result.rows[0]) : null;
  },
});

export const wasteMainserverSourceStateStatements = {
  getWasteMainserverSourceRevision: getWasteMainserverSourceRevisionStatement,
} as const;
