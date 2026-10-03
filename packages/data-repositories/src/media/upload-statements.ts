import type { SqlStatement } from '../iam/repositories/types.js';
import type { MediaVariantRecord, MediaUploadSessionRecord } from './model-types.js';

export const upsertVariantStatement = (
  instanceId: string,
  input: MediaVariantRecord
): SqlStatement => ({
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

export const listVariantsByAssetIdStatement = (
  instanceId: string,
  assetId: string
): SqlStatement => ({
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

export const upsertUploadSessionStatement = (input: MediaUploadSessionRecord): SqlStatement => ({
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
    claim_token = CASE
      WHEN EXCLUDED.status = 'uploaded' THEN iam.media_upload_sessions.claim_token
      ELSE NULL
    END,
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

export const getUploadSessionByIdStatement = (
  instanceId: string,
  sessionId: string
): SqlStatement => ({
  text: `
SELECT
  id,
  instance_id,
  asset_id,
  storage_key,
  mime_type,
  byte_size,
  status,
  claim_token,
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

export const refreshPendingUploadSessionStatement = (input: {
  readonly instanceId: string;
  readonly sessionId: string;
  readonly storageKey: string;
  readonly expiresAt?: string;
}): SqlStatement => ({
  text: `
UPDATE iam.media_upload_sessions
SET storage_key = $3,
    expires_at = $4::timestamptz,
    updated_at = NOW()
WHERE instance_id = $1
  AND id = $2::uuid
  AND status = 'pending'
RETURNING id;
`,
  values: [input.instanceId, input.sessionId, input.storageKey, input.expiresAt ?? null],
});

export const getUploadSessionByAssetIdStatement = (
  instanceId: string,
  assetId: string
): SqlStatement => ({
  text: `
SELECT
  id,
  instance_id,
  asset_id,
  storage_key,
  mime_type,
  byte_size,
  status,
  claim_token,
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

export const UPLOAD_SESSION_STALE_CLAIM_SECONDS = 10 * 60;

export const claimUploadSessionStatement = (
  instanceId: string,
  sessionId: string
): SqlStatement => ({
  text: `
WITH claimable AS (
  SELECT id, claim_token AS replaced_claim_token
  FROM iam.media_upload_sessions
  WHERE instance_id = $1
    AND id = $2::uuid
    AND (
      (
        status = 'pending'
        AND (expires_at IS NULL OR expires_at > NOW())
      )
      OR (
        status = 'uploaded'
        AND updated_at < NOW() - ($3 * INTERVAL '1 second')
      )
    )
  FOR UPDATE
)
UPDATE iam.media_upload_sessions AS sessions
SET status = 'uploaded',
    claim_token = gen_random_uuid(),
    updated_at = NOW()
FROM claimable
WHERE sessions.id = claimable.id
RETURNING
  sessions.id,
  sessions.instance_id,
  sessions.asset_id,
  sessions.storage_key,
  sessions.mime_type,
  sessions.byte_size,
  sessions.status,
  sessions.claim_token,
  claimable.replaced_claim_token,
  sessions.expires_at,
  sessions.created_at,
  sessions.updated_at;
`,
  values: [instanceId, sessionId, UPLOAD_SESSION_STALE_CLAIM_SECONDS],
});

export const lockUploadSessionClaimStatement = (input: {
  readonly instanceId: string;
  readonly sessionId: string;
  readonly claimToken: string;
}): SqlStatement => ({
  text: `
SELECT EXISTS (
  SELECT 1
  FROM iam.media_upload_sessions
  WHERE instance_id = $1
    AND id = $2::uuid
    AND status = 'uploaded'
    AND claim_token = $3::uuid
  FOR UPDATE
) AS claimed;
`,
  values: [input.instanceId, input.sessionId, input.claimToken],
});
