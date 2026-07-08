-- +goose Up
-- +goose StatementBegin
CREATE OR REPLACE FUNCTION iam.build_content_list_projection_scope_key(
  p_instance_id TEXT,
  p_source_system TEXT,
  p_source_entity_type TEXT,
  p_source_entity_id TEXT,
  p_content_type TEXT,
  p_organization_id UUID,
  p_owner_subject_id TEXT,
  p_owner_user_id UUID,
  p_owner_organization_id UUID
)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_source_system = 'mainserver' THEN
      concat_ws(
        '::',
        p_instance_id,
        COALESCE(p_owner_user_id::text, 'no-owner-user'),
        COALESCE(p_owner_organization_id::text, p_organization_id::text, 'no-organization'),
        p_content_type
      )
    ELSE
      concat_ws(
        '::',
        p_instance_id,
        p_source_system,
        p_source_entity_type,
        p_source_entity_id,
        COALESCE(p_organization_id::text, 'no-organization'),
        COALESCE(p_owner_user_id::text, NULLIF(p_owner_subject_id, ''), 'no-owner-user'),
        COALESCE(p_owner_organization_id::text, 'no-owner-organization')
      )
  END;
$$;

ALTER TABLE iam.content_list_projection
  ADD COLUMN IF NOT EXISTS projection_scope_key TEXT;

UPDATE iam.content_list_projection
SET projection_scope_key = iam.build_content_list_projection_scope_key(
  instance_id,
  source_system,
  source_entity_type,
  source_entity_id,
  content_type,
  organization_id,
  owner_subject_id,
  owner_user_id,
  owner_organization_id
)
WHERE projection_scope_key IS NULL;

ALTER TABLE iam.content_list_projection
  ALTER COLUMN projection_scope_key SET NOT NULL;

ALTER TABLE iam.content_list_projection
  DROP CONSTRAINT IF EXISTS content_list_projection_scope_key;

ALTER TABLE iam.content_list_projection
  ADD CONSTRAINT content_list_projection_scope_key
  UNIQUE NULLS NOT DISTINCT (
    instance_id,
    source_system,
    source_entity_type,
    source_entity_id,
    projection_scope_key
  );

CREATE INDEX IF NOT EXISTS iam_content_list_projection_mainserver_scope_idx
  ON iam.content_list_projection (instance_id, source_system, content_type, projection_scope_key);

ALTER TABLE iam.content_list_projection_sync_state
  ADD COLUMN IF NOT EXISTS sync_scope_key TEXT;

UPDATE iam.content_list_projection_sync_state
SET sync_scope_key = content_type
WHERE sync_scope_key IS NULL
  AND source_system <> 'mainserver';

UPDATE iam.content_list_projection_sync_state AS sync_state
SET sync_scope_key = scoped.projection_scope_key
FROM (
  SELECT
    projection.instance_id,
    projection.content_type,
    MIN(projection.projection_scope_key) AS projection_scope_key
  FROM iam.content_list_projection AS projection
  WHERE projection.source_system = 'mainserver'
  GROUP BY projection.instance_id, projection.content_type
) AS scoped
WHERE sync_state.sync_scope_key IS NULL
  AND sync_state.source_system = 'mainserver'
  AND sync_state.instance_id = scoped.instance_id
  AND sync_state.content_type = scoped.content_type;

UPDATE iam.content_list_projection_sync_state
SET sync_scope_key = content_type
WHERE sync_scope_key IS NULL;

ALTER TABLE iam.content_list_projection_sync_state
  DROP CONSTRAINT IF EXISTS content_list_projection_sync_state_pkey;

INSERT INTO iam.content_list_projection_sync_state (
  instance_id,
  source_system,
  content_type,
  sync_scope_key,
  sync_mode,
  last_started_at,
  last_succeeded_at,
  last_failed_at,
  last_error_code,
  last_error_message,
  projected_count,
  updated_at
)
SELECT
  sync_state.instance_id,
  sync_state.source_system,
  sync_state.content_type,
  projection.projection_scope_key,
  sync_state.sync_mode,
  sync_state.last_started_at,
  sync_state.last_succeeded_at,
  sync_state.last_failed_at,
  sync_state.last_error_code,
  sync_state.last_error_message,
  COUNT(*)::int,
  sync_state.updated_at
FROM iam.content_list_projection_sync_state AS sync_state
JOIN iam.content_list_projection AS projection
  ON projection.instance_id = sync_state.instance_id
 AND projection.source_system = 'mainserver'
 AND projection.content_type = sync_state.content_type
