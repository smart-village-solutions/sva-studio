--
-- PostgreSQL database dump
--

\restrict 8k3Qjf9gY0vuevNTyGYZ0GdclXCgxTTra0CfwVS3aqEMQXokjbN82cujAGXToFs

-- Dumped from database version 16.14
-- Dumped by pg_dump version 16.14

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: iam; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA iam;


--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: build_content_list_projection_scope_key(text, text, text, text, text, uuid, text, uuid, uuid); Type: FUNCTION; Schema: iam; Owner: -
--

CREATE FUNCTION iam.build_content_list_projection_scope_key(p_instance_id text, p_source_system text, p_source_entity_type text, p_source_entity_id text, p_content_type text, p_organization_id uuid, p_owner_subject_id text, p_owner_user_id uuid, p_owner_organization_id uuid) RETURNS text
    LANGUAGE sql IMMUTABLE
    AS $$
  SELECT CASE
    WHEN p_source_system = 'mainserver' THEN
      concat_ws(
        '::',
        p_instance_id,
        COALESCE(p_owner_user_id::text, 'missing-account:' || COALESCE(NULLIF(p_owner_subject_id, ''), 'unknown-subject')),
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


--
-- Name: check_geo_hierarchy_depth(); Type: FUNCTION; Schema: iam; Owner: -
--

CREATE FUNCTION iam.check_geo_hierarchy_depth() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  max_result_depth INTEGER;
BEGIN
  IF NEW.depth > 5 THEN
    RAISE EXCEPTION 'geo_hierarchy_depth_exceeded'
      USING DETAIL = 'Maximum geo hierarchy depth is 5',
            ERRCODE = 'check_violation';
  END IF;

  SELECT GREATEST(
           NEW.depth,
           COALESCE(
             (
               SELECT MAX(parent.depth + NEW.depth)
               FROM iam.geo_hierarchy parent
               WHERE parent.descendant_id = NEW.ancestor_id
             ),
             NEW.depth
           ),
           COALESCE(
             (
               SELECT MAX(NEW.depth + child.depth)
               FROM iam.geo_hierarchy child
               WHERE child.ancestor_id = NEW.descendant_id
             ),
             NEW.depth
           ),
           COALESCE(
             (
               SELECT MAX(parent.depth + NEW.depth + child.depth)
               FROM iam.geo_hierarchy parent
               CROSS JOIN iam.geo_hierarchy child
               WHERE parent.descendant_id = NEW.ancestor_id
                 AND child.ancestor_id = NEW.descendant_id
             ),
             NEW.depth
           )
         )
    INTO max_result_depth;

  IF max_result_depth > 5 THEN
    RAISE EXCEPTION 'geo_hierarchy_depth_exceeded'
      USING DETAIL = 'Maximum geo hierarchy depth is 5',
            ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: current_instance_id(); Type: FUNCTION; Schema: iam; Owner: -
--

CREATE FUNCTION iam.current_instance_id() RETURNS text
    LANGUAGE sql STABLE
    AS $$
  SELECT NULLIF(current_setting('app.instance_id', true), '')
$$;


--
-- Name: prevent_activity_logs_mutation(); Type: FUNCTION; Schema: iam; Owner: -
--

CREATE FUNCTION iam.prevent_activity_logs_mutation() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF TG_OP = 'DELETE' AND current_setting('iam.retention_mode', true) = 'true' THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'iam.activity_logs is immutable';
END;
$$;


--
-- Name: prevent_platform_activity_logs_mutation(); Type: FUNCTION; Schema: iam; Owner: -
--

CREATE FUNCTION iam.prevent_platform_activity_logs_mutation() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF TG_OP = 'DELETE' AND current_setting('iam.retention_mode', true) = 'true' THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'iam.platform_activity_logs is immutable';
END;
$$;


--
-- Name: sync_content_list_projection_from_contents(); Type: FUNCTION; Schema: iam; Owner: -
--

CREATE FUNCTION iam.sync_content_list_projection_from_contents() RETURNS trigger
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


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: account_deletion_content_preferences; Type: TABLE; Schema: iam; Owner: -
--

CREATE TABLE iam.account_deletion_content_preferences (
    instance_id text NOT NULL,
    account_id uuid NOT NULL,
    content_strategy text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT account_deletion_content_preferences_content_strategy_chk CHECK ((content_strategy = ANY (ARRAY['retain'::text, 'with_owner_lifecycle'::text])))
);

ALTER TABLE ONLY iam.account_deletion_content_preferences FORCE ROW LEVEL SECURITY;


--
-- Name: account_groups; Type: TABLE; Schema: iam; Owner: -
--

CREATE TABLE iam.account_groups (
    instance_id text NOT NULL,
    account_id uuid NOT NULL,
    group_id uuid NOT NULL,
    valid_from timestamp with time zone,
    valid_until timestamp with time zone,
    assigned_at timestamp with time zone DEFAULT now() NOT NULL,
    assigned_by uuid,
    origin text DEFAULT 'manual'::text NOT NULL,
    CONSTRAINT account_groups_origin_chk CHECK ((origin = ANY (ARRAY['manual'::text, 'seed'::text, 'sync'::text]))),
    CONSTRAINT account_groups_validity_chk CHECK (((valid_until IS NULL) OR (valid_from IS NULL) OR (valid_until >= valid_from)))
);


--
-- Name: account_organizations; Type: TABLE; Schema: iam; Owner: -
--

CREATE TABLE iam.account_organizations (
    account_id uuid NOT NULL,
    organization_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    is_default_context boolean DEFAULT false NOT NULL,
    membership_visibility text DEFAULT 'internal'::text NOT NULL,
    instance_id text NOT NULL,
    CONSTRAINT account_organizations_visibility_chk CHECK ((membership_visibility = ANY (ARRAY['internal'::text, 'external'::text])))
);


--
-- Name: account_profile_corrections; Type: TABLE; Schema: iam; Owner: -
--

CREATE TABLE iam.account_profile_corrections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    account_id uuid NOT NULL,
    actor_account_id uuid,
    previous_email_ciphertext text,
    previous_display_name_ciphertext text,
    next_email_ciphertext text,
    next_display_name_ciphertext text,
    correction_reason text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    instance_id text NOT NULL
);


--
-- Name: account_roles; Type: TABLE; Schema: iam; Owner: -
--

CREATE TABLE iam.account_roles (
    account_id uuid NOT NULL,
    role_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    assigned_by uuid,
    valid_from timestamp with time zone DEFAULT now() NOT NULL,
    valid_to timestamp with time zone,
    instance_id text NOT NULL,
    CONSTRAINT account_roles_valid_window_chk CHECK (((valid_to IS NULL) OR (valid_to > valid_from)))
);


--
-- Name: accounts; Type: TABLE; Schema: iam; Owner: -
--

CREATE TABLE iam.accounts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    keycloak_subject text NOT NULL,
    email_ciphertext text,
    display_name_ciphertext text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    is_blocked boolean DEFAULT false NOT NULL,
    soft_deleted_at timestamp with time zone,
    delete_after timestamp with time zone,
    permanently_deleted_at timestamp with time zone,
    processing_restricted_at timestamp with time zone,
    processing_restriction_reason text,
    non_essential_processing_opt_out_at timestamp with time zone,
    first_name_ciphertext text,
    last_name_ciphertext text,
    phone_ciphertext text,
    "position" text,
    department text,
    avatar_url text,
    preferred_language text,
    timezone text,
    status text DEFAULT 'pending'::text NOT NULL,
    notes text,
    username_ciphertext text,
    instance_id text,
    last_login_at timestamp with time zone,
    deletion_lifecycle_state text DEFAULT 'active'::text NOT NULL,
    deactivated_at timestamp with time zone,
    pseudonymized_at timestamp with time zone,
    deletion_marked_at timestamp with time zone,
    CONSTRAINT accounts_deletion_lifecycle_state_chk CHECK ((deletion_lifecycle_state = ANY (ARRAY['active'::text, 'deactivated'::text, 'pseudonymized'::text, 'deleted'::text]))),
    CONSTRAINT accounts_notes_length_chk CHECK ((char_length(notes) <= 2000)),
    CONSTRAINT accounts_status_chk CHECK ((status = ANY (ARRAY['pending'::text, 'active'::text, 'inactive'::text])))
);


--
-- Name: activity_logs; Type: TABLE; Schema: iam; Owner: -
--

CREATE TABLE iam.activity_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    account_id uuid,
    event_type text NOT NULL,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    request_id text,
    trace_id text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    subject_id uuid,
    result text DEFAULT 'success'::text NOT NULL,
    instance_id text NOT NULL,
    CONSTRAINT activity_logs_result_chk CHECK ((result = ANY (ARRAY['success'::text, 'failure'::text])))
);


--
-- Name: activity_logs_archive; Type: TABLE; Schema: iam; Owner: -
--

CREATE TABLE iam.activity_logs_archive (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    activity_log_id uuid NOT NULL,
    account_id uuid,
    subject_id uuid,
    event_type text NOT NULL,
    result text NOT NULL,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    request_id text,
    trace_id text,
    original_created_at timestamp with time zone NOT NULL,
    archived_at timestamp with time zone DEFAULT now() NOT NULL,
    instance_id text NOT NULL,
    CONSTRAINT activity_logs_archive_result_chk CHECK ((result = ANY (ARRAY['success'::text, 'failure'::text])))
);


--
-- Name: content_history; Type: TABLE; Schema: iam; Owner: -
--

CREATE TABLE iam.content_history (
    id uuid NOT NULL,
    instance_id text NOT NULL,
    content_id uuid NOT NULL,
    actor_account_id uuid,
    actor_display_name text NOT NULL,
    action text NOT NULL,
    changed_fields text[] DEFAULT ARRAY[]::text[] NOT NULL,
    previous_status text,
    next_status text,
    summary text,
    snapshot_json jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT content_history_action_chk CHECK ((action = ANY (ARRAY['created'::text, 'updated'::text, 'status_changed'::text])))
);


--
-- Name: content_list_projection; Type: TABLE; Schema: iam; Owner: -
--

CREATE TABLE iam.content_list_projection (
    id text NOT NULL,
    instance_id text NOT NULL,
    organization_id uuid,
    owner_subject_id text,
    content_type text NOT NULL,
    title text NOT NULL,
    published_at timestamp with time zone,
    publish_from timestamp with time zone,
    publish_until timestamp with time zone,
    created_at timestamp with time zone NOT NULL,
    created_by text NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    updated_by text NOT NULL,
    author_display_name text NOT NULL,
    payload_json jsonb DEFAULT '{}'::jsonb NOT NULL,
    status text NOT NULL,
    validation_state text DEFAULT 'valid'::text NOT NULL,
    history_ref text NOT NULL,
    current_revision_ref text,
    last_audit_event_ref text,
    source_system text NOT NULL,
    source_entity_type text NOT NULL,
    source_entity_id text NOT NULL,
    projection_updated_at timestamp with time zone DEFAULT now() NOT NULL,
    owner_user_id uuid,
    owner_organization_id uuid,
    author_display_mode text DEFAULT 'organization'::text NOT NULL,
    source_data_provider_id text,
    source_data_provider_name text,
    credential_source text,
    projection_scope_key text NOT NULL,
    CONSTRAINT content_list_projection_author_display_mode_chk CHECK ((author_display_mode = ANY (ARRAY['organization'::text, 'user'::text]))),
    CONSTRAINT content_list_projection_credential_source_chk CHECK (((credential_source IS NULL) OR (credential_source = ANY (ARRAY['organization'::text, 'user'::text])))),
    CONSTRAINT content_list_projection_source_system_chk CHECK ((source_system = ANY (ARRAY['iam'::text, 'mainserver'::text]))),
    CONSTRAINT content_list_projection_status_chk CHECK ((status = ANY (ARRAY['draft'::text, 'in_review'::text, 'approved'::text, 'published'::text, 'archived'::text]))),
    CONSTRAINT content_list_projection_validation_state_chk CHECK ((validation_state = ANY (ARRAY['valid'::text, 'invalid'::text, 'pending'::text])))
);


--
-- Name: content_list_projection_sync_state; Type: TABLE; Schema: iam; Owner: -
--

CREATE TABLE iam.content_list_projection_sync_state (
    instance_id text NOT NULL,
    source_system text NOT NULL,
    content_type text NOT NULL,
    sync_mode text DEFAULT 'full_refresh'::text NOT NULL,
    last_started_at timestamp with time zone,
    last_succeeded_at timestamp with time zone,
    last_failed_at timestamp with time zone,
    last_error_code text,
    last_error_message text,
    projected_count integer DEFAULT 0 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    sync_scope_key text NOT NULL,
    CONSTRAINT content_list_projection_sync_state_mode_chk CHECK ((sync_mode = 'full_refresh'::text)),
    CONSTRAINT content_list_projection_sync_state_source_system_chk CHECK ((source_system = ANY (ARRAY['iam'::text, 'mainserver'::text])))
);


--
-- Name: contents; Type: TABLE; Schema: iam; Owner: -
--

CREATE TABLE iam.contents (
    id uuid NOT NULL,
    instance_id text NOT NULL,
    content_type text NOT NULL,
    title text NOT NULL,
    published_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    author_account_id uuid,
    author_display_name text NOT NULL,
    payload_json jsonb NOT NULL,
    status text NOT NULL,
    organization_id uuid,
    owner_subject_id text,
    validation_state text DEFAULT 'valid'::text NOT NULL,
    publish_from timestamp with time zone,
    publish_until timestamp with time zone,
    creator_account_id uuid,
    updater_account_id uuid,
    history_ref text NOT NULL,
    current_revision_ref text,
    last_audit_event_ref text,
    deletion_lifecycle_state text DEFAULT 'active'::text NOT NULL,
    deletion_lifecycle_changed_at timestamp with time zone,
    owner_user_id uuid,
    owner_organization_id uuid,
    author_display_mode text DEFAULT 'organization'::text NOT NULL,
    CONSTRAINT contents_author_display_mode_chk CHECK ((author_display_mode = ANY (ARRAY['organization'::text, 'user'::text]))),
    CONSTRAINT contents_deletion_lifecycle_state_chk CHECK ((deletion_lifecycle_state = ANY (ARRAY['active'::text, 'deactivated'::text, 'pseudonymized'::text, 'deleted'::text]))),
    CONSTRAINT contents_status_chk CHECK ((status = ANY (ARRAY['draft'::text, 'in_review'::text, 'approved'::text, 'published'::text, 'archived'::text]))),
    CONSTRAINT contents_validation_state_chk CHECK ((validation_state = ANY (ARRAY['valid'::text, 'invalid'::text, 'pending'::text])))
);


--
-- Name: data_subject_export_jobs; Type: TABLE; Schema: iam; Owner: -
--

CREATE TABLE iam.data_subject_export_jobs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    target_account_id uuid NOT NULL,
    requested_by_account_id uuid,
    format text NOT NULL,
    status text DEFAULT 'queued'::text NOT NULL,
    error_message text,
    payload_json jsonb,
    payload_csv text,
    payload_xml text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    instance_id text NOT NULL,
    studio_job_id uuid,
    CONSTRAINT data_subject_export_jobs_format_chk CHECK ((format = ANY (ARRAY['json'::text, 'csv'::text, 'xml'::text]))),
    CONSTRAINT data_subject_export_jobs_status_chk CHECK ((status = ANY (ARRAY['queued'::text, 'processing'::text, 'completed'::text, 'failed'::text])))
);


--
-- Name: data_subject_recipient_notifications; Type: TABLE; Schema: iam; Owner: -
--

CREATE TABLE iam.data_subject_recipient_notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    request_id uuid NOT NULL,
    recipient_class text NOT NULL,
    notification_status text DEFAULT 'pending'::text NOT NULL,
    notification_result text,
    notified_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    instance_id text NOT NULL,
    CONSTRAINT data_subject_recipient_notifications_status_chk CHECK ((notification_status = ANY (ARRAY['pending'::text, 'sent'::text, 'skipped'::text])))
);


--
-- Name: data_subject_request_events; Type: TABLE; Schema: iam; Owner: -
--

CREATE TABLE iam.data_subject_request_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    request_id uuid NOT NULL,
    actor_account_id uuid,
    event_type text NOT NULL,
    event_payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    instance_id text NOT NULL
);


--
-- Name: data_subject_requests; Type: TABLE; Schema: iam; Owner: -
--

CREATE TABLE iam.data_subject_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    request_type text NOT NULL,
    status text DEFAULT 'accepted'::text NOT NULL,
    requester_account_id uuid,
    target_account_id uuid NOT NULL,
    legal_hold_blocked boolean DEFAULT false NOT NULL,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    sla_deadline_at timestamp with time zone,
    request_accepted_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone,
    escalated_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    instance_id text NOT NULL,
    CONSTRAINT data_subject_requests_status_chk CHECK ((status = ANY (ARRAY['accepted'::text, 'processing'::text, 'blocked_legal_hold'::text, 'completed'::text, 'failed'::text, 'escalated'::text]))),
    CONSTRAINT data_subject_requests_type_chk CHECK ((request_type = ANY (ARRAY['access'::text, 'deletion'::text, 'rectification'::text, 'restriction'::text, 'objection'::text])))
);


--
-- Name: delegations; Type: TABLE; Schema: iam; Owner: -
--

CREATE TABLE iam.delegations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    delegator_account_id uuid NOT NULL,
    delegatee_account_id uuid NOT NULL,
    role_id uuid NOT NULL,
    status text DEFAULT 'requested'::text NOT NULL,
    ticket_id text,
    ticket_system text,
    ticket_state text,
    approver_account_id uuid,
    starts_at timestamp with time zone NOT NULL,
    ends_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    revoked_at timestamp with time zone,
    instance_id text NOT NULL,
    CONSTRAINT delegations_duration_chk CHECK ((ends_at > starts_at)),
    CONSTRAINT delegations_status_chk CHECK ((status = ANY (ARRAY['requested'::text, 'active'::text, 'expired'::text, 'revoked'::text])))
);


--
-- Name: external_interface_types; Type: TABLE; Schema: iam; Owner: -
--

