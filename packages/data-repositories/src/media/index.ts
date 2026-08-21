import type { SqlExecutor, SqlStatement } from '../iam/repositories/types.js';

export type MediaAssetLifecycleStatus = 'provisional' | 'active';

export type MediaAssetRecord = {
  readonly id: string;
  readonly instanceId: string;
  readonly storageKey: string;
  readonly mediaType: string;
  readonly mimeType: string;
  readonly byteSize: number;
  readonly visibility: string;
  readonly uploadStatus: string;
  readonly processingStatus: string;
  readonly lifecycleStatus?: MediaAssetLifecycleStatus;
  readonly provisionalOperationId?: string;
  readonly provisionalOwnerSubject?: string;
  readonly provisionalDraftId?: string;
  readonly provisionalExpiresAt?: string;
  readonly metadata: Readonly<Record<string, unknown>>;
  readonly technical: Readonly<Record<string, unknown>>;
  readonly createdAt?: string;
  readonly updatedAt?: string;
};

export type MediaContentSaveOperationStatus =
  | 'preparing'
  | 'uploading'
  | 'saving_content'
  | 'content_saved'
  | 'committed'
  | 'abandon_pending'
  | 'abandoned'
  | 'outcome_unknown'
  | 'reconciliation_required';

export type MediaContentSaveOperationRecord = Readonly<{
  id: string;
  instanceId: string;
  actorSubject: string;
  targetType: string;
  targetId?: string;
  status: MediaContentSaveOperationStatus;
  errorCode?: string;
  expiresAt: string;
  createdAt?: string;
  updatedAt?: string;
}>;

export type MediaContentSaveOperationReference = Readonly<{
  id: string;
  assetId: string;
  role: string;
  sortOrder?: number;
}>;

export type MediaReferenceRecord = {
  readonly id: string;
  readonly assetId: string;
  readonly targetType: string;
  readonly targetId: string;
  readonly role: string;
  readonly sortOrder?: number;
  readonly createdAt?: string;
};

export type MediaVariantRecord = {
  readonly id: string;
  readonly assetId: string;
  readonly variantKey: string;
  readonly presetKey: string;
  readonly format: string;
  readonly width: number;
  readonly height?: number;
  readonly storageKey: string;
  readonly generationStatus: string;
  readonly createdAt?: string;
  readonly updatedAt?: string;
};

export type MediaUploadSessionRecord = {
  readonly id: string;
  readonly instanceId: string;
  readonly assetId: string;
  readonly storageKey: string;
  readonly mimeType: string;
  readonly byteSize: number;
  readonly status: string;
  readonly expiresAt?: string;
  readonly createdAt?: string;
  readonly updatedAt?: string;
};

export type MediaStorageUsageRecord = {
  readonly instanceId: string;
  readonly totalBytes: number;
  readonly assetCount: number;
  readonly updatedAt?: string;
};

export type MediaStorageUsageDelta = {
  readonly instanceId: string;
  readonly totalBytesDelta: number;
  readonly assetCountDelta: number;
};

export type MediaStorageUsageClaim = Readonly<{
  instanceId: string;
  totalBytes: number;
  assetCount: number;
}>;

export type MediaStorageQuotaRecord = {
  readonly instanceId: string;
  readonly maxBytes: number;
  readonly updatedAt?: string;
};

export type MediaStorageQuotaCheck = {
  readonly instanceId: string;
  readonly currentBytes: number;
  readonly additionalBytes: number;
  readonly maxBytes: number | null;
  readonly wouldExceed: boolean;
};

export type MediaUsageImpact = {
  readonly assetId: string;
  readonly totalReferences: number;
  readonly references: readonly MediaReferenceRecord[];
};

export type MediaAssetListFilter = {
  readonly instanceId: string;
  readonly search?: string;
  readonly visibility?: string;
  readonly afterStorageKey?: string;
  readonly order?: 'updatedAtDesc' | 'storageKeyAsc';
  readonly limit?: number;
  readonly offset?: number;
};

export type MediaRepository = {
  upsertAsset(input: MediaAssetRecord): Promise<void>;
  getAssetById(instanceId: string, assetId: string): Promise<MediaAssetRecord | null>;
  getAssetByStorageKey(instanceId: string, storageKey: string): Promise<MediaAssetRecord | null>;
  getProvisionalAssetByDraft(input: {
    readonly instanceId: string;
    readonly operationId: string;
    readonly draftId: string;
    readonly actorSubject: string;
  }): Promise<MediaAssetRecord | null>;
  listAssetsByOperation(input: {
    readonly instanceId: string;
    readonly operationId: string;
    readonly actorSubject: string;
  }): Promise<readonly MediaAssetRecord[]>;
  listAssets(filter: MediaAssetListFilter): Promise<readonly MediaAssetRecord[]>;
  countAssets(filter: Omit<MediaAssetListFilter, 'limit' | 'offset'>): Promise<number>;
  deleteAsset(instanceId: string, assetId: string): Promise<void>;
  deleteVariantsByAssetId(instanceId: string, assetId: string): Promise<void>;
  upsertVariant(instanceId: string, input: MediaVariantRecord): Promise<void>;
  listVariantsByAssetId(
    instanceId: string,
    assetId: string
  ): Promise<readonly MediaVariantRecord[]>;
  upsertUploadSession(input: MediaUploadSessionRecord): Promise<void>;
  getUploadSessionById(
    instanceId: string,
    sessionId: string
  ): Promise<MediaUploadSessionRecord | null>;
  getUploadSessionByAssetId(
    instanceId: string,
    assetId: string
  ): Promise<MediaUploadSessionRecord | null>;
  claimUploadSession(
    instanceId: string,
    sessionId: string
  ): Promise<MediaUploadSessionRecord | null>;
  upsertStorageUsage(input: MediaStorageUsageRecord): Promise<void>;
  applyStorageUsageDelta(input: MediaStorageUsageDelta): Promise<void>;
  tryApplyStorageUsageWithinQuota(input: MediaStorageUsageClaim): Promise<boolean>;
  getStorageUsage(instanceId: string): Promise<MediaStorageUsageRecord | null>;
  upsertStorageQuota(input: MediaStorageQuotaRecord): Promise<void>;
  getStorageQuota(instanceId: string): Promise<MediaStorageQuotaRecord | null>;
  wouldExceedStorageQuota(
    instanceId: string,
    additionalBytes: number
  ): Promise<MediaStorageQuotaCheck>;
  replaceReferences(input: {
    readonly instanceId: string;
    readonly targetType: string;
    readonly targetId: string;
    readonly references: readonly MediaReferenceRecord[];
  }): Promise<void>;
  listReferencesByAssetId(
    instanceId: string,
    assetId: string
  ): Promise<readonly MediaReferenceRecord[]>;
  listReferencesByTarget(
    instanceId: string,
    targetType: string,
    targetId: string
  ): Promise<readonly MediaReferenceRecord[]>;
  getUsageImpact(instanceId: string, assetId: string): Promise<MediaUsageImpact>;
  createContentSaveOperation(
    input: MediaContentSaveOperationRecord
  ): Promise<MediaContentSaveOperationRecord>;
  getContentSaveOperation(input: {
    readonly instanceId: string;
    readonly operationId: string;
    readonly actorSubject: string;
  }): Promise<MediaContentSaveOperationRecord | null>;
  replaceContentSaveOperationReferences(input: {
    readonly instanceId: string;
    readonly operationId: string;
    readonly actorSubject: string;
    readonly references: readonly MediaContentSaveOperationReference[];
  }): Promise<boolean>;
  markContentSaveOperationContentSaved(input: {
    readonly instanceId: string;
    readonly operationId: string;
    readonly actorSubject: string;
    readonly targetId: string;
  }): Promise<boolean>;
  markContentSaveOperationSavingContent(input: {
    readonly instanceId: string;
    readonly operationId: string;
    readonly actorSubject: string;
  }): Promise<boolean>;
  markContentSaveOperationOutcomeUnknown(input: {
    readonly instanceId: string;
    readonly operationId: string;
    readonly actorSubject: string;
    readonly errorCode?: string;
  }): Promise<boolean>;
  commitContentSaveOperation(input: {
    readonly instanceId: string;
    readonly operationId: string;
    readonly actorSubject: string;
  }): Promise<boolean>;
  markContentSaveOperationAbandonPending(input: {
    readonly instanceId: string;
    readonly operationId: string;
    readonly actorSubject: string;
    readonly errorCode?: string;
  }): Promise<boolean>;
  finalizeContentSaveOperationAbandoned(input: {
    readonly instanceId: string;
    readonly operationId: string;
    readonly actorSubject: string;
  }): Promise<boolean>;
  claimContentSaveOperationRecovery(input: {
    readonly instanceId: string;
    readonly operationId: string;
    readonly leaseOwner: string;
    readonly leaseExpiresAt: string;
    readonly now: string;
  }): Promise<MediaContentSaveOperationRecord | null>;
  finalizeContentSaveOperationCleanup(input: {
    readonly instanceId: string;
    readonly operationId: string;
    readonly actorSubject: string;
  }): Promise<boolean>;
};

