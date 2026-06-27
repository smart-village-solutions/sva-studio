-- +goose Up
-- +goose StatementBegin
ALTER TABLE iam.contents
  ADD COLUMN IF NOT EXISTS owner_user_id UUID NULL,
  ADD COLUMN IF NOT EXISTS owner_organization_id UUID NULL;

-- Existing rows without canonical owner columns remain ownerless intentionally.
-- Ownerless content is only visible through global all-scope permissions.

ALTER TABLE iam.content_list_projection
  ADD COLUMN IF NOT EXISTS owner_user_id UUID NULL,
  ADD COLUMN IF NOT EXISTS owner_organization_id UUID NULL;

UPDATE iam.content_list_projection AS projection
SET
  owner_user_id = content.owner_user_id,
  owner_organization_id = content.owner_organization_id
FROM iam.contents AS content
WHERE projection.instance_id = content.instance_id
  AND projection.source_system = 'iam'
  AND projection.source_entity_type = 'iam.contents'
  AND projection.source_entity_id = content.id::text;

DELETE FROM iam.content_list_projection
WHERE source_system = 'mainserver'
  AND owner_subject_id IS NOT NULL
  AND owner_user_id IS NULL
  AND owner_organization_id IS NULL;

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

CREATE INDEX IF NOT EXISTS iam_content_list_projection_owner_user_updated_idx
  ON iam.content_list_projection (instance_id, owner_user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS iam_content_list_projection_owner_org_updated_idx
  ON iam.content_list_projection (instance_id, owner_organization_id, updated_at DESC);

DROP TRIGGER IF EXISTS sync_content_list_projection_from_contents_trg ON iam.contents;

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

CREATE TRIGGER sync_content_list_projection_from_contents_trg
AFTER INSERT OR UPDATE OR DELETE ON iam.contents
FOR EACH ROW
EXECUTE FUNCTION iam.sync_content_list_projection_from_contents();

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
SELECT
  content.id::text,
  content.instance_id,
  content.organization_id,
  content.owner_subject_id,
  content.owner_user_id,
  content.owner_organization_id,
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

DROP POLICY IF EXISTS account_permissions_isolation_policy ON iam.account_permissions;
DROP INDEX IF EXISTS iam.idx_account_permissions_instance_account;
DROP INDEX IF EXISTS iam.idx_account_permissions_instance_permission;
DROP TABLE IF EXISTS iam.account_permissions;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM iam.permissions
    WHERE effect = 'deny'
  ) THEN
    RAISE EXCEPTION 'iam.permissions contains deny rows; clean up unsupported deny permissions before applying migration 0061';
  END IF;
END $$;

DROP INDEX IF EXISTS iam.idx_permissions_instance_action_resource_effect;

ALTER TABLE iam.permissions
  DROP CONSTRAINT IF EXISTS permissions_effect_chk,
  DROP COLUMN IF EXISTS effect;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
ALTER TABLE iam.permissions
  ADD COLUMN IF NOT EXISTS effect TEXT NOT NULL DEFAULT 'allow';

ALTER TABLE iam.permissions
  ADD CONSTRAINT permissions_effect_chk
  CHECK (effect IN ('allow', 'deny'));

CREATE INDEX IF NOT EXISTS idx_permissions_instance_action_resource_effect
  ON iam.permissions(instance_id, action, resource_type, effect);

CREATE TABLE IF NOT EXISTS iam.account_permissions (
  instance_id TEXT NOT NULL,
  account_id UUID NOT NULL,
  permission_id UUID NOT NULL,
  effect TEXT NOT NULL DEFAULT 'allow',
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  assigned_by_account_id UUID NULL,
  CONSTRAINT account_permissions_pkey PRIMARY KEY (instance_id, account_id, permission_id),
  CONSTRAINT account_permissions_membership_fk FOREIGN KEY (instance_id, account_id)
    REFERENCES iam.instance_memberships(instance_id, account_id) ON DELETE CASCADE,
  CONSTRAINT account_permissions_permission_fk FOREIGN KEY (instance_id, permission_id)
    REFERENCES iam.permissions(instance_id, id) ON DELETE CASCADE,
  CONSTRAINT account_permissions_assigned_by_fk FOREIGN KEY (assigned_by_account_id)
    REFERENCES iam.accounts(id) ON DELETE SET NULL,
  CONSTRAINT account_permissions_effect_chk CHECK (effect IN ('allow', 'deny'))
);

CREATE INDEX IF NOT EXISTS idx_account_permissions_instance_account
  ON iam.account_permissions(instance_id, account_id);

CREATE INDEX IF NOT EXISTS idx_account_permissions_instance_permission
  ON iam.account_permissions(instance_id, permission_id);

ALTER TABLE iam.account_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE iam.account_permissions FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS account_permissions_isolation_policy ON iam.account_permissions;
CREATE POLICY account_permissions_isolation_policy
  ON iam.account_permissions
  USING (instance_id = iam.current_instance_id())
  WITH CHECK (instance_id = iam.current_instance_id());

DROP TRIGGER IF EXISTS sync_content_list_projection_from_contents_trg ON iam.contents;
DROP FUNCTION IF EXISTS iam.sync_content_list_projection_from_contents();

ALTER TABLE iam.content_list_projection
  DROP CONSTRAINT IF EXISTS content_list_projection_scope_key;

DROP INDEX IF EXISTS iam.iam_content_list_projection_owner_user_updated_idx;
DROP INDEX IF EXISTS iam.iam_content_list_projection_owner_org_updated_idx;

ALTER TABLE iam.content_list_projection
  DROP COLUMN IF EXISTS owner_user_id,
  DROP COLUMN IF EXISTS owner_organization_id;

ALTER TABLE iam.content_list_projection
  ADD CONSTRAINT content_list_projection_scope_key
  UNIQUE NULLS NOT DISTINCT (
    instance_id,
    source_system,
    source_entity_type,
    source_entity_id,
    organization_id,
    owner_subject_id
  );

ALTER TABLE iam.contents
  DROP COLUMN IF EXISTS owner_user_id,
  DROP COLUMN IF EXISTS owner_organization_id;

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
  ON CONFLICT ON CONSTRAINT content_list_projection_scope_key
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

  RETURN NEW;
END;
$$;

CREATE TRIGGER sync_content_list_projection_from_contents_trg
AFTER INSERT OR UPDATE OR DELETE ON iam.contents
FOR EACH ROW
EXECUTE FUNCTION iam.sync_content_list_projection_from_contents();
-- +goose StatementEnd
