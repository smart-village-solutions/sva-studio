-- +goose Up
-- +goose StatementBegin
CREATE TABLE IF NOT EXISTS iam.content_list_projection (
  id TEXT NOT NULL,
  instance_id TEXT NOT NULL,
  organization_id UUID NULL,
  owner_subject_id TEXT NULL,
  content_type TEXT NOT NULL,
  title TEXT NOT NULL,
  published_at TIMESTAMPTZ NULL,
  publish_from TIMESTAMPTZ NULL,
  publish_until TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL,
  created_by TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  updated_by TEXT NOT NULL,
  author_display_name TEXT NOT NULL,
  payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL,
  validation_state TEXT NOT NULL DEFAULT 'valid',
  history_ref TEXT NOT NULL,
  current_revision_ref TEXT NULL,
  last_audit_event_ref TEXT NULL,
  source_system TEXT NOT NULL,
  source_entity_type TEXT NOT NULL,
  source_entity_id TEXT NOT NULL,
  projection_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT content_list_projection_pkey
    PRIMARY KEY (instance_id, source_system, source_entity_type, source_entity_id),
  CONSTRAINT content_list_projection_status_chk
    CHECK (status IN ('draft', 'in_review', 'approved', 'published', 'archived')),
  CONSTRAINT content_list_projection_validation_state_chk
    CHECK (validation_state IN ('valid', 'invalid', 'pending')),
  CONSTRAINT content_list_projection_source_system_chk
    CHECK (source_system IN ('iam', 'mainserver'))
);