type MediaAssetRow = {
  readonly id: string;
  readonly instance_id: string;
  readonly storage_key: string;
  readonly media_type: string;
  readonly mime_type: string;
  readonly byte_size: number;
  readonly visibility: string;
  readonly upload_status: string;
  readonly processing_status: string;
  readonly lifecycle_status: MediaAssetLifecycleStatus;
  readonly provisional_operation_id: string | null;
  readonly provisional_owner_subject: string | null;
  readonly provisional_draft_id: string | null;
  readonly provisional_expires_at: string | null;
  readonly metadata: Record<string, unknown> | null;
  readonly technical: Record<string, unknown> | null;
  readonly created_at: string | null;
  readonly updated_at: string | null;
};

type MediaContentSaveOperationRow = {
  readonly id: string;
  readonly instance_id: string;
  readonly actor_subject: string;
  readonly target_type: string;
  readonly target_id: string | null;
  readonly status: MediaContentSaveOperationStatus;
  readonly error_code: string | null;
  readonly expires_at: string;
  readonly created_at: string | null;
  readonly updated_at: string | null;
};

type MediaReferenceRow = {
  readonly id: string;
  readonly asset_id: string;
  readonly target_type: string;
  readonly target_id: string;
  readonly role: string;
  readonly sort_order: number | null;
  readonly created_at: string | null;
};

type MediaVariantRow = {
  readonly id: string;
  readonly asset_id: string;
  readonly variant_key: string;
  readonly preset_key: string;
  readonly format: string;
  readonly width: number;
  readonly height: number | null;
  readonly storage_key: string;
  readonly generation_status: string;
  readonly created_at: string | null;
  readonly updated_at: string | null;
};

type MediaUploadSessionRow = {
  readonly id: string;
  readonly instance_id: string;
  readonly asset_id: string;
  readonly storage_key: string;
  readonly mime_type: string;
  readonly byte_size: number;
  readonly status: string;
  readonly expires_at: string | null;
  readonly created_at: string | null;
  readonly updated_at: string | null;
};

type MediaStorageUsageRow = {
  readonly instance_id: string;
  readonly total_bytes: number;
  readonly asset_count: number;
  readonly updated_at: string | null;
};

type MediaStorageQuotaRow = {
  readonly instance_id: string;
  readonly max_bytes: number;
  readonly updated_at: string | null;
};

const mapAssetRow = (row: MediaAssetRow): MediaAssetRecord => ({
  id: row.id,
  instanceId: row.instance_id,
  storageKey: row.storage_key,
  mediaType: row.media_type,
  mimeType: row.mime_type,
  byteSize: row.byte_size,
  visibility: row.visibility,
  uploadStatus: row.upload_status,
  processingStatus: row.processing_status,
  lifecycleStatus: row.lifecycle_status,
  provisionalOperationId: row.provisional_operation_id ?? undefined,
  provisionalOwnerSubject: row.provisional_owner_subject ?? undefined,
  provisionalDraftId: row.provisional_draft_id ?? undefined,
  provisionalExpiresAt: row.provisional_expires_at ?? undefined,
  metadata: row.metadata ?? {},
  technical: row.technical ?? {},
  createdAt: row.created_at ?? undefined,
  updatedAt: row.updated_at ?? undefined,
});

const mapContentSaveOperationRow = (
  row: MediaContentSaveOperationRow
): MediaContentSaveOperationRecord => ({
  id: row.id,
  instanceId: row.instance_id,
  actorSubject: row.actor_subject,
  targetType: row.target_type,
  targetId: row.target_id ?? undefined,
  status: row.status,
  errorCode: row.error_code ?? undefined,
  expiresAt: row.expires_at,
  createdAt: row.created_at ?? undefined,
  updatedAt: row.updated_at ?? undefined,
});

const mapReferenceRow = (row: MediaReferenceRow): MediaReferenceRecord => ({
  id: row.id,
  assetId: row.asset_id,
  targetType: row.target_type,
  targetId: row.target_id,
  role: row.role,
  sortOrder: row.sort_order ?? undefined,
  createdAt: row.created_at ?? undefined,
});

