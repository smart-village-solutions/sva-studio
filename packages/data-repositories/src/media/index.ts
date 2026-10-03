import type { SqlExecutor } from '../iam/repositories/types.js';
import type { MediaRepository } from './repository-types.js';
import * as asset_statements from './asset-statements.js';
import * as asset_list_statements from './asset-list-statements.js';
import * as upload_statements from './upload-statements.js';
import * as storage_reference_statements from './storage-reference-statements.js';
import * as content_save_start_statements from './content-save-start-statements.js';
import * as content_save_transition_statements from './content-save-transition-statements.js';
import * as content_save_finalize_statements from './content-save-finalize-statements.js';
import { createContentSaveMethods } from './content-save-methods.js';
import { createContentSaveFinalizeMethods } from './content-save-finalize-methods.js';
import { createAssetMethods } from './asset-methods.js';
import { createUploadMethods } from './upload-methods.js';
import { createStorageMethods } from './storage-methods.js';
import { createReferenceMethods } from './reference-methods.js';

export type * from './model-types.js';
export type * from './repository-types.js';

export const createMediaRepository = (executor: SqlExecutor): MediaRepository => ({
  ...createAssetMethods(executor),
  ...createUploadMethods(executor),
  ...createStorageMethods(executor),
  ...createReferenceMethods(executor),
  ...createContentSaveMethods(executor),
  ...createContentSaveFinalizeMethods(executor),
});

export const mediaStatements = {
  upsertAsset: asset_statements.upsertAssetStatement,
  getAssetById: asset_statements.getAssetByIdStatement,
  getAssetByStorageKey: asset_statements.getAssetByStorageKeyStatement,
  getProvisionalAssetByDraft: asset_statements.getProvisionalAssetByDraftStatement,
  listAssetsByOperation: asset_statements.listAssetsByOperationStatement,
  listAssets: asset_list_statements.listAssetsStatement,
  countAssets: asset_list_statements.countAssetsStatement,
  deleteAsset: asset_statements.deleteAssetStatement,
  deleteVariantsByAssetId: asset_statements.deleteVariantsByAssetIdStatement,
  upsertVariant: upload_statements.upsertVariantStatement,
  listVariantsByAssetId: upload_statements.listVariantsByAssetIdStatement,
  upsertUploadSession: upload_statements.upsertUploadSessionStatement,
  refreshPendingUploadSession: upload_statements.refreshPendingUploadSessionStatement,
  getUploadSessionById: upload_statements.getUploadSessionByIdStatement,
  getUploadSessionByAssetId: upload_statements.getUploadSessionByAssetIdStatement,
  claimUploadSession: upload_statements.claimUploadSessionStatement,
  lockUploadSessionClaim: upload_statements.lockUploadSessionClaimStatement,
  upsertStorageUsage: storage_reference_statements.upsertStorageUsageStatement,
  applyStorageUsageDelta: storage_reference_statements.applyStorageUsageDeltaStatement,
  tryApplyStorageUsageWithinQuota:
    storage_reference_statements.tryApplyStorageUsageWithinQuotaStatement,
  getStorageUsage: storage_reference_statements.getStorageUsageStatement,
  upsertStorageQuota: storage_reference_statements.upsertStorageQuotaStatement,
  getStorageQuota: storage_reference_statements.getStorageQuotaStatement,
  deleteReferencesForTarget: storage_reference_statements.deleteReferencesForTargetStatement,
  insertReference: storage_reference_statements.insertReferenceStatement,
  listReferencesByAssetId: storage_reference_statements.listReferencesByAssetIdStatement,
  listReferencesByTarget: storage_reference_statements.listReferencesByTargetStatement,
  createContentSaveOperation: content_save_start_statements.createContentSaveOperationStatement,
  getContentSaveOperation: content_save_start_statements.getContentSaveOperationStatement,
  lockOpenContentSaveOperationForUpload:
    content_save_start_statements.lockOpenContentSaveOperationForUploadStatement,
  replaceContentSaveOperationReferences:
    content_save_start_statements.replaceContentSaveOperationReferencesStatement,
  markContentSaveOperationContentSaved:
    content_save_transition_statements.markContentSaveOperationContentSavedStatement,
  markContentSaveOperationSavingContent:
    content_save_transition_statements.markContentSaveOperationSavingContentStatement,
  markContentSaveOperationOutcomeUnknown:
    content_save_transition_statements.markContentSaveOperationOutcomeUnknownStatement,
  commitContentSaveOperation:
    content_save_transition_statements.commitContentSaveOperationStatement,
  markContentSaveOperationAbandonPending:
    content_save_finalize_statements.markContentSaveOperationAbandonPendingStatement,
  finalizeContentSaveOperationAbandoned:
    content_save_finalize_statements.finalizeContentSaveOperationAbandonedStatement,
  claimContentSaveOperationRecovery:
    content_save_finalize_statements.claimContentSaveOperationRecoveryStatement,
  finalizeContentSaveOperationCleanup:
    content_save_finalize_statements.finalizeContentSaveOperationCleanupStatement,
} as const;

export type { SqlExecutionResult } from '../iam/repositories/types.js';