CREATE TABLE iam.external_interface_types (
    type_key text NOT NULL,
    owner_kind text NOT NULL,
    owner_id text NOT NULL,
    display_name text NOT NULL,
    category text NOT NULL,
    public_schema_json jsonb DEFAULT '{}'::jsonb NOT NULL,
    secret_schema_json jsonb DEFAULT '{}'::jsonb NOT NULL,
    status_check_kind text NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT external_interface_types_category_chk CHECK ((category = ANY (ARRAY['api'::text, 'object_storage'::text, 'database'::text, 'feed'::text]))),
    CONSTRAINT external_interface_types_owner_kind_chk CHECK ((owner_kind = ANY (ARRAY['host'::text, 'plugin'::text])))
);


--
-- Name: geo_hierarchy; Type: TABLE; Schema: iam; Owner: -
--

CREATE TABLE iam.geo_hierarchy (
    ancestor_id uuid NOT NULL,
    descendant_id uuid NOT NULL,
    depth integer NOT NULL,
    CONSTRAINT geo_hierarchy_depth_range_chk CHECK (((depth >= 0) AND (depth <= 5)))
);


--
-- Name: geo_nodes; Type: TABLE; Schema: iam; Owner: -
--

CREATE TABLE iam.geo_nodes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    instance_id text NOT NULL,
    key text NOT NULL,
    display_name text NOT NULL,
    node_type text DEFAULT 'district'::text NOT NULL,
    deleted_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: geo_units; Type: TABLE; Schema: iam; Owner: -
--

CREATE TABLE iam.geo_units (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    instance_id text NOT NULL,
    geo_key text NOT NULL,
    display_name text NOT NULL,
    geo_type text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    parent_geo_unit_id uuid,
    hierarchy_path uuid[] DEFAULT ARRAY[]::uuid[] NOT NULL,
    depth integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT geo_units_depth_nonnegative_chk CHECK ((depth >= 0)),
    CONSTRAINT geo_units_parent_not_self_chk CHECK (((parent_geo_unit_id IS NULL) OR (parent_geo_unit_id <> id))),
    CONSTRAINT geo_units_type_chk CHECK ((geo_type = ANY (ARRAY['country'::text, 'state'::text, 'county'::text, 'municipality'::text, 'district'::text, 'custom'::text])))
);


--
-- Name: group_roles; Type: TABLE; Schema: iam; Owner: -
--

CREATE TABLE iam.group_roles (
    instance_id text NOT NULL,
    group_id uuid NOT NULL,
    role_id uuid NOT NULL,
    assigned_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: groups; Type: TABLE; Schema: iam; Owner: -
--

CREATE TABLE iam.groups (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    instance_id text NOT NULL,
    group_key text NOT NULL,
    display_name text NOT NULL,
    description text,
    group_type text DEFAULT 'custom'::text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT groups_type_chk CHECK ((group_type = 'role_bundle'::text))
);


--
-- Name: idempotency_keys; Type: TABLE; Schema: iam; Owner: -
--

CREATE TABLE iam.idempotency_keys (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    actor_account_id uuid NOT NULL,
    endpoint text NOT NULL,
    idempotency_key text NOT NULL,
    payload_hash text NOT NULL,
    status text DEFAULT 'IN_PROGRESS'::text NOT NULL,
    response_status integer,
    response_body jsonb,
    expires_at timestamp with time zone DEFAULT (now() + '24:00:00'::interval) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    instance_id text NOT NULL,
    CONSTRAINT idempotency_keys_status_chk CHECK ((status = ANY (ARRAY['IN_PROGRESS'::text, 'COMPLETED'::text, 'FAILED'::text])))
);


--
-- Name: impersonation_sessions; Type: TABLE; Schema: iam; Owner: -
--

CREATE TABLE iam.impersonation_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    actor_account_id uuid NOT NULL,
    target_account_id uuid NOT NULL,
    status text DEFAULT 'requested'::text NOT NULL,
    ticket_id text NOT NULL,
    ticket_system text NOT NULL,
    ticket_state text NOT NULL,
    approved_by_account_id uuid,
    security_approver_account_id uuid,
    requested_at timestamp with time zone DEFAULT now() NOT NULL,
    approved_at timestamp with time zone,
    started_at timestamp with time zone,
    ended_at timestamp with time zone,
    expires_at timestamp with time zone NOT NULL,
    termination_reason text,
    reason_code text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    instance_id text NOT NULL,
    CONSTRAINT impersonation_sessions_status_chk CHECK ((status = ANY (ARRAY['requested'::text, 'approved'::text, 'active'::text, 'terminated'::text, 'expired'::text])))
);


--
-- Name: instance_audit_events; Type: TABLE; Schema: iam; Owner: -
--

CREATE TABLE iam.instance_audit_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    instance_id text NOT NULL,
    event_type text NOT NULL,
    actor_id text,
    request_id text,
    details jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: instance_deletion_rules; Type: TABLE; Schema: iam; Owner: -
--

CREATE TABLE iam.instance_deletion_rules (
    instance_id text NOT NULL,
    deactivate_after_days integer NOT NULL,
    pseudonymize_after_days integer NOT NULL,
    delete_after_days integer NOT NULL,
    default_content_strategy text DEFAULT 'retain'::text NOT NULL,
    allow_content_preference_override boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT instance_deletion_rules_deactivate_after_days_chk CHECK ((deactivate_after_days > 0)),
    CONSTRAINT instance_deletion_rules_default_content_strategy_chk CHECK ((default_content_strategy = ANY (ARRAY['retain'::text, 'with_owner_lifecycle'::text]))),
    CONSTRAINT instance_deletion_rules_delete_after_days_chk CHECK ((delete_after_days > pseudonymize_after_days)),
    CONSTRAINT instance_deletion_rules_pseudonymize_after_days_chk CHECK ((pseudonymize_after_days > deactivate_after_days))
);

ALTER TABLE ONLY iam.instance_deletion_rules FORCE ROW LEVEL SECURITY;


--
-- Name: instance_external_interfaces; Type: TABLE; Schema: iam; Owner: -
--

CREATE TABLE iam.instance_external_interfaces (
    id text NOT NULL,
    instance_id text NOT NULL,
    type_key text NOT NULL,
    owner_kind text NOT NULL,
    owner_id text NOT NULL,
    display_name text NOT NULL,
    alias text NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    is_default boolean DEFAULT false NOT NULL,
    category text NOT NULL,
    base_url text,
    auth_mode text,
    public_config_json jsonb DEFAULT '{}'::jsonb NOT NULL,
    secret_config_ciphertext text,
    status_check_kind text NOT NULL,
    visible_status text DEFAULT 'unknown'::text NOT NULL,
    last_checked_at timestamp with time zone,
    last_check_status text,
    last_check_error_code text,
    last_check_error_message text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT instance_external_interfaces_category_chk CHECK ((category = ANY (ARRAY['api'::text, 'object_storage'::text, 'database'::text, 'feed'::text]))),
    CONSTRAINT instance_external_interfaces_last_check_status_chk CHECK (((last_check_status IS NULL) OR (last_check_status = ANY (ARRAY['succeeded'::text, 'failed'::text])))),
    CONSTRAINT instance_external_interfaces_owner_kind_chk CHECK ((owner_kind = ANY (ARRAY['host'::text, 'plugin'::text]))),
    CONSTRAINT instance_external_interfaces_visible_status_chk CHECK ((visible_status = ANY (ARRAY['not_configured'::text, 'unknown'::text, 'ok'::text, 'error'::text, 'disabled'::text])))
);

ALTER TABLE ONLY iam.instance_external_interfaces FORCE ROW LEVEL SECURITY;


--
-- Name: instance_hostnames; Type: TABLE; Schema: iam; Owner: -
--

CREATE TABLE iam.instance_hostnames (
    hostname text NOT NULL,
    instance_id text NOT NULL,
    is_primary boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by text
);


--
-- Name: instance_integrations; Type: TABLE; Schema: iam; Owner: -
--

CREATE TABLE iam.instance_integrations (
    instance_id text NOT NULL,
    provider_key text NOT NULL,
    graphql_base_url text NOT NULL,
    oauth_token_url text NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    last_verified_at timestamp with time zone,
    last_verified_status text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: instance_keycloak_provisioning_runs; Type: TABLE; Schema: iam; Owner: -
--

CREATE TABLE iam.instance_keycloak_provisioning_runs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    instance_id text NOT NULL,
    mode text NOT NULL,
    intent text NOT NULL,
    overall_status text NOT NULL,
    drift_summary text DEFAULT ''::text NOT NULL,
    request_id text,
    actor_id text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    mutation text,
    idempotency_key text,
    payload_fingerprint text,
    CONSTRAINT instance_keycloak_provisioning_runs_idempotency_complete_chk CHECK ((((mutation IS NULL) AND (idempotency_key IS NULL) AND (payload_fingerprint IS NULL)) OR ((mutation IS NOT NULL) AND (idempotency_key IS NOT NULL) AND (payload_fingerprint IS NOT NULL)))),
    CONSTRAINT instance_keycloak_provisioning_runs_intent_chk CHECK ((intent = ANY (ARRAY['provision'::text, 'provision_admin_client'::text, 'reset_tenant_admin'::text, 'rotate_client_secret'::text]))),
    CONSTRAINT instance_keycloak_provisioning_runs_mode_chk CHECK ((mode = ANY (ARRAY['new'::text, 'existing'::text]))),
    CONSTRAINT instance_keycloak_provisioning_runs_status_chk CHECK ((overall_status = ANY (ARRAY['planned'::text, 'running'::text, 'succeeded'::text, 'failed'::text])))
);


--
-- Name: instance_keycloak_provisioning_steps; Type: TABLE; Schema: iam; Owner: -
--

CREATE TABLE iam.instance_keycloak_provisioning_steps (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    run_id uuid NOT NULL,
    step_key text NOT NULL,
    title text NOT NULL,
    status text NOT NULL,
    started_at timestamp with time zone,
    finished_at timestamp with time zone,
    summary text DEFAULT ''::text NOT NULL,
    details jsonb DEFAULT '{}'::jsonb NOT NULL,
    request_id text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT instance_keycloak_provisioning_steps_status_chk CHECK ((status = ANY (ARRAY['pending'::text, 'running'::text, 'done'::text, 'failed'::text, 'skipped'::text, 'unchanged'::text])))
);


--
-- Name: instance_memberships; Type: TABLE; Schema: iam; Owner: -
--

CREATE TABLE iam.instance_memberships (
    account_id uuid NOT NULL,
    membership_type text DEFAULT 'member'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    instance_id text NOT NULL
);


--
-- Name: instance_modules; Type: TABLE; Schema: iam; Owner: -
--

CREATE TABLE iam.instance_modules (
    instance_id text NOT NULL,
    module_id text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: instance_provisioning_runs; Type: TABLE; Schema: iam; Owner: -
--

CREATE TABLE iam.instance_provisioning_runs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    instance_id text NOT NULL,
    operation text NOT NULL,
    status text NOT NULL,
    step_key text,
    idempotency_key text NOT NULL,
    error_code text,
    error_message text,
    request_id text,
    actor_id text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT instance_provisioning_operation_chk CHECK ((operation = ANY (ARRAY['create'::text, 'activate'::text, 'suspend'::text, 'archive'::text]))),
    CONSTRAINT instance_provisioning_status_chk CHECK ((status = ANY (ARRAY['requested'::text, 'validated'::text, 'provisioning'::text, 'active'::text, 'failed'::text, 'suspended'::text, 'archived'::text])))
);


--
-- Name: instance_waste_data_sources; Type: TABLE; Schema: iam; Owner: -
--

CREATE TABLE iam.instance_waste_data_sources (
    instance_id text NOT NULL,
    provider_key text NOT NULL,
    project_url text NOT NULL,
    schema_name text NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    database_url_ciphertext text,
    service_role_key_ciphertext text,
    visible_status text DEFAULT 'unknown'::text NOT NULL,
    last_checked_at timestamp with time zone,
    last_check_status text,
    last_check_error_code text,
    last_check_error_message text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT instance_waste_data_sources_last_check_status_chk CHECK (((last_check_status IS NULL) OR (last_check_status = ANY (ARRAY['succeeded'::text, 'failed'::text])))),
    CONSTRAINT instance_waste_data_sources_visible_status_chk CHECK ((visible_status = ANY (ARRAY['not_configured'::text, 'unknown'::text, 'ok'::text, 'error'::text, 'disabled'::text])))
);

ALTER TABLE ONLY iam.instance_waste_data_sources FORCE ROW LEVEL SECURITY;


--
-- Name: instances; Type: TABLE; Schema: iam; Owner: -
--

CREATE TABLE iam.instances (
    id text NOT NULL,
    display_name text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    retention_days integer DEFAULT 90 NOT NULL,
    audit_retention_days integer DEFAULT 365 NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    parent_domain text DEFAULT 'studio.smart-village.app'::text NOT NULL,
    primary_hostname text NOT NULL,
    theme_key text,
    feature_flags jsonb DEFAULT '{}'::jsonb NOT NULL,
    mainserver_config_ref text,
    created_by text,
    updated_by text,
    auth_realm text NOT NULL,
    auth_client_id text NOT NULL,
    auth_issuer_url text,
    auth_client_secret_ciphertext text,
    tenant_admin_username text,
    tenant_admin_email text,
    tenant_admin_first_name text,
    tenant_admin_last_name text,
    realm_mode text DEFAULT 'new'::text NOT NULL,
    tenant_admin_client_id text NOT NULL,
    tenant_admin_client_secret_ciphertext text,
    CONSTRAINT instances_audit_retention_days_positive_chk CHECK ((audit_retention_days > 0)),
    CONSTRAINT instances_realm_mode_chk CHECK ((realm_mode = ANY (ARRAY['new'::text, 'existing'::text]))),
    CONSTRAINT instances_retention_days_positive_chk CHECK ((retention_days > 0)),
    CONSTRAINT instances_status_chk CHECK ((status = ANY (ARRAY['requested'::text, 'validated'::text, 'provisioning'::text, 'active'::text, 'failed'::text, 'suspended'::text, 'archived'::text])))
);


--
-- Name: legal_holds; Type: TABLE; Schema: iam; Owner: -
--

CREATE TABLE iam.legal_holds (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    account_id uuid NOT NULL,
    active boolean DEFAULT true NOT NULL,
    hold_reason text NOT NULL,
    hold_until timestamp with time zone,
    lifted_reason text,
    created_by_account_id uuid,
    lifted_by_account_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    lifted_at timestamp with time zone,
    instance_id text NOT NULL
);


--
-- Name: legal_text_acceptances; Type: TABLE; Schema: iam; Owner: -
--

CREATE TABLE iam.legal_text_acceptances (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    legal_text_version_id uuid NOT NULL,
    account_id uuid NOT NULL,
    accepted_at timestamp with time zone DEFAULT now() NOT NULL,
    revoked_at timestamp with time zone,
    revocation_reason text,
    request_id text,
    trace_id text,
    instance_id text NOT NULL,
    workspace_id text,
    subject_id text,
    legal_text_version text,
    action_type text DEFAULT 'accepted'::text NOT NULL,
    CONSTRAINT legal_text_acceptances_action_type_chk CHECK ((action_type = ANY (ARRAY['accepted'::text, 'revoked'::text, 'prompted'::text])))
);


--
-- Name: legal_text_target_groups; Type: TABLE; Schema: iam; Owner: -
--