const mapVariantRow = (row: MediaVariantRow): MediaVariantRecord => ({
  id: row.id,
  assetId: row.asset_id,
  variantKey: row.variant_key,
  presetKey: row.preset_key,
  format: row.format,
  width: row.width,
  height: row.height ?? undefined,
  storageKey: row.storage_key,
  generationStatus: row.generation_status,
  createdAt: row.created_at ?? undefined,
  updatedAt: row.updated_at ?? undefined,
});

const mapUploadSessionRow = (row: MediaUploadSessionRow): MediaUploadSessionRecord => ({
  id: row.id,
  instanceId: row.instance_id,
  assetId: row.asset_id,
  storageKey: row.storage_key,
  mimeType: row.mime_type,
  byteSize: row.byte_size,
  status: row.status,
  expiresAt: row.expires_at ?? undefined,
  createdAt: row.created_at ?? undefined,
  updatedAt: row.updated_at ?? undefined,
});

const mapStorageUsageRow = (row: MediaStorageUsageRow): MediaStorageUsageRecord => ({
  instanceId: row.instance_id,
  totalBytes: row.total_bytes,
  assetCount: row.asset_count,
  updatedAt: row.updated_at ?? undefined,
});

const mapStorageQuotaRow = (row: MediaStorageQuotaRow): MediaStorageQuotaRecord => ({
  instanceId: row.instance_id,
  maxBytes: row.max_bytes,
  updatedAt: row.updated_at ?? undefined,
});

const upsertAssetStatement = (input: MediaAssetRecord): SqlStatement => ({
  text: `
INSERT INTO iam.media_assets (
  id,
  instance_id,
  storage_key,
  media_type,
  mime_type,
  byte_size,
  visibility,
  upload_status,
  processing_status,
  metadata,
  technical,
  lifecycle_status,
  provisional_operation_id,
  provisional_owner_subject,
  provisional_draft_id,
  provisional_expires_at
)
VALUES (
  $1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11::jsonb,
  $12, $13::uuid, $14, $15::uuid, $16::timestamptz
)
ON CONFLICT (id) DO UPDATE
SET storage_key = EXCLUDED.storage_key,
    media_type = EXCLUDED.media_type,
    mime_type = EXCLUDED.mime_type,
    byte_size = EXCLUDED.byte_size,
    visibility = EXCLUDED.visibility,
    upload_status = EXCLUDED.upload_status,
    processing_status = EXCLUDED.processing_status,
    metadata = EXCLUDED.metadata,
    technical = EXCLUDED.technical,
    lifecycle_status = EXCLUDED.lifecycle_status,
    provisional_operation_id = EXCLUDED.provisional_operation_id,
    provisional_owner_subject = EXCLUDED.provisional_owner_subject,
    provisional_draft_id = EXCLUDED.provisional_draft_id,
    provisional_expires_at = EXCLUDED.provisional_expires_at,
    updated_at = NOW();
`,
  values: [
    input.id,
    input.instanceId,
    input.storageKey,
    input.mediaType,
    input.mimeType,
    input.byteSize,
    input.visibility,
    input.uploadStatus,
    input.processingStatus,
    JSON.stringify(input.metadata),
    JSON.stringify(input.technical),
    input.lifecycleStatus ?? 'active',
    input.provisionalOperationId ?? null,
    input.provisionalOwnerSubject ?? null,
    input.provisionalDraftId ?? null,
    input.provisionalExpiresAt ?? null,
  ],
});

const getAssetByIdStatement = (instanceId: string, assetId: string): SqlStatement => ({
  text: `
SELECT
  id,
  instance_id,
  storage_key,
  media_type,
  mime_type,
  byte_size,
  visibility,
  upload_status,
  processing_status,
  lifecycle_status,
  provisional_operation_id,
  provisional_owner_subject,
  provisional_draft_id,
  provisional_expires_at,
  metadata,
  technical,
  created_at,
  updated_at
FROM iam.media_assets
WHERE instance_id = $1
  AND id = $2
LIMIT 1;
`,
  values: [instanceId, assetId],
});

const getAssetByStorageKeyStatement = (instanceId: string, storageKey: string): SqlStatement => ({
  text: `
SELECT
  id,
  instance_id,
  storage_key,
  media_type,
  mime_type,
  byte_size,
  visibility,
  upload_status,
  processing_status,
  lifecycle_status,
  provisional_operation_id,
  provisional_owner_subject,
  provisional_draft_id,
  provisional_expires_at,
  metadata,
  technical,
  created_at,
  updated_at
FROM iam.media_assets
WHERE instance_id = $1
  AND storage_key = $2
LIMIT 1
`,
  values: [instanceId, storageKey],
});

const deleteAssetStatement = (instanceId: string, assetId: string): SqlStatement => ({
  text: `
DELETE FROM iam.media_assets
WHERE instance_id = $1
  AND id = $2;
`,
  values: [instanceId, assetId],
});

const getProvisionalAssetByDraftStatement = (input: {
  readonly instanceId: string;
  readonly operationId: string;
  readonly draftId: string;
  readonly actorSubject: string;
}): SqlStatement => ({
  text: `
SELECT
  id,
  instance_id,
  storage_key,
  media_type,
  mime_type,
  byte_size,
  visibility,
  upload_status,
  processing_status,
  lifecycle_status,
  provisional_operation_id,
  provisional_owner_subject,
  provisional_draft_id,
  provisional_expires_at,
  metadata,
  technical,
  created_at,
  updated_at
FROM iam.media_assets
WHERE instance_id = $1
  AND lifecycle_status = 'provisional'
  AND provisional_operation_id = $2::uuid
  AND provisional_draft_id = $3::uuid
  AND provisional_owner_subject = $4
LIMIT 1;
`,
  values: [input.instanceId, input.operationId, input.draftId, input.actorSubject],
});

const listAssetsByOperationStatement = (input: {
  readonly instanceId: string;
  readonly operationId: string;
  readonly actorSubject: string;
}): SqlStatement => ({
  text: `
SELECT
  id,
  instance_id,
  storage_key,
  media_type,
  mime_type,
  byte_size,
  visibility,
  upload_status,
  processing_status,
  lifecycle_status,
  provisional_operation_id,
  provisional_owner_subject,
  provisional_draft_id,
  provisional_expires_at,
  metadata,
  technical,
  created_at,
  updated_at
FROM iam.media_assets
WHERE instance_id = $1
  AND lifecycle_status = 'provisional'
  AND provisional_operation_id = $2::uuid
  AND provisional_owner_subject = $3
ORDER BY created_at ASC, id ASC;
`,
  values: [input.instanceId, input.operationId, input.actorSubject],
});

const deleteVariantsByAssetIdStatement = (instanceId: string, assetId: string): SqlStatement => ({
  text: `
DELETE FROM iam.media_variants
WHERE instance_id = $1
  AND asset_id = $2;
`,
  values: [instanceId, assetId],
});

