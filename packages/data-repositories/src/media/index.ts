import type { SqlExecutor, SqlStatement } from '../iam/repositories/types.js';

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
  readonly metadata: Readonly<Record<string, unknown>>;
  readonly technical: Readonly<Record<string, unknown>>;
  readonly createdAt?: string;
  readonly updatedAt?: string;
};

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
  readonly limit?: number;
  readonly offset?: number;
};

export type MediaRepository = {
  upsertAsset(input: MediaAssetRecord): Promise<void>;
  getAssetById(instanceId: string, assetId: string): Promise<MediaAssetRecord | null>;
  listAssets(filter: MediaAssetListFilter): Promise<readonly MediaAssetRecord[]>;
  countAssets(filter: Omit<MediaAssetListFilter, 'limit' | 'offset'>): Promise<number>;
  deleteAsset(instanceId: string, assetId: string): Promise<void>;
  upsertVariant(instanceId: string, input: MediaVariantRecord): Promise<void>;
  listVariantsByAssetId(instanceId: string, assetId: string): Promise<readonly MediaVariantRecord[]>;
  upsertUploadSession(input: MediaUploadSessionRecord): Promise<void>;
  getUploadSessionById(instanceId: string, sessionId: string): Promise<MediaUploadSessionRecord | null>;
  upsertStorageUsage(input: MediaStorageUsageRecord): Promise<void>;
  applyStorageUsageDelta(input: MediaStorageUsageDelta): Promise<void>;
  getStorageUsage(instanceId: string): Promise<MediaStorageUsageRecord | null>;
  upsertStorageQuota(input: MediaStorageQuotaRecord): Promise<void>;
  getStorageQuota(instanceId: string): Promise<MediaStorageQuotaRecord | null>;
  wouldExceedStorageQuota(instanceId: string, additionalBytes: number): Promise<MediaStorageQuotaCheck>;
  replaceReferences(input: {
    readonly instanceId: string;
    readonly targetType: string;
    readonly targetId: string;
    readonly references: readonly MediaReferenceRecord[];
  }): Promise<void>;
  listReferencesByAssetId(instanceId: string, assetId: string): Promise<readonly MediaReferenceRecord[]>;
  listReferencesByTarget(instanceId: string, targetType: string, targetId: string): Promise<readonly MediaReferenceRecord[]>;
  getUsageImpact(instanceId: string, assetId: string): Promise<MediaUsageImpact>;
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
  readonly metadata: Record<string, unknown> | null;
  readonly technical: Record<string, unknown> | null;
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
  metadata: row.metadata ?? {},
  technical: row.technical ?? {},
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
  technical
)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11::jsonb)
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

const deleteAssetStatement = (instanceId: string, assetId: string): SqlStatement => ({
  text: `
DELETE FROM iam.media_assets
WHERE instance_id = $1
  AND id = $2;
`,
  values: [instanceId, assetId],
});

