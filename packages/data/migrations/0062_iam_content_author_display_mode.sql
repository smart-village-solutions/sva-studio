-- +goose Up
-- +goose StatementBegin
ALTER TABLE iam.contents
  ADD COLUMN IF NOT EXISTS author_display_mode TEXT NOT NULL DEFAULT 'organization';

ALTER TABLE iam.content_list_projection
  ADD COLUMN IF NOT EXISTS author_display_mode TEXT NOT NULL DEFAULT 'organization';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'contents_author_display_mode_chk'
      AND conrelid = 'iam.contents'::regclass
  ) THEN
    ALTER TABLE iam.contents
      ADD CONSTRAINT contents_author_display_mode_chk
      CHECK (author_display_mode IN ('organization', 'user'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'content_list_projection_author_display_mode_chk'
      AND conrelid = 'iam.content_list_projection'::regclass
  ) THEN
    ALTER TABLE iam.content_list_projection
      ADD CONSTRAINT content_list_projection_author_display_mode_chk
      CHECK (author_display_mode IN ('organization', 'user'));
  END IF;
END $$;

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

  IF TG_OP = 'UPDATE' THEN
    DELETE FROM iam.content_list_projection
    WHERE instance_id = OLD.instance_id
      AND source_system = 'iam'
      AND source_entity_type = 'iam.contents'
      AND source_entity_id = OLD.id::text;
  END IF;

  INSERT INTO iam.content_list_projection (
    id,
    instance_id,
    organization_id,
    owner_subject_id,
    owner_user_id,
    owner_organization_id,
    content_type,
    title,
    published_at,
    publish_from,
    publish_until,
    created_at,
    created_by,
    updated_at,
    updated_by,
    author_display_mode,
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
    NEW.owner_user_id,
    NEW.owner_organization_id,
    NEW.content_type,
    NEW.title,
    NEW.published_at,
    NEW.publish_from,
    NEW.publish_until,
    NEW.created_at,
    NEW.creator_account_id::text,
    NEW.updated_at,
    NEW.updater_account_id::text,
    NEW.author_display_mode,
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
  ON CONFLICT ON CONSTRAINT content_list_projection_scope_key
  DO UPDATE SET
    id = EXCLUDED.id,
    organization_id = EXCLUDED.organization_id,
    owner_subject_id = EXCLUDED.owner_subject_id,
    owner_user_id = EXCLUDED.owner_user_id,
    owner_organization_id = EXCLUDED.owner_organization_id,
    content_type = EXCLUDED.content_type,
    title = EXCLUDED.title,
    published_at = EXCLUDED.published_at,
    publish_from = EXCLUDED.publish_from,
    publish_until = EXCLUDED.publish_until,
    created_at = EXCLUDED.created_at,
    created_by = EXCLUDED.created_by,
    updated_at = EXCLUDED.updated_at,
    updated_by = EXCLUDED.updated_by,
    author_display_mode = EXCLUDED.author_display_mode,
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

UPDATE iam.content_list_projection AS projection
SET author_display_mode = content.author_display_mode
FROM iam.contents AS content
WHERE projection.instance_id = content.instance_id
  AND projection.source_system = 'iam'
  AND projection.source_entity_type = 'iam.contents'
  AND projection.source_entity_id = content.id::text;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
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

  IF TG_OP = 'UPDATE' THEN
    DELETE FROM iam.content_list_projection
    WHERE instance_id = OLD.instance_id
      AND source_system = 'iam'
      AND source_entity_type = 'iam.contents'
      AND source_entity_id = OLD.id::text;
  END IF;

  INSERT INTO iam.content_list_projection (
    id,
    instance_id,
    organization_id,
    owner_subject_id,
    owner_user_id,
    owner_organization_id,
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
    NEW.owner_user_id,
    NEW.owner_organization_id,
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
  ON CONFLICT ON CONSTRAINT content_list_projection_scope_key
  DO UPDATE SET
    id = EXCLUDED.id,
    organization_id = EXCLUDED.organization_id,
    owner_subject_id = EXCLUDED.owner_subject_id,
    owner_user_id = EXCLUDED.owner_user_id,
    owner_organization_id = EXCLUDED.owner_organization_id,
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

ALTER TABLE iam.content_list_projection
  DROP CONSTRAINT IF EXISTS content_list_projection_author_display_mode_chk;

ALTER TABLE iam.contents
  DROP CONSTRAINT IF EXISTS contents_author_display_mode_chk;

ALTER TABLE iam.content_list_projection
  DROP COLUMN IF EXISTS author_display_mode;

ALTER TABLE iam.contents
  DROP COLUMN IF EXISTS author_display_mode;
-- +goose StatementEnd