const buildAssetFilterClauses = (filter: Omit<MediaAssetListFilter, 'limit' | 'offset'>) => {
  const clauses = ['instance_id = $1', "lifecycle_status = 'active'"];
  const values: unknown[] = [filter.instanceId];

  if (filter.search?.trim()) {
    values.push(`%${filter.search.trim().toLowerCase()}%`);
    clauses.push(`(
      lower(coalesce(metadata->>'title', '')) LIKE $${values.length}
      OR lower(coalesce(metadata->>'altText', '')) LIKE $${values.length}
      OR lower(mime_type) LIKE $${values.length}
      OR lower(storage_key) LIKE $${values.length}
    )`);
  }

  if (filter.visibility?.trim()) {
    values.push(filter.visibility.trim());
    clauses.push(`visibility = $${values.length}`);
  }

  if (filter.afterStorageKey !== undefined) {
    values.push(filter.afterStorageKey);
    clauses.push(`storage_key > $${values.length}`);
  }

  return { clauses, values };
};

const listAssetsStatement = (filter: MediaAssetListFilter): SqlStatement => {
  const { clauses, values } = buildAssetFilterClauses(filter);

  values.push(filter.limit ?? 25);
  const limitPlaceholder = `$${values.length}`;
  values.push(filter.offset ?? 0);
  const offsetPlaceholder = `$${values.length}`;

  return {
    text: `
SELECT
  id,
  instance_id,
  storage_key,
  media_type,
  mime_type,
  byte_size,
  visibility,
  upload_status,
  processing_status,
  lifecycle_status,
  provisional_operation_id,
  provisional_owner_subject,
  provisional_draft_id,
  provisional_expires_at,
  metadata,
  technical,
  created_at,
  updated_at
FROM iam.media_assets
WHERE ${clauses.join('\n  AND ')}
ORDER BY ${
      filter.order === 'storageKeyAsc'
        ? 'storage_key ASC'
        : 'updated_at DESC NULLS LAST, created_at DESC NULLS LAST'
    }
LIMIT ${limitPlaceholder}
OFFSET ${offsetPlaceholder};
`,
    values: values as SqlStatement['values'],
  };
};

const countAssetsStatement = (
  filter: Omit<MediaAssetListFilter, 'limit' | 'offset'>
): SqlStatement => {
  const { clauses, values } = buildAssetFilterClauses(filter);

  return {
    text: `
SELECT COUNT(*)::int AS total
FROM iam.media_assets
WHERE ${clauses.join('\n  AND ')};
`,
    values: values as SqlStatement['values'],
  };
};

const upsertVariantStatement = (instanceId: string, input: MediaVariantRecord): SqlStatement => ({
  text: `
INSERT INTO iam.media_variants (
  id,
  instance_id,
  asset_id,
  variant_key,
  preset_key,
  format,
  width,
  height,
  storage_key,
  generation_status
)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
ON CONFLICT (asset_id, variant_key) DO UPDATE
SET instance_id = EXCLUDED.instance_id,
    variant_key = EXCLUDED.variant_key,
    preset_key = EXCLUDED.preset_key,
    format = EXCLUDED.format,
    width = EXCLUDED.width,
    height = EXCLUDED.height,
    storage_key = EXCLUDED.storage_key,
    generation_status = EXCLUDED.generation_status,
    updated_at = NOW();
`,
  values: [
    input.id,
    instanceId,
    input.assetId,
    input.variantKey,
    input.presetKey,
    input.format,
    input.width,
    input.height ?? null,
    input.storageKey,
    input.generationStatus,
  ],
});

const listVariantsByAssetIdStatement = (instanceId: string, assetId: string): SqlStatement => ({
  text: `
SELECT
  id,
  asset_id,
  variant_key,
  preset_key,
  format,
  width,
  height,
  storage_key,
  generation_status,
  created_at,
  updated_at
FROM iam.media_variants
WHERE instance_id = $1
  AND asset_id = $2
ORDER BY created_at ASC, variant_key ASC;
`,
  values: [instanceId, assetId],
});

const upsertUploadSessionStatement = (input: MediaUploadSessionRecord): SqlStatement => ({
  text: `
INSERT INTO iam.media_upload_sessions (
  id,
  instance_id,
  asset_id,
  storage_key,
  mime_type,
  byte_size,
  status,
  expires_at
)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8::timestamptz)
ON CONFLICT (id) DO UPDATE
SET asset_id = EXCLUDED.asset_id,
    storage_key = EXCLUDED.storage_key,
    mime_type = EXCLUDED.mime_type,
    byte_size = EXCLUDED.byte_size,
    status = EXCLUDED.status,
    expires_at = EXCLUDED.expires_at,
    updated_at = NOW();
`,
  values: [
    input.id,
    input.instanceId,
    input.assetId,
    input.storageKey,
    input.mimeType,
    input.byteSize,
    input.status,
    input.expiresAt ?? null,
  ],
});

const getUploadSessionByIdStatement = (instanceId: string, sessionId: string): SqlStatement => ({
  text: `
SELECT
  id,
  instance_id,
  asset_id,
  storage_key,
  mime_type,
  byte_size,
  status,
  expires_at,
  created_at,
  updated_at
FROM iam.media_upload_sessions
WHERE instance_id = $1
  AND id = $2
LIMIT 1;
`,
  values: [instanceId, sessionId],
});

const getUploadSessionByAssetIdStatement = (instanceId: string, assetId: string): SqlStatement => ({
  text: `
SELECT
  id,
  instance_id,
  asset_id,
  storage_key,
  mime_type,
  byte_size,
  status,
  expires_at,
  created_at,
  updated_at
FROM iam.media_upload_sessions
WHERE instance_id = $1
  AND asset_id = $2::uuid
ORDER BY created_at DESC
LIMIT 1;
`,
  values: [instanceId, assetId],
});

const UPLOAD_SESSION_STALE_CLAIM_SECONDS = 10 * 60;

const claimUploadSessionStatement = (instanceId: string, sessionId: string): SqlStatement => ({
  text: `
UPDATE iam.media_upload_sessions
SET status = 'uploaded',
    updated_at = NOW()
WHERE instance_id = $1
  AND id = $2::uuid
  AND (
    status = 'pending'
    OR (
      status = 'uploaded'
      AND updated_at < NOW() - ($3 * INTERVAL '1 second')
    )
  )
  AND (expires_at IS NULL OR expires_at > NOW())
RETURNING
  id,
  instance_id,
  asset_id,
  storage_key,
  mime_type,
  byte_size,
  status,
  expires_at,
  created_at,
  updated_at;
`,
  values: [instanceId, sessionId, UPLOAD_SESSION_STALE_CLAIM_SECONDS],
});

