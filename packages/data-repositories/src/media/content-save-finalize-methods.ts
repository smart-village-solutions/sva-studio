import type { SqlExecutor } from '../iam/repositories/types.js';
import type { MediaRepository } from './repository-types.js';
import type { MediaContentSaveOperationRow } from './rows.js';
import { mapContentSaveOperationRow } from './rows.js';
import { commitContentSaveOperationStatement } from './content-save-transition-statements.js';
import {
  markContentSaveOperationAbandonPendingStatement,
  finalizeContentSaveOperationAbandonedStatement,
  claimContentSaveOperationRecoveryStatement,
  finalizeContentSaveOperationCleanupStatement,
} from './content-save-finalize-statements.js';

export const createContentSaveFinalizeMethods = (
  executor: SqlExecutor
): Pick<
  MediaRepository,
  | 'commitContentSaveOperation'
  | 'markContentSaveOperationAbandonPending'
  | 'finalizeContentSaveOperationAbandoned'
  | 'claimContentSaveOperationRecovery'
  | 'finalizeContentSaveOperationCleanup'
> => ({
  async commitContentSaveOperation(
    input: Parameters<MediaRepository['commitContentSaveOperation']>[0]
  ) {
    const result = await executor.execute<{ readonly successful: boolean }>(
      commitContentSaveOperationStatement(input)
    );
    return result.rows[0]?.successful ?? false;
  },
  async markContentSaveOperationAbandonPending(
    input: Parameters<MediaRepository['markContentSaveOperationAbandonPending']>[0]
  ) {
    const result = await executor.execute(markContentSaveOperationAbandonPendingStatement(input));
    return result.rowCount > 0;
  },
  async finalizeContentSaveOperationAbandoned(
    input: Parameters<MediaRepository['finalizeContentSaveOperationAbandoned']>[0]
  ) {
    const result = await executor.execute(finalizeContentSaveOperationAbandonedStatement(input));
    return result.rowCount > 0;
  },
  async claimContentSaveOperationRecovery(
    input: Parameters<MediaRepository['claimContentSaveOperationRecovery']>[0]
  ) {
    const result = await executor.execute<MediaContentSaveOperationRow>(
      claimContentSaveOperationRecoveryStatement(input)
    );
    return result.rows[0] ? mapContentSaveOperationRow(result.rows[0]) : null;
  },
  async finalizeContentSaveOperationCleanup(
    input: Parameters<MediaRepository['finalizeContentSaveOperationCleanup']>[0]
  ) {
    const result = await executor.execute<{ readonly successful: boolean }>(
      finalizeContentSaveOperationCleanupStatement(input)
    );
    return result.rows[0]?.successful ?? false;
  },
});
