import type { MediaRepository } from './repository-types.js';
import type { SqlExecutor } from '../iam/repositories/types.js';
import type { MediaUploadSessionRow } from './rows.js';
import { mapUploadSessionRow } from './rows.js';
import {
  upsertUploadSessionStatement,
  getUploadSessionByIdStatement,
  refreshPendingUploadSessionStatement,
  getUploadSessionByAssetIdStatement,
  claimUploadSessionStatement,
  lockUploadSessionClaimStatement,
} from './upload-statements.js';

export const createUploadMethods = (
  executor: SqlExecutor
): Pick<
  MediaRepository,
  | 'upsertUploadSession'
  | 'refreshPendingUploadSession'
  | 'getUploadSessionById'
  | 'getUploadSessionByAssetId'
  | 'claimUploadSession'
  | 'lockUploadSessionClaim'
> => ({
  async upsertUploadSession(input) {
    await executor.execute(upsertUploadSessionStatement(input));
  },
  async refreshPendingUploadSession(input) {
    const result = await executor.execute<{ readonly id: string }>(
      refreshPendingUploadSessionStatement(input)
    );
    return result.rows.length > 0;
  },
  async getUploadSessionById(instanceId, sessionId) {
    const result = await executor.execute<MediaUploadSessionRow>(
      getUploadSessionByIdStatement(instanceId, sessionId)
    );
    return result.rows[0] ? mapUploadSessionRow(result.rows[0]) : null;
  },
  async getUploadSessionByAssetId(instanceId, assetId) {
    const result = await executor.execute<MediaUploadSessionRow>(
      getUploadSessionByAssetIdStatement(instanceId, assetId)
    );
    return result.rows[0] ? mapUploadSessionRow(result.rows[0]) : null;
  },
  async claimUploadSession(instanceId, sessionId) {
    const result = await executor.execute<MediaUploadSessionRow>(
      claimUploadSessionStatement(instanceId, sessionId)
    );
    return result.rows[0] ? mapUploadSessionRow(result.rows[0]) : null;
  },
  async lockUploadSessionClaim(input) {
    const result = await executor.execute<{ readonly claimed: boolean }>(
      lockUploadSessionClaimStatement(input)
    );
    return result.rows[0]?.claimed === true;
  },
});
