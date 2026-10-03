import type { SqlStatement } from '../iam/repositories/types.js';

export const markContentSaveOperationContentSavedStatement = (input: {
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

export const markContentSaveOperationSavingContentStatement = (input: {
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

export const markContentSaveOperationOutcomeUnknownStatement = (input: {
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

const commitContentSaveOperationSql = `
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
`;

export const commitContentSaveOperationStatement = (input: {
  readonly instanceId: string;
  readonly operationId: string;
  readonly actorSubject: string;
}): SqlStatement => ({
  text: commitContentSaveOperationSql,
  values: [input.operationId, input.instanceId, input.actorSubject],
});