const upsertStorageUsageStatement = (input: MediaStorageUsageRecord): SqlStatement => ({
  text: `
INSERT INTO iam.media_storage_usage (
  instance_id,
  total_bytes,
  asset_count
)
VALUES ($1, $2, $3)
ON CONFLICT (instance_id) DO UPDATE
SET total_bytes = EXCLUDED.total_bytes,
    asset_count = EXCLUDED.asset_count,
    updated_at = NOW();
`,
  values: [input.instanceId, input.totalBytes, input.assetCount],
});

const applyStorageUsageDeltaStatement = (input: MediaStorageUsageDelta): SqlStatement => ({
  text: `
INSERT INTO iam.media_storage_usage (
  instance_id,
  total_bytes,
  asset_count
)
VALUES ($1, $2, $3)
ON CONFLICT (instance_id) DO UPDATE
SET total_bytes = GREATEST(iam.media_storage_usage.total_bytes + EXCLUDED.total_bytes, 0),
    asset_count = GREATEST(iam.media_storage_usage.asset_count + EXCLUDED.asset_count, 0),
    updated_at = NOW();
`,
  values: [input.instanceId, input.totalBytesDelta, input.assetCountDelta],
});

const tryApplyStorageUsageWithinQuotaStatement = (input: MediaStorageUsageClaim): SqlStatement => ({
  text: `
WITH quota AS (
  SELECT max_bytes
  FROM iam.media_storage_quotas
  WHERE instance_id = $1
), usage_claim AS (
  INSERT INTO iam.media_storage_usage (
    instance_id,
    total_bytes,
    asset_count
  )
  SELECT $1, $2, $3
  WHERE NOT EXISTS (SELECT 1 FROM quota)
     OR $2 <= (SELECT max_bytes FROM quota)
  ON CONFLICT (instance_id) DO UPDATE
  SET total_bytes = iam.media_storage_usage.total_bytes + EXCLUDED.total_bytes,
      asset_count = iam.media_storage_usage.asset_count + EXCLUDED.asset_count,
      updated_at = NOW()
  WHERE NOT EXISTS (SELECT 1 FROM quota)
     OR iam.media_storage_usage.total_bytes + EXCLUDED.total_bytes <= (SELECT max_bytes FROM quota)
  RETURNING instance_id
)
SELECT EXISTS(SELECT 1 FROM usage_claim) AS claimed;
`,
  values: [input.instanceId, input.totalBytes, input.assetCount],
});

const getStorageUsageStatement = (instanceId: string): SqlStatement => ({
  text: `
SELECT
  instance_id,
  total_bytes,
  asset_count,
  updated_at
FROM iam.media_storage_usage
WHERE instance_id = $1
LIMIT 1;
`,
  values: [instanceId],
});

const upsertStorageQuotaStatement = (input: MediaStorageQuotaRecord): SqlStatement => ({
  text: `
INSERT INTO iam.media_storage_quotas (
  instance_id,
  max_bytes
)
VALUES ($1, $2)
ON CONFLICT (instance_id) DO UPDATE
SET max_bytes = EXCLUDED.max_bytes,
    updated_at = NOW();
`,
  values: [input.instanceId, input.maxBytes],
});

const getStorageQuotaStatement = (instanceId: string): SqlStatement => ({
  text: `
SELECT
  instance_id,
  max_bytes,
  updated_at
FROM iam.media_storage_quotas
WHERE instance_id = $1
LIMIT 1;
`,
  values: [instanceId],
});

const deleteReferencesForTargetStatement = (
  instanceId: string,
  targetType: string,
  targetId: string
): SqlStatement => ({
  text: `
DELETE FROM iam.media_references
WHERE instance_id = $1
  AND target_type = $2
  AND target_id = $3;
`,
  values: [instanceId, targetType, targetId],
});

const insertReferenceStatement = (
  instanceId: string,
  reference: MediaReferenceRecord
): SqlStatement => ({
  text: `
INSERT INTO iam.media_references (
  id,
  instance_id,
  asset_id,
  target_type,
  target_id,
  role,
  sort_order
)
VALUES ($1, $2, $3, $4, $5, $6, $7);
`,
  values: [
    reference.id,
    instanceId,
    reference.assetId,
    reference.targetType,
    reference.targetId,
    reference.role,
    reference.sortOrder ?? null,
  ],
});

const listReferencesByAssetIdStatement = (instanceId: string, assetId: string): SqlStatement => ({
  text: `
SELECT
  id,
  asset_id,
  target_type,
  target_id,
  role,
  sort_order,
  created_at
FROM iam.media_references
WHERE instance_id = $1
  AND asset_id = $2
ORDER BY created_at DESC, sort_order ASC NULLS LAST;
`,
  values: [instanceId, assetId],
});

const listReferencesByTargetStatement = (
  instanceId: string,
  targetType: string,
  targetId: string
): SqlStatement => ({
  text: `
SELECT
  id,
  asset_id,
  target_type,
  target_id,
  role,
  sort_order,
  created_at
FROM iam.media_references
WHERE instance_id = $1
  AND target_type = $2
  AND target_id = $3
ORDER BY created_at DESC, sort_order ASC NULLS LAST;
`,
  values: [instanceId, targetType, targetId],
});

const createContentSaveOperationStatement = (
  input: MediaContentSaveOperationRecord
): SqlStatement => ({
  text: `
INSERT INTO iam.media_content_save_operations (
  id,
  instance_id,
  actor_subject,
  target_type,
  target_id,
  status,
  error_code,
  expires_at
)
VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8::timestamptz)
ON CONFLICT (id) DO UPDATE
SET updated_at = iam.media_content_save_operations.updated_at
WHERE iam.media_content_save_operations.instance_id = EXCLUDED.instance_id
  AND iam.media_content_save_operations.actor_subject = EXCLUDED.actor_subject
  AND iam.media_content_save_operations.target_type = EXCLUDED.target_type
RETURNING
  id,
  instance_id,
  actor_subject,
  target_type,
  target_id,
  status,
  error_code,
  expires_at,
  created_at,
  updated_at;
`,
  values: [
    input.id,
    input.instanceId,
    input.actorSubject,
    input.targetType,
    input.targetId ?? null,
    input.status,
    input.errorCode ?? null,
    input.expiresAt,
  ],
});

const getContentSaveOperationStatement = (input: {
  readonly instanceId: string;
  readonly operationId: string;
  readonly actorSubject: string;
}): SqlStatement => ({
  text: `
SELECT
  id,
  instance_id,
  actor_subject,
  target_type,
  target_id,
  status,
  error_code,
  expires_at,
  created_at,
  updated_at
FROM iam.media_content_save_operations
WHERE id = $1::uuid
  AND instance_id = $2
  AND actor_subject = $3
LIMIT 1;
`,
  values: [input.operationId, input.instanceId, input.actorSubject],
});

