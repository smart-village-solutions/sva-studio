-- +goose Up
-- +goose StatementBegin
ALTER TABLE iam.contents
  ADD COLUMN IF NOT EXISTS organization_id UUID NULL,
  ADD COLUMN IF NOT EXISTS owner_subject_id TEXT NULL,
  ADD COLUMN IF NOT EXISTS validation_state TEXT NOT NULL DEFAULT 'valid',
  ADD COLUMN IF NOT EXISTS publish_from TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS publish_until TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS creator_account_id UUID NULL REFERENCES iam.accounts(id),
  ADD COLUMN IF NOT EXISTS updater_account_id UUID NULL REFERENCES iam.accounts(id),
  ADD COLUMN IF NOT EXISTS history_ref TEXT NULL,
  ADD COLUMN IF NOT EXISTS current_revision_ref TEXT NULL,
  ADD COLUMN IF NOT EXISTS last_audit_event_ref TEXT NULL;

UPDATE iam.contents content
SET
  creator_account_id = COALESCE(content.creator_account_id, content.author_account_id),
  updater_account_id = COALESCE(content.updater_account_id, content.author_account_id)
WHERE content.creator_account_id IS NULL
   OR content.updater_account_id IS NULL;

UPDATE iam.contents content
SET
  content_type = 'news.article'
WHERE content.content_type = 'news';

UPDATE iam.contents content
SET history_ref = COALESCE(
  (
    SELECT history.id::text
    FROM iam.content_history history
    WHERE history.instance_id = content.instance_id
      AND history.content_id = content.id
    ORDER BY history.created_at DESC, history.id DESC
    LIMIT 1
  ),
  content.id::text
)
WHERE content.history_ref IS NULL;

UPDATE iam.contents content
SET current_revision_ref = history_ref
WHERE content.current_revision_ref IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'contents_validation_state_chk'
      AND conrelid = 'iam.contents'::regclass
  ) THEN
    ALTER TABLE iam.contents
      ADD CONSTRAINT contents_validation_state_chk
      CHECK (validation_state IN ('valid', 'invalid', 'pending'));
  END IF;
END $$;

ALTER TABLE iam.contents
  ALTER COLUMN creator_account_id SET NOT NULL,
  ALTER COLUMN updater_account_id SET NOT NULL,
  ALTER COLUMN history_ref SET NOT NULL;

CREATE INDEX IF NOT EXISTS iam_contents_instance_org_updated_idx
  ON iam.contents (instance_id, organization_id, updated_at DESC);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP INDEX IF EXISTS iam.iam_contents_instance_org_updated_idx;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'contents_validation_state_chk'
      AND conrelid = 'iam.contents'::regclass
  ) THEN
    ALTER TABLE iam.contents
      DROP CONSTRAINT contents_validation_state_chk;
  END IF;
END $$;

ALTER TABLE iam.contents
  DROP COLUMN IF EXISTS last_audit_event_ref,
  DROP COLUMN IF EXISTS current_revision_ref,
  DROP COLUMN IF EXISTS history_ref,
  DROP COLUMN IF EXISTS updater_account_id,
  DROP COLUMN IF EXISTS creator_account_id,
  DROP COLUMN IF EXISTS publish_until,
  DROP COLUMN IF EXISTS publish_from,
  DROP COLUMN IF EXISTS validation_state,
  DROP COLUMN IF EXISTS owner_subject_id,
  DROP COLUMN IF EXISTS organization_id;
-- +goose StatementEnd