CREATE TABLE iam.legal_text_target_groups (
    instance_id text NOT NULL,
    legal_text_version_id uuid NOT NULL,
    group_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY iam.legal_text_target_groups FORCE ROW LEVEL SECURITY;


--
-- Name: legal_text_target_roles; Type: TABLE; Schema: iam; Owner: -
--

CREATE TABLE iam.legal_text_target_roles (
    instance_id text NOT NULL,
    legal_text_version_id uuid NOT NULL,
    role_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY iam.legal_text_target_roles FORCE ROW LEVEL SECURITY;


--
-- Name: legal_text_versions; Type: TABLE; Schema: iam; Owner: -
--

CREATE TABLE iam.legal_text_versions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    legal_text_id text NOT NULL,
    legal_text_version text NOT NULL,
    locale text NOT NULL,
    content_hash text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    published_at timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    instance_id text NOT NULL,
    name text NOT NULL,
    content_html text NOT NULL,
    status text NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT legal_text_versions_status_chk CHECK ((status = ANY (ARRAY['draft'::text, 'valid'::text, 'archived'::text])))
);


--
-- Name: media_assets; Type: TABLE; Schema: iam; Owner: -
--

CREATE TABLE iam.media_assets (
    id uuid NOT NULL,
    instance_id text NOT NULL,
    storage_key text NOT NULL,
    media_type text NOT NULL,
    mime_type text NOT NULL,
    byte_size bigint NOT NULL,
    visibility text NOT NULL,
    upload_status text NOT NULL,
    processing_status text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    technical jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT media_assets_media_type_chk CHECK ((media_type = 'image'::text)),
    CONSTRAINT media_assets_processing_status_chk CHECK ((processing_status = ANY (ARRAY['pending'::text, 'ready'::text, 'failed'::text]))),
    CONSTRAINT media_assets_upload_status_chk CHECK ((upload_status = ANY (ARRAY['pending'::text, 'validated'::text, 'processed'::text, 'failed'::text, 'blocked'::text]))),
    CONSTRAINT media_assets_visibility_chk CHECK ((visibility = ANY (ARRAY['public'::text, 'protected'::text])))
);


--
-- Name: media_references; Type: TABLE; Schema: iam; Owner: -
--

CREATE TABLE iam.media_references (
    id uuid NOT NULL,
    instance_id text NOT NULL,
    asset_id uuid NOT NULL,
    target_type text NOT NULL,
    target_id text NOT NULL,
    role text NOT NULL,
    sort_order integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: media_storage_quotas; Type: TABLE; Schema: iam; Owner: -
--

CREATE TABLE iam.media_storage_quotas (
    instance_id text NOT NULL,
    max_bytes bigint NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT media_storage_quotas_max_bytes_chk CHECK ((max_bytes > 0))
);


--
-- Name: media_storage_usage; Type: TABLE; Schema: iam; Owner: -
--

CREATE TABLE iam.media_storage_usage (
    instance_id text NOT NULL,
    total_bytes bigint DEFAULT 0 NOT NULL,
    asset_count integer DEFAULT 0 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: media_upload_sessions; Type: TABLE; Schema: iam; Owner: -
--

CREATE TABLE iam.media_upload_sessions (
    id uuid NOT NULL,
    instance_id text NOT NULL,
    asset_id uuid NOT NULL,
    storage_key text NOT NULL,
    mime_type text NOT NULL,
    byte_size bigint NOT NULL,
    status text NOT NULL,
    expires_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT media_upload_sessions_status_chk CHECK ((status = ANY (ARRAY['pending'::text, 'uploaded'::text, 'validated'::text, 'failed'::text, 'expired'::text])))
);


--
-- Name: media_variants; Type: TABLE; Schema: iam; Owner: -
--

CREATE TABLE iam.media_variants (
    id uuid NOT NULL,
    instance_id text NOT NULL,
    asset_id uuid NOT NULL,
    variant_key text NOT NULL,
    preset_key text NOT NULL,
    format text NOT NULL,
    width integer NOT NULL,
    height integer,
    storage_key text NOT NULL,
    generation_status text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT media_variants_generation_status_chk CHECK ((generation_status = ANY (ARRAY['pending'::text, 'ready'::text, 'failed'::text])))
);


--
-- Name: organization_mainserver_credentials; Type: TABLE; Schema: iam; Owner: -
--

CREATE TABLE iam.organization_mainserver_credentials (
    instance_id text NOT NULL,
    organization_id uuid NOT NULL,
    mainserver_application_id text,
    mainserver_application_secret_ciphertext text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by_account_id uuid
);

ALTER TABLE ONLY iam.organization_mainserver_credentials FORCE ROW LEVEL SECURITY;


--
-- Name: organizations; Type: TABLE; Schema: iam; Owner: -
--

CREATE TABLE iam.organizations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_key text NOT NULL,
    display_name text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    parent_organization_id uuid,
    organization_type text DEFAULT 'other'::text NOT NULL,
    content_author_policy text DEFAULT 'org_only'::text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    hierarchy_path uuid[] DEFAULT ARRAY[]::uuid[] NOT NULL,
    depth integer DEFAULT 0 NOT NULL,
    instance_id text NOT NULL,
    CONSTRAINT organizations_content_author_policy_chk CHECK ((content_author_policy = ANY (ARRAY['org_only'::text, 'org_or_personal'::text]))),
    CONSTRAINT organizations_depth_nonnegative_chk CHECK ((depth >= 0)),
    CONSTRAINT organizations_parent_not_self_chk CHECK (((parent_organization_id IS NULL) OR (parent_organization_id <> id))),
    CONSTRAINT organizations_type_chk CHECK ((organization_type = ANY (ARRAY['county'::text, 'municipality'::text, 'district'::text, 'company'::text, 'agency'::text, 'other'::text])))
);


--
-- Name: permission_change_requests; Type: TABLE; Schema: iam; Owner: -
--

CREATE TABLE iam.permission_change_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    requester_account_id uuid NOT NULL,
    target_account_id uuid NOT NULL,
    role_id uuid,
    status text DEFAULT 'draft'::text NOT NULL,
    is_critical boolean DEFAULT true NOT NULL,
    ticket_id text,
    ticket_system text,
    ticket_state text,
    approver_account_id uuid,
    security_approver_account_id uuid,
    rejection_reason text,
    reason_code text,
    requested_at timestamp with time zone DEFAULT now() NOT NULL,
    approved_at timestamp with time zone,
    applied_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    instance_id text NOT NULL,
    request_note text NOT NULL,
    request_origin text DEFAULT 'admin'::text NOT NULL,
    CONSTRAINT permission_change_requests_request_origin_chk CHECK ((request_origin = ANY (ARRAY['admin'::text, 'self_service'::text]))),
    CONSTRAINT permission_change_requests_status_chk CHECK ((status = ANY (ARRAY['draft'::text, 'intake'::text, 'triaged'::text, 'submitted'::text, 'approved'::text, 'rejected'::text, 'applied'::text])))
);


--
-- Name: permissions; Type: TABLE; Schema: iam; Owner: -
--

CREATE TABLE iam.permissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    permission_key text NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    action text NOT NULL,
    resource_type text NOT NULL,
    resource_id text,
    scope jsonb DEFAULT '{}'::jsonb NOT NULL,
    instance_id text NOT NULL
);


--
-- Name: platform_activity_logs; Type: TABLE; Schema: iam; Owner: -
--

CREATE TABLE iam.platform_activity_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    scope_kind text DEFAULT 'platform'::text NOT NULL,
    account_id uuid,
    event_type text NOT NULL,
    actor_user_id text,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    request_id text,
    trace_id text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT platform_activity_logs_scope_kind_chk CHECK ((scope_kind = 'platform'::text))
);

ALTER TABLE ONLY iam.platform_activity_logs FORCE ROW LEVEL SECURITY;


--
-- Name: role_permissions; Type: TABLE; Schema: iam; Owner: -
--

CREATE TABLE iam.role_permissions (
    role_id uuid NOT NULL,
    permission_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    instance_id text NOT NULL,
    grant_origin_kind text DEFAULT 'manual'::text NOT NULL,
    grant_origin_module_id text,
    access_scope text DEFAULT 'all'::text NOT NULL,
    CONSTRAINT role_permissions_access_scope_check CHECK ((access_scope = ANY (ARRAY['all'::text, 'own'::text, 'organization'::text]))),
    CONSTRAINT role_permissions_grant_origin_kind_check CHECK ((grant_origin_kind = ANY (ARRAY['manual'::text, 'seed'::text, 'bootstrap'::text, 'module_sync'::text]))),
    CONSTRAINT role_permissions_grant_origin_module_check CHECK ((((grant_origin_kind = 'module_sync'::text) AND (grant_origin_module_id IS NOT NULL) AND (btrim(grant_origin_module_id) <> ''::text)) OR ((grant_origin_kind <> 'module_sync'::text) AND (grant_origin_module_id IS NULL))))
);


--
-- Name: roles; Type: TABLE; Schema: iam; Owner: -
--

CREATE TABLE iam.roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    role_name text NOT NULL,
    description text,
    is_system_role boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    role_level integer DEFAULT 0 NOT NULL,
    role_key text NOT NULL,
    display_name text NOT NULL,
    external_role_name text NOT NULL,
    managed_by text DEFAULT 'studio'::text NOT NULL,
    sync_state text DEFAULT 'pending'::text NOT NULL,
    last_synced_at timestamp with time zone,
    last_error_code text,
    instance_id text NOT NULL,
    CONSTRAINT roles_managed_by_chk CHECK ((managed_by = ANY (ARRAY['studio'::text, 'external'::text]))),
    CONSTRAINT roles_role_level_range_chk CHECK (((role_level >= 0) AND (role_level <= 100))),
    CONSTRAINT roles_sync_state_chk CHECK ((sync_state = ANY (ARRAY['synced'::text, 'pending'::text, 'failed'::text])))
);


--
-- Name: studio_job_events; Type: TABLE; Schema: iam; Owner: -
--

CREATE TABLE iam.studio_job_events (
    id uuid NOT NULL,
    job_id uuid NOT NULL,
    instance_id text NOT NULL,
    event_type text NOT NULL,
    status text NOT NULL,
    progress jsonb,
    attempts integer DEFAULT 0 NOT NULL,
    message text,
    details jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT studio_job_events_status_check CHECK ((status = ANY (ARRAY['queued'::text, 'running'::text, 'retrying'::text, 'succeeded'::text, 'failed'::text, 'cancelled'::text]))),
    CONSTRAINT studio_job_events_type_check CHECK ((event_type = ANY (ARRAY['job.queued'::text, 'job.started'::text, 'job.progressed'::text, 'job.retrying'::text, 'job.succeeded'::text, 'job.failed'::text, 'job.cancelled'::text])))
);


--
-- Name: studio_jobs; Type: TABLE; Schema: iam; Owner: -
--

CREATE TABLE iam.studio_jobs (
    id uuid NOT NULL,
    instance_id text NOT NULL,
    plugin_id text,
    job_type_id text NOT NULL,
    import_profile_id text,
    queue_name text NOT NULL,
    status text NOT NULL,
    progress jsonb,
    input_payload jsonb NOT NULL,
    result_payload jsonb,
    error_payload jsonb,
    attempts integer DEFAULT 0 NOT NULL,
    max_attempts integer DEFAULT 1 NOT NULL,
    idempotency_key text NOT NULL,
    request_id text,
    actor_account_id text,
    scheduled_at timestamp with time zone NOT NULL,
    started_at timestamp with time zone,
    finished_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    worker_id text,
    heartbeat_at timestamp with time zone,
    last_progress_at timestamp with time zone,
    cancel_requested_at timestamp with time zone,
    correlation_id text,
    parent_job_id uuid,
    source text DEFAULT 'plugin'::text NOT NULL,
    CONSTRAINT studio_jobs_attempts_check CHECK ((attempts >= 0)),
    CONSTRAINT studio_jobs_max_attempts_check CHECK ((max_attempts >= 1)),
    CONSTRAINT studio_jobs_source_check CHECK ((source = ANY (ARRAY['plugin'::text, 'host'::text]))),
    CONSTRAINT studio_jobs_status_check CHECK ((status = ANY (ARRAY['queued'::text, 'running'::text, 'retrying'::text, 'succeeded'::text, 'failed'::text, 'cancelled'::text])))
);


--
-- Name: goose_db_version; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.goose_db_version (
    id integer NOT NULL,
    version_id bigint NOT NULL,
    is_applied boolean NOT NULL,
    tstamp timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: goose_db_version_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.goose_db_version ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.goose_db_version_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: waste_email_reminder_outbox; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.waste_email_reminder_outbox (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    subscription_id uuid NOT NULL,
    message_kind text NOT NULL,
    transport_id text NOT NULL,
    template_key text NOT NULL,
    send_at timestamp with time zone NOT NULL,
    dedupe_key text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    payload jsonb NOT NULL,
    leased_at timestamp with time zone,
    sent_at timestamp with time zone,
    attempt_count integer DEFAULT 0 NOT NULL,
    last_error text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT waste_email_reminder_outbox_message_kind_check CHECK ((message_kind = ANY (ARRAY['doi'::text, 'reminder'::text]))),
    CONSTRAINT waste_email_reminder_outbox_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'processing'::text, 'sent'::text, 'failed'::text, 'cancelled'::text])))
);


--
-- Name: waste_email_reminder_subscription_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.waste_email_reminder_subscription_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    subscription_id uuid NOT NULL,
    fraction_id uuid NOT NULL,
    slot_id text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: waste_email_reminder_subscriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.waste_email_reminder_subscriptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email text NOT NULL,
    email_hash text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    region_id uuid,
    city_id uuid NOT NULL,
    street_id text NOT NULL,
    house_number_id uuid,
    location_label text NOT NULL,
    consent_version text NOT NULL,
    consent_accepted_at timestamp with time zone NOT NULL,
    doi_token_hash text NOT NULL,
    unsubscribe_token_hash text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    activated_at timestamp with time zone,
    unsubscribed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT waste_email_reminder_subscriptions_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'active'::text, 'unsubscribed'::text, 'expired'::text])))
);


--
-- Name: account_deletion_content_preferences account_deletion_content_preferences_pkey; Type: CONSTRAINT; Schema: iam; Owner: -
--

ALTER TABLE ONLY iam.account_deletion_content_preferences
    ADD CONSTRAINT account_deletion_content_preferences_pkey PRIMARY KEY (instance_id, account_id);


--
-- Name: account_groups account_groups_pkey; Type: CONSTRAINT; Schema: iam; Owner: -
--

ALTER TABLE ONLY iam.account_groups
    ADD CONSTRAINT account_groups_pkey PRIMARY KEY (instance_id, account_id, group_id);


--
-- Name: account_organizations account_organizations_pkey; Type: CONSTRAINT; Schema: iam; Owner: -
--

ALTER TABLE ONLY iam.account_organizations
    ADD CONSTRAINT account_organizations_pkey PRIMARY KEY (instance_id, account_id, organization_id);


--
-- Name: account_profile_corrections account_profile_corrections_pkey; Type: CONSTRAINT; Schema: iam; Owner: -
--

ALTER TABLE ONLY iam.account_profile_corrections
    ADD CONSTRAINT account_profile_corrections_pkey PRIMARY KEY (id);


--
-- Name: account_roles account_roles_pkey; Type: CONSTRAINT; Schema: iam; Owner: -
--

ALTER TABLE ONLY iam.account_roles
    ADD CONSTRAINT account_roles_pkey PRIMARY KEY (instance_id, account_id, role_id);


--
-- Name: accounts accounts_pkey; Type: CONSTRAINT; Schema: iam; Owner: -
--

ALTER TABLE ONLY iam.accounts
    ADD CONSTRAINT accounts_pkey PRIMARY KEY (id);


--
-- Name: activity_logs_archive activity_logs_archive_activity_log_unique; Type: CONSTRAINT; Schema: iam; Owner: -
--

ALTER TABLE ONLY iam.activity_logs_archive
    ADD CONSTRAINT activity_logs_archive_activity_log_unique UNIQUE (activity_log_id);


--
-- Name: activity_logs_archive activity_logs_archive_pkey; Type: CONSTRAINT; Schema: iam; Owner: -
--

ALTER TABLE ONLY iam.activity_logs_archive
    ADD CONSTRAINT activity_logs_archive_pkey PRIMARY KEY (id);


--
-- Name: activity_logs activity_logs_pkey; Type: CONSTRAINT; Schema: iam; Owner: -
--

ALTER TABLE ONLY iam.activity_logs
    ADD CONSTRAINT activity_logs_pkey PRIMARY KEY (id);


--
-- Name: content_history content_history_pkey; Type: CONSTRAINT; Schema: iam; Owner: -
--

ALTER TABLE ONLY iam.content_history
    ADD CONSTRAINT content_history_pkey PRIMARY KEY (id);


--
-- Name: content_list_projection content_list_projection_scope_key; Type: CONSTRAINT; Schema: iam; Owner: -
--

ALTER TABLE ONLY iam.content_list_projection
    ADD CONSTRAINT content_list_projection_scope_key UNIQUE NULLS NOT DISTINCT (instance_id, source_system, source_entity_type, source_entity_id, projection_scope_key);


--
-- Name: content_list_projection_sync_state content_list_projection_sync_state_pkey; Type: CONSTRAINT; Schema: iam; Owner: -
--

ALTER TABLE ONLY iam.content_list_projection_sync_state
    ADD CONSTRAINT content_list_projection_sync_state_pkey PRIMARY KEY (instance_id, source_system, content_type, sync_scope_key);


--
-- Name: contents contents_pkey; Type: CONSTRAINT; Schema: iam; Owner: -
--

ALTER TABLE ONLY iam.contents
    ADD CONSTRAINT contents_pkey PRIMARY KEY (id);


--
-- Name: data_subject_export_jobs data_subject_export_jobs_pkey; Type: CONSTRAINT; Schema: iam; Owner: -
--

ALTER TABLE ONLY iam.data_subject_export_jobs
    ADD CONSTRAINT data_subject_export_jobs_pkey PRIMARY KEY (id);


--
-- Name: data_subject_recipient_notifications data_subject_recipient_notifications_pkey; Type: CONSTRAINT; Schema: iam; Owner: -
--

ALTER TABLE ONLY iam.data_subject_recipient_notifications
    ADD CONSTRAINT data_subject_recipient_notifications_pkey PRIMARY KEY (id);


--
-- Name: data_subject_recipient_notifications data_subject_recipient_notifications_unique; Type: CONSTRAINT; Schema: iam; Owner: -
--

ALTER TABLE ONLY iam.data_subject_recipient_notifications
    ADD CONSTRAINT data_subject_recipient_notifications_unique UNIQUE (instance_id, request_id, recipient_class);


--
-- Name: data_subject_request_events data_subject_request_events_pkey; Type: CONSTRAINT; Schema: iam; Owner: -
--

ALTER TABLE ONLY iam.data_subject_request_events
    ADD CONSTRAINT data_subject_request_events_pkey PRIMARY KEY (id);


--
-- Name: data_subject_requests data_subject_requests_pkey; Type: CONSTRAINT; Schema: iam; Owner: -
--

ALTER TABLE ONLY iam.data_subject_requests
    ADD CONSTRAINT data_subject_requests_pkey PRIMARY KEY (id);


--
-- Name: delegations delegations_pkey; Type: CONSTRAINT; Schema: iam; Owner: -
--

ALTER TABLE ONLY iam.delegations
    ADD CONSTRAINT delegations_pkey PRIMARY KEY (id);


--
-- Name: external_interface_types external_interface_types_pkey; Type: CONSTRAINT; Schema: iam; Owner: -
--

ALTER TABLE ONLY iam.external_interface_types
    ADD CONSTRAINT external_interface_types_pkey PRIMARY KEY (type_key);


--
-- Name: geo_hierarchy geo_hierarchy_pkey; Type: CONSTRAINT; Schema: iam; Owner: -
--

ALTER TABLE ONLY iam.geo_hierarchy
    ADD CONSTRAINT geo_hierarchy_pkey PRIMARY KEY (ancestor_id, descendant_id);


--
-- Name: geo_nodes geo_nodes_instance_key_uniq; Type: CONSTRAINT; Schema: iam; Owner: -
--

ALTER TABLE ONLY iam.geo_nodes
    ADD CONSTRAINT geo_nodes_instance_key_uniq UNIQUE (instance_id, key);


--
-- Name: geo_nodes geo_nodes_pkey; Type: CONSTRAINT; Schema: iam; Owner: -
--

ALTER TABLE ONLY iam.geo_nodes
    ADD CONSTRAINT geo_nodes_pkey PRIMARY KEY (id);


--
-- Name: geo_units geo_units_instance_key_uniq; Type: CONSTRAINT; Schema: iam; Owner: -
--

ALTER TABLE ONLY iam.geo_units
    ADD CONSTRAINT geo_units_instance_key_uniq UNIQUE (instance_id, geo_key);


--
-- Name: geo_units geo_units_pkey; Type: CONSTRAINT; Schema: iam; Owner: -
--

ALTER TABLE ONLY iam.geo_units
    ADD CONSTRAINT geo_units_pkey PRIMARY KEY (id);


--
-- Name: group_roles group_roles_pkey; Type: CONSTRAINT; Schema: iam; Owner: -
--

ALTER TABLE ONLY iam.group_roles
    ADD CONSTRAINT group_roles_pkey PRIMARY KEY (instance_id, group_id, role_id);


--
-- Name: groups groups_instance_key_uniq; Type: CONSTRAINT; Schema: iam; Owner: -
--