const buildAssetFilterClauses = (filter: Omit<MediaAssetListFilter, 'limit' | 'offset'>) => {
  const clauses = ['instance_id = $1'];
  const values: unknown[] = [filter.instanceId];

  if (filter.search?.trim()) {
    values.push(`%${filter.search.trim().toLowerCase()}%`);
    clauses.push(`(
      lower(coalesce(metadata->>'title', '')) LIKE $${values.length}
      OR lower(coalesce(metadata->>'altText', '')) LIKE $${values.length}
      OR lower(mime_type) LIKE $${values.length}
    )`);
  }

  if (filter.visibility?.trim()) {
    values.push(filter.visibility.trim());
    clauses.push(`visibility = $${values.length}`);
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
  metadata,
  technical,
  created_at,
  updated_at
FROM iam.media_assets
WHERE ${clauses.join('\n  AND ')}
ORDER BY updated_at DESC
LIMIT ${limitPlaceholder}
OFFSET ${offsetPlaceholder};
`,
    values: values as SqlStatement['values'],
  };
};

const countAssetsStatement = (filter: Omit<MediaAssetListFilter, 'limit' | 'offset'>): SqlStatement => {
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
VALUES ($1, GREATEST($2, 0), GREATEST($3, 0))
ON CONFLICT (instance_id) DO UPDATE
SET total_bytes = GREATEST(iam.media_storage_usage.total_bytes + EXCLUDED.total_bytes, 0),
    asset_count = GREATEST(iam.media_storage_usage.asset_count + EXCLUDED.asset_count, 0),
    updated_at = NOW();
`,
  values: [input.instanceId, input.totalBytesDelta, input.assetCountDelta],
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

const deleteReferencesForTargetStatement = (instanceId: string, targetType: string, targetId: string): SqlStatement => ({
  text: `
DELETE FROM iam.media_references
WHERE instance_id = $1
  AND target_type = $2
  AND target_id = $3;
`,
  values: [instanceId, targetType, targetId],
});

const insertReferenceStatement = (instanceId: string, reference: MediaReferenceRecord): SqlStatement => ({
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

const listReferencesByTargetStatement = (instanceId: string, targetType: string, targetId: string): SqlStatement => ({
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

export const createMediaRepository = (executor: SqlExecutor): MediaRepository => ({
  async upsertAsset(input) {
    await executor.execute(upsertAssetStatement(input));
  },
  async getAssetById(instanceId, assetId) {
    const result = await executor.execute<MediaAssetRow>(getAssetByIdStatement(instanceId, assetId));
    return result.rows[0] ? mapAssetRow(result.rows[0]) : null;
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
  async upsertVariant(instanceId, input) {
    await executor.execute(upsertVariantStatement(instanceId, input));
  },
  async listVariantsByAssetId(instanceId, assetId) {
    const result = await executor.execute<MediaVariantRow>(listVariantsByAssetIdStatement(instanceId, assetId));
    return result.rows.map(mapVariantRow);
  },
  async upsertUploadSession(input) {
    await executor.execute(upsertUploadSessionStatement(input));
  },
  async getUploadSessionById(instanceId, sessionId) {
    const result = await executor.execute<MediaUploadSessionRow>(getUploadSessionByIdStatement(instanceId, sessionId));
    return result.rows[0] ? mapUploadSessionRow(result.rows[0]) : null;
  },
  async upsertStorageUsage(input) {
    await executor.execute(upsertStorageUsageStatement(input));
  },
  async applyStorageUsageDelta(input) {
    await executor.execute(applyStorageUsageDeltaStatement(input));
  },
  async getStorageUsage(instanceId) {
    const result = await executor.execute<MediaStorageUsageRow>(getStorageUsageStatement(instanceId));
    return result.rows[0] ? mapStorageUsageRow(result.rows[0]) : null;
  },
  async upsertStorageQuota(input) {
    await executor.execute(upsertStorageQuotaStatement(input));
  },
  async getStorageQuota(instanceId) {
    const result = await executor.execute<MediaStorageQuotaRow>(getStorageQuotaStatement(instanceId));
    return result.rows[0] ? mapStorageQuotaRow(result.rows[0]) : null;
  },
  async wouldExceedStorageQuota(instanceId, additionalBytes) {
    const [quota, usage] = await Promise.all([this.getStorageQuota(instanceId), this.getStorageUsage(instanceId)]);
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
    await executor.execute(deleteReferencesForTargetStatement(input.instanceId, input.targetType, input.targetId));
    for (const reference of input.references) {
      await executor.execute(insertReferenceStatement(input.instanceId, reference));
    }
  },
  async listReferencesByAssetId(instanceId, assetId) {
    const result = await executor.execute<MediaReferenceRow>(listReferencesByAssetIdStatement(instanceId, assetId));
    return result.rows.map(mapReferenceRow);
  },
  async listReferencesByTarget(instanceId, targetType, targetId) {
    const result = await executor.execute<MediaReferenceRow>(listReferencesByTargetStatement(instanceId, targetType, targetId));
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

export const mediaStatements = {
  upsertAsset: upsertAssetStatement,
  getAssetById: getAssetByIdStatement,
  listAssets: listAssetsStatement,
  countAssets: countAssetsStatement,
  deleteAsset: deleteAssetStatement,
  upsertVariant: upsertVariantStatement,
  listVariantsByAssetId: listVariantsByAssetIdStatement,
  upsertUploadSession: upsertUploadSessionStatement,
  getUploadSessionById: getUploadSessionByIdStatement,
  upsertStorageUsage: upsertStorageUsageStatement,
  applyStorageUsageDelta: applyStorageUsageDeltaStatement,
  getStorageUsage: getStorageUsageStatement,
  upsertStorageQuota: upsertStorageQuotaStatement,
  getStorageQuota: getStorageQuotaStatement,
  deleteReferencesForTarget: deleteReferencesForTargetStatement,
  insertReference: insertReferenceStatement,
  listReferencesByAssetId: listReferencesByAssetIdStatement,
  listReferencesByTarget: listReferencesByTargetStatement,
} as const;

export type { SqlExecutionResult } from '../iam/repositories/types.js';
