import type { MediaRepository } from './repository-types.js';
import type { SqlExecutor } from '../iam/repositories/types.js';
import type { MediaAssetRow, MediaVariantRow } from './rows.js';
import { mapAssetRow, mapVariantRow } from './rows.js';
import { upsertVariantStatement, listVariantsByAssetIdStatement } from './upload-statements.js';
import { listAssetsStatement, countAssetsStatement } from './asset-list-statements.js';
import {
  upsertAssetStatement,
  getAssetByIdStatement,
  getAssetByStorageKeyStatement,
  deleteAssetStatement,
  getProvisionalAssetByDraftStatement,
  listAssetsByOperationStatement,
  deleteVariantsByAssetIdStatement,
} from './asset-statements.js';

export const createAssetMethods = (
  executor: SqlExecutor
): Pick<
  MediaRepository,
  | 'upsertAsset'
  | 'getAssetById'
  | 'getAssetByStorageKey'
  | 'getProvisionalAssetByDraft'
  | 'listAssetsByOperation'
  | 'listAssets'
  | 'countAssets'
  | 'deleteAsset'
  | 'deleteVariantsByAssetId'
  | 'upsertVariant'
  | 'listVariantsByAssetId'
> => ({
  async upsertAsset(input) {
    await executor.execute(upsertAssetStatement(input));
  },
  async getAssetById(instanceId, assetId) {
    const result = await executor.execute<MediaAssetRow>(
      getAssetByIdStatement(instanceId, assetId)
    );
    return result.rows[0] ? mapAssetRow(result.rows[0]) : null;
  },
  async getAssetByStorageKey(instanceId, storageKey) {
    const result = await executor.execute<MediaAssetRow>(
      getAssetByStorageKeyStatement(instanceId, storageKey)
    );
    return result.rows[0] ? mapAssetRow(result.rows[0]) : null;
  },
  async getProvisionalAssetByDraft(input) {
    const result = await executor.execute<MediaAssetRow>(
      getProvisionalAssetByDraftStatement(input)
    );
    return result.rows[0] ? mapAssetRow(result.rows[0]) : null;
  },
  async listAssetsByOperation(input) {
    const result = await executor.execute<MediaAssetRow>(listAssetsByOperationStatement(input));
    return result.rows.map(mapAssetRow);
  },
  async listAssets(filter) {
    const result = await executor.execute<MediaAssetRow>(listAssetsStatement(filter));
    return result.rows.map(mapAssetRow);
  },
  async countAssets(filter) {
    const result = await executor.execute<{ readonly total: number }>(countAssetsStatement(filter));
    return result.rows[0]?.total ?? 0;
  },
  async deleteAsset(instanceId, assetId) {
    await executor.execute(deleteAssetStatement(instanceId, assetId));
  },
  async deleteVariantsByAssetId(instanceId, assetId) {
    await executor.execute(deleteVariantsByAssetIdStatement(instanceId, assetId));
  },
  async upsertVariant(instanceId, input) {
    await executor.execute(upsertVariantStatement(instanceId, input));
  },
  async listVariantsByAssetId(instanceId, assetId) {
    const result = await executor.execute<MediaVariantRow>(
      listVariantsByAssetIdStatement(instanceId, assetId)
    );
    return result.rows.map(mapVariantRow);
  },
});