ALTER TABLE ONLY iam.groups
    ADD CONSTRAINT groups_instance_key_uniq UNIQUE (instance_id, group_key);


--
-- Name: groups groups_pkey; Type: CONSTRAINT; Schema: iam; Owner: -
--

ALTER TABLE ONLY iam.groups
    ADD CONSTRAINT groups_pkey PRIMARY KEY (id);


--
-- Name: idempotency_keys idempotency_keys_pkey; Type: CONSTRAINT; Schema: iam; Owner: -
--

ALTER TABLE ONLY iam.idempotency_keys
    ADD CONSTRAINT idempotency_keys_pkey PRIMARY KEY (id);


--
-- Name: impersonation_sessions impersonation_sessions_pkey; Type: CONSTRAINT; Schema: iam; Owner: -
--

ALTER TABLE ONLY iam.impersonation_sessions
    ADD CONSTRAINT impersonation_sessions_pkey PRIMARY KEY (id);


--
-- Name: instance_audit_events instance_audit_events_pkey; Type: CONSTRAINT; Schema: iam; Owner: -
--

ALTER TABLE ONLY iam.instance_audit_events
    ADD CONSTRAINT instance_audit_events_pkey PRIMARY KEY (id);


--
-- Name: instance_deletion_rules instance_deletion_rules_pkey; Type: CONSTRAINT; Schema: iam; Owner: -
--

ALTER TABLE ONLY iam.instance_deletion_rules
    ADD CONSTRAINT instance_deletion_rules_pkey PRIMARY KEY (instance_id);


--
-- Name: instance_external_interfaces instance_external_interfaces_instance_type_alias_key; Type: CONSTRAINT; Schema: iam; Owner: -
--

ALTER TABLE ONLY iam.instance_external_interfaces
    ADD CONSTRAINT instance_external_interfaces_instance_type_alias_key UNIQUE (instance_id, type_key, alias);


--
-- Name: instance_external_interfaces instance_external_interfaces_pkey; Type: CONSTRAINT; Schema: iam; Owner: -
--

ALTER TABLE ONLY iam.instance_external_interfaces
    ADD CONSTRAINT instance_external_interfaces_pkey PRIMARY KEY (id);


--
-- Name: instance_hostnames instance_hostnames_pkey; Type: CONSTRAINT; Schema: iam; Owner: -
--

ALTER TABLE ONLY iam.instance_hostnames
    ADD CONSTRAINT instance_hostnames_pkey PRIMARY KEY (hostname);


--
-- Name: instance_integrations instance_integrations_pkey; Type: CONSTRAINT; Schema: iam; Owner: -
--

ALTER TABLE ONLY iam.instance_integrations
    ADD CONSTRAINT instance_integrations_pkey PRIMARY KEY (instance_id, provider_key);


--
-- Name: instance_keycloak_provisioning_runs instance_keycloak_provisioning_runs_pkey; Type: CONSTRAINT; Schema: iam; Owner: -
--

ALTER TABLE ONLY iam.instance_keycloak_provisioning_runs
    ADD CONSTRAINT instance_keycloak_provisioning_runs_pkey PRIMARY KEY (id);


--
-- Name: instance_keycloak_provisioning_steps instance_keycloak_provisioning_steps_pkey; Type: CONSTRAINT; Schema: iam; Owner: -
--

ALTER TABLE ONLY iam.instance_keycloak_provisioning_steps
    ADD CONSTRAINT instance_keycloak_provisioning_steps_pkey PRIMARY KEY (id);


--
-- Name: instance_memberships instance_memberships_pkey; Type: CONSTRAINT; Schema: iam; Owner: -
--

ALTER TABLE ONLY iam.instance_memberships
    ADD CONSTRAINT instance_memberships_pkey PRIMARY KEY (instance_id, account_id);


--
-- Name: instance_modules instance_modules_pkey; Type: CONSTRAINT; Schema: iam; Owner: -
--

ALTER TABLE ONLY iam.instance_modules
    ADD CONSTRAINT instance_modules_pkey PRIMARY KEY (instance_id, module_id);


--
-- Name: instance_provisioning_runs instance_provisioning_runs_pkey; Type: CONSTRAINT; Schema: iam; Owner: -
--

ALTER TABLE ONLY iam.instance_provisioning_runs
    ADD CONSTRAINT instance_provisioning_runs_pkey PRIMARY KEY (id);


--
-- Name: instance_waste_data_sources instance_waste_data_sources_pkey; Type: CONSTRAINT; Schema: iam; Owner: -
--

ALTER TABLE ONLY iam.instance_waste_data_sources
    ADD CONSTRAINT instance_waste_data_sources_pkey PRIMARY KEY (instance_id);


--
-- Name: instances instances_pkey; Type: CONSTRAINT; Schema: iam; Owner: -
--

ALTER TABLE ONLY iam.instances
    ADD CONSTRAINT instances_pkey PRIMARY KEY (id);


--
-- Name: legal_holds legal_holds_pkey; Type: CONSTRAINT; Schema: iam; Owner: -
--

ALTER TABLE ONLY iam.legal_holds
    ADD CONSTRAINT legal_holds_pkey PRIMARY KEY (id);


--
-- Name: legal_text_acceptances legal_text_acceptances_pkey; Type: CONSTRAINT; Schema: iam; Owner: -
--

ALTER TABLE ONLY iam.legal_text_acceptances
    ADD CONSTRAINT legal_text_acceptances_pkey PRIMARY KEY (id);


--
-- Name: legal_text_acceptances legal_text_acceptances_unique; Type: CONSTRAINT; Schema: iam; Owner: -
--

ALTER TABLE ONLY iam.legal_text_acceptances
    ADD CONSTRAINT legal_text_acceptances_unique UNIQUE (instance_id, legal_text_version_id, account_id, accepted_at);


--
-- Name: legal_text_target_groups legal_text_target_groups_unique; Type: CONSTRAINT; Schema: iam; Owner: -
--

ALTER TABLE ONLY iam.legal_text_target_groups
    ADD CONSTRAINT legal_text_target_groups_unique UNIQUE (instance_id, legal_text_version_id, group_id);


--
-- Name: legal_text_target_roles legal_text_target_roles_unique; Type: CONSTRAINT; Schema: iam; Owner: -
--

ALTER TABLE ONLY iam.legal_text_target_roles
    ADD CONSTRAINT legal_text_target_roles_unique UNIQUE (instance_id, legal_text_version_id, role_id);


--
-- Name: legal_text_versions legal_text_versions_instance_unique; Type: CONSTRAINT; Schema: iam; Owner: -
--

ALTER TABLE ONLY iam.legal_text_versions
    ADD CONSTRAINT legal_text_versions_instance_unique UNIQUE (instance_id, legal_text_id, legal_text_version, locale);


--
-- Name: legal_text_versions legal_text_versions_pkey; Type: CONSTRAINT; Schema: iam; Owner: -
--

ALTER TABLE ONLY iam.legal_text_versions
    ADD CONSTRAINT legal_text_versions_pkey PRIMARY KEY (id);


--
-- Name: media_assets media_assets_pkey; Type: CONSTRAINT; Schema: iam; Owner: -
--

ALTER TABLE ONLY iam.media_assets
    ADD CONSTRAINT media_assets_pkey PRIMARY KEY (id);


--
-- Name: media_references media_references_pkey; Type: CONSTRAINT; Schema: iam; Owner: -
--

ALTER TABLE ONLY iam.media_references
    ADD CONSTRAINT media_references_pkey PRIMARY KEY (id);


--
-- Name: media_storage_quotas media_storage_quotas_pkey; Type: CONSTRAINT; Schema: iam; Owner: -
--

ALTER TABLE ONLY iam.media_storage_quotas
    ADD CONSTRAINT media_storage_quotas_pkey PRIMARY KEY (instance_id);


--
-- Name: media_storage_usage media_storage_usage_pkey; Type: CONSTRAINT; Schema: iam; Owner: -
--

ALTER TABLE ONLY iam.media_storage_usage
    ADD CONSTRAINT media_storage_usage_pkey PRIMARY KEY (instance_id);


--
-- Name: media_upload_sessions media_upload_sessions_pkey; Type: CONSTRAINT; Schema: iam; Owner: -
--

ALTER TABLE ONLY iam.media_upload_sessions
    ADD CONSTRAINT media_upload_sessions_pkey PRIMARY KEY (id);


--
-- Name: media_variants media_variants_pkey; Type: CONSTRAINT; Schema: iam; Owner: -
--

ALTER TABLE ONLY iam.media_variants
    ADD CONSTRAINT media_variants_pkey PRIMARY KEY (id);


--
-- Name: organization_mainserver_credentials organization_mainserver_credentials_pkey; Type: CONSTRAINT; Schema: iam; Owner: -
--

ALTER TABLE ONLY iam.organization_mainserver_credentials
    ADD CONSTRAINT organization_mainserver_credentials_pkey PRIMARY KEY (instance_id, organization_id);


--
-- Name: organizations organizations_instance_key_uniq; Type: CONSTRAINT; Schema: iam; Owner: -
--

ALTER TABLE ONLY iam.organizations
    ADD CONSTRAINT organizations_instance_key_uniq UNIQUE (instance_id, organization_key);


--
-- Name: organizations organizations_pkey; Type: CONSTRAINT; Schema: iam; Owner: -
--

ALTER TABLE ONLY iam.organizations
    ADD CONSTRAINT organizations_pkey PRIMARY KEY (id);


--
-- Name: permission_change_requests permission_change_requests_pkey; Type: CONSTRAINT; Schema: iam; Owner: -
--

ALTER TABLE ONLY iam.permission_change_requests
    ADD CONSTRAINT permission_change_requests_pkey PRIMARY KEY (id);


--
-- Name: permissions permissions_instance_key_uniq; Type: CONSTRAINT; Schema: iam; Owner: -
--

ALTER TABLE ONLY iam.permissions
    ADD CONSTRAINT permissions_instance_key_uniq UNIQUE (instance_id, permission_key);


--
-- Name: permissions permissions_pkey; Type: CONSTRAINT; Schema: iam; Owner: -
--

ALTER TABLE ONLY iam.permissions
    ADD CONSTRAINT permissions_pkey PRIMARY KEY (id);


--
-- Name: platform_activity_logs platform_activity_logs_pkey; Type: CONSTRAINT; Schema: iam; Owner: -
--

ALTER TABLE ONLY iam.platform_activity_logs
    ADD CONSTRAINT platform_activity_logs_pkey PRIMARY KEY (id);


--
-- Name: role_permissions role_permissions_pkey; Type: CONSTRAINT; Schema: iam; Owner: -
--

ALTER TABLE ONLY iam.role_permissions
    ADD CONSTRAINT role_permissions_pkey PRIMARY KEY (instance_id, role_id, permission_id);


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: iam; Owner: -
--

ALTER TABLE ONLY iam.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);


--
-- Name: studio_job_events studio_job_events_pkey; Type: CONSTRAINT; Schema: iam; Owner: -
--

ALTER TABLE ONLY iam.studio_job_events
    ADD CONSTRAINT studio_job_events_pkey PRIMARY KEY (id);


--
-- Name: studio_jobs studio_jobs_pkey; Type: CONSTRAINT; Schema: iam; Owner: -
--

ALTER TABLE ONLY iam.studio_jobs
    ADD CONSTRAINT studio_jobs_pkey PRIMARY KEY (id);


--
-- Name: goose_db_version goose_db_version_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goose_db_version
    ADD CONSTRAINT goose_db_version_pkey PRIMARY KEY (id);


--
-- Name: waste_email_reminder_outbox waste_email_reminder_outbox_dedupe_key_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.waste_email_reminder_outbox
    ADD CONSTRAINT waste_email_reminder_outbox_dedupe_key_unique UNIQUE (dedupe_key);


--
-- Name: waste_email_reminder_outbox waste_email_reminder_outbox_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.waste_email_reminder_outbox
    ADD CONSTRAINT waste_email_reminder_outbox_pkey PRIMARY KEY (id);


--
-- Name: waste_email_reminder_subscription_items waste_email_reminder_subscription_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.waste_email_reminder_subscription_items
    ADD CONSTRAINT waste_email_reminder_subscription_items_pkey PRIMARY KEY (id);


--
-- Name: waste_email_reminder_subscription_items waste_email_reminder_subscription_items_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.waste_email_reminder_subscription_items
    ADD CONSTRAINT waste_email_reminder_subscription_items_unique UNIQUE (subscription_id, fraction_id, slot_id);


--
-- Name: waste_email_reminder_subscriptions waste_email_reminder_subscriptions_doi_token_hash_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.waste_email_reminder_subscriptions
    ADD CONSTRAINT waste_email_reminder_subscriptions_doi_token_hash_unique UNIQUE (doi_token_hash);


--
-- Name: waste_email_reminder_subscriptions waste_email_reminder_subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.waste_email_reminder_subscriptions
    ADD CONSTRAINT waste_email_reminder_subscriptions_pkey PRIMARY KEY (id);


--
-- Name: waste_email_reminder_subscriptions waste_email_reminder_subscriptions_unsubscribe_token_hash_uniqu; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.waste_email_reminder_subscriptions
    ADD CONSTRAINT waste_email_reminder_subscriptions_unsubscribe_token_hash_uniqu UNIQUE (unsubscribe_token_hash);


--
-- Name: iam_content_history_instance_content_created_idx; Type: INDEX; Schema: iam; Owner: -
--

CREATE INDEX iam_content_history_instance_content_created_idx ON iam.content_history USING btree (instance_id, content_id, created_at DESC);


--
-- Name: iam_content_list_projection_instance_org_updated_idx; Type: INDEX; Schema: iam; Owner: -
--

CREATE INDEX iam_content_list_projection_instance_org_updated_idx ON iam.content_list_projection USING btree (instance_id, organization_id, updated_at DESC);


--
-- Name: iam_content_list_projection_instance_type_updated_idx; Type: INDEX; Schema: iam; Owner: -
--

CREATE INDEX iam_content_list_projection_instance_type_updated_idx ON iam.content_list_projection USING btree (instance_id, content_type, updated_at DESC);


--
-- Name: iam_content_list_projection_instance_updated_idx; Type: INDEX; Schema: iam; Owner: -
--

CREATE INDEX iam_content_list_projection_instance_updated_idx ON iam.content_list_projection USING btree (instance_id, updated_at DESC);


--
-- Name: iam_content_list_projection_mainserver_scope_idx; Type: INDEX; Schema: iam; Owner: -
--

CREATE INDEX iam_content_list_projection_mainserver_scope_idx ON iam.content_list_projection USING btree (instance_id, source_system, content_type, projection_scope_key);


--
-- Name: iam_content_list_projection_owner_org_updated_idx; Type: INDEX; Schema: iam; Owner: -
--

CREATE INDEX iam_content_list_projection_owner_org_updated_idx ON iam.content_list_projection USING btree (instance_id, owner_organization_id, updated_at DESC);


--
-- Name: iam_content_list_projection_owner_user_updated_idx; Type: INDEX; Schema: iam; Owner: -
--

CREATE INDEX iam_content_list_projection_owner_user_updated_idx ON iam.content_list_projection USING btree (instance_id, owner_user_id, updated_at DESC);


--
-- Name: iam_contents_instance_org_updated_idx; Type: INDEX; Schema: iam; Owner: -
--

CREATE INDEX iam_contents_instance_org_updated_idx ON iam.contents USING btree (instance_id, organization_id, updated_at DESC);


--
-- Name: iam_contents_instance_updated_idx; Type: INDEX; Schema: iam; Owner: -
--

CREATE INDEX iam_contents_instance_updated_idx ON iam.contents USING btree (instance_id, updated_at DESC);


--
-- Name: idx_account_groups_account; Type: INDEX; Schema: iam; Owner: -
--

CREATE INDEX idx_account_groups_account ON iam.account_groups USING btree (instance_id, account_id);


--
-- Name: idx_account_groups_group; Type: INDEX; Schema: iam; Owner: -
--

CREATE INDEX idx_account_groups_group ON iam.account_groups USING btree (instance_id, group_id);


--
-- Name: idx_account_groups_group_account; Type: INDEX; Schema: iam; Owner: -
--

CREATE INDEX idx_account_groups_group_account ON iam.account_groups USING btree (instance_id, group_id, account_id);


--
-- Name: idx_account_profile_corrections_instance_account; Type: INDEX; Schema: iam; Owner: -
--

CREATE INDEX idx_account_profile_corrections_instance_account ON iam.account_profile_corrections USING btree (instance_id, account_id, created_at DESC);


--
-- Name: idx_accounts_delete_after; Type: INDEX; Schema: iam; Owner: -
--

CREATE INDEX idx_accounts_delete_after ON iam.accounts USING btree (delete_after) WHERE ((soft_deleted_at IS NOT NULL) AND (permanently_deleted_at IS NULL));


--
-- Name: idx_accounts_kc_subject_instance; Type: INDEX; Schema: iam; Owner: -
--

CREATE UNIQUE INDEX idx_accounts_kc_subject_instance ON iam.accounts USING btree (keycloak_subject, instance_id) WHERE (instance_id IS NOT NULL);


--
-- Name: idx_accounts_keycloak_subject; Type: INDEX; Schema: iam; Owner: -
--

CREATE INDEX idx_accounts_keycloak_subject ON iam.accounts USING btree (keycloak_subject);


--
-- Name: idx_accounts_status; Type: INDEX; Schema: iam; Owner: -
--

CREATE INDEX idx_accounts_status ON iam.accounts USING btree (status);


--
-- Name: idx_activity_logs_account_created; Type: INDEX; Schema: iam; Owner: -
--

CREATE INDEX idx_activity_logs_account_created ON iam.activity_logs USING btree (instance_id, account_id, created_at DESC);


--
-- Name: idx_activity_logs_archive_instance_created; Type: INDEX; Schema: iam; Owner: -
--

CREATE INDEX idx_activity_logs_archive_instance_created ON iam.activity_logs_archive USING btree (instance_id, original_created_at DESC);


--
-- Name: idx_activity_logs_instance_id_created_at; Type: INDEX; Schema: iam; Owner: -
--

CREATE INDEX idx_activity_logs_instance_id_created_at ON iam.activity_logs USING btree (instance_id, created_at DESC);


--
-- Name: idx_activity_logs_subject_created; Type: INDEX; Schema: iam; Owner: -
--

CREATE INDEX idx_activity_logs_subject_created ON iam.activity_logs USING btree (instance_id, subject_id, created_at DESC);