const replaceContentSaveOperationReferencesStatement = (input: {
  readonly instanceId: string;
  readonly operationId: string;
  readonly actorSubject: string;
  readonly references: readonly MediaContentSaveOperationReference[];
}): SqlStatement => ({
  text: `
WITH eligible_operation AS (
  SELECT id
  FROM iam.media_content_save_operations
  WHERE id = $1::uuid
    AND instance_id = $2
    AND actor_subject = $3
    AND status IN ('preparing', 'uploading', 'saving_content', 'abandon_pending')
  FOR UPDATE
), deleted AS (
  DELETE FROM iam.media_content_save_operation_references
  WHERE operation_id IN (SELECT id FROM eligible_operation)
  RETURNING id
), desired AS (
  SELECT
    input.id,
    input.asset_id,
    input.role,
    NULLIF(input.sort_order, '')::integer AS sort_order
  FROM unnest($4::uuid[], $5::uuid[], $6::text[], $7::text[])
    AS input(id, asset_id, role, sort_order)
), inserted AS (
  INSERT INTO iam.media_content_save_operation_references (
    id,
    instance_id,
    operation_id,
    asset_id,
    role,
    sort_order
  )
  SELECT
    desired.id,
    $2,
    eligible_operation.id,
    desired.asset_id,
    desired.role,
    desired.sort_order
  FROM desired
  CROSS JOIN eligible_operation
  CROSS JOIN (SELECT COUNT(*) FROM deleted) AS deletion_barrier
  JOIN iam.media_assets AS asset
    ON asset.id = desired.asset_id
   AND asset.instance_id = $2
   AND (
     asset.lifecycle_status = 'active'
     OR (
       asset.lifecycle_status = 'provisional'
       AND asset.provisional_operation_id = eligible_operation.id
       AND asset.provisional_owner_subject = $3
     )
   )
  RETURNING id
), updated AS (
  UPDATE iam.media_content_save_operations
  SET status = CASE WHEN status = 'preparing' THEN 'uploading' ELSE status END,
      updated_at = NOW()
  WHERE id IN (SELECT id FROM eligible_operation)
    AND (SELECT COUNT(*) FROM inserted) = cardinality($4::uuid[])
  RETURNING id
)
SELECT EXISTS(SELECT 1 FROM updated) AS successful;
`,
  values: [
    input.operationId,
    input.instanceId,
    input.actorSubject,
    input.references.map(({ id }) => id),
    input.references.map(({ assetId }) => assetId),
    input.references.map(({ role }) => role),
    input.references.map(({ sortOrder }) => sortOrder?.toString() ?? ''),
  ],
});

const markContentSaveOperationContentSavedStatement = (input: {
  readonly instanceId: string;
  readonly operationId: string;
  readonly actorSubject: string;
  readonly targetId: string;
}): SqlStatement => ({
  text: `
UPDATE iam.media_content_save_operations
SET target_id = $4,
    status = 'content_saved',
    error_code = NULL,
    updated_at = NOW()
WHERE id = $1::uuid
  AND instance_id = $2
  AND actor_subject = $3
  AND (status IN ('preparing', 'uploading', 'saving_content', 'content_saved') OR (status = 'committed' AND target_id = $4))
  AND (target_id IS NULL OR target_id = $4)
RETURNING id;
`,
  values: [input.operationId, input.instanceId, input.actorSubject, input.targetId],
});

const markContentSaveOperationSavingContentStatement = (input: {
  readonly instanceId: string;
  readonly operationId: string;
  readonly actorSubject: string;
}): SqlStatement => ({
  text: `
UPDATE iam.media_content_save_operations
SET status = 'saving_content',
    error_code = NULL,
    updated_at = NOW()
WHERE id = $1::uuid
  AND instance_id = $2
  AND actor_subject = $3
  AND status IN ('uploading', 'saving_content')
RETURNING id;
`,
  values: [input.operationId, input.instanceId, input.actorSubject],
});

const markContentSaveOperationOutcomeUnknownStatement = (input: {
  readonly instanceId: string;
  readonly operationId: string;
  readonly actorSubject: string;
  readonly errorCode?: string;
}): SqlStatement => ({
  text: `
UPDATE iam.media_content_save_operations
SET status = 'outcome_unknown',
    error_code = $4,
    updated_at = NOW()
WHERE id = $1::uuid
  AND instance_id = $2
  AND actor_subject = $3
  AND status IN ('saving_content', 'outcome_unknown')
RETURNING id;
`,
  values: [input.operationId, input.instanceId, input.actorSubject, input.errorCode ?? null],
});

const commitContentSaveOperationStatement = (input: {
  readonly instanceId: string;
  readonly operationId: string;
  readonly actorSubject: string;
}): SqlStatement => ({
  text: `
WITH eligible_operation AS (
  SELECT id, instance_id, target_type, target_id, status
  FROM iam.media_content_save_operations
  WHERE id = $1::uuid
    AND instance_id = $2
    AND actor_subject = $3
    AND status IN ('content_saved', 'committed')
  FOR UPDATE
), deleted AS (
  DELETE FROM iam.media_references AS reference
  USING eligible_operation
  WHERE eligible_operation.status = 'content_saved'
    AND reference.instance_id = eligible_operation.instance_id
    AND reference.target_type = eligible_operation.target_type
    AND reference.target_id = eligible_operation.target_id
  RETURNING reference.id
), inserted AS (
  INSERT INTO iam.media_references (
    id,
    instance_id,
    asset_id,
    target_type,
    target_id,
    role,
    sort_order
  )
  SELECT
    operation_reference.id,
    eligible_operation.instance_id,
    operation_reference.asset_id,
    eligible_operation.target_type,
    eligible_operation.target_id,
    operation_reference.role,
    operation_reference.sort_order
  FROM eligible_operation
  JOIN iam.media_content_save_operation_references AS operation_reference
    ON operation_reference.operation_id = eligible_operation.id
  CROSS JOIN (SELECT COUNT(*) FROM deleted) AS deletion_barrier
  WHERE eligible_operation.status = 'content_saved'
  RETURNING asset_id
), activated AS (
  UPDATE iam.media_assets AS asset
  SET lifecycle_status = 'active',
      provisional_operation_id = NULL,
      provisional_owner_subject = NULL,
      provisional_draft_id = NULL,
      provisional_expires_at = NULL,
      updated_at = NOW()
  FROM eligible_operation
  WHERE eligible_operation.status = 'content_saved'
    AND asset.instance_id = eligible_operation.instance_id
    AND asset.provisional_operation_id = eligible_operation.id
    AND asset.id IN (SELECT asset_id FROM inserted)
  RETURNING asset.id
), committed AS (
  UPDATE iam.media_content_save_operations AS operation
  SET status = 'committed',
      error_code = NULL,
      updated_at = NOW()
  FROM eligible_operation
  WHERE operation.id = eligible_operation.id
    AND (
      eligible_operation.status = 'committed'
      OR (
        eligible_operation.status = 'content_saved'
        AND NOT EXISTS (
          SELECT 1
          FROM iam.media_assets AS provisional_asset
          WHERE provisional_asset.instance_id = eligible_operation.instance_id
            AND provisional_asset.provisional_operation_id = eligible_operation.id
            AND provisional_asset.lifecycle_status = 'provisional'
            AND NOT EXISTS (
              SELECT 1
              FROM iam.media_content_save_operation_references AS desired_reference
              WHERE desired_reference.operation_id = eligible_operation.id
                AND desired_reference.asset_id = provisional_asset.id
            )
        )
      )
    )
    AND (SELECT COUNT(*) FROM activated) >= 0
  RETURNING operation.id
)
SELECT EXISTS(SELECT 1 FROM committed) AS successful;
`,
  values: [input.operationId, input.instanceId, input.actorSubject],
});

