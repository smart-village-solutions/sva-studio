import type { SqlExecutor } from '../iam/repositories/types.js';
import type { MediaRepository } from './repository-types.js';
import type { MediaReferenceRow } from './rows.js';
import { mapReferenceRow } from './rows.js';
import {
  deleteReferencesForTargetStatement,
  insertReferenceStatement,
  listReferencesByAssetIdStatement,
  listReferencesByTargetStatement,
} from './storage-reference-statements.js';

export const createReferenceMethods = (
  executor: SqlExecutor
): Pick<
  MediaRepository,
  'replaceReferences' | 'listReferencesByAssetId' | 'listReferencesByTarget' | 'getUsageImpact'
> => ({
  async replaceReferences(input) {
    await executor.execute(
      deleteReferencesForTargetStatement(input.instanceId, input.targetType, input.targetId)
    );
    for (const reference of input.references) {
      await executor.execute(insertReferenceStatement(input.instanceId, reference));
    }
  },
  async listReferencesByAssetId(instanceId, assetId) {
    const result = await executor.execute<MediaReferenceRow>(
      listReferencesByAssetIdStatement(instanceId, assetId)
    );
    return result.rows.map(mapReferenceRow);
  },
  async listReferencesByTarget(instanceId, targetType, targetId) {
    const result = await executor.execute<MediaReferenceRow>(
      listReferencesByTargetStatement(instanceId, targetType, targetId)
    );
    return result.rows.map(mapReferenceRow);
  },
  async getUsageImpact(instanceId, assetId) {
    const references = await this.listReferencesByAssetId(instanceId, assetId);
    return {
      assetId,
      totalReferences: references.length,
      references,
    };
  },
});