--
-- Name: idx_data_subject_export_jobs_instance_status; Type: INDEX; Schema: iam; Owner: -
--

CREATE INDEX idx_data_subject_export_jobs_instance_status ON iam.data_subject_export_jobs USING btree (instance_id, status, created_at DESC);


--
-- Name: idx_data_subject_export_jobs_studio_job_id; Type: INDEX; Schema: iam; Owner: -
--

CREATE UNIQUE INDEX idx_data_subject_export_jobs_studio_job_id ON iam.data_subject_export_jobs USING btree (studio_job_id) WHERE (studio_job_id IS NOT NULL);


--
-- Name: idx_data_subject_recipient_notifications_request; Type: INDEX; Schema: iam; Owner: -
--

CREATE INDEX idx_data_subject_recipient_notifications_request ON iam.data_subject_recipient_notifications USING btree (instance_id, request_id, created_at DESC);


--
-- Name: idx_data_subject_request_events_request; Type: INDEX; Schema: iam; Owner: -
--

CREATE INDEX idx_data_subject_request_events_request ON iam.data_subject_request_events USING btree (instance_id, request_id, created_at DESC);


--
-- Name: idx_data_subject_requests_instance_status; Type: INDEX; Schema: iam; Owner: -
--

CREATE INDEX idx_data_subject_requests_instance_status ON iam.data_subject_requests USING btree (instance_id, status, request_accepted_at DESC);


--
-- Name: idx_data_subject_requests_sla; Type: INDEX; Schema: iam; Owner: -
--

CREATE INDEX idx_data_subject_requests_sla ON iam.data_subject_requests USING btree (instance_id, sla_deadline_at) WHERE (status = ANY (ARRAY['accepted'::text, 'processing'::text]));


--
-- Name: idx_delegations_instance_delegatee_active; Type: INDEX; Schema: iam; Owner: -
--

CREATE INDEX idx_delegations_instance_delegatee_active ON iam.delegations USING btree (instance_id, delegatee_account_id, status, starts_at, ends_at);


--
-- Name: idx_geo_hierarchy_ancestor; Type: INDEX; Schema: iam; Owner: -
--

CREATE INDEX idx_geo_hierarchy_ancestor ON iam.geo_hierarchy USING btree (ancestor_id, depth);


--
-- Name: idx_geo_hierarchy_descendant; Type: INDEX; Schema: iam; Owner: -
--

CREATE INDEX idx_geo_hierarchy_descendant ON iam.geo_hierarchy USING btree (descendant_id, depth);


--
-- Name: idx_geo_nodes_instance; Type: INDEX; Schema: iam; Owner: -
--

CREATE INDEX idx_geo_nodes_instance ON iam.geo_nodes USING btree (instance_id) WHERE (deleted_at IS NULL);


--
-- Name: idx_geo_units_parent; Type: INDEX; Schema: iam; Owner: -
--

CREATE INDEX idx_geo_units_parent ON iam.geo_units USING btree (instance_id, parent_geo_unit_id);


--
-- Name: idx_geo_units_type_active; Type: INDEX; Schema: iam; Owner: -
--

CREATE INDEX idx_geo_units_type_active ON iam.geo_units USING btree (instance_id, geo_type, is_active);


--
-- Name: idx_group_roles_group; Type: INDEX; Schema: iam; Owner: -
--

CREATE INDEX idx_group_roles_group ON iam.group_roles USING btree (instance_id, group_id);


--
-- Name: idx_groups_instance_active; Type: INDEX; Schema: iam; Owner: -
--

CREATE INDEX idx_groups_instance_active ON iam.groups USING btree (instance_id, is_active);


--
-- Name: idx_idempotency_keys_expires_at; Type: INDEX; Schema: iam; Owner: -
--

CREATE INDEX idx_idempotency_keys_expires_at ON iam.idempotency_keys USING btree (expires_at);


--
-- Name: idx_impersonation_sessions_instance_actor_status; Type: INDEX; Schema: iam; Owner: -
--

CREATE INDEX idx_impersonation_sessions_instance_actor_status ON iam.impersonation_sessions USING btree (instance_id, actor_account_id, status, expires_at);


--
-- Name: idx_instance_audit_events_instance_created; Type: INDEX; Schema: iam; Owner: -
--

CREATE INDEX idx_instance_audit_events_instance_created ON iam.instance_audit_events USING btree (instance_id, created_at DESC);


--
-- Name: idx_instance_external_interfaces_default_per_type; Type: INDEX; Schema: iam; Owner: -
--

CREATE UNIQUE INDEX idx_instance_external_interfaces_default_per_type ON iam.instance_external_interfaces USING btree (instance_id, type_key) WHERE (is_default = true);


--
-- Name: idx_instance_external_interfaces_instance_type; Type: INDEX; Schema: iam; Owner: -
--

CREATE INDEX idx_instance_external_interfaces_instance_type ON iam.instance_external_interfaces USING btree (instance_id, type_key);


--
-- Name: idx_instance_integrations_instance_provider; Type: INDEX; Schema: iam; Owner: -
--

CREATE INDEX idx_instance_integrations_instance_provider ON iam.instance_integrations USING btree (instance_id, provider_key);


--
-- Name: idx_instance_keycloak_provisioning_runs_idempotency; Type: INDEX; Schema: iam; Owner: -
--

CREATE UNIQUE INDEX idx_instance_keycloak_provisioning_runs_idempotency ON iam.instance_keycloak_provisioning_runs USING btree (instance_id, mutation, idempotency_key) WHERE (idempotency_key IS NOT NULL);


--
-- Name: idx_instance_keycloak_provisioning_runs_idempotency_lookup; Type: INDEX; Schema: iam; Owner: -
--

CREATE INDEX idx_instance_keycloak_provisioning_runs_idempotency_lookup ON iam.instance_keycloak_provisioning_runs USING btree (instance_id, mutation, idempotency_key, payload_fingerprint) WHERE (idempotency_key IS NOT NULL);


--
-- Name: idx_instance_keycloak_provisioning_runs_instance_created; Type: INDEX; Schema: iam; Owner: -
--

CREATE INDEX idx_instance_keycloak_provisioning_runs_instance_created ON iam.instance_keycloak_provisioning_runs USING btree (instance_id, created_at DESC);


--
-- Name: idx_instance_keycloak_provisioning_steps_run_created; Type: INDEX; Schema: iam; Owner: -
--

CREATE INDEX idx_instance_keycloak_provisioning_steps_run_created ON iam.instance_keycloak_provisioning_steps USING btree (run_id, created_at);


--
-- Name: idx_instance_modules_instance_created; Type: INDEX; Schema: iam; Owner: -
--

CREATE INDEX idx_instance_modules_instance_created ON iam.instance_modules USING btree (instance_id, created_at DESC);


--
-- Name: idx_instance_provisioning_runs_instance_created; Type: INDEX; Schema: iam; Owner: -
--

CREATE INDEX idx_instance_provisioning_runs_instance_created ON iam.instance_provisioning_runs USING btree (instance_id, created_at DESC);


--
-- Name: idx_legal_holds_instance_account_active; Type: INDEX; Schema: iam; Owner: -
--

CREATE INDEX idx_legal_holds_instance_account_active ON iam.legal_holds USING btree (instance_id, account_id, active);


--
-- Name: idx_legal_text_acceptances_instance_account; Type: INDEX; Schema: iam; Owner: -
--

CREATE INDEX idx_legal_text_acceptances_instance_account ON iam.legal_text_acceptances USING btree (instance_id, account_id, accepted_at DESC);


--
-- Name: idx_legal_text_acceptances_subject; Type: INDEX; Schema: iam; Owner: -
--

CREATE INDEX idx_legal_text_acceptances_subject ON iam.legal_text_acceptances USING btree (subject_id) WHERE (subject_id IS NOT NULL);


--
-- Name: idx_legal_text_acceptances_workspace_action; Type: INDEX; Schema: iam; Owner: -
--

CREATE INDEX idx_legal_text_acceptances_workspace_action ON iam.legal_text_acceptances USING btree (workspace_id, action_type) WHERE (workspace_id IS NOT NULL);


--
-- Name: idx_media_assets_instance_storage_key; Type: INDEX; Schema: iam; Owner: -
--

CREATE UNIQUE INDEX idx_media_assets_instance_storage_key ON iam.media_assets USING btree (instance_id, storage_key);


--
-- Name: idx_media_assets_instance_updated_at; Type: INDEX; Schema: iam; Owner: -
--

CREATE INDEX idx_media_assets_instance_updated_at ON iam.media_assets USING btree (instance_id, updated_at DESC);


--
-- Name: idx_media_assets_instance_visibility_updated_at; Type: INDEX; Schema: iam; Owner: -
--

CREATE INDEX idx_media_assets_instance_visibility_updated_at ON iam.media_assets USING btree (instance_id, visibility, updated_at DESC);


--
-- Name: idx_media_references_asset_id; Type: INDEX; Schema: iam; Owner: -
--

CREATE INDEX idx_media_references_asset_id ON iam.media_references USING btree (instance_id, asset_id, created_at DESC);


--
-- Name: idx_media_references_target; Type: INDEX; Schema: iam; Owner: -
--

CREATE INDEX idx_media_references_target ON iam.media_references USING btree (instance_id, target_type, target_id, created_at DESC);


--
-- Name: idx_media_upload_sessions_instance_asset; Type: INDEX; Schema: iam; Owner: -
--

CREATE INDEX idx_media_upload_sessions_instance_asset ON iam.media_upload_sessions USING btree (instance_id, asset_id, created_at DESC);


--
-- Name: idx_media_upload_sessions_instance_storage_key; Type: INDEX; Schema: iam; Owner: -
--

CREATE UNIQUE INDEX idx_media_upload_sessions_instance_storage_key ON iam.media_upload_sessions USING btree (instance_id, storage_key);


--
-- Name: idx_media_variants_asset_variant_key; Type: INDEX; Schema: iam; Owner: -
--

CREATE UNIQUE INDEX idx_media_variants_asset_variant_key ON iam.media_variants USING btree (asset_id, variant_key);


--
-- Name: idx_media_variants_instance_asset; Type: INDEX; Schema: iam; Owner: -
--

CREATE INDEX idx_media_variants_instance_asset ON iam.media_variants USING btree (instance_id, asset_id, created_at);


--
-- Name: idx_media_variants_instance_storage_key; Type: INDEX; Schema: iam; Owner: -
--

CREATE UNIQUE INDEX idx_media_variants_instance_storage_key ON iam.media_variants USING btree (instance_id, storage_key);


--
-- Name: idx_organizations_instance_id; Type: INDEX; Schema: iam; Owner: -
--

CREATE INDEX idx_organizations_instance_id ON iam.organizations USING btree (instance_id);


--
-- Name: idx_permission_change_requests_instance_status; Type: INDEX; Schema: iam; Owner: -
--

CREATE INDEX idx_permission_change_requests_instance_status ON iam.permission_change_requests USING btree (instance_id, status, requested_at DESC);


--
-- Name: idx_permissions_instance_id; Type: INDEX; Schema: iam; Owner: -
--

CREATE INDEX idx_permissions_instance_id ON iam.permissions USING btree (instance_id);


--
-- Name: idx_platform_activity_logs_created_at; Type: INDEX; Schema: iam; Owner: -
--

CREATE INDEX idx_platform_activity_logs_created_at ON iam.platform_activity_logs USING btree (created_at DESC);


--
-- Name: idx_platform_activity_logs_event_type_created_at; Type: INDEX; Schema: iam; Owner: -
--

CREATE INDEX idx_platform_activity_logs_event_type_created_at ON iam.platform_activity_logs USING btree (event_type, created_at DESC);


--
-- Name: idx_platform_activity_logs_request_id; Type: INDEX; Schema: iam; Owner: -
--

CREATE INDEX idx_platform_activity_logs_request_id ON iam.platform_activity_logs USING btree (request_id) WHERE (request_id IS NOT NULL);


--
-- Name: idx_role_permissions_origin_module; Type: INDEX; Schema: iam; Owner: -
--

CREATE INDEX idx_role_permissions_origin_module ON iam.role_permissions USING btree (instance_id, grant_origin_kind, grant_origin_module_id);


--
-- Name: idx_roles_instance_id; Type: INDEX; Schema: iam; Owner: -
--

CREATE INDEX idx_roles_instance_id ON iam.roles USING btree (instance_id);


--
-- Name: idx_roles_instance_sync_state; Type: INDEX; Schema: iam; Owner: -
--

CREATE INDEX idx_roles_instance_sync_state ON iam.roles USING btree (instance_id, sync_state, updated_at DESC);


--
-- Name: idx_roles_managed_scope; Type: INDEX; Schema: iam; Owner: -
--

CREATE INDEX idx_roles_managed_scope ON iam.roles USING btree (instance_id, managed_by, external_role_name);


--
-- Name: idx_studio_job_events_job_created_at; Type: INDEX; Schema: iam; Owner: -
--

CREATE INDEX idx_studio_job_events_job_created_at ON iam.studio_job_events USING btree (instance_id, job_id, created_at);


--
-- Name: idx_studio_jobs_id_instance; Type: INDEX; Schema: iam; Owner: -
--

CREATE UNIQUE INDEX idx_studio_jobs_id_instance ON iam.studio_jobs USING btree (id, instance_id);


--
-- Name: idx_studio_jobs_instance_created_at; Type: INDEX; Schema: iam; Owner: -
--

CREATE INDEX idx_studio_jobs_instance_created_at ON iam.studio_jobs USING btree (instance_id, created_at DESC);


--
-- Name: idx_studio_jobs_instance_heartbeat_at; Type: INDEX; Schema: iam; Owner: -
--

CREATE INDEX idx_studio_jobs_instance_heartbeat_at ON iam.studio_jobs USING btree (instance_id, heartbeat_at DESC);


--
-- Name: idx_studio_jobs_instance_idempotency_key; Type: INDEX; Schema: iam; Owner: -
--

CREATE UNIQUE INDEX idx_studio_jobs_instance_idempotency_key ON iam.studio_jobs USING btree (instance_id, idempotency_key);


--
-- Name: idx_studio_jobs_instance_status_updated_at; Type: INDEX; Schema: iam; Owner: -
--

CREATE INDEX idx_studio_jobs_instance_status_updated_at ON iam.studio_jobs USING btree (instance_id, status, updated_at DESC);


--
-- Name: idx_studio_jobs_parent_job_id; Type: INDEX; Schema: iam; Owner: -
--

CREATE INDEX idx_studio_jobs_parent_job_id ON iam.studio_jobs USING btree (parent_job_id);


--
-- Name: uq_geo_units_instance_id_id; Type: INDEX; Schema: iam; Owner: -
--

CREATE UNIQUE INDEX uq_geo_units_instance_id_id ON iam.geo_units USING btree (instance_id, id);


--
-- Name: uq_groups_instance_id_id; Type: INDEX; Schema: iam; Owner: -
--

CREATE UNIQUE INDEX uq_groups_instance_id_id ON iam.groups USING btree (instance_id, id);


--
-- Name: uq_idempotency_keys_scope; Type: INDEX; Schema: iam; Owner: -
--

CREATE UNIQUE INDEX uq_idempotency_keys_scope ON iam.idempotency_keys USING btree (actor_account_id, endpoint, idempotency_key);


--
-- Name: uq_instance_hostnames_primary_per_instance; Type: INDEX; Schema: iam; Owner: -
--

CREATE UNIQUE INDEX uq_instance_hostnames_primary_per_instance ON iam.instance_hostnames USING btree (instance_id) WHERE (is_primary = true);


--
-- Name: uq_instance_provisioning_runs_idempotency; Type: INDEX; Schema: iam; Owner: -
--

CREATE UNIQUE INDEX uq_instance_provisioning_runs_idempotency ON iam.instance_provisioning_runs USING btree (instance_id, operation, idempotency_key);


--
-- Name: uq_instances_primary_hostname; Type: INDEX; Schema: iam; Owner: -
--

CREATE UNIQUE INDEX uq_instances_primary_hostname ON iam.instances USING btree (primary_hostname);


--
-- Name: uq_legal_text_versions_instance_id_id; Type: INDEX; Schema: iam; Owner: -
--

CREATE UNIQUE INDEX uq_legal_text_versions_instance_id_id ON iam.legal_text_versions USING btree (instance_id, id);


--
-- Name: uq_organizations_instance_id_id; Type: INDEX; Schema: iam; Owner: -
--

CREATE UNIQUE INDEX uq_organizations_instance_id_id ON iam.organizations USING btree (instance_id, id);


--
-- Name: uq_permissions_instance_id_id; Type: INDEX; Schema: iam; Owner: -
--

CREATE UNIQUE INDEX uq_permissions_instance_id_id ON iam.permissions USING btree (instance_id, id);


--
-- Name: uq_roles_instance_external_role_name; Type: INDEX; Schema: iam; Owner: -
--

CREATE UNIQUE INDEX uq_roles_instance_external_role_name ON iam.roles USING btree (instance_id, external_role_name);


--
-- Name: uq_roles_instance_id_id; Type: INDEX; Schema: iam; Owner: -
--

CREATE UNIQUE INDEX uq_roles_instance_id_id ON iam.roles USING btree (instance_id, id);


--
-- Name: uq_roles_instance_role_key; Type: INDEX; Schema: iam; Owner: -
--

CREATE UNIQUE INDEX uq_roles_instance_role_key ON iam.roles USING btree (instance_id, role_key);


--
-- Name: idx_waste_email_reminder_outbox_status_send_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_waste_email_reminder_outbox_status_send_at ON public.waste_email_reminder_outbox USING btree (status, send_at);


--
-- Name: idx_waste_email_reminder_outbox_subscription_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_waste_email_reminder_outbox_subscription_id ON public.waste_email_reminder_outbox USING btree (subscription_id);


--
-- Name: idx_waste_email_reminder_subscription_items_subscription_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_waste_email_reminder_subscription_items_subscription_id ON public.waste_email_reminder_subscription_items USING btree (subscription_id);


--
-- Name: idx_waste_email_reminder_subscriptions_email_location_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_waste_email_reminder_subscriptions_email_location_status ON public.waste_email_reminder_subscriptions USING btree (email_hash, city_id, street_id, house_number_id, status);


--
-- Name: idx_waste_email_reminder_subscriptions_status_expires_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_waste_email_reminder_subscriptions_status_expires_at ON public.waste_email_reminder_subscriptions USING btree (status, expires_at);