const markContentSaveOperationAbandonPendingStatement = (input: {
  readonly instanceId: string;
  readonly operationId: string;
  readonly actorSubject: string;
  readonly errorCode?: string;
}): SqlStatement => ({
  text: `
UPDATE iam.media_content_save_operations
SET status = 'abandon_pending',
    error_code = $4,
    updated_at = NOW()
WHERE id = $1::uuid
  AND instance_id = $2
  AND actor_subject = $3
  AND status IN ('preparing', 'uploading', 'saving_content', 'abandon_pending')
RETURNING id;
`,
  values: [input.operationId, input.instanceId, input.actorSubject, input.errorCode ?? null],
});

const finalizeContentSaveOperationAbandonedStatement = (input: {
  readonly instanceId: string;
  readonly operationId: string;
  readonly actorSubject: string;
}): SqlStatement => ({
  text: `
UPDATE iam.media_content_save_operations AS operation
SET status = 'abandoned',
    updated_at = NOW()
WHERE operation.id = $1::uuid
  AND operation.instance_id = $2
  AND operation.actor_subject = $3
  AND operation.status IN ('abandon_pending', 'abandoned')
  AND NOT EXISTS (
    SELECT 1
    FROM iam.media_assets AS asset
    WHERE asset.provisional_operation_id = operation.id
  )
RETURNING id;
`,
  values: [input.operationId, input.instanceId, input.actorSubject],
});

const claimContentSaveOperationRecoveryStatement = (input: {
  readonly instanceId: string;
  readonly operationId: string;
  readonly leaseOwner: string;
  readonly leaseExpiresAt: string;
  readonly now: string;
}): SqlStatement => ({
  text: `
WITH reconciled AS (
  UPDATE iam.media_content_save_operations
  SET status = 'reconciliation_required',
      error_code = COALESCE(error_code, 'content_save_interrupted'),
      lease_owner = NULL,
      lease_expires_at = NULL,
      updated_at = NOW()
  WHERE id = $1::uuid
    AND instance_id = $2
    AND status = 'saving_content'
    AND expires_at <= $5::timestamptz
  RETURNING id
), claimed AS (
  UPDATE iam.media_content_save_operations
  SET status = 'abandon_pending',
      error_code = COALESCE(error_code, 'content_save_expired'),
      lease_owner = $3,
      lease_expires_at = $4::timestamptz,
      updated_at = NOW()
  WHERE id = $1::uuid
    AND instance_id = $2
    AND status IN ('preparing', 'uploading', 'abandon_pending')
    AND expires_at <= $5::timestamptz
    AND (
      lease_owner = $3
      OR lease_expires_at IS NULL
      OR lease_expires_at <= $5::timestamptz
    )
    AND NOT EXISTS (SELECT 1 FROM reconciled)
  RETURNING
    id,
    instance_id,
    actor_subject,
    target_type,
    target_id,
    status,
    error_code,
    expires_at,
    created_at,
    updated_at
)
SELECT * FROM claimed;
`,
  values: [input.operationId, input.instanceId, input.leaseOwner, input.leaseExpiresAt, input.now],
});

const finalizeContentSaveOperationCleanupStatement = (input: {
  readonly instanceId: string;
  readonly operationId: string;
  readonly actorSubject: string;
}): SqlStatement => ({
  text: `
WITH eligible_operation AS (
  SELECT id, instance_id
  FROM iam.media_content_save_operations
  WHERE id = $1::uuid
    AND instance_id = $2
    AND actor_subject = $3
    AND status IN ('abandon_pending', 'abandoned')
  FOR UPDATE
), deleted_operation_references AS (
  DELETE FROM iam.media_content_save_operation_references
  WHERE operation_id IN (SELECT id FROM eligible_operation)
  RETURNING id
), deleted_assets AS (
  DELETE FROM iam.media_assets AS asset
  USING eligible_operation
  WHERE asset.instance_id = eligible_operation.instance_id
    AND asset.provisional_operation_id = eligible_operation.id
    AND asset.lifecycle_status = 'provisional'
  RETURNING
    asset.byte_size,
    CASE
      WHEN COALESCE(asset.technical->>'variantBytes', '') ~ '^[0-9]+$'
        THEN (asset.technical->>'variantBytes')::bigint
      ELSE 0
    END AS variant_bytes
), deleted_totals AS (
  SELECT
    COUNT(*)::integer AS asset_count,
    COALESCE(SUM(byte_size + variant_bytes), 0)::bigint AS total_bytes
  FROM deleted_assets
), usage_updated AS (
  UPDATE iam.media_storage_usage AS usage
  SET total_bytes = GREATEST(0, usage.total_bytes - deleted_totals.total_bytes),
      asset_count = GREATEST(0, usage.asset_count - deleted_totals.asset_count),
      updated_at = NOW()
  FROM deleted_totals
  WHERE usage.instance_id = $2
    AND deleted_totals.asset_count > 0
  RETURNING usage.instance_id
), finalized AS (
  UPDATE iam.media_content_save_operations AS operation
  SET status = 'abandoned',
      lease_owner = NULL,
      lease_expires_at = NULL,
      updated_at = NOW()
  WHERE operation.id IN (SELECT id FROM eligible_operation)
    AND NOT EXISTS (
      SELECT 1
      FROM iam.media_assets AS asset
      WHERE asset.provisional_operation_id = operation.id
    )
    AND (SELECT COUNT(*) FROM deleted_operation_references) >= 0
    AND (SELECT COUNT(*) FROM usage_updated) >= 0
  RETURNING operation.id
)
SELECT EXISTS(SELECT 1 FROM finalized) AS successful;
`,
  values: [input.operationId, input.instanceId, input.actorSubject],
});