WHERE sync_state.source_system = 'mainserver'
  AND sync_state.sync_scope_key <> projection.projection_scope_key
GROUP BY
  sync_state.instance_id,
  sync_state.source_system,
  sync_state.content_type,
  projection.projection_scope_key,
  sync_state.sync_mode,
  sync_state.last_started_at,
  sync_state.last_succeeded_at,
  sync_state.last_failed_at,
  sync_state.last_error_code,
  sync_state.last_error_message,
  sync_state.updated_at;

ALTER TABLE iam.content_list_projection_sync_state
  ALTER COLUMN sync_scope_key SET NOT NULL;

ALTER TABLE iam.content_list_projection_sync_state
  ADD CONSTRAINT content_list_projection_sync_state_pkey
  PRIMARY KEY (instance_id, source_system, content_type, sync_scope_key);

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
      sync_scope_key,
      sync_mode,
      last_succeeded_at,
      projected_count,
      updated_at
    )
    VALUES (
      OLD.instance_id,
      'iam',
      OLD.content_type,
      OLD.content_type,
      'full_refresh',
      NOW(),
      0,
      NOW()
    )
    ON CONFLICT (instance_id, source_system, content_type, sync_scope_key)
    DO UPDATE SET
      last_succeeded_at = EXCLUDED.last_succeeded_at,
      last_error_code = NULL,
      last_error_message = NULL,
      projected_count = EXCLUDED.projected_count,
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
    projection_scope_key,
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
    iam.build_content_list_projection_scope_key(
      NEW.instance_id,
      'iam',
      'iam.contents',
      NEW.id::text,
      NEW.content_type,
      NEW.organization_id,
      NEW.owner_subject_id,
      NEW.owner_user_id,
      NEW.owner_organization_id
    ),
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
    COALESCE(NEW.creator_account_id::text, '__iam_author_deleted__'),
    NEW.updated_at,
    COALESCE(NEW.updater_account_id::text, '__iam_author_deleted__'),
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
    projection_scope_key = EXCLUDED.projection_scope_key,
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
    sync_scope_key,
    sync_mode,
    last_succeeded_at,
    projected_count,
    updated_at
  )
  VALUES (
    NEW.instance_id,
    'iam',
    NEW.content_type,
    NEW.content_type,
    'full_refresh',
    NOW(),
    1,
    NOW()
  )
  ON CONFLICT (instance_id, source_system, content_type, sync_scope_key)
  DO UPDATE SET
    last_succeeded_at = EXCLUDED.last_succeeded_at,
    last_error_code = NULL,
    last_error_message = NULL,
    projected_count = EXCLUDED.projected_count,
    updated_at = EXCLUDED.updated_at;

  RETURN NEW;
END;
$$;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP INDEX IF EXISTS iam_content_list_projection_mainserver_scope_idx;

ALTER TABLE iam.content_list_projection_sync_state
  DROP CONSTRAINT IF EXISTS content_list_projection_sync_state_pkey;

DELETE FROM iam.content_list_projection_sync_state AS sync_state
WHERE sync_state.source_system = 'mainserver'
  AND sync_state.sync_scope_key <> sync_state.content_type;

UPDATE iam.content_list_projection_sync_state
SET sync_scope_key = content_type
WHERE source_system = 'mainserver';

ALTER TABLE iam.content_list_projection_sync_state
  ADD CONSTRAINT content_list_projection_sync_state_pkey
  PRIMARY KEY (instance_id, source_system, content_type);

ALTER TABLE iam.content_list_projection
  DROP CONSTRAINT IF EXISTS content_list_projection_scope_key;

ALTER TABLE iam.content_list_projection
  ADD CONSTRAINT content_list_projection_scope_key
  UNIQUE NULLS NOT DISTINCT (
    instance_id,
    source_system,
    source_entity_type,
    source_entity_id,
    organization_id,
    owner_user_id,
    owner_organization_id
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
    COALESCE(NEW.creator_account_id::text, '__iam_author_deleted__'),
    NEW.updated_at,
    COALESCE(NEW.updater_account_id::text, '__iam_author_deleted__'),
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

ALTER TABLE iam.content_list_projection_sync_state
  DROP COLUMN IF EXISTS sync_scope_key;

ALTER TABLE iam.content_list_projection
  DROP COLUMN IF EXISTS projection_scope_key;

DROP FUNCTION IF EXISTS iam.build_content_list_projection_scope_key(
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  UUID,
  TEXT,
  UUID,
  UUID
);
-- +goose StatementEnd