--
-- Name: geo_hierarchy geo_hierarchy_depth_check; Type: TRIGGER; Schema: iam; Owner: -
--

CREATE TRIGGER geo_hierarchy_depth_check BEFORE INSERT ON iam.geo_hierarchy FOR EACH ROW EXECUTE FUNCTION iam.check_geo_hierarchy_depth();


--
-- Name: contents sync_content_list_projection_from_contents_trg; Type: TRIGGER; Schema: iam; Owner: -
--

CREATE TRIGGER sync_content_list_projection_from_contents_trg AFTER INSERT OR DELETE OR UPDATE ON iam.contents FOR EACH ROW EXECUTE FUNCTION iam.sync_content_list_projection_from_contents();


--
-- Name: activity_logs trg_immutable_activity_logs; Type: TRIGGER; Schema: iam; Owner: -
--

CREATE TRIGGER trg_immutable_activity_logs BEFORE DELETE OR UPDATE ON iam.activity_logs FOR EACH ROW EXECUTE FUNCTION iam.prevent_activity_logs_mutation();


--
-- Name: platform_activity_logs trg_immutable_platform_activity_logs; Type: TRIGGER; Schema: iam; Owner: -
--

CREATE TRIGGER trg_immutable_platform_activity_logs BEFORE DELETE OR UPDATE ON iam.platform_activity_logs FOR EACH ROW EXECUTE FUNCTION iam.prevent_platform_activity_logs_mutation();


--
-- Name: account_deletion_content_preferences account_deletion_content_preferences_instance_id_fkey; Type: FK CONSTRAINT; Schema: iam; Owner: -
--

ALTER TABLE ONLY iam.account_deletion_content_preferences
    ADD CONSTRAINT account_deletion_content_preferences_instance_id_fkey FOREIGN KEY (instance_id) REFERENCES iam.instances(id) ON DELETE CASCADE;


--
-- Name: account_deletion_content_preferences account_deletion_content_preferences_membership_fk; Type: FK CONSTRAINT; Schema: iam; Owner: -
--

ALTER TABLE ONLY iam.account_deletion_content_preferences
    ADD CONSTRAINT account_deletion_content_preferences_membership_fk FOREIGN KEY (instance_id, account_id) REFERENCES iam.instance_memberships(instance_id, account_id) ON DELETE CASCADE;


--
-- Name: account_groups account_groups_group_fk; Type: FK CONSTRAINT; Schema: iam; Owner: -
--

ALTER TABLE ONLY iam.account_groups
    ADD CONSTRAINT account_groups_group_fk FOREIGN KEY (instance_id, group_id) REFERENCES iam.groups(instance_id, id) ON DELETE CASCADE;


--
-- Name: account_groups account_groups_membership_fk; Type: FK CONSTRAINT; Schema: iam; Owner: -
--

ALTER TABLE ONLY iam.account_groups
    ADD CONSTRAINT account_groups_membership_fk FOREIGN KEY (instance_id, account_id) REFERENCES iam.instance_memberships(instance_id, account_id) ON DELETE CASCADE;


--
-- Name: account_organizations account_org_membership_fk; Type: FK CONSTRAINT; Schema: iam; Owner: -
--

ALTER TABLE ONLY iam.account_organizations
    ADD CONSTRAINT account_org_membership_fk FOREIGN KEY (instance_id, account_id) REFERENCES iam.instance_memberships(instance_id, account_id) ON DELETE CASCADE;


--
-- Name: account_organizations account_org_organization_fk; Type: FK CONSTRAINT; Schema: iam; Owner: -
--

ALTER TABLE ONLY iam.account_organizations
    ADD CONSTRAINT account_org_organization_fk FOREIGN KEY (instance_id, organization_id) REFERENCES iam.organizations(instance_id, id) ON DELETE CASCADE;


--
-- Name: account_profile_corrections account_profile_corrections_account_membership_fk; Type: FK CONSTRAINT; Schema: iam; Owner: -
--

ALTER TABLE ONLY iam.account_profile_corrections
    ADD CONSTRAINT account_profile_corrections_account_membership_fk FOREIGN KEY (instance_id, account_id) REFERENCES iam.instance_memberships(instance_id, account_id) ON DELETE RESTRICT;


--
-- Name: account_profile_corrections account_profile_corrections_actor_membership_fk; Type: FK CONSTRAINT; Schema: iam; Owner: -
--

ALTER TABLE ONLY iam.account_profile_corrections
    ADD CONSTRAINT account_profile_corrections_actor_membership_fk FOREIGN KEY (instance_id, actor_account_id) REFERENCES iam.instance_memberships(instance_id, account_id) ON DELETE SET NULL;


--
-- Name: account_profile_corrections account_profile_corrections_instance_id_fkey; Type: FK CONSTRAINT; Schema: iam; Owner: -
--

ALTER TABLE ONLY iam.account_profile_corrections
    ADD CONSTRAINT account_profile_corrections_instance_id_fkey FOREIGN KEY (instance_id) REFERENCES iam.instances(id) ON DELETE CASCADE;


--
-- Name: account_roles account_roles_assigned_by_fkey; Type: FK CONSTRAINT; Schema: iam; Owner: -
--

ALTER TABLE ONLY iam.account_roles
    ADD CONSTRAINT account_roles_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES iam.accounts(id) ON DELETE SET NULL;


--
-- Name: account_roles account_roles_membership_fk; Type: FK CONSTRAINT; Schema: iam; Owner: -
--

ALTER TABLE ONLY iam.account_roles
    ADD CONSTRAINT account_roles_membership_fk FOREIGN KEY (instance_id, account_id) REFERENCES iam.instance_memberships(instance_id, account_id) ON DELETE CASCADE;


--
-- Name: account_roles account_roles_role_fk; Type: FK CONSTRAINT; Schema: iam; Owner: -
--

ALTER TABLE ONLY iam.account_roles
    ADD CONSTRAINT account_roles_role_fk FOREIGN KEY (instance_id, role_id) REFERENCES iam.roles(instance_id, id) ON DELETE CASCADE;


--
-- Name: accounts accounts_instance_id_fkey; Type: FK CONSTRAINT; Schema: iam; Owner: -
--

ALTER TABLE ONLY iam.accounts
    ADD CONSTRAINT accounts_instance_id_fkey FOREIGN KEY (instance_id) REFERENCES iam.instances(id) ON DELETE CASCADE;


--
-- Name: activity_logs_archive activity_logs_archive_instance_id_fkey; Type: FK CONSTRAINT; Schema: iam; Owner: -
--

ALTER TABLE ONLY iam.activity_logs_archive
    ADD CONSTRAINT activity_logs_archive_instance_id_fkey FOREIGN KEY (instance_id) REFERENCES iam.instances(id) ON DELETE CASCADE;


--
-- Name: activity_logs activity_logs_instance_id_fkey; Type: FK CONSTRAINT; Schema: iam; Owner: -
--

ALTER TABLE ONLY iam.activity_logs
    ADD CONSTRAINT activity_logs_instance_id_fkey FOREIGN KEY (instance_id) REFERENCES iam.instances(id) ON DELETE CASCADE;


--
-- Name: content_history content_history_actor_account_id_fkey; Type: FK CONSTRAINT; Schema: iam; Owner: -
--

ALTER TABLE ONLY iam.content_history
    ADD CONSTRAINT content_history_actor_account_id_fkey FOREIGN KEY (actor_account_id) REFERENCES iam.accounts(id) ON DELETE SET NULL;


--
-- Name: content_history content_history_content_id_fkey; Type: FK CONSTRAINT; Schema: iam; Owner: -
--

ALTER TABLE ONLY iam.content_history
    ADD CONSTRAINT content_history_content_id_fkey FOREIGN KEY (content_id) REFERENCES iam.contents(id) ON DELETE CASCADE;


--
-- Name: contents contents_author_account_id_fkey; Type: FK CONSTRAINT; Schema: iam; Owner: -
--

ALTER TABLE ONLY iam.contents
    ADD CONSTRAINT contents_author_account_id_fkey FOREIGN KEY (author_account_id) REFERENCES iam.accounts(id) ON DELETE SET NULL;


--
-- Name: contents contents_creator_account_id_fkey; Type: FK CONSTRAINT; Schema: iam; Owner: -
--

ALTER TABLE ONLY iam.contents
    ADD CONSTRAINT contents_creator_account_id_fkey FOREIGN KEY (creator_account_id) REFERENCES iam.accounts(id) ON DELETE SET NULL;


--
-- Name: contents contents_updater_account_id_fkey; Type: FK CONSTRAINT; Schema: iam; Owner: -
--

ALTER TABLE ONLY iam.contents
    ADD CONSTRAINT contents_updater_account_id_fkey FOREIGN KEY (updater_account_id) REFERENCES iam.accounts(id) ON DELETE SET NULL;


--
-- Name: data_subject_export_jobs data_subject_export_jobs_instance_id_fkey; Type: FK CONSTRAINT; Schema: iam; Owner: -
--

ALTER TABLE ONLY iam.data_subject_export_jobs
    ADD CONSTRAINT data_subject_export_jobs_instance_id_fkey FOREIGN KEY (instance_id) REFERENCES iam.instances(id) ON DELETE CASCADE;


--
-- Name: data_subject_export_jobs data_subject_export_jobs_requester_membership_fk; Type: FK CONSTRAINT; Schema: iam; Owner: -
--

ALTER TABLE ONLY iam.data_subject_export_jobs
    ADD CONSTRAINT data_subject_export_jobs_requester_membership_fk FOREIGN KEY (instance_id, requested_by_account_id) REFERENCES iam.instance_memberships(instance_id, account_id) ON DELETE SET NULL;


--
-- Name: data_subject_export_jobs data_subject_export_jobs_studio_job_fk; Type: FK CONSTRAINT; Schema: iam; Owner: -
--

ALTER TABLE ONLY iam.data_subject_export_jobs
    ADD CONSTRAINT data_subject_export_jobs_studio_job_fk FOREIGN KEY (studio_job_id) REFERENCES iam.studio_jobs(id) ON DELETE SET NULL;


--
-- Name: data_subject_export_jobs data_subject_export_jobs_target_membership_fk; Type: FK CONSTRAINT; Schema: iam; Owner: -
--

ALTER TABLE ONLY iam.data_subject_export_jobs
    ADD CONSTRAINT data_subject_export_jobs_target_membership_fk FOREIGN KEY (instance_id, target_account_id) REFERENCES iam.instance_memberships(instance_id, account_id) ON DELETE RESTRICT;


--
-- Name: data_subject_recipient_notifications data_subject_recipient_notifications_instance_id_fkey; Type: FK CONSTRAINT; Schema: iam; Owner: -
--

ALTER TABLE ONLY iam.data_subject_recipient_notifications
    ADD CONSTRAINT data_subject_recipient_notifications_instance_id_fkey FOREIGN KEY (instance_id) REFERENCES iam.instances(id) ON DELETE CASCADE;


--
-- Name: data_subject_recipient_notifications data_subject_recipient_notifications_request_id_fkey; Type: FK CONSTRAINT; Schema: iam; Owner: -
--

ALTER TABLE ONLY iam.data_subject_recipient_notifications
    ADD CONSTRAINT data_subject_recipient_notifications_request_id_fkey FOREIGN KEY (request_id) REFERENCES iam.data_subject_requests(id) ON DELETE CASCADE;


--
-- Name: data_subject_request_events data_subject_request_events_actor_membership_fk; Type: FK CONSTRAINT; Schema: iam; Owner: -
--

ALTER TABLE ONLY iam.data_subject_request_events
    ADD CONSTRAINT data_subject_request_events_actor_membership_fk FOREIGN KEY (instance_id, actor_account_id) REFERENCES iam.instance_memberships(instance_id, account_id) ON DELETE SET NULL;


--
-- Name: data_subject_request_events data_subject_request_events_instance_id_fkey; Type: FK CONSTRAINT; Schema: iam; Owner: -
--

ALTER TABLE ONLY iam.data_subject_request_events
    ADD CONSTRAINT data_subject_request_events_instance_id_fkey FOREIGN KEY (instance_id) REFERENCES iam.instances(id) ON DELETE CASCADE;


--
-- Name: data_subject_request_events data_subject_request_events_request_id_fkey; Type: FK CONSTRAINT; Schema: iam; Owner: -
--

ALTER TABLE ONLY iam.data_subject_request_events
    ADD CONSTRAINT data_subject_request_events_request_id_fkey FOREIGN KEY (request_id) REFERENCES iam.data_subject_requests(id) ON DELETE CASCADE;


--
-- Name: data_subject_requests data_subject_requests_instance_id_fkey; Type: FK CONSTRAINT; Schema: iam; Owner: -
--

ALTER TABLE ONLY iam.data_subject_requests
    ADD CONSTRAINT data_subject_requests_instance_id_fkey FOREIGN KEY (instance_id) REFERENCES iam.instances(id) ON DELETE CASCADE;


--
-- Name: data_subject_requests data_subject_requests_requester_membership_fk; Type: FK CONSTRAINT; Schema: iam; Owner: -
--

ALTER TABLE ONLY iam.data_subject_requests
    ADD CONSTRAINT data_subject_requests_requester_membership_fk FOREIGN KEY (instance_id, requester_account_id) REFERENCES iam.instance_memberships(instance_id, account_id) ON DELETE SET NULL;


--
-- Name: data_subject_requests data_subject_requests_target_membership_fk; Type: FK CONSTRAINT; Schema: iam; Owner: -
--

ALTER TABLE ONLY iam.data_subject_requests
    ADD CONSTRAINT data_subject_requests_target_membership_fk FOREIGN KEY (instance_id, target_account_id) REFERENCES iam.instance_memberships(instance_id, account_id) ON DELETE RESTRICT;


--
-- Name: delegations delegations_approver_fk; Type: FK CONSTRAINT; Schema: iam; Owner: -
--

ALTER TABLE ONLY iam.delegations
    ADD CONSTRAINT delegations_approver_fk FOREIGN KEY (approver_account_id) REFERENCES iam.accounts(id) ON DELETE SET NULL;


--
-- Name: delegations delegations_instance_id_fkey; Type: FK CONSTRAINT; Schema: iam; Owner: -
--

ALTER TABLE ONLY iam.delegations
    ADD CONSTRAINT delegations_instance_id_fkey FOREIGN KEY (instance_id) REFERENCES iam.instances(id) ON DELETE CASCADE;


--
-- Name: delegations delegations_membership_delegatee_fk; Type: FK CONSTRAINT; Schema: iam; Owner: -
--

ALTER TABLE ONLY iam.delegations
    ADD CONSTRAINT delegations_membership_delegatee_fk FOREIGN KEY (instance_id, delegatee_account_id) REFERENCES iam.instance_memberships(instance_id, account_id) ON DELETE RESTRICT;


--
-- Name: delegations delegations_membership_delegator_fk; Type: FK CONSTRAINT; Schema: iam; Owner: -
--

ALTER TABLE ONLY iam.delegations
    ADD CONSTRAINT delegations_membership_delegator_fk FOREIGN KEY (instance_id, delegator_account_id) REFERENCES iam.instance_memberships(instance_id, account_id) ON DELETE RESTRICT;


--
-- Name: delegations delegations_role_fk; Type: FK CONSTRAINT; Schema: iam; Owner: -
--

ALTER TABLE ONLY iam.delegations
    ADD CONSTRAINT delegations_role_fk FOREIGN KEY (instance_id, role_id) REFERENCES iam.roles(instance_id, id) ON DELETE RESTRICT;


--
-- Name: geo_hierarchy geo_hierarchy_ancestor_id_fkey; Type: FK CONSTRAINT; Schema: iam; Owner: -
--

ALTER TABLE ONLY iam.geo_hierarchy
    ADD CONSTRAINT geo_hierarchy_ancestor_id_fkey FOREIGN KEY (ancestor_id) REFERENCES iam.geo_nodes(id) ON DELETE CASCADE;


--
-- Name: geo_hierarchy geo_hierarchy_descendant_id_fkey; Type: FK CONSTRAINT; Schema: iam; Owner: -
--

ALTER TABLE ONLY iam.geo_hierarchy
    ADD CONSTRAINT geo_hierarchy_descendant_id_fkey FOREIGN KEY (descendant_id) REFERENCES iam.geo_nodes(id) ON DELETE CASCADE;


--
-- Name: geo_nodes geo_nodes_instance_id_fkey; Type: FK CONSTRAINT; Schema: iam; Owner: -
--

ALTER TABLE ONLY iam.geo_nodes
    ADD CONSTRAINT geo_nodes_instance_id_fkey FOREIGN KEY (instance_id) REFERENCES iam.instances(id) ON DELETE CASCADE;


--
-- Name: geo_units geo_units_instance_id_fkey; Type: FK CONSTRAINT; Schema: iam; Owner: -
--

ALTER TABLE ONLY iam.geo_units
    ADD CONSTRAINT geo_units_instance_id_fkey FOREIGN KEY (instance_id) REFERENCES iam.instances(id) ON DELETE CASCADE;


--
-- Name: geo_units geo_units_parent_fk; Type: FK CONSTRAINT; Schema: iam; Owner: -
--

ALTER TABLE ONLY iam.geo_units
    ADD CONSTRAINT geo_units_parent_fk FOREIGN KEY (instance_id, parent_geo_unit_id) REFERENCES iam.geo_units(instance_id, id) ON DELETE RESTRICT;


--
-- Name: group_roles group_roles_group_fk; Type: FK CONSTRAINT; Schema: iam; Owner: -
--

ALTER TABLE ONLY iam.group_roles
    ADD CONSTRAINT group_roles_group_fk FOREIGN KEY (instance_id, group_id) REFERENCES iam.groups(instance_id, id) ON DELETE CASCADE;


--
-- Name: group_roles group_roles_role_fk; Type: FK CONSTRAINT; Schema: iam; Owner: -
--

ALTER TABLE ONLY iam.group_roles
    ADD CONSTRAINT group_roles_role_fk FOREIGN KEY (instance_id, role_id) REFERENCES iam.roles(instance_id, id) ON DELETE CASCADE;


--
-- Name: groups groups_instance_id_fkey; Type: FK CONSTRAINT; Schema: iam; Owner: -
--