const createContentSaveRepositoryMethods = (executor: SqlExecutor) => ({
  async createContentSaveOperation(input: MediaContentSaveOperationRecord) {
    const result = await executor.execute<MediaContentSaveOperationRow>(
      createContentSaveOperationStatement(input)
    );
    const operation = result.rows[0];
    if (!operation) throw new Error('Failed to create media content save operation.');
    return mapContentSaveOperationRow(operation);
  },
  async getContentSaveOperation(input: Parameters<MediaRepository['getContentSaveOperation']>[0]) {
    const result = await executor.execute<MediaContentSaveOperationRow>(
      getContentSaveOperationStatement(input)
    );
    return result.rows[0] ? mapContentSaveOperationRow(result.rows[0]) : null;
  },
  async replaceContentSaveOperationReferences(
    input: Parameters<MediaRepository['replaceContentSaveOperationReferences']>[0]
  ) {
    const result = await executor.execute<{ readonly successful: boolean }>(
      replaceContentSaveOperationReferencesStatement(input)
    );
    return result.rows[0]?.successful ?? false;
  },
  async markContentSaveOperationContentSaved(
    input: Parameters<MediaRepository['markContentSaveOperationContentSaved']>[0]
  ) {
    const result = await executor.execute(markContentSaveOperationContentSavedStatement(input));
    return result.rowCount > 0;
  },
  async markContentSaveOperationSavingContent(
    input: Parameters<MediaRepository['markContentSaveOperationSavingContent']>[0]
  ) {
    const result = await executor.execute(markContentSaveOperationSavingContentStatement(input));
    return result.rowCount > 0;
  },
  async markContentSaveOperationOutcomeUnknown(
    input: Parameters<MediaRepository['markContentSaveOperationOutcomeUnknown']>[0]
  ) {
    const result = await executor.execute(markContentSaveOperationOutcomeUnknownStatement(input));
    return result.rowCount > 0;
  },
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

export const createMediaRepository = (executor: SqlExecutor): MediaRepository => ({
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
  async upsertUploadSession(input) {
    await executor.execute(upsertUploadSessionStatement(input));
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
  async upsertStorageUsage(input) {
    await executor.execute(upsertStorageUsageStatement(input));
  },
  async applyStorageUsageDelta(input) {
    await executor.execute(applyStorageUsageDeltaStatement(input));
  },
  async tryApplyStorageUsageWithinQuota(input) {
    const result = await executor.execute<{ readonly claimed: boolean }>(
      tryApplyStorageUsageWithinQuotaStatement(input)
    );
    return result.rows[0]?.claimed === true;
  },
  async getStorageUsage(instanceId) {
    const result = await executor.execute<MediaStorageUsageRow>(
      getStorageUsageStatement(instanceId)
    );
    return result.rows[0] ? mapStorageUsageRow(result.rows[0]) : null;
  },
  async upsertStorageQuota(input) {
    await executor.execute(upsertStorageQuotaStatement(input));
  },
  async getStorageQuota(instanceId) {
    const result = await executor.execute<MediaStorageQuotaRow>(
      getStorageQuotaStatement(instanceId)
    );
    return result.rows[0] ? mapStorageQuotaRow(result.rows[0]) : null;
  },
  async wouldExceedStorageQuota(instanceId, additionalBytes) {
    const [quota, usage] = await Promise.all([
      this.getStorageQuota(instanceId),
      this.getStorageUsage(instanceId),
    ]);
    const currentBytes = usage?.totalBytes ?? 0;
    const maxBytes = quota?.maxBytes ?? null;
    return {
      instanceId,
      currentBytes,
      additionalBytes,
      maxBytes,
      wouldExceed: maxBytes === null ? false : currentBytes + additionalBytes > maxBytes,
    };
  },
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
  ...createContentSaveRepositoryMethods(executor),
});

export const mediaStatements = {
  upsertAsset: upsertAssetStatement,
  getAssetById: getAssetByIdStatement,
  getAssetByStorageKey: getAssetByStorageKeyStatement,
  getProvisionalAssetByDraft: getProvisionalAssetByDraftStatement,
  listAssetsByOperation: listAssetsByOperationStatement,
  listAssets: listAssetsStatement,
  countAssets: countAssetsStatement,
  deleteAsset: deleteAssetStatement,
  deleteVariantsByAssetId: deleteVariantsByAssetIdStatement,
  upsertVariant: upsertVariantStatement,
  listVariantsByAssetId: listVariantsByAssetIdStatement,
  upsertUploadSession: upsertUploadSessionStatement,
  getUploadSessionById: getUploadSessionByIdStatement,
  getUploadSessionByAssetId: getUploadSessionByAssetIdStatement,
  claimUploadSession: claimUploadSessionStatement,
  upsertStorageUsage: upsertStorageUsageStatement,
  applyStorageUsageDelta: applyStorageUsageDeltaStatement,
  tryApplyStorageUsageWithinQuota: tryApplyStorageUsageWithinQuotaStatement,
  getStorageUsage: getStorageUsageStatement,
  upsertStorageQuota: upsertStorageQuotaStatement,
  getStorageQuota: getStorageQuotaStatement,
  deleteReferencesForTarget: deleteReferencesForTargetStatement,
  insertReference: insertReferenceStatement,
  listReferencesByAssetId: listReferencesByAssetIdStatement,
  listReferencesByTarget: listReferencesByTargetStatement,
  createContentSaveOperation: createContentSaveOperationStatement,
  getContentSaveOperation: getContentSaveOperationStatement,
  replaceContentSaveOperationReferences: replaceContentSaveOperationReferencesStatement,
  markContentSaveOperationContentSaved: markContentSaveOperationContentSavedStatement,
  markContentSaveOperationSavingContent: markContentSaveOperationSavingContentStatement,
  markContentSaveOperationOutcomeUnknown: markContentSaveOperationOutcomeUnknownStatement,
  commitContentSaveOperation: commitContentSaveOperationStatement,
  markContentSaveOperationAbandonPending: markContentSaveOperationAbandonPendingStatement,
  finalizeContentSaveOperationAbandoned: finalizeContentSaveOperationAbandonedStatement,
  claimContentSaveOperationRecovery: claimContentSaveOperationRecoveryStatement,
  finalizeContentSaveOperationCleanup: finalizeContentSaveOperationCleanupStatement,
} as const;

export type { SqlExecutionResult } from '../iam/repositories/types.js';