CREATE INDEX IF NOT EXISTS iam_content_list_projection_instance_updated_idx
  ON iam.content_list_projection (instance_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS iam_content_list_projection_instance_type_updated_idx
  ON iam.content_list_projection (instance_id, content_type, updated_at DESC);

CREATE INDEX IF NOT EXISTS iam_content_list_projection_instance_org_updated_idx
  ON iam.content_list_projection (instance_id, organization_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS iam.content_list_projection_sync_state (
  instance_id TEXT NOT NULL,
  source_system TEXT NOT NULL,
  content_type TEXT NOT NULL,
  sync_mode TEXT NOT NULL DEFAULT 'full_refresh',
  last_started_at TIMESTAMPTZ NULL,
  last_succeeded_at TIMESTAMPTZ NULL,
  last_failed_at TIMESTAMPTZ NULL,
  last_error_code TEXT NULL,
  last_error_message TEXT NULL,
  projected_count INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT content_list_projection_sync_state_pkey
    PRIMARY KEY (instance_id, source_system, content_type),
  CONSTRAINT content_list_projection_sync_state_source_system_chk
    CHECK (source_system IN ('iam', 'mainserver')),
  CONSTRAINT content_list_projection_sync_state_mode_chk
    CHECK (sync_mode IN ('full_refresh'))
);

CREATE OR REPLACE FUNCTION iam.sync_content_list_projection_from_contents()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM iam.content_list_projection
    WHERE instance_id = OLD.instance_id
      AND source_system = 'iam'
      AND source_entity_type = 'iam.contents'
      AND source_entity_id = OLD.id::text;

    INSERT INTO iam.content_list_projection_sync_state (
      instance_id,
      source_system,
      content_type,
      sync_mode,
      last_succeeded_at,
      projected_count,
      updated_at
    )
    VALUES (
      OLD.instance_id,
      'iam',
      OLD.content_type,
      'full_refresh',
      NOW(),
      0,
      NOW()
    )
    ON CONFLICT (instance_id, source_system, content_type)
    DO UPDATE SET
      last_succeeded_at = EXCLUDED.last_succeeded_at,
      last_error_code = NULL,
      last_error_message = NULL,
      updated_at = EXCLUDED.updated_at;

    RETURN OLD;
  END IF;

  INSERT INTO iam.content_list_projection (
    id,
    instance_id,
    organization_id,
    owner_subject_id,
    content_type,
    title,
    published_at,
    publish_from,
    publish_until,
    created_at,
    created_by,
    updated_at,
    updated_by,
    author_display_name,
    payload_json,
    status,
    validation_state,
    history_ref,
    current_revision_ref,
    last_audit_event_ref,
    source_system,
    source_entity_type,
    source_entity_id,
    projection_updated_at
  )
  VALUES (
    NEW.id::text,
    NEW.instance_id,
    NEW.organization_id,
    NEW.owner_subject_id,
    NEW.content_type,
    NEW.title,
    NEW.published_at,
    NEW.publish_from,
    NEW.publish_until,
    NEW.created_at,
    NEW.creator_account_id::text,
    NEW.updated_at,
    NEW.updater_account_id::text,
    NEW.author_display_name,
    NEW.payload_json,
    NEW.status,
    NEW.validation_state,
    NEW.history_ref,
    NEW.current_revision_ref,
    NEW.last_audit_event_ref,
    'iam',
    'iam.contents',
    NEW.id::text,
    NOW()
  )
  ON CONFLICT (instance_id, source_system, source_entity_type, source_entity_id)
  DO UPDATE SET
    id = EXCLUDED.id,
    organization_id = EXCLUDED.organization_id,
    owner_subject_id = EXCLUDED.owner_subject_id,
    content_type = EXCLUDED.content_type,
    title = EXCLUDED.title,
    published_at = EXCLUDED.published_at,
    publish_from = EXCLUDED.publish_from,
    publish_until = EXCLUDED.publish_until,
    created_at = EXCLUDED.created_at,
    created_by = EXCLUDED.created_by,
    updated_at = EXCLUDED.updated_at,
    updated_by = EXCLUDED.updated_by,
    author_display_name = EXCLUDED.author_display_name,
    payload_json = EXCLUDED.payload_json,
    status = EXCLUDED.status,
    validation_state = EXCLUDED.validation_state,
    history_ref = EXCLUDED.history_ref,
    current_revision_ref = EXCLUDED.current_revision_ref,
    last_audit_event_ref = EXCLUDED.last_audit_event_ref,
    projection_updated_at = EXCLUDED.projection_updated_at;

  INSERT INTO iam.content_list_projection_sync_state (
    instance_id,
    source_system,
    content_type,
    sync_mode,
    last_succeeded_at,
    projected_count,
    updated_at
  )
  VALUES (
    NEW.instance_id,
    'iam',
    NEW.content_type,
    'full_refresh',
    NOW(),
    1,
    NOW()
  )
  ON CONFLICT (instance_id, source_system, content_type)
  DO UPDATE SET
    last_succeeded_at = EXCLUDED.last_succeeded_at,
    last_error_code = NULL,
    last_error_message = NULL,
    updated_at = EXCLUDED.updated_at;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_content_list_projection_from_contents_trg ON iam.contents;
CREATE TRIGGER sync_content_list_projection_from_contents_trg
AFTER INSERT OR UPDATE OR DELETE ON iam.contents
FOR EACH ROW
EXECUTE FUNCTION iam.sync_content_list_projection_from_contents();

INSERT INTO iam.content_list_projection (
  id,
  instance_id,
  organization_id,
  owner_subject_id,
  content_type,
  title,
  published_at,
  publish_from,
  publish_until,
  created_at,
  created_by,
  updated_at,
  updated_by,
  author_display_name,
  payload_json,
  status,
  validation_state,
  history_ref,
  current_revision_ref,
  last_audit_event_ref,
  source_system,
  source_entity_type,
  source_entity_id,
  projection_updated_at
)
SELECT
  content.id::text,
  content.instance_id,
  content.organization_id,
  content.owner_subject_id,
  content.content_type,
  content.title,
  content.published_at,
  content.publish_from,
  content.publish_until,
  content.created_at,
  content.creator_account_id::text,
  content.updated_at,
  content.updater_account_id::text,
  content.author_display_name,
  content.payload_json,
  content.status,
  content.validation_state,
  content.history_ref,
  content.current_revision_ref,
  content.last_audit_event_ref,
  'iam',
  'iam.contents',
  content.id::text,
  NOW()
FROM iam.contents AS content
ON CONFLICT (instance_id, source_system, source_entity_type, source_entity_id)
DO UPDATE SET
  id = EXCLUDED.id,
  organization_id = EXCLUDED.organization_id,
  owner_subject_id = EXCLUDED.owner_subject_id,
  content_type = EXCLUDED.content_type,
  title = EXCLUDED.title,
  published_at = EXCLUDED.published_at,
  publish_from = EXCLUDED.publish_from,
  publish_until = EXCLUDED.publish_until,
  created_at = EXCLUDED.created_at,
  created_by = EXCLUDED.created_by,
  updated_at = EXCLUDED.updated_at,
  updated_by = EXCLUDED.updated_by,
  author_display_name = EXCLUDED.author_display_name,
  payload_json = EXCLUDED.payload_json,
  status = EXCLUDED.status,
  validation_state = EXCLUDED.validation_state,
  history_ref = EXCLUDED.history_ref,
  current_revision_ref = EXCLUDED.current_revision_ref,
  last_audit_event_ref = EXCLUDED.last_audit_event_ref,
  projection_updated_at = EXCLUDED.projection_updated_at;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TRIGGER IF EXISTS sync_content_list_projection_from_contents_trg ON iam.contents;
DROP FUNCTION IF EXISTS iam.sync_content_list_projection_from_contents();
DROP TABLE IF EXISTS iam.content_list_projection_sync_state;
DROP TABLE IF EXISTS iam.content_list_projection;
-- +goose StatementEnd