ALTER TABLE ONLY iam.groups
    ADD CONSTRAINT groups_instance_id_fkey FOREIGN KEY (instance_id) REFERENCES iam.instances(id) ON DELETE CASCADE;


--
-- Name: idempotency_keys idempotency_keys_actor_membership_fk; Type: FK CONSTRAINT; Schema: iam; Owner: -
--

ALTER TABLE ONLY iam.idempotency_keys
    ADD CONSTRAINT idempotency_keys_actor_membership_fk FOREIGN KEY (instance_id, actor_account_id) REFERENCES iam.instance_memberships(instance_id, account_id) ON DELETE CASCADE;


--
-- Name: idempotency_keys idempotency_keys_instance_id_fkey; Type: FK CONSTRAINT; Schema: iam; Owner: -
--

ALTER TABLE ONLY iam.idempotency_keys
    ADD CONSTRAINT idempotency_keys_instance_id_fkey FOREIGN KEY (instance_id) REFERENCES iam.instances(id) ON DELETE CASCADE;


--
-- Name: impersonation_sessions impersonation_sessions_approved_by_fk; Type: FK CONSTRAINT; Schema: iam; Owner: -
--

ALTER TABLE ONLY iam.impersonation_sessions
    ADD CONSTRAINT impersonation_sessions_approved_by_fk FOREIGN KEY (approved_by_account_id) REFERENCES iam.accounts(id) ON DELETE SET NULL;


--
-- Name: impersonation_sessions impersonation_sessions_instance_id_fkey; Type: FK CONSTRAINT; Schema: iam; Owner: -
--

ALTER TABLE ONLY iam.impersonation_sessions
    ADD CONSTRAINT impersonation_sessions_instance_id_fkey FOREIGN KEY (instance_id) REFERENCES iam.instances(id) ON DELETE CASCADE;


--
-- Name: impersonation_sessions impersonation_sessions_membership_actor_fk; Type: FK CONSTRAINT; Schema: iam; Owner: -
--

ALTER TABLE ONLY iam.impersonation_sessions
    ADD CONSTRAINT impersonation_sessions_membership_actor_fk FOREIGN KEY (instance_id, actor_account_id) REFERENCES iam.instance_memberships(instance_id, account_id) ON DELETE RESTRICT;


--
-- Name: impersonation_sessions impersonation_sessions_membership_target_fk; Type: FK CONSTRAINT; Schema: iam; Owner: -
--

ALTER TABLE ONLY iam.impersonation_sessions
    ADD CONSTRAINT impersonation_sessions_membership_target_fk FOREIGN KEY (instance_id, target_account_id) REFERENCES iam.instance_memberships(instance_id, account_id) ON DELETE RESTRICT;


--
-- Name: impersonation_sessions impersonation_sessions_security_approver_fk; Type: FK CONSTRAINT; Schema: iam; Owner: -
--

ALTER TABLE ONLY iam.impersonation_sessions
    ADD CONSTRAINT impersonation_sessions_security_approver_fk FOREIGN KEY (security_approver_account_id) REFERENCES iam.accounts(id) ON DELETE SET NULL;


--
-- Name: instance_audit_events instance_audit_events_instance_id_fkey; Type: FK CONSTRAINT; Schema: iam; Owner: -
--

ALTER TABLE ONLY iam.instance_audit_events
    ADD CONSTRAINT instance_audit_events_instance_id_fkey FOREIGN KEY (instance_id) REFERENCES iam.instances(id) ON DELETE CASCADE;


--
-- Name: instance_deletion_rules instance_deletion_rules_instance_id_fkey; Type: FK CONSTRAINT; Schema: iam; Owner: -
--

ALTER TABLE ONLY iam.instance_deletion_rules
    ADD CONSTRAINT instance_deletion_rules_instance_id_fkey FOREIGN KEY (instance_id) REFERENCES iam.instances(id) ON DELETE CASCADE;


--
-- Name: instance_external_interfaces instance_external_interfaces_instance_id_fkey; Type: FK CONSTRAINT; Schema: iam; Owner: -
--

ALTER TABLE ONLY iam.instance_external_interfaces
    ADD CONSTRAINT instance_external_interfaces_instance_id_fkey FOREIGN KEY (instance_id) REFERENCES iam.instances(id) ON DELETE CASCADE;


--
-- Name: instance_external_interfaces instance_external_interfaces_type_key_fkey; Type: FK CONSTRAINT; Schema: iam; Owner: -
--

ALTER TABLE ONLY iam.instance_external_interfaces
    ADD CONSTRAINT instance_external_interfaces_type_key_fkey FOREIGN KEY (type_key) REFERENCES iam.external_interface_types(type_key);


--
-- Name: instance_hostnames instance_hostnames_instance_id_fkey; Type: FK CONSTRAINT; Schema: iam; Owner: -
--

ALTER TABLE ONLY iam.instance_hostnames
    ADD CONSTRAINT instance_hostnames_instance_id_fkey FOREIGN KEY (instance_id) REFERENCES iam.instances(id) ON DELETE CASCADE;


--
-- Name: instance_integrations instance_integrations_instance_id_fkey; Type: FK CONSTRAINT; Schema: iam; Owner: -
--

ALTER TABLE ONLY iam.instance_integrations
    ADD CONSTRAINT instance_integrations_instance_id_fkey FOREIGN KEY (instance_id) REFERENCES iam.instances(id) ON DELETE CASCADE;


--
-- Name: instance_keycloak_provisioning_runs instance_keycloak_provisioning_runs_instance_id_fkey; Type: FK CONSTRAINT; Schema: iam; Owner: -
--

ALTER TABLE ONLY iam.instance_keycloak_provisioning_runs
    ADD CONSTRAINT instance_keycloak_provisioning_runs_instance_id_fkey FOREIGN KEY (instance_id) REFERENCES iam.instances(id) ON DELETE CASCADE;


--
-- Name: instance_keycloak_provisioning_steps instance_keycloak_provisioning_steps_run_id_fkey; Type: FK CONSTRAINT; Schema: iam; Owner: -
--

ALTER TABLE ONLY iam.instance_keycloak_provisioning_steps
    ADD CONSTRAINT instance_keycloak_provisioning_steps_run_id_fkey FOREIGN KEY (run_id) REFERENCES iam.instance_keycloak_provisioning_runs(id) ON DELETE CASCADE;


--
-- Name: instance_memberships instance_memberships_account_id_fkey; Type: FK CONSTRAINT; Schema: iam; Owner: -
--

ALTER TABLE ONLY iam.instance_memberships
    ADD CONSTRAINT instance_memberships_account_id_fkey FOREIGN KEY (account_id) REFERENCES iam.accounts(id) ON DELETE CASCADE;


--
-- Name: instance_memberships instance_memberships_instance_id_fkey; Type: FK CONSTRAINT; Schema: iam; Owner: -
--

ALTER TABLE ONLY iam.instance_memberships
    ADD CONSTRAINT instance_memberships_instance_id_fkey FOREIGN KEY (instance_id) REFERENCES iam.instances(id) ON DELETE CASCADE;


--
-- Name: instance_modules instance_modules_instance_id_fkey; Type: FK CONSTRAINT; Schema: iam; Owner: -
--

ALTER TABLE ONLY iam.instance_modules
    ADD CONSTRAINT instance_modules_instance_id_fkey FOREIGN KEY (instance_id) REFERENCES iam.instances(id) ON DELETE CASCADE;


--
-- Name: instance_provisioning_runs instance_provisioning_runs_instance_id_fkey; Type: FK CONSTRAINT; Schema: iam; Owner: -
--

ALTER TABLE ONLY iam.instance_provisioning_runs
    ADD CONSTRAINT instance_provisioning_runs_instance_id_fkey FOREIGN KEY (instance_id) REFERENCES iam.instances(id) ON DELETE CASCADE;


--
-- Name: instance_waste_data_sources instance_waste_data_sources_instance_id_fkey; Type: FK CONSTRAINT; Schema: iam; Owner: -
--

ALTER TABLE ONLY iam.instance_waste_data_sources
    ADD CONSTRAINT instance_waste_data_sources_instance_id_fkey FOREIGN KEY (instance_id) REFERENCES iam.instances(id) ON DELETE CASCADE;


--
-- Name: legal_holds legal_holds_account_membership_fk; Type: FK CONSTRAINT; Schema: iam; Owner: -
--

ALTER TABLE ONLY iam.legal_holds
    ADD CONSTRAINT legal_holds_account_membership_fk FOREIGN KEY (instance_id, account_id) REFERENCES iam.instance_memberships(instance_id, account_id) ON DELETE RESTRICT;


--
-- Name: legal_holds legal_holds_creator_membership_fk; Type: FK CONSTRAINT; Schema: iam; Owner: -
--

ALTER TABLE ONLY iam.legal_holds
    ADD CONSTRAINT legal_holds_creator_membership_fk FOREIGN KEY (instance_id, created_by_account_id) REFERENCES iam.instance_memberships(instance_id, account_id) ON DELETE SET NULL;


--
-- Name: legal_holds legal_holds_instance_id_fkey; Type: FK CONSTRAINT; Schema: iam; Owner: -
--

ALTER TABLE ONLY iam.legal_holds
    ADD CONSTRAINT legal_holds_instance_id_fkey FOREIGN KEY (instance_id) REFERENCES iam.instances(id) ON DELETE CASCADE;


--
-- Name: legal_holds legal_holds_lifter_membership_fk; Type: FK CONSTRAINT; Schema: iam; Owner: -
--

ALTER TABLE ONLY iam.legal_holds
    ADD CONSTRAINT legal_holds_lifter_membership_fk FOREIGN KEY (instance_id, lifted_by_account_id) REFERENCES iam.instance_memberships(instance_id, account_id) ON DELETE SET NULL;


--
-- Name: legal_text_acceptances legal_text_acceptances_instance_id_fkey; Type: FK CONSTRAINT; Schema: iam; Owner: -
--

ALTER TABLE ONLY iam.legal_text_acceptances
    ADD CONSTRAINT legal_text_acceptances_instance_id_fkey FOREIGN KEY (instance_id) REFERENCES iam.instances(id) ON DELETE CASCADE;


--
-- Name: legal_text_acceptances legal_text_acceptances_legal_text_version_id_fkey; Type: FK CONSTRAINT; Schema: iam; Owner: -
--

ALTER TABLE ONLY iam.legal_text_acceptances
    ADD CONSTRAINT legal_text_acceptances_legal_text_version_id_fkey FOREIGN KEY (legal_text_version_id) REFERENCES iam.legal_text_versions(id) ON DELETE RESTRICT;


--
-- Name: legal_text_acceptances legal_text_acceptances_membership_fk; Type: FK CONSTRAINT; Schema: iam; Owner: -
--

ALTER TABLE ONLY iam.legal_text_acceptances
    ADD CONSTRAINT legal_text_acceptances_membership_fk FOREIGN KEY (instance_id, account_id) REFERENCES iam.instance_memberships(instance_id, account_id) ON DELETE RESTRICT;


--
-- Name: legal_text_target_groups legal_text_target_groups_instance_id_fkey; Type: FK CONSTRAINT; Schema: iam; Owner: -
--

ALTER TABLE ONLY iam.legal_text_target_groups
    ADD CONSTRAINT legal_text_target_groups_instance_id_fkey FOREIGN KEY (instance_id) REFERENCES iam.instances(id) ON DELETE CASCADE;


--
-- Name: legal_text_target_groups legal_text_target_groups_instance_id_group_id_fkey; Type: FK CONSTRAINT; Schema: iam; Owner: -
--

ALTER TABLE ONLY iam.legal_text_target_groups
    ADD CONSTRAINT legal_text_target_groups_instance_id_group_id_fkey FOREIGN KEY (instance_id, group_id) REFERENCES iam.groups(instance_id, id) ON DELETE CASCADE;


--
-- Name: legal_text_target_groups legal_text_target_groups_instance_id_legal_text_version_id_fkey; Type: FK CONSTRAINT; Schema: iam; Owner: -
--

ALTER TABLE ONLY iam.legal_text_target_groups
    ADD CONSTRAINT legal_text_target_groups_instance_id_legal_text_version_id_fkey FOREIGN KEY (instance_id, legal_text_version_id) REFERENCES iam.legal_text_versions(instance_id, id) ON DELETE CASCADE;


--
-- Name: legal_text_target_roles legal_text_target_roles_instance_id_fkey; Type: FK CONSTRAINT; Schema: iam; Owner: -
--

ALTER TABLE ONLY iam.legal_text_target_roles
    ADD CONSTRAINT legal_text_target_roles_instance_id_fkey FOREIGN KEY (instance_id) REFERENCES iam.instances(id) ON DELETE CASCADE;


--
-- Name: legal_text_target_roles legal_text_target_roles_instance_id_legal_text_version_id_fkey; Type: FK CONSTRAINT; Schema: iam; Owner: -
--

ALTER TABLE ONLY iam.legal_text_target_roles
    ADD CONSTRAINT legal_text_target_roles_instance_id_legal_text_version_id_fkey FOREIGN KEY (instance_id, legal_text_version_id) REFERENCES iam.legal_text_versions(instance_id, id) ON DELETE CASCADE;


--
-- Name: legal_text_target_roles legal_text_target_roles_instance_id_role_id_fkey; Type: FK CONSTRAINT; Schema: iam; Owner: -
--

ALTER TABLE ONLY iam.legal_text_target_roles
    ADD CONSTRAINT legal_text_target_roles_instance_id_role_id_fkey FOREIGN KEY (instance_id, role_id) REFERENCES iam.roles(instance_id, id) ON DELETE CASCADE;


--
-- Name: legal_text_versions legal_text_versions_instance_id_fkey; Type: FK CONSTRAINT; Schema: iam; Owner: -
--

ALTER TABLE ONLY iam.legal_text_versions
    ADD CONSTRAINT legal_text_versions_instance_id_fkey FOREIGN KEY (instance_id) REFERENCES iam.instances(id) ON DELETE CASCADE;


--
-- Name: media_assets media_assets_instance_id_fkey; Type: FK CONSTRAINT; Schema: iam; Owner: -
--

ALTER TABLE ONLY iam.media_assets
    ADD CONSTRAINT media_assets_instance_id_fkey FOREIGN KEY (instance_id) REFERENCES iam.instances(id) ON DELETE CASCADE;


--
-- Name: media_references media_references_asset_id_fkey; Type: FK CONSTRAINT; Schema: iam; Owner: -
--

ALTER TABLE ONLY iam.media_references
    ADD CONSTRAINT media_references_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES iam.media_assets(id) ON DELETE CASCADE;


--
-- Name: media_references media_references_instance_id_fkey; Type: FK CONSTRAINT; Schema: iam; Owner: -
--

ALTER TABLE ONLY iam.media_references
    ADD CONSTRAINT media_references_instance_id_fkey FOREIGN KEY (instance_id) REFERENCES iam.instances(id) ON DELETE CASCADE;


--
-- Name: media_storage_quotas media_storage_quotas_instance_id_fkey; Type: FK CONSTRAINT; Schema: iam; Owner: -
--

ALTER TABLE ONLY iam.media_storage_quotas
    ADD CONSTRAINT media_storage_quotas_instance_id_fkey FOREIGN KEY (instance_id) REFERENCES iam.instances(id) ON DELETE CASCADE;


--
-- Name: media_storage_usage media_storage_usage_instance_id_fkey; Type: FK CONSTRAINT; Schema: iam; Owner: -
--

ALTER TABLE ONLY iam.media_storage_usage
    ADD CONSTRAINT media_storage_usage_instance_id_fkey FOREIGN KEY (instance_id) REFERENCES iam.instances(id) ON DELETE CASCADE;


--
-- Name: media_upload_sessions media_upload_sessions_asset_id_fkey; Type: FK CONSTRAINT; Schema: iam; Owner: -
--

ALTER TABLE ONLY iam.media_upload_sessions
    ADD CONSTRAINT media_upload_sessions_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES iam.media_assets(id) ON DELETE CASCADE;


--
-- Name: media_upload_sessions media_upload_sessions_instance_id_fkey; Type: FK CONSTRAINT; Schema: iam; Owner: -
--

ALTER TABLE ONLY iam.media_upload_sessions
    ADD CONSTRAINT media_upload_sessions_instance_id_fkey FOREIGN KEY (instance_id) REFERENCES iam.instances(id) ON DELETE CASCADE;


--
-- Name: media_variants media_variants_asset_id_fkey; Type: FK CONSTRAINT; Schema: iam; Owner: -
--

ALTER TABLE ONLY iam.media_variants
    ADD CONSTRAINT media_variants_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES iam.media_assets(id) ON DELETE CASCADE;


--
-- Name: media_variants media_variants_instance_id_fkey; Type: FK CONSTRAINT; Schema: iam; Owner: -
--

ALTER TABLE ONLY iam.media_variants
    ADD CONSTRAINT media_variants_instance_id_fkey FOREIGN KEY (instance_id) REFERENCES iam.instances(id) ON DELETE CASCADE;


--
-- Name: organization_mainserver_credentials organization_mainserver_credentials_org_fk; Type: FK CONSTRAINT; Schema: iam; Owner: -
--

ALTER TABLE ONLY iam.organization_mainserver_credentials
    ADD CONSTRAINT organization_mainserver_credentials_org_fk FOREIGN KEY (instance_id, organization_id) REFERENCES iam.organizations(instance_id, id) ON DELETE CASCADE;


--
-- Name: organization_mainserver_credentials organization_mainserver_credentials_updated_by_fk; Type: FK CONSTRAINT; Schema: iam; Owner: -
--

ALTER TABLE ONLY iam.organization_mainserver_credentials
    ADD CONSTRAINT organization_mainserver_credentials_updated_by_fk FOREIGN KEY (updated_by_account_id) REFERENCES iam.accounts(id) ON DELETE SET NULL;


--
-- Name: organizations organizations_instance_id_fkey; Type: FK CONSTRAINT; Schema: iam; Owner: -
--

ALTER TABLE ONLY iam.organizations
    ADD CONSTRAINT organizations_instance_id_fkey FOREIGN KEY (instance_id) REFERENCES iam.instances(id) ON DELETE CASCADE;


--
-- Name: permission_change_requests permission_change_requests_approver_fk; Type: FK CONSTRAINT; Schema: iam; Owner: -
--

ALTER TABLE ONLY iam.permission_change_requests
    ADD CONSTRAINT permission_change_requests_approver_fk FOREIGN KEY (approver_account_id) REFERENCES iam.accounts(id) ON DELETE SET NULL;


