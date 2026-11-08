-- +goose Up
-- +goose StatementBegin
-- Studio-only hard delete. No external lifecycle or provisioning hooks are involved.
CREATE OR REPLACE FUNCTION iam.reject_app_translation_revision_change() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' AND TG_TABLE_NAME = 'app_translation_catalog_releases' THEN
    IF OLD.instance_id = iam.current_instance_id()
     AND current_setting('app.deleting_instance', true) = OLD.instance_id
     AND EXISTS (SELECT 1 FROM iam.instances WHERE id = OLD.instance_id AND status = 'archived') THEN
      RETURN OLD;
    END IF;
  END IF;
  RAISE EXCEPTION 'app_translation_revision_immutable' USING ERRCODE = '23514';
END;
$$;
CREATE POLICY app_translation_draft_instance_delete ON iam.app_translation_catalog_drafts
  FOR ALL TO iam_app
  USING (instance_id = iam.current_instance_id() AND current_setting('app.deleting_instance', true) = instance_id
    AND EXISTS (SELECT 1 FROM iam.instances WHERE id = instance_id AND status = 'archived'))
  WITH CHECK (false);
CREATE POLICY app_translation_release_instance_delete ON iam.app_translation_catalog_releases
  FOR ALL TO iam_app
  USING (instance_id = iam.current_instance_id() AND current_setting('app.deleting_instance', true) = instance_id
    AND EXISTS (SELECT 1 FROM iam.instances WHERE id = instance_id AND status = 'archived'))
  WITH CHECK (false);
GRANT DELETE ON iam.app_translation_catalog_drafts, iam.app_translation_catalog_releases TO iam_app;

CREATE FUNCTION iam.delete_studio_instance(p_instance text, p_updated_at timestamptz, p_actor text, p_request text)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER
SET search_path = pg_catalog, iam
AS $$
DECLARE
  target iam.instances%ROWTYPE;
  previous_retention text := current_setting('iam.retention_mode', true);
  previous_deleting text := current_setting('app.deleting_instance', true);
BEGIN
  IF p_instance IS DISTINCT FROM iam.current_instance_id() THEN
    RAISE EXCEPTION 'instance_delete_scope_mismatch';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_instance, 0));
  SELECT * INTO target FROM iam.instances WHERE id = p_instance FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  IF target.status <> 'archived' OR p_updated_at IS NULL OR target.updated_at <> p_updated_at
     OR target.primary_hostname = target.parent_domain THEN
    RAISE EXCEPTION 'instance_delete_conflict';
  END IF;
  IF EXISTS (SELECT 1 FROM iam.legal_holds WHERE instance_id = p_instance AND active) THEN
    RAISE EXCEPTION 'instance_delete_legal_hold';
  END IF;
  IF EXISTS (SELECT 1 FROM iam.studio_jobs WHERE instance_id = p_instance AND status IN ('queued', 'running', 'retrying'))
    OR EXISTS (SELECT 1 FROM iam.instance_keycloak_provisioning_runs WHERE instance_id = p_instance AND overall_status IN ('planned', 'running'))
    OR EXISTS (SELECT 1 FROM iam.instance_provisioning_runs WHERE instance_id = p_instance
      AND (status IN ('requested', 'provisioning') OR lease_expires_at > now())) THEN
    RAISE EXCEPTION 'instance_delete_busy';
  END IF;

  PERFORM set_config('app.deleting_instance', p_instance, true);
  PERFORM set_config('iam.retention_mode', 'true', true);
  -- Remove references that deliberately restrict account/organization deletion first.
  DELETE FROM iam.app_translation_catalog_drafts WHERE instance_id = p_instance;
  DELETE FROM iam.app_translation_catalog_releases WHERE instance_id = p_instance;
  DELETE FROM iam.data_subject_export_jobs WHERE instance_id = p_instance;
  DELETE FROM iam.data_subject_request_events WHERE instance_id = p_instance;
  DELETE FROM iam.data_subject_requests WHERE instance_id = p_instance;
  DELETE FROM iam.account_profile_corrections WHERE instance_id = p_instance;
  DELETE FROM iam.permission_change_requests WHERE instance_id = p_instance;
  DELETE FROM iam.delegations WHERE instance_id = p_instance;
  DELETE FROM iam.impersonation_sessions WHERE instance_id = p_instance;
  DELETE FROM iam.legal_holds WHERE instance_id = p_instance;
  DELETE FROM iam.legal_text_acceptances WHERE instance_id = p_instance;
  DELETE FROM iam.instance_plugin_lifecycle WHERE instance_id = p_instance;
  DELETE FROM iam.instance_waste_provisioning WHERE instance_id = p_instance;
  DELETE FROM iam.studio_jobs WHERE instance_id = p_instance;
  -- These tables have no direct FK to the registry.
  DELETE FROM iam.content_history WHERE instance_id = p_instance;
  DELETE FROM iam.contents WHERE instance_id = p_instance;
  DELETE FROM iam.content_list_projection WHERE instance_id = p_instance;
  DELETE FROM iam.content_list_projection_sync_state WHERE instance_id = p_instance;
  -- Delete all rows of self-referencing trees in one statement, before their parent cascade.
  DELETE FROM iam.media_content_save_operation_references WHERE instance_id = p_instance;
  DELETE FROM iam.media_assets WHERE instance_id = p_instance;
  DELETE FROM iam.geo_units WHERE instance_id = p_instance;
  DELETE FROM iam.instances WHERE id = p_instance;

  PERFORM set_config('iam.retention_mode', coalesce(previous_retention, ''), true);
  PERFORM set_config('app.deleting_instance', coalesce(previous_deleting, ''), true);
  -- Keep the deletion evidence outside the tenant's cascading audit history.
  PERFORM set_config('app.instance_id', '', true);
  INSERT INTO iam.platform_activity_logs(event_type, actor_user_id, request_id, payload)
    VALUES ('instance.deleted', p_actor, p_request, jsonb_build_object('instanceId', p_instance));
  PERFORM set_config('app.instance_id', p_instance, true);
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION iam.delete_studio_instance(text, timestamptz, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION iam.delete_studio_instance(text, timestamptz, text, text) TO iam_app;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP FUNCTION iam.delete_studio_instance(text, timestamptz, text, text);
DROP POLICY app_translation_draft_instance_delete ON iam.app_translation_catalog_drafts;
DROP POLICY app_translation_release_instance_delete ON iam.app_translation_catalog_releases;
REVOKE DELETE ON iam.app_translation_catalog_drafts, iam.app_translation_catalog_releases FROM iam_app;
CREATE OR REPLACE FUNCTION iam.reject_app_translation_revision_change() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'app_translation_revision_immutable' USING ERRCODE = '23514';
END;
$$;
-- +goose StatementEnd
