import type { SqlExecutor } from '../iam/repositories/types.js';
import type { MediaAssetRecord } from './model-types.js';
import type { MediaRepository } from './repository-types.js';
import type { MediaAssetRow } from './rows.js';
import { mapAssetRow } from './rows.js';
import {
  lockAssetByIdStatement,
  listEditingCopiesStatement,
  claimAssetDeletionStatement,
  finalizeAssetDeletionStatement,
} from './asset-lifecycle-statements.js';

export const assertMediaEditingSource = async (
  executor: SqlExecutor,
  input: MediaAssetRecord
): Promise<void> => {
  const existing = (
    await executor.execute<MediaAssetRow>(lockAssetByIdStatement(input.instanceId, input.id))
  ).rows[0];
  if (existing && existing.visibility !== input.visibility) {
    const copies = await executor.execute({
      text: 'SELECT id FROM iam.media_assets WHERE instance_id = $1 AND editing_source_asset_id = $2 LIMIT 1;',
      values: [input.instanceId, input.id],
    });
    if (
      existing.editing_document ||
      existing.editing_source_key ||
      existing.editing_source_asset_id ||
      copies.rows.length
    ) {
      throw new Error('media_visibility_fixed');
    }
  }
  if (!input.editingSourceAssetId) return;
  const result = await executor.execute<MediaAssetRow>(
    lockAssetByIdStatement(input.instanceId, input.editingSourceAssetId)
  );
  const source = result.rows[0];
  if (
    !source ||
    source.deletion_pending ||
    source.lifecycle_status !== 'active' ||
    source.upload_status !== 'processed' ||
    source.processing_status !== 'ready' ||
    source.editing_source_asset_id ||
    source.visibility !== input.visibility
  ) {
    throw new Error('media_editing_source_unavailable');
  }
};

export const createAssetLifecycleMethods = (
  executor: SqlExecutor
): Pick<
  MediaRepository,
  'lockAssetById' | 'listEditingCopies' | 'claimAssetDeletion' | 'finalizeAssetDeletion'
> => ({
  async lockAssetById(instanceId, assetId) {
    const result = await executor.execute<MediaAssetRow>(
      lockAssetByIdStatement(instanceId, assetId)
    );
    return result.rows[0] ? mapAssetRow(result.rows[0]) : null;
  },
  async listEditingCopies(instanceId, assetId) {
    const result = await executor.execute<Pick<MediaAssetRow, 'id' | 'metadata'>>(
      listEditingCopiesStatement(instanceId, assetId)
    );
    return result.rows.map((row) => ({ id: row.id, metadata: row.metadata ?? {} }));
  },
  async claimAssetDeletion(instanceId, assetId) {
    // Match worker lock order: session before asset. No accepted job can race cleanup.
    await executor.execute({
      text: 'SELECT id FROM iam.media_upload_sessions WHERE instance_id = $1 AND asset_id = $2 ORDER BY id FOR UPDATE;',
      values: [instanceId, assetId],
    });
    const locked = await executor.execute<MediaAssetRow>(
      lockAssetByIdStatement(instanceId, assetId)
    );
    if (!locked.rows[0]) return false;
    const result = await executor.execute(claimAssetDeletionStatement(instanceId, assetId));
    return result.rowCount > 0;
  },
  async finalizeAssetDeletion(instanceId, assetId) {
    const result = await executor.execute<{ deleted: boolean }>(
      finalizeAssetDeletionStatement(instanceId, assetId)
    );
    return result.rows[0]?.deleted === true;
  },
});