--
-- Name: permission_change_requests permission_change_requests_instance_id_fkey; Type: FK CONSTRAINT; Schema: iam; Owner: -
--

ALTER TABLE ONLY iam.permission_change_requests
    ADD CONSTRAINT permission_change_requests_instance_id_fkey FOREIGN KEY (instance_id) REFERENCES iam.instances(id) ON DELETE CASCADE;


--
-- Name: permission_change_requests permission_change_requests_membership_requester_fk; Type: FK CONSTRAINT; Schema: iam; Owner: -
--

ALTER TABLE ONLY iam.permission_change_requests
    ADD CONSTRAINT permission_change_requests_membership_requester_fk FOREIGN KEY (instance_id, requester_account_id) REFERENCES iam.instance_memberships(instance_id, account_id) ON DELETE RESTRICT;


--
-- Name: permission_change_requests permission_change_requests_membership_target_fk; Type: FK CONSTRAINT; Schema: iam; Owner: -
--

ALTER TABLE ONLY iam.permission_change_requests
    ADD CONSTRAINT permission_change_requests_membership_target_fk FOREIGN KEY (instance_id, target_account_id) REFERENCES iam.instance_memberships(instance_id, account_id) ON DELETE RESTRICT;


--
-- Name: permission_change_requests permission_change_requests_role_fk; Type: FK CONSTRAINT; Schema: iam; Owner: -
--

ALTER TABLE ONLY iam.permission_change_requests
    ADD CONSTRAINT permission_change_requests_role_fk FOREIGN KEY (instance_id, role_id) REFERENCES iam.roles(instance_id, id) ON DELETE RESTRICT;


--
-- Name: permission_change_requests permission_change_requests_security_approver_fk; Type: FK CONSTRAINT; Schema: iam; Owner: -
--

ALTER TABLE ONLY iam.permission_change_requests
    ADD CONSTRAINT permission_change_requests_security_approver_fk FOREIGN KEY (security_approver_account_id) REFERENCES iam.accounts(id) ON DELETE SET NULL;


--
-- Name: permissions permissions_instance_id_fkey; Type: FK CONSTRAINT; Schema: iam; Owner: -
--

ALTER TABLE ONLY iam.permissions
    ADD CONSTRAINT permissions_instance_id_fkey FOREIGN KEY (instance_id) REFERENCES iam.instances(id) ON DELETE CASCADE;


--
-- Name: role_permissions role_permissions_permission_fk; Type: FK CONSTRAINT; Schema: iam; Owner: -
--

ALTER TABLE ONLY iam.role_permissions
    ADD CONSTRAINT role_permissions_permission_fk FOREIGN KEY (instance_id, permission_id) REFERENCES iam.permissions(instance_id, id) ON DELETE CASCADE;


--
-- Name: role_permissions role_permissions_role_fk; Type: FK CONSTRAINT; Schema: iam; Owner: -
--

ALTER TABLE ONLY iam.role_permissions
    ADD CONSTRAINT role_permissions_role_fk FOREIGN KEY (instance_id, role_id) REFERENCES iam.roles(instance_id, id) ON DELETE CASCADE;


--
-- Name: roles roles_instance_id_fkey; Type: FK CONSTRAINT; Schema: iam; Owner: -
--

ALTER TABLE ONLY iam.roles
    ADD CONSTRAINT roles_instance_id_fkey FOREIGN KEY (instance_id) REFERENCES iam.instances(id) ON DELETE CASCADE;


--
-- Name: studio_job_events studio_job_events_job_instance_fk; Type: FK CONSTRAINT; Schema: iam; Owner: -
--

ALTER TABLE ONLY iam.studio_job_events
    ADD CONSTRAINT studio_job_events_job_instance_fk FOREIGN KEY (job_id, instance_id) REFERENCES iam.studio_jobs(id, instance_id) ON DELETE CASCADE;


--
-- Name: studio_jobs studio_jobs_parent_job_fk; Type: FK CONSTRAINT; Schema: iam; Owner: -
--

ALTER TABLE ONLY iam.studio_jobs
    ADD CONSTRAINT studio_jobs_parent_job_fk FOREIGN KEY (parent_job_id) REFERENCES iam.studio_jobs(id) ON DELETE SET NULL;


--
-- Name: waste_email_reminder_outbox waste_email_reminder_outbox_subscription_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.waste_email_reminder_outbox
    ADD CONSTRAINT waste_email_reminder_outbox_subscription_id_fkey FOREIGN KEY (subscription_id) REFERENCES public.waste_email_reminder_subscriptions(id) ON DELETE CASCADE;


--
-- Name: waste_email_reminder_subscription_items waste_email_reminder_subscription_items_subscription_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.waste_email_reminder_subscription_items
    ADD CONSTRAINT waste_email_reminder_subscription_items_subscription_id_fkey FOREIGN KEY (subscription_id) REFERENCES public.waste_email_reminder_subscriptions(id) ON DELETE CASCADE;


--
-- Name: account_deletion_content_preferences; Type: ROW SECURITY; Schema: iam; Owner: -
--

ALTER TABLE iam.account_deletion_content_preferences ENABLE ROW LEVEL SECURITY;

--
-- Name: account_deletion_content_preferences account_deletion_content_preferences_isolation_policy; Type: POLICY; Schema: iam; Owner: -
--

CREATE POLICY account_deletion_content_preferences_isolation_policy ON iam.account_deletion_content_preferences USING ((instance_id = iam.current_instance_id())) WITH CHECK ((instance_id = iam.current_instance_id()));


--
-- Name: account_groups account_groups_isolation_policy; Type: POLICY; Schema: iam; Owner: -
--

CREATE POLICY account_groups_isolation_policy ON iam.account_groups USING ((instance_id = iam.current_instance_id())) WITH CHECK ((instance_id = iam.current_instance_id()));


--
-- Name: account_organizations account_organizations_isolation_policy; Type: POLICY; Schema: iam; Owner: -
--

CREATE POLICY account_organizations_isolation_policy ON iam.account_organizations USING ((instance_id = iam.current_instance_id())) WITH CHECK ((instance_id = iam.current_instance_id()));


--
-- Name: account_profile_corrections account_profile_corrections_isolation_policy; Type: POLICY; Schema: iam; Owner: -
--

CREATE POLICY account_profile_corrections_isolation_policy ON iam.account_profile_corrections USING ((instance_id = iam.current_instance_id())) WITH CHECK ((instance_id = iam.current_instance_id()));


--
-- Name: account_roles account_roles_isolation_policy; Type: POLICY; Schema: iam; Owner: -
--

CREATE POLICY account_roles_isolation_policy ON iam.account_roles USING ((instance_id = iam.current_instance_id())) WITH CHECK ((instance_id = iam.current_instance_id()));


--
-- Name: accounts accounts_isolation_policy; Type: POLICY; Schema: iam; Owner: -
--

CREATE POLICY accounts_isolation_policy ON iam.accounts USING ((instance_id = iam.current_instance_id())) WITH CHECK ((instance_id = iam.current_instance_id()));


--
-- Name: activity_logs_archive activity_logs_archive_isolation_policy; Type: POLICY; Schema: iam; Owner: -
--

CREATE POLICY activity_logs_archive_isolation_policy ON iam.activity_logs_archive USING ((instance_id = iam.current_instance_id())) WITH CHECK ((instance_id = iam.current_instance_id()));


--
-- Name: activity_logs activity_logs_isolation_policy; Type: POLICY; Schema: iam; Owner: -
--

CREATE POLICY activity_logs_isolation_policy ON iam.activity_logs USING ((instance_id = iam.current_instance_id())) WITH CHECK ((instance_id = iam.current_instance_id()));


--
-- Name: data_subject_export_jobs data_subject_export_jobs_isolation_policy; Type: POLICY; Schema: iam; Owner: -
--

CREATE POLICY data_subject_export_jobs_isolation_policy ON iam.data_subject_export_jobs USING ((instance_id = iam.current_instance_id())) WITH CHECK ((instance_id = iam.current_instance_id()));


--
-- Name: data_subject_recipient_notifications data_subject_recipient_notifications_isolation_policy; Type: POLICY; Schema: iam; Owner: -
--

CREATE POLICY data_subject_recipient_notifications_isolation_policy ON iam.data_subject_recipient_notifications USING ((instance_id = iam.current_instance_id())) WITH CHECK ((instance_id = iam.current_instance_id()));


--
-- Name: data_subject_request_events data_subject_request_events_isolation_policy; Type: POLICY; Schema: iam; Owner: -
--

CREATE POLICY data_subject_request_events_isolation_policy ON iam.data_subject_request_events USING ((instance_id = iam.current_instance_id())) WITH CHECK ((instance_id = iam.current_instance_id()));


--
-- Name: data_subject_requests data_subject_requests_isolation_policy; Type: POLICY; Schema: iam; Owner: -
--

CREATE POLICY data_subject_requests_isolation_policy ON iam.data_subject_requests USING ((instance_id = iam.current_instance_id())) WITH CHECK ((instance_id = iam.current_instance_id()));


--
-- Name: delegations delegations_isolation_policy; Type: POLICY; Schema: iam; Owner: -
--

CREATE POLICY delegations_isolation_policy ON iam.delegations USING ((instance_id = iam.current_instance_id())) WITH CHECK ((instance_id = iam.current_instance_id()));


--
-- Name: geo_nodes geo_nodes_isolation_policy; Type: POLICY; Schema: iam; Owner: -
--

CREATE POLICY geo_nodes_isolation_policy ON iam.geo_nodes USING ((instance_id = iam.current_instance_id())) WITH CHECK ((instance_id = iam.current_instance_id()));


--
-- Name: geo_units geo_units_isolation_policy; Type: POLICY; Schema: iam; Owner: -
--

CREATE POLICY geo_units_isolation_policy ON iam.geo_units USING ((instance_id = iam.current_instance_id())) WITH CHECK ((instance_id = iam.current_instance_id()));


--
-- Name: group_roles group_roles_isolation_policy; Type: POLICY; Schema: iam; Owner: -
--

CREATE POLICY group_roles_isolation_policy ON iam.group_roles USING ((instance_id = iam.current_instance_id())) WITH CHECK ((instance_id = iam.current_instance_id()));


--
-- Name: groups groups_isolation_policy; Type: POLICY; Schema: iam; Owner: -
--

CREATE POLICY groups_isolation_policy ON iam.groups USING ((instance_id = iam.current_instance_id())) WITH CHECK ((instance_id = iam.current_instance_id()));


--
-- Name: idempotency_keys idempotency_keys_isolation_policy; Type: POLICY; Schema: iam; Owner: -
--

CREATE POLICY idempotency_keys_isolation_policy ON iam.idempotency_keys USING ((instance_id = iam.current_instance_id())) WITH CHECK ((instance_id = iam.current_instance_id()));


--
-- Name: impersonation_sessions impersonation_sessions_isolation_policy; Type: POLICY; Schema: iam; Owner: -
--

CREATE POLICY impersonation_sessions_isolation_policy ON iam.impersonation_sessions USING ((instance_id = iam.current_instance_id())) WITH CHECK ((instance_id = iam.current_instance_id()));


--
-- Name: instance_deletion_rules; Type: ROW SECURITY; Schema: iam; Owner: -
--

ALTER TABLE iam.instance_deletion_rules ENABLE ROW LEVEL SECURITY;

--
-- Name: instance_deletion_rules instance_deletion_rules_isolation_policy; Type: POLICY; Schema: iam; Owner: -
--

CREATE POLICY instance_deletion_rules_isolation_policy ON iam.instance_deletion_rules USING ((instance_id = iam.current_instance_id())) WITH CHECK ((instance_id = iam.current_instance_id()));


--
-- Name: instance_external_interfaces; Type: ROW SECURITY; Schema: iam; Owner: -
--

ALTER TABLE iam.instance_external_interfaces ENABLE ROW LEVEL SECURITY;

--
-- Name: instance_external_interfaces instance_external_interfaces_isolation_policy; Type: POLICY; Schema: iam; Owner: -
--

CREATE POLICY instance_external_interfaces_isolation_policy ON iam.instance_external_interfaces USING ((instance_id = iam.current_instance_id())) WITH CHECK ((instance_id = iam.current_instance_id()));


--
-- Name: instance_integrations instance_integrations_isolation_policy; Type: POLICY; Schema: iam; Owner: -
--

CREATE POLICY instance_integrations_isolation_policy ON iam.instance_integrations USING ((instance_id = iam.current_instance_id())) WITH CHECK ((instance_id = iam.current_instance_id()));


--
-- Name: instance_memberships instance_memberships_isolation_policy; Type: POLICY; Schema: iam; Owner: -
--

CREATE POLICY instance_memberships_isolation_policy ON iam.instance_memberships USING ((instance_id = iam.current_instance_id())) WITH CHECK ((instance_id = iam.current_instance_id()));


--
-- Name: instance_waste_data_sources; Type: ROW SECURITY; Schema: iam; Owner: -
--

ALTER TABLE iam.instance_waste_data_sources ENABLE ROW LEVEL SECURITY;

--
-- Name: instance_waste_data_sources instance_waste_data_sources_isolation_policy; Type: POLICY; Schema: iam; Owner: -
--

CREATE POLICY instance_waste_data_sources_isolation_policy ON iam.instance_waste_data_sources USING ((instance_id = iam.current_instance_id())) WITH CHECK ((instance_id = iam.current_instance_id()));


--
-- Name: instances instances_isolation_policy; Type: POLICY; Schema: iam; Owner: -
--

CREATE POLICY instances_isolation_policy ON iam.instances USING ((id = iam.current_instance_id())) WITH CHECK ((id = iam.current_instance_id()));


--
-- Name: legal_holds legal_holds_isolation_policy; Type: POLICY; Schema: iam; Owner: -
--

CREATE POLICY legal_holds_isolation_policy ON iam.legal_holds USING ((instance_id = iam.current_instance_id())) WITH CHECK ((instance_id = iam.current_instance_id()));


--
-- Name: legal_text_acceptances legal_text_acceptances_isolation_policy; Type: POLICY; Schema: iam; Owner: -
--

CREATE POLICY legal_text_acceptances_isolation_policy ON iam.legal_text_acceptances USING ((instance_id = iam.current_instance_id())) WITH CHECK ((instance_id = iam.current_instance_id()));


--
-- Name: legal_text_target_groups; Type: ROW SECURITY; Schema: iam; Owner: -
--

ALTER TABLE iam.legal_text_target_groups ENABLE ROW LEVEL SECURITY;

--
-- Name: legal_text_target_groups legal_text_target_groups_isolation_policy; Type: POLICY; Schema: iam; Owner: -
--

CREATE POLICY legal_text_target_groups_isolation_policy ON iam.legal_text_target_groups USING ((instance_id = current_setting('app.current_instance_id'::text, true)));


--
-- Name: legal_text_target_roles; Type: ROW SECURITY; Schema: iam; Owner: -
--

ALTER TABLE iam.legal_text_target_roles ENABLE ROW LEVEL SECURITY;

--
-- Name: legal_text_target_roles legal_text_target_roles_isolation_policy; Type: POLICY; Schema: iam; Owner: -
--

CREATE POLICY legal_text_target_roles_isolation_policy ON iam.legal_text_target_roles USING ((instance_id = current_setting('app.current_instance_id'::text, true)));


--
-- Name: legal_text_versions legal_text_versions_isolation_policy; Type: POLICY; Schema: iam; Owner: -
--

CREATE POLICY legal_text_versions_isolation_policy ON iam.legal_text_versions USING ((instance_id = iam.current_instance_id())) WITH CHECK ((instance_id = iam.current_instance_id()));


--
-- Name: organization_mainserver_credentials; Type: ROW SECURITY; Schema: iam; Owner: -
--

ALTER TABLE iam.organization_mainserver_credentials ENABLE ROW LEVEL SECURITY;

--
-- Name: organization_mainserver_credentials organization_mainserver_credentials_isolation_policy; Type: POLICY; Schema: iam; Owner: -
--

CREATE POLICY organization_mainserver_credentials_isolation_policy ON iam.organization_mainserver_credentials USING ((instance_id = iam.current_instance_id())) WITH CHECK ((instance_id = iam.current_instance_id()));


--
-- Name: organizations organizations_isolation_policy; Type: POLICY; Schema: iam; Owner: -
--

CREATE POLICY organizations_isolation_policy ON iam.organizations USING ((instance_id = iam.current_instance_id())) WITH CHECK ((instance_id = iam.current_instance_id()));


--
-- Name: permission_change_requests permission_change_requests_isolation_policy; Type: POLICY; Schema: iam; Owner: -
--

CREATE POLICY permission_change_requests_isolation_policy ON iam.permission_change_requests USING ((instance_id = iam.current_instance_id())) WITH CHECK ((instance_id = iam.current_instance_id()));


--
-- Name: permissions permissions_isolation_policy; Type: POLICY; Schema: iam; Owner: -
--

CREATE POLICY permissions_isolation_policy ON iam.permissions USING ((instance_id = iam.current_instance_id())) WITH CHECK ((instance_id = iam.current_instance_id()));


--
-- Name: platform_activity_logs; Type: ROW SECURITY; Schema: iam; Owner: -
--

ALTER TABLE iam.platform_activity_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: platform_activity_logs platform_activity_logs_platform_scope; Type: POLICY; Schema: iam; Owner: -
--

CREATE POLICY platform_activity_logs_platform_scope ON iam.platform_activity_logs USING ((iam.current_instance_id() IS NULL)) WITH CHECK ((iam.current_instance_id() IS NULL));


--
-- Name: role_permissions role_permissions_isolation_policy; Type: POLICY; Schema: iam; Owner: -
--

CREATE POLICY role_permissions_isolation_policy ON iam.role_permissions USING ((instance_id = iam.current_instance_id())) WITH CHECK ((instance_id = iam.current_instance_id()));


--
-- Name: roles roles_isolation_policy; Type: POLICY; Schema: iam; Owner: -
--

CREATE POLICY roles_isolation_policy ON iam.roles USING ((instance_id = iam.current_instance_id())) WITH CHECK ((instance_id = iam.current_instance_id()));


--
-- PostgreSQL database dump complete
--

\unrestrict 8k3Qjf9gY0vuevNTyGYZ0GdclXCgxTTra0CfwVS3aqEMQXokjbN82cujAGXToFs

