-- packages/data/migrations/0001_iam_core.sql

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE SCHEMA IF NOT EXISTS iam;

CREATE TABLE IF NOT EXISTS iam.instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_key TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS iam.accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  keycloak_subject TEXT NOT NULL UNIQUE,
  email_ciphertext TEXT,
  display_name_ciphertext TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS iam.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id UUID NOT NULL REFERENCES iam.instances(id) ON DELETE CASCADE,
  organization_key TEXT NOT NULL,
  display_name TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT organizations_instance_key_uniq UNIQUE (instance_id, organization_key)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_organizations_instance_id_id
  ON iam.organizations(instance_id, id);

CREATE TABLE IF NOT EXISTS iam.roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id UUID NOT NULL REFERENCES iam.instances(id) ON DELETE CASCADE,
  role_name TEXT NOT NULL,
  description TEXT,
  is_system_role BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT roles_instance_name_uniq UNIQUE (instance_id, role_name)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_roles_instance_id_id
  ON iam.roles(instance_id, id);

CREATE TABLE IF NOT EXISTS iam.permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id UUID NOT NULL REFERENCES iam.instances(id) ON DELETE CASCADE,
  permission_key TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT permissions_instance_key_uniq UNIQUE (instance_id, permission_key)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_permissions_instance_id_id
  ON iam.permissions(instance_id, id);

CREATE TABLE IF NOT EXISTS iam.instance_memberships (
  instance_id UUID NOT NULL REFERENCES iam.instances(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES iam.accounts(id) ON DELETE CASCADE,
  membership_type TEXT NOT NULL DEFAULT 'member',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (instance_id, account_id)
);

CREATE TABLE IF NOT EXISTS iam.account_organizations (
  instance_id UUID NOT NULL,
  account_id UUID NOT NULL,
  organization_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (instance_id, account_id, organization_id),
  CONSTRAINT account_org_membership_fk FOREIGN KEY (instance_id, account_id)
    REFERENCES iam.instance_memberships(instance_id, account_id) ON DELETE CASCADE,
  CONSTRAINT account_org_organization_fk FOREIGN KEY (instance_id, organization_id)
    REFERENCES iam.organizations(instance_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS iam.account_roles (
  instance_id UUID NOT NULL,
  account_id UUID NOT NULL,
  role_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (instance_id, account_id, role_id),
  CONSTRAINT account_roles_membership_fk FOREIGN KEY (instance_id, account_id)
    REFERENCES iam.instance_memberships(instance_id, account_id) ON DELETE CASCADE,
  CONSTRAINT account_roles_role_fk FOREIGN KEY (instance_id, role_id)
    REFERENCES iam.roles(instance_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS iam.role_permissions (
  instance_id UUID NOT NULL,
  role_id UUID NOT NULL,
  permission_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (instance_id, role_id, permission_id),
  CONSTRAINT role_permissions_role_fk FOREIGN KEY (instance_id, role_id)
    REFERENCES iam.roles(instance_id, id) ON DELETE CASCADE,
  CONSTRAINT role_permissions_permission_fk FOREIGN KEY (instance_id, permission_id)
    REFERENCES iam.permissions(instance_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS iam.activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id UUID NOT NULL REFERENCES iam.instances(id) ON DELETE CASCADE,
  account_id UUID REFERENCES iam.accounts(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  request_id TEXT,
  trace_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_organizations_instance_id
  ON iam.organizations(instance_id);

CREATE INDEX IF NOT EXISTS idx_roles_instance_id
  ON iam.roles(instance_id);

CREATE INDEX IF NOT EXISTS idx_permissions_instance_id
  ON iam.permissions(instance_id);

CREATE INDEX IF NOT EXISTS idx_activity_logs_instance_id_created_at
  ON iam.activity_logs(instance_id, created_at DESC);

DO $$
DECLARE
  instance_id_is_uuid BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'iam'
      AND table_name = 'instances'
      AND column_name = 'id'
      AND udt_name = 'uuid'
  )
  INTO instance_id_is_uuid;

  EXECUTE 'DROP FUNCTION IF EXISTS iam.current_instance_id() CASCADE';

  IF instance_id_is_uuid THEN
    EXECUTE $sql$
      CREATE FUNCTION iam.current_instance_id()
      RETURNS UUID
      LANGUAGE SQL
      STABLE
      AS $fn$
        SELECT NULLIF(current_setting('app.instance_id', true), '')::uuid
      $fn$
    $sql$;
  ELSE
    EXECUTE $sql$
      CREATE FUNCTION iam.current_instance_id()
      RETURNS TEXT
      LANGUAGE SQL
      STABLE
      AS $fn$
        SELECT NULLIF(current_setting('app.instance_id', true), '')
      $fn$
    $sql$;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'iam_app') THEN
    CREATE ROLE iam_app NOINHERIT;
  END IF;
END
$$;

GRANT USAGE ON SCHEMA iam TO iam_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA iam TO iam_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA iam TO iam_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA iam GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO iam_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA iam GRANT USAGE, SELECT ON SEQUENCES TO iam_app;

ALTER TABLE iam.instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE iam.instances FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS instances_isolation_policy ON iam.instances;
CREATE POLICY instances_isolation_policy
  ON iam.instances
  USING (id = iam.current_instance_id())
  WITH CHECK (id = iam.current_instance_id());

ALTER TABLE iam.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE iam.accounts FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS accounts_isolation_policy ON iam.accounts;
CREATE POLICY accounts_isolation_policy
  ON iam.accounts
  USING (
    EXISTS (
      SELECT 1
      FROM iam.instance_memberships membership
      WHERE membership.account_id = iam.accounts.id
        AND membership.instance_id = iam.current_instance_id()
    )
  )
  WITH CHECK (
    iam.current_instance_id() IS NOT NULL
  );

ALTER TABLE iam.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE iam.organizations FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS organizations_isolation_policy ON iam.organizations;
CREATE POLICY organizations_isolation_policy
  ON iam.organizations
  USING (instance_id = iam.current_instance_id())
  WITH CHECK (instance_id = iam.current_instance_id());

ALTER TABLE iam.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE iam.roles FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS roles_isolation_policy ON iam.roles;
CREATE POLICY roles_isolation_policy
  ON iam.roles
  USING (instance_id = iam.current_instance_id())
  WITH CHECK (instance_id = iam.current_instance_id());

ALTER TABLE iam.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE iam.permissions FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS permissions_isolation_policy ON iam.permissions;
CREATE POLICY permissions_isolation_policy
  ON iam.permissions
  USING (instance_id = iam.current_instance_id())
  WITH CHECK (instance_id = iam.current_instance_id());

ALTER TABLE iam.instance_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE iam.instance_memberships FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS instance_memberships_isolation_policy ON iam.instance_memberships;
CREATE POLICY instance_memberships_isolation_policy
  ON iam.instance_memberships
  USING (instance_id = iam.current_instance_id())
  WITH CHECK (instance_id = iam.current_instance_id());

ALTER TABLE iam.account_organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE iam.account_organizations FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS account_organizations_isolation_policy ON iam.account_organizations;
CREATE POLICY account_organizations_isolation_policy
  ON iam.account_organizations
  USING (instance_id = iam.current_instance_id())
  WITH CHECK (instance_id = iam.current_instance_id());

ALTER TABLE iam.account_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE iam.account_roles FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS account_roles_isolation_policy ON iam.account_roles;
CREATE POLICY account_roles_isolation_policy
  ON iam.account_roles
  USING (instance_id = iam.current_instance_id())
  WITH CHECK (instance_id = iam.current_instance_id());

ALTER TABLE iam.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE iam.role_permissions FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS role_permissions_isolation_policy ON iam.role_permissions;
CREATE POLICY role_permissions_isolation_policy
  ON iam.role_permissions
  USING (instance_id = iam.current_instance_id())
  WITH CHECK (instance_id = iam.current_instance_id());

ALTER TABLE iam.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE iam.activity_logs FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS activity_logs_isolation_policy ON iam.activity_logs;
CREATE POLICY activity_logs_isolation_policy
  ON iam.activity_logs
  USING (instance_id = iam.current_instance_id())
  WITH CHECK (instance_id = iam.current_instance_id());


-- packages/data/migrations/0002_iam_governance_workflows.sql

CREATE TABLE IF NOT EXISTS iam.permission_change_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id UUID NOT NULL REFERENCES iam.instances(id) ON DELETE CASCADE,
  requester_account_id UUID NOT NULL,
  target_account_id UUID NOT NULL,
  role_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  is_critical BOOLEAN NOT NULL DEFAULT true,
  ticket_id TEXT,
  ticket_system TEXT,
  ticket_state TEXT,
  approver_account_id UUID,
  security_approver_account_id UUID,
  rejection_reason TEXT,
  reason_code TEXT,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_at TIMESTAMPTZ,
  applied_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT permission_change_requests_status_chk CHECK (
    status IN ('draft', 'submitted', 'approved', 'rejected', 'applied')
  ),
  CONSTRAINT permission_change_requests_membership_requester_fk FOREIGN KEY (instance_id, requester_account_id)
    REFERENCES iam.instance_memberships(instance_id, account_id) ON DELETE RESTRICT,
  CONSTRAINT permission_change_requests_membership_target_fk FOREIGN KEY (instance_id, target_account_id)
    REFERENCES iam.instance_memberships(instance_id, account_id) ON DELETE RESTRICT,
  CONSTRAINT permission_change_requests_role_fk FOREIGN KEY (instance_id, role_id)
    REFERENCES iam.roles(instance_id, id) ON DELETE RESTRICT,
  CONSTRAINT permission_change_requests_approver_fk FOREIGN KEY (approver_account_id)
    REFERENCES iam.accounts(id) ON DELETE SET NULL,
  CONSTRAINT permission_change_requests_security_approver_fk FOREIGN KEY (security_approver_account_id)
    REFERENCES iam.accounts(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_permission_change_requests_instance_status
  ON iam.permission_change_requests(instance_id, status, requested_at DESC);

CREATE TABLE IF NOT EXISTS iam.delegations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id UUID NOT NULL REFERENCES iam.instances(id) ON DELETE CASCADE,
  delegator_account_id UUID NOT NULL,
  delegatee_account_id UUID NOT NULL,
  role_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'requested',
  ticket_id TEXT,
  ticket_system TEXT,
  ticket_state TEXT,
  approver_account_id UUID,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ,
  CONSTRAINT delegations_status_chk CHECK (status IN ('requested', 'active', 'expired', 'revoked')),
  CONSTRAINT delegations_duration_chk CHECK (ends_at > starts_at),
  CONSTRAINT delegations_membership_delegator_fk FOREIGN KEY (instance_id, delegator_account_id)
    REFERENCES iam.instance_memberships(instance_id, account_id) ON DELETE RESTRICT,
  CONSTRAINT delegations_membership_delegatee_fk FOREIGN KEY (instance_id, delegatee_account_id)
    REFERENCES iam.instance_memberships(instance_id, account_id) ON DELETE RESTRICT,
  CONSTRAINT delegations_role_fk FOREIGN KEY (instance_id, role_id)
    REFERENCES iam.roles(instance_id, id) ON DELETE RESTRICT,
  CONSTRAINT delegations_approver_fk FOREIGN KEY (approver_account_id)
    REFERENCES iam.accounts(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_delegations_instance_delegatee_active
  ON iam.delegations(instance_id, delegatee_account_id, status, starts_at, ends_at);

CREATE TABLE IF NOT EXISTS iam.impersonation_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id UUID NOT NULL REFERENCES iam.instances(id) ON DELETE CASCADE,
  actor_account_id UUID NOT NULL,
  target_account_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'requested',
  ticket_id TEXT NOT NULL,
  ticket_system TEXT NOT NULL,
  ticket_state TEXT NOT NULL,
  approved_by_account_id UUID,
  security_approver_account_id UUID,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  termination_reason TEXT,
  reason_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT impersonation_sessions_status_chk CHECK (
    status IN ('requested', 'approved', 'active', 'terminated', 'expired')
  ),
  CONSTRAINT impersonation_sessions_membership_actor_fk FOREIGN KEY (instance_id, actor_account_id)
    REFERENCES iam.instance_memberships(instance_id, account_id) ON DELETE RESTRICT,
  CONSTRAINT impersonation_sessions_membership_target_fk FOREIGN KEY (instance_id, target_account_id)
    REFERENCES iam.instance_memberships(instance_id, account_id) ON DELETE RESTRICT,
  CONSTRAINT impersonation_sessions_approved_by_fk FOREIGN KEY (approved_by_account_id)
    REFERENCES iam.accounts(id) ON DELETE SET NULL,
  CONSTRAINT impersonation_sessions_security_approver_fk FOREIGN KEY (security_approver_account_id)
    REFERENCES iam.accounts(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_impersonation_sessions_instance_actor_status
  ON iam.impersonation_sessions(instance_id, actor_account_id, status, expires_at);

CREATE TABLE IF NOT EXISTS iam.legal_text_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id UUID NOT NULL REFERENCES iam.instances(id) ON DELETE CASCADE,
  legal_text_id TEXT NOT NULL,
  legal_text_version TEXT NOT NULL,
  locale TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  published_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT legal_text_versions_instance_unique UNIQUE (instance_id, legal_text_id, legal_text_version, locale)
);

CREATE TABLE IF NOT EXISTS iam.legal_text_acceptances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id UUID NOT NULL REFERENCES iam.instances(id) ON DELETE CASCADE,
  legal_text_version_id UUID NOT NULL REFERENCES iam.legal_text_versions(id) ON DELETE RESTRICT,
  account_id UUID NOT NULL,
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ,
  revocation_reason TEXT,
  request_id TEXT,
  trace_id TEXT,
  CONSTRAINT legal_text_acceptances_membership_fk FOREIGN KEY (instance_id, account_id)
    REFERENCES iam.instance_memberships(instance_id, account_id) ON DELETE RESTRICT,
  CONSTRAINT legal_text_acceptances_unique UNIQUE (instance_id, legal_text_version_id, account_id, accepted_at)
);

CREATE INDEX IF NOT EXISTS idx_legal_text_acceptances_instance_account
  ON iam.legal_text_acceptances(instance_id, account_id, accepted_at DESC);

ALTER TABLE iam.permission_change_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE iam.permission_change_requests FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS permission_change_requests_isolation_policy ON iam.permission_change_requests;
CREATE POLICY permission_change_requests_isolation_policy
  ON iam.permission_change_requests
  USING (instance_id = iam.current_instance_id())
  WITH CHECK (instance_id = iam.current_instance_id());

ALTER TABLE iam.delegations ENABLE ROW LEVEL SECURITY;
ALTER TABLE iam.delegations FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS delegations_isolation_policy ON iam.delegations;
CREATE POLICY delegations_isolation_policy
  ON iam.delegations
  USING (instance_id = iam.current_instance_id())
  WITH CHECK (instance_id = iam.current_instance_id());

ALTER TABLE iam.impersonation_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE iam.impersonation_sessions FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS impersonation_sessions_isolation_policy ON iam.impersonation_sessions;
CREATE POLICY impersonation_sessions_isolation_policy
  ON iam.impersonation_sessions
  USING (instance_id = iam.current_instance_id())
  WITH CHECK (instance_id = iam.current_instance_id());

ALTER TABLE iam.legal_text_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE iam.legal_text_versions FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS legal_text_versions_isolation_policy ON iam.legal_text_versions;
CREATE POLICY legal_text_versions_isolation_policy
  ON iam.legal_text_versions
  USING (instance_id = iam.current_instance_id())
  WITH CHECK (instance_id = iam.current_instance_id());

ALTER TABLE iam.legal_text_acceptances ENABLE ROW LEVEL SECURITY;
ALTER TABLE iam.legal_text_acceptances FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS legal_text_acceptances_isolation_policy ON iam.legal_text_acceptances;
CREATE POLICY legal_text_acceptances_isolation_policy
  ON iam.legal_text_acceptances
  USING (instance_id = iam.current_instance_id())
  WITH CHECK (instance_id = iam.current_instance_id());


-- packages/data/migrations/0003_iam_data_subject_rights.sql

ALTER TABLE iam.accounts
  ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS soft_deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS delete_after TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS permanently_deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS processing_restricted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS processing_restriction_reason TEXT,
  ADD COLUMN IF NOT EXISTS non_essential_processing_opt_out_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_accounts_delete_after
  ON iam.accounts(delete_after)
  WHERE soft_deleted_at IS NOT NULL AND permanently_deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS iam.data_subject_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id UUID NOT NULL REFERENCES iam.instances(id) ON DELETE CASCADE,
  request_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'accepted',
  requester_account_id UUID,
  target_account_id UUID NOT NULL,
  legal_hold_blocked BOOLEAN NOT NULL DEFAULT false,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  sla_deadline_at TIMESTAMPTZ,
  request_accepted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  escalated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT data_subject_requests_type_chk CHECK (
    request_type IN ('access', 'deletion', 'rectification', 'restriction', 'objection')
  ),
  CONSTRAINT data_subject_requests_status_chk CHECK (
    status IN ('accepted', 'processing', 'blocked_legal_hold', 'completed', 'failed', 'escalated')
  ),
  CONSTRAINT data_subject_requests_target_membership_fk FOREIGN KEY (instance_id, target_account_id)
    REFERENCES iam.instance_memberships(instance_id, account_id) ON DELETE RESTRICT,
  CONSTRAINT data_subject_requests_requester_membership_fk FOREIGN KEY (instance_id, requester_account_id)
    REFERENCES iam.instance_memberships(instance_id, account_id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_data_subject_requests_instance_status
  ON iam.data_subject_requests(instance_id, status, request_accepted_at DESC);
CREATE INDEX IF NOT EXISTS idx_data_subject_requests_sla
  ON iam.data_subject_requests(instance_id, sla_deadline_at)
  WHERE status IN ('accepted', 'processing');

CREATE TABLE IF NOT EXISTS iam.data_subject_request_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id UUID NOT NULL REFERENCES iam.instances(id) ON DELETE CASCADE,
  request_id UUID NOT NULL REFERENCES iam.data_subject_requests(id) ON DELETE CASCADE,
  actor_account_id UUID,
  event_type TEXT NOT NULL,
  event_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT data_subject_request_events_actor_membership_fk FOREIGN KEY (instance_id, actor_account_id)
    REFERENCES iam.instance_memberships(instance_id, account_id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_data_subject_request_events_request
  ON iam.data_subject_request_events(instance_id, request_id, created_at DESC);

CREATE TABLE IF NOT EXISTS iam.data_subject_export_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id UUID NOT NULL REFERENCES iam.instances(id) ON DELETE CASCADE,
  target_account_id UUID NOT NULL,
  requested_by_account_id UUID,
  format TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  error_message TEXT,
  payload_json JSONB,
  payload_csv TEXT,
  payload_xml TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  CONSTRAINT data_subject_export_jobs_format_chk CHECK (format IN ('json', 'csv', 'xml')),
  CONSTRAINT data_subject_export_jobs_status_chk CHECK (status IN ('queued', 'processing', 'completed', 'failed')),
  CONSTRAINT data_subject_export_jobs_target_membership_fk FOREIGN KEY (instance_id, target_account_id)
    REFERENCES iam.instance_memberships(instance_id, account_id) ON DELETE RESTRICT,
  CONSTRAINT data_subject_export_jobs_requester_membership_fk FOREIGN KEY (instance_id, requested_by_account_id)
    REFERENCES iam.instance_memberships(instance_id, account_id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_data_subject_export_jobs_instance_status
  ON iam.data_subject_export_jobs(instance_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS iam.legal_holds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id UUID NOT NULL REFERENCES iam.instances(id) ON DELETE CASCADE,
  account_id UUID NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  hold_reason TEXT NOT NULL,
  hold_until TIMESTAMPTZ,
  lifted_reason TEXT,
  created_by_account_id UUID,
  lifted_by_account_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  lifted_at TIMESTAMPTZ,
  CONSTRAINT legal_holds_account_membership_fk FOREIGN KEY (instance_id, account_id)
    REFERENCES iam.instance_memberships(instance_id, account_id) ON DELETE RESTRICT,
  CONSTRAINT legal_holds_creator_membership_fk FOREIGN KEY (instance_id, created_by_account_id)
    REFERENCES iam.instance_memberships(instance_id, account_id) ON DELETE SET NULL,
  CONSTRAINT legal_holds_lifter_membership_fk FOREIGN KEY (instance_id, lifted_by_account_id)
    REFERENCES iam.instance_memberships(instance_id, account_id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_legal_holds_instance_account_active
  ON iam.legal_holds(instance_id, account_id, active);

CREATE TABLE IF NOT EXISTS iam.account_profile_corrections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id UUID NOT NULL REFERENCES iam.instances(id) ON DELETE CASCADE,
  account_id UUID NOT NULL,
  actor_account_id UUID,
  previous_email_ciphertext TEXT,
  previous_display_name_ciphertext TEXT,
  next_email_ciphertext TEXT,
  next_display_name_ciphertext TEXT,
  correction_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT account_profile_corrections_account_membership_fk FOREIGN KEY (instance_id, account_id)
    REFERENCES iam.instance_memberships(instance_id, account_id) ON DELETE RESTRICT,
  CONSTRAINT account_profile_corrections_actor_membership_fk FOREIGN KEY (instance_id, actor_account_id)
    REFERENCES iam.instance_memberships(instance_id, account_id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_account_profile_corrections_instance_account
  ON iam.account_profile_corrections(instance_id, account_id, created_at DESC);

CREATE TABLE IF NOT EXISTS iam.data_subject_recipient_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id UUID NOT NULL REFERENCES iam.instances(id) ON DELETE CASCADE,
  request_id UUID NOT NULL REFERENCES iam.data_subject_requests(id) ON DELETE CASCADE,
  recipient_class TEXT NOT NULL,
  notification_status TEXT NOT NULL DEFAULT 'pending',
  notification_result TEXT,
  notified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT data_subject_recipient_notifications_status_chk CHECK (
    notification_status IN ('pending', 'sent', 'skipped')
  ),
  CONSTRAINT data_subject_recipient_notifications_unique UNIQUE (instance_id, request_id, recipient_class)
);

CREATE INDEX IF NOT EXISTS idx_data_subject_recipient_notifications_request
  ON iam.data_subject_recipient_notifications(instance_id, request_id, created_at DESC);

ALTER TABLE iam.data_subject_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE iam.data_subject_requests FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS data_subject_requests_isolation_policy ON iam.data_subject_requests;
CREATE POLICY data_subject_requests_isolation_policy
  ON iam.data_subject_requests
  USING (instance_id = iam.current_instance_id())
  WITH CHECK (instance_id = iam.current_instance_id());

ALTER TABLE iam.data_subject_request_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE iam.data_subject_request_events FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS data_subject_request_events_isolation_policy ON iam.data_subject_request_events;
CREATE POLICY data_subject_request_events_isolation_policy
  ON iam.data_subject_request_events
  USING (instance_id = iam.current_instance_id())
  WITH CHECK (instance_id = iam.current_instance_id());

ALTER TABLE iam.data_subject_export_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE iam.data_subject_export_jobs FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS data_subject_export_jobs_isolation_policy ON iam.data_subject_export_jobs;
CREATE POLICY data_subject_export_jobs_isolation_policy
  ON iam.data_subject_export_jobs
  USING (instance_id = iam.current_instance_id())
  WITH CHECK (instance_id = iam.current_instance_id());

ALTER TABLE iam.legal_holds ENABLE ROW LEVEL SECURITY;
ALTER TABLE iam.legal_holds FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS legal_holds_isolation_policy ON iam.legal_holds;
CREATE POLICY legal_holds_isolation_policy
  ON iam.legal_holds
  USING (instance_id = iam.current_instance_id())
  WITH CHECK (instance_id = iam.current_instance_id());

ALTER TABLE iam.account_profile_corrections ENABLE ROW LEVEL SECURITY;
ALTER TABLE iam.account_profile_corrections FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS account_profile_corrections_isolation_policy ON iam.account_profile_corrections;
CREATE POLICY account_profile_corrections_isolation_policy
  ON iam.account_profile_corrections
  USING (instance_id = iam.current_instance_id())
  WITH CHECK (instance_id = iam.current_instance_id());

ALTER TABLE iam.data_subject_recipient_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE iam.data_subject_recipient_notifications FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS data_subject_recipient_notifications_isolation_policy ON iam.data_subject_recipient_notifications;
CREATE POLICY data_subject_recipient_notifications_isolation_policy
  ON iam.data_subject_recipient_notifications
  USING (instance_id = iam.current_instance_id())
  WITH CHECK (instance_id = iam.current_instance_id());


-- packages/data/migrations/0004_iam_account_profile.sql

ALTER TABLE iam.instances
  ADD COLUMN IF NOT EXISTS retention_days INTEGER NOT NULL DEFAULT 90,
  ADD COLUMN IF NOT EXISTS audit_retention_days INTEGER NOT NULL DEFAULT 365;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'instances_retention_days_positive_chk'
      AND conrelid = 'iam.instances'::regclass
  ) THEN
    ALTER TABLE iam.instances
      ADD CONSTRAINT instances_retention_days_positive_chk CHECK (retention_days > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'instances_audit_retention_days_positive_chk'
      AND conrelid = 'iam.instances'::regclass
  ) THEN
    ALTER TABLE iam.instances
      ADD CONSTRAINT instances_audit_retention_days_positive_chk CHECK (audit_retention_days > 0);
  END IF;
END
$$;

ALTER TABLE iam.roles
  ADD COLUMN IF NOT EXISTS role_level INTEGER NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'roles_role_level_range_chk'
      AND conrelid = 'iam.roles'::regclass
  ) THEN
    ALTER TABLE iam.roles
      ADD CONSTRAINT roles_role_level_range_chk CHECK (role_level BETWEEN 0 AND 100);
  END IF;
END
$$;

ALTER TABLE iam.accounts
  ADD COLUMN IF NOT EXISTS instance_id UUID REFERENCES iam.instances(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS first_name_ciphertext TEXT,
  ADD COLUMN IF NOT EXISTS last_name_ciphertext TEXT,
  ADD COLUMN IF NOT EXISTS phone_ciphertext TEXT,
  ADD COLUMN IF NOT EXISTS position TEXT,
  ADD COLUMN IF NOT EXISTS department TEXT,
  ADD COLUMN IF NOT EXISTS avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS preferred_language TEXT,
  ADD COLUMN IF NOT EXISTS timezone TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS notes TEXT;

UPDATE iam.accounts AS account
SET instance_id = membership.instance_id
FROM (
  SELECT
    account_id,
    (ARRAY_AGG(DISTINCT instance_id))[1] AS instance_id,
    COUNT(DISTINCT instance_id) AS instance_count
  FROM iam.instance_memberships
  GROUP BY account_id
) AS membership
WHERE account.id = membership.account_id
  AND account.instance_id IS NULL
  AND membership.instance_count = 1;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'accounts_status_chk'
      AND conrelid = 'iam.accounts'::regclass
  ) THEN
    ALTER TABLE iam.accounts
      ADD CONSTRAINT accounts_status_chk CHECK (status IN ('pending', 'active', 'inactive'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'accounts_notes_length_chk'
      AND conrelid = 'iam.accounts'::regclass
  ) THEN
    ALTER TABLE iam.accounts
      ADD CONSTRAINT accounts_notes_length_chk CHECK (char_length(notes) <= 2000);
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'accounts_keycloak_subject_key'
      AND conrelid = 'iam.accounts'::regclass
  ) THEN
    ALTER TABLE iam.accounts DROP CONSTRAINT accounts_keycloak_subject_key;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_accounts_status
  ON iam.accounts(status);

CREATE INDEX IF NOT EXISTS idx_accounts_keycloak_subject
  ON iam.accounts(keycloak_subject);

CREATE UNIQUE INDEX IF NOT EXISTS idx_accounts_kc_subject_instance
  ON iam.accounts(keycloak_subject, instance_id)
  WHERE instance_id IS NOT NULL;

ALTER TABLE iam.account_roles
  ADD COLUMN IF NOT EXISTS assigned_by UUID REFERENCES iam.accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS valid_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS valid_to TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'account_roles_valid_window_chk'
      AND conrelid = 'iam.account_roles'::regclass
  ) THEN
    ALTER TABLE iam.account_roles
      ADD CONSTRAINT account_roles_valid_window_chk CHECK (valid_to IS NULL OR valid_to > valid_from);
  END IF;
END
$$;

ALTER TABLE iam.activity_logs
  ADD COLUMN IF NOT EXISTS subject_id UUID REFERENCES iam.accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS result TEXT NOT NULL DEFAULT 'success';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'activity_logs_result_chk'
      AND conrelid = 'iam.activity_logs'::regclass
  ) THEN
    ALTER TABLE iam.activity_logs
      ADD CONSTRAINT activity_logs_result_chk CHECK (result IN ('success', 'failure'));
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_activity_logs_subject_created
  ON iam.activity_logs(instance_id, subject_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_activity_logs_account_created
  ON iam.activity_logs(instance_id, account_id, created_at DESC);

CREATE OR REPLACE FUNCTION iam.prevent_activity_logs_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' AND current_setting('iam.retention_mode', true) = 'true' THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'iam.activity_logs is immutable';
END;
$$;

DROP TRIGGER IF EXISTS trg_immutable_activity_logs ON iam.activity_logs;
CREATE TRIGGER trg_immutable_activity_logs
BEFORE UPDATE OR DELETE ON iam.activity_logs
FOR EACH ROW
EXECUTE FUNCTION iam.prevent_activity_logs_mutation();


-- packages/data/migrations/0005_iam_idempotency_keys.sql

CREATE TABLE IF NOT EXISTS iam.idempotency_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id UUID NOT NULL REFERENCES iam.instances(id) ON DELETE CASCADE,
  actor_account_id UUID NOT NULL,
  endpoint TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'IN_PROGRESS',
  response_status INTEGER,
  response_body JSONB,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT idempotency_keys_status_chk CHECK (status IN ('IN_PROGRESS', 'COMPLETED', 'FAILED')),
  CONSTRAINT idempotency_keys_actor_membership_fk FOREIGN KEY (instance_id, actor_account_id)
    REFERENCES iam.instance_memberships(instance_id, account_id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_idempotency_keys_scope
  ON iam.idempotency_keys(actor_account_id, endpoint, idempotency_key);

CREATE INDEX IF NOT EXISTS idx_idempotency_keys_expires_at
  ON iam.idempotency_keys(expires_at);

ALTER TABLE iam.idempotency_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE iam.idempotency_keys FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS idempotency_keys_isolation_policy ON iam.idempotency_keys;
CREATE POLICY idempotency_keys_isolation_policy
  ON iam.idempotency_keys
  USING (instance_id = iam.current_instance_id())
  WITH CHECK (instance_id = iam.current_instance_id());


-- packages/data/migrations/0006_iam_activity_log_archive.sql

CREATE TABLE IF NOT EXISTS iam.activity_logs_archive (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id UUID NOT NULL REFERENCES iam.instances(id) ON DELETE CASCADE,
  activity_log_id UUID NOT NULL,
  account_id UUID,
  subject_id UUID,
  event_type TEXT NOT NULL,
  result TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  request_id TEXT,
  trace_id TEXT,
  original_created_at TIMESTAMPTZ NOT NULL,
  archived_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT activity_logs_archive_activity_log_unique UNIQUE (activity_log_id),
  CONSTRAINT activity_logs_archive_result_chk CHECK (result IN ('success', 'failure'))
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_archive_instance_created
  ON iam.activity_logs_archive(instance_id, original_created_at DESC);

ALTER TABLE iam.activity_logs_archive ENABLE ROW LEVEL SECURITY;
ALTER TABLE iam.activity_logs_archive FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS activity_logs_archive_isolation_policy ON iam.activity_logs_archive;
CREATE POLICY activity_logs_archive_isolation_policy
  ON iam.activity_logs_archive
  USING (instance_id = iam.current_instance_id())
  WITH CHECK (instance_id = iam.current_instance_id());


-- packages/data/migrations/0007_iam_role_catalog_sync.sql

ALTER TABLE iam.roles
  ADD COLUMN IF NOT EXISTS role_key TEXT,
  ADD COLUMN IF NOT EXISTS display_name TEXT,
  ADD COLUMN IF NOT EXISTS external_role_name TEXT,
  ADD COLUMN IF NOT EXISTS managed_by TEXT,
  ADD COLUMN IF NOT EXISTS sync_state TEXT,
  ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_error_code TEXT;

UPDATE iam.roles
SET
  role_key = COALESCE(role_key, role_name),
  display_name = COALESCE(display_name, role_name),
  external_role_name = COALESCE(external_role_name, role_name),
  managed_by = COALESCE(managed_by, 'studio'),
  sync_state = COALESCE(sync_state, 'pending')
WHERE
  role_key IS NULL
  OR display_name IS NULL
  OR external_role_name IS NULL
  OR managed_by IS NULL
  OR sync_state IS NULL;

ALTER TABLE iam.roles
  ALTER COLUMN role_key SET NOT NULL,
  ALTER COLUMN display_name SET NOT NULL,
  ALTER COLUMN external_role_name SET NOT NULL,
  ALTER COLUMN managed_by SET NOT NULL,
  ALTER COLUMN managed_by SET DEFAULT 'studio',
  ALTER COLUMN sync_state SET NOT NULL,
  ALTER COLUMN sync_state SET DEFAULT 'pending';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'roles_sync_state_chk'
      AND conrelid = 'iam.roles'::regclass
  ) THEN
    ALTER TABLE iam.roles
      ADD CONSTRAINT roles_sync_state_chk CHECK (sync_state IN ('synced', 'pending', 'failed'));
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'roles_managed_by_chk'
      AND conrelid = 'iam.roles'::regclass
  ) THEN
    ALTER TABLE iam.roles
      ADD CONSTRAINT roles_managed_by_chk CHECK (managed_by IN ('studio', 'external'));
  END IF;
END
$$;

ALTER TABLE iam.roles
  DROP CONSTRAINT IF EXISTS roles_instance_name_uniq;

CREATE UNIQUE INDEX IF NOT EXISTS uq_roles_instance_role_key
  ON iam.roles(instance_id, role_key);

CREATE UNIQUE INDEX IF NOT EXISTS uq_roles_instance_external_role_name
  ON iam.roles(instance_id, external_role_name);

CREATE INDEX IF NOT EXISTS idx_roles_instance_sync_state
  ON iam.roles(instance_id, sync_state, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_roles_managed_scope
  ON iam.roles(instance_id, managed_by, external_role_name);


-- packages/data/migrations/0008_iam_idempotency_scope.sql

DROP INDEX IF EXISTS uq_idempotency_keys_scope;

CREATE UNIQUE INDEX IF NOT EXISTS uq_idempotency_keys_scope
  ON iam.idempotency_keys(instance_id, actor_account_id, endpoint, idempotency_key);


-- packages/data/migrations/0009_iam_organization_management.sql

ALTER TABLE iam.organizations
  ADD COLUMN IF NOT EXISTS parent_organization_id UUID,
  ADD COLUMN IF NOT EXISTS organization_type TEXT NOT NULL DEFAULT 'other',
  ADD COLUMN IF NOT EXISTS content_author_policy TEXT NOT NULL DEFAULT 'org_only',
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS hierarchy_path UUID[] NOT NULL DEFAULT ARRAY[]::uuid[],
  ADD COLUMN IF NOT EXISTS depth INTEGER NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'organizations_parent_fk'
      AND conrelid = 'iam.organizations'::regclass
  ) THEN
    ALTER TABLE iam.organizations
      ADD CONSTRAINT organizations_parent_fk
      FOREIGN KEY (instance_id, parent_organization_id)
      REFERENCES iam.organizations (instance_id, id)
      ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'organizations_parent_not_self_chk'
      AND conrelid = 'iam.organizations'::regclass
  ) THEN
    ALTER TABLE iam.organizations
      ADD CONSTRAINT organizations_parent_not_self_chk
      CHECK (parent_organization_id IS NULL OR parent_organization_id <> id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'organizations_type_chk'
      AND conrelid = 'iam.organizations'::regclass
  ) THEN
    ALTER TABLE iam.organizations
      ADD CONSTRAINT organizations_type_chk
      CHECK (organization_type IN ('county', 'municipality', 'district', 'company', 'agency', 'other'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'organizations_content_author_policy_chk'
      AND conrelid = 'iam.organizations'::regclass
  ) THEN
    ALTER TABLE iam.organizations
      ADD CONSTRAINT organizations_content_author_policy_chk
      CHECK (content_author_policy IN ('org_only', 'org_or_personal'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'organizations_depth_nonnegative_chk'
      AND conrelid = 'iam.organizations'::regclass
  ) THEN
    ALTER TABLE iam.organizations
      ADD CONSTRAINT organizations_depth_nonnegative_chk
      CHECK (depth >= 0);
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_organizations_parent
  ON iam.organizations(instance_id, parent_organization_id);

CREATE INDEX IF NOT EXISTS idx_organizations_type_active
  ON iam.organizations(instance_id, organization_type, is_active);

ALTER TABLE iam.account_organizations
  ADD COLUMN IF NOT EXISTS is_default_context BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS membership_visibility TEXT NOT NULL DEFAULT 'internal';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'account_organizations_visibility_chk'
      AND conrelid = 'iam.account_organizations'::regclass
  ) THEN
    ALTER TABLE iam.account_organizations
      ADD CONSTRAINT account_organizations_visibility_chk
      CHECK (membership_visibility IN ('internal', 'external'));
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_account_organizations_org_account
  ON iam.account_organizations(instance_id, organization_id, account_id);

WITH ranked_memberships AS (
  SELECT
    instance_id,
    account_id,
    organization_id,
    ROW_NUMBER() OVER (PARTITION BY instance_id, account_id ORDER BY created_at ASC, organization_id ASC) AS membership_rank
  FROM iam.account_organizations
)
UPDATE iam.account_organizations AS membership
SET is_default_context = false
WHERE membership.is_default_context;

WITH ranked_memberships AS (
  SELECT
    instance_id,
    account_id,
    organization_id,
    ROW_NUMBER() OVER (PARTITION BY instance_id, account_id ORDER BY created_at ASC, organization_id ASC) AS membership_rank
  FROM iam.account_organizations
)
UPDATE iam.account_organizations AS membership
SET is_default_context = true
FROM ranked_memberships
WHERE membership.instance_id = ranked_memberships.instance_id
  AND membership.account_id = ranked_memberships.account_id
  AND membership.organization_id = ranked_memberships.organization_id
  AND ranked_memberships.membership_rank = 1;

CREATE UNIQUE INDEX IF NOT EXISTS uq_account_organizations_default_context
  ON iam.account_organizations(instance_id, account_id)
  WHERE is_default_context;

UPDATE iam.organizations
SET
  hierarchy_path = ARRAY[]::uuid[],
  depth = 0
WHERE parent_organization_id IS NULL;

WITH RECURSIVE organization_tree AS (
  SELECT
    organization.id,
    organization.instance_id,
    organization.parent_organization_id,
    ARRAY[]::uuid[] AS hierarchy_path,
    0 AS depth
  FROM iam.organizations AS organization
  WHERE organization.parent_organization_id IS NULL

  UNION ALL

  SELECT
    child.id,
    child.instance_id,
    child.parent_organization_id,
    organization_tree.hierarchy_path || child.parent_organization_id,
    organization_tree.depth + 1
  FROM iam.organizations AS child
  JOIN organization_tree
    ON organization_tree.instance_id = child.instance_id
   AND organization_tree.id = child.parent_organization_id
)
UPDATE iam.organizations AS organization
SET
  hierarchy_path = organization_tree.hierarchy_path,
  depth = organization_tree.depth
FROM organization_tree
WHERE organization.id = organization_tree.id
  AND organization.instance_id = organization_tree.instance_id;


-- packages/data/migrations/0010_iam_structured_permissions.sql

ALTER TABLE iam.permissions
  ADD COLUMN IF NOT EXISTS action TEXT,
  ADD COLUMN IF NOT EXISTS resource_type TEXT,
  ADD COLUMN IF NOT EXISTS resource_id TEXT,
  ADD COLUMN IF NOT EXISTS effect TEXT NOT NULL DEFAULT 'allow',
  ADD COLUMN IF NOT EXISTS scope JSONB NOT NULL DEFAULT '{}'::jsonb;

UPDATE iam.permissions
SET
  action = COALESCE(NULLIF(action, ''), permission_key),
  resource_type = COALESCE(NULLIF(resource_type, ''), split_part(permission_key, '.', 1)),
  scope = COALESCE(scope, '{}'::jsonb)
WHERE action IS NULL
   OR action = ''
   OR resource_type IS NULL
   OR resource_type = ''
   OR scope IS NULL;

ALTER TABLE iam.permissions
  ALTER COLUMN action SET NOT NULL,
  ALTER COLUMN resource_type SET NOT NULL,
  ALTER COLUMN effect SET DEFAULT 'allow',
  ALTER COLUMN scope SET DEFAULT '{}'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'permissions_effect_chk'
      AND conrelid = 'iam.permissions'::regclass
  ) THEN
    ALTER TABLE iam.permissions
      ADD CONSTRAINT permissions_effect_chk
      CHECK (effect IN ('allow', 'deny'));
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_permissions_instance_action_resource_effect
  ON iam.permissions(instance_id, action, resource_type, effect);


-- packages/data/migrations/0011_iam_account_username.sql

ALTER TABLE iam.accounts
  ADD COLUMN IF NOT EXISTS username_ciphertext TEXT;


-- packages/data/migrations/0012_iam_instance_id_text_scope.sql

DROP TRIGGER IF EXISTS trg_immutable_activity_logs ON iam.activity_logs;

DO $$
DECLARE
  current_table_name TEXT;
  instance_id_source_expression TEXT;
  requires_instance_migration BOOLEAN;
BEGIN
  SELECT CASE
    WHEN EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'iam'
        AND table_name = 'instances'
        AND column_name = 'instance_key'
    ) THEN 'instance.instance_key'
    ELSE 'instance.id'
  END
  INTO instance_id_source_expression;

  FOREACH current_table_name IN ARRAY ARRAY[
    'accounts',
    'organizations',
    'roles',
    'permissions',
    'instance_memberships',
    'account_organizations',
    'account_roles',
    'role_permissions',
    'activity_logs',
    'permission_change_requests',
    'delegations',
    'impersonation_sessions',
    'legal_text_versions',
    'legal_text_acceptances',
    'data_subject_requests',
    'data_subject_request_events',
    'data_subject_export_jobs',
    'legal_holds',
    'account_profile_corrections',
    'data_subject_recipient_notifications',
    'idempotency_keys',
    'activity_logs_archive'
  ] LOOP
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'iam'
        AND table_name = current_table_name
        AND column_name = 'instance_id'
        AND udt_name <> 'text'
    )
    INTO requires_instance_migration;

    IF requires_instance_migration THEN
      EXECUTE format('ALTER TABLE iam.%I ADD COLUMN IF NOT EXISTS instance_id_v2 TEXT;', current_table_name);
      EXECUTE format(
        'UPDATE iam.%I AS target
         SET instance_id_v2 = %s
         FROM iam.instances AS instance
         WHERE target.instance_id IS NOT NULL
           AND instance.id = target.instance_id
           AND target.instance_id_v2 IS NULL;',
        current_table_name,
        instance_id_source_expression
      );
    END IF;
  END LOOP;
END
$$;

CREATE TRIGGER trg_immutable_activity_logs
BEFORE UPDATE OR DELETE ON iam.activity_logs
FOR EACH ROW
EXECUTE FUNCTION iam.prevent_activity_logs_mutation();

DROP POLICY IF EXISTS instances_isolation_policy ON iam.instances;
DROP POLICY IF EXISTS accounts_isolation_policy ON iam.accounts;
DROP POLICY IF EXISTS organizations_isolation_policy ON iam.organizations;
DROP POLICY IF EXISTS roles_isolation_policy ON iam.roles;
DROP POLICY IF EXISTS permissions_isolation_policy ON iam.permissions;
DROP POLICY IF EXISTS instance_memberships_isolation_policy ON iam.instance_memberships;
DROP POLICY IF EXISTS account_organizations_isolation_policy ON iam.account_organizations;
DROP POLICY IF EXISTS account_roles_isolation_policy ON iam.account_roles;
DROP POLICY IF EXISTS role_permissions_isolation_policy ON iam.role_permissions;
DROP POLICY IF EXISTS activity_logs_isolation_policy ON iam.activity_logs;
DROP POLICY IF EXISTS permission_change_requests_isolation_policy ON iam.permission_change_requests;
DROP POLICY IF EXISTS delegations_isolation_policy ON iam.delegations;
DROP POLICY IF EXISTS impersonation_sessions_isolation_policy ON iam.impersonation_sessions;
DROP POLICY IF EXISTS legal_text_versions_isolation_policy ON iam.legal_text_versions;
DROP POLICY IF EXISTS legal_text_acceptances_isolation_policy ON iam.legal_text_acceptances;
DROP POLICY IF EXISTS data_subject_requests_isolation_policy ON iam.data_subject_requests;
DROP POLICY IF EXISTS data_subject_request_events_isolation_policy ON iam.data_subject_request_events;
DROP POLICY IF EXISTS data_subject_export_jobs_isolation_policy ON iam.data_subject_export_jobs;
DROP POLICY IF EXISTS legal_holds_isolation_policy ON iam.legal_holds;
DROP POLICY IF EXISTS account_profile_corrections_isolation_policy ON iam.account_profile_corrections;
DROP POLICY IF EXISTS data_subject_recipient_notifications_isolation_policy ON iam.data_subject_recipient_notifications;
DROP POLICY IF EXISTS idempotency_keys_isolation_policy ON iam.idempotency_keys;
DROP POLICY IF EXISTS activity_logs_archive_isolation_policy ON iam.activity_logs_archive;
DROP POLICY IF EXISTS instance_integrations_isolation_policy ON iam.instance_integrations;

ALTER TABLE iam.organizations
  DROP CONSTRAINT IF EXISTS organizations_instance_key_uniq,
  DROP CONSTRAINT IF EXISTS organizations_instance_id_fkey;

ALTER TABLE iam.account_organizations
  DROP CONSTRAINT IF EXISTS account_organizations_pkey,
  DROP CONSTRAINT IF EXISTS account_org_membership_fk,
  DROP CONSTRAINT IF EXISTS account_org_organization_fk;

ALTER TABLE iam.account_roles
  DROP CONSTRAINT IF EXISTS account_roles_pkey,
  DROP CONSTRAINT IF EXISTS account_roles_membership_fk,
  DROP CONSTRAINT IF EXISTS account_roles_role_fk;

ALTER TABLE iam.role_permissions
  DROP CONSTRAINT IF EXISTS role_permissions_pkey,
  DROP CONSTRAINT IF EXISTS role_permissions_role_fk,
  DROP CONSTRAINT IF EXISTS role_permissions_permission_fk;

ALTER TABLE iam.activity_logs
  DROP CONSTRAINT IF EXISTS activity_logs_instance_id_fkey;
DROP INDEX IF EXISTS iam.idx_activity_logs_instance_id_created_at;
DROP INDEX IF EXISTS iam.idx_activity_logs_subject_created;
DROP INDEX IF EXISTS iam.idx_activity_logs_account_created;

ALTER TABLE iam.accounts
  DROP CONSTRAINT IF EXISTS accounts_instance_id_fkey;
DROP INDEX IF EXISTS iam.idx_accounts_kc_subject_instance;

ALTER TABLE iam.permission_change_requests
  DROP CONSTRAINT IF EXISTS permission_change_requests_instance_id_fkey,
  DROP CONSTRAINT IF EXISTS permission_change_requests_membership_requester_fk,
  DROP CONSTRAINT IF EXISTS permission_change_requests_membership_target_fk,
  DROP CONSTRAINT IF EXISTS permission_change_requests_role_fk;
DROP INDEX IF EXISTS iam.idx_permission_change_requests_instance_status;

ALTER TABLE iam.delegations
  DROP CONSTRAINT IF EXISTS delegations_instance_id_fkey,
  DROP CONSTRAINT IF EXISTS delegations_membership_delegator_fk,
  DROP CONSTRAINT IF EXISTS delegations_membership_delegatee_fk,
  DROP CONSTRAINT IF EXISTS delegations_role_fk;
DROP INDEX IF EXISTS iam.idx_delegations_instance_delegatee_active;

ALTER TABLE iam.impersonation_sessions
  DROP CONSTRAINT IF EXISTS impersonation_sessions_instance_id_fkey,
  DROP CONSTRAINT IF EXISTS impersonation_sessions_membership_actor_fk,
  DROP CONSTRAINT IF EXISTS impersonation_sessions_membership_target_fk;
DROP INDEX IF EXISTS iam.idx_impersonation_sessions_instance_actor_status;

ALTER TABLE iam.legal_text_versions
  DROP CONSTRAINT IF EXISTS legal_text_versions_instance_id_fkey,
  DROP CONSTRAINT IF EXISTS legal_text_versions_instance_unique;

ALTER TABLE iam.legal_text_acceptances
  DROP CONSTRAINT IF EXISTS legal_text_acceptances_instance_id_fkey,
  DROP CONSTRAINT IF EXISTS legal_text_acceptances_membership_fk,
  DROP CONSTRAINT IF EXISTS legal_text_acceptances_unique;
DROP INDEX IF EXISTS iam.idx_legal_text_acceptances_instance_account;

ALTER TABLE iam.data_subject_requests
  DROP CONSTRAINT IF EXISTS data_subject_requests_instance_id_fkey,
  DROP CONSTRAINT IF EXISTS data_subject_requests_target_membership_fk,
  DROP CONSTRAINT IF EXISTS data_subject_requests_requester_membership_fk;
DROP INDEX IF EXISTS iam.idx_data_subject_requests_instance_status;
DROP INDEX IF EXISTS iam.idx_data_subject_requests_sla;

ALTER TABLE iam.data_subject_request_events
  DROP CONSTRAINT IF EXISTS data_subject_request_events_instance_id_fkey,
  DROP CONSTRAINT IF EXISTS data_subject_request_events_actor_membership_fk;
DROP INDEX IF EXISTS iam.idx_data_subject_request_events_request;

ALTER TABLE iam.data_subject_export_jobs
  DROP CONSTRAINT IF EXISTS data_subject_export_jobs_instance_id_fkey,
  DROP CONSTRAINT IF EXISTS data_subject_export_jobs_target_membership_fk,
  DROP CONSTRAINT IF EXISTS data_subject_export_jobs_requester_membership_fk;
DROP INDEX IF EXISTS iam.idx_data_subject_export_jobs_instance_status;

ALTER TABLE iam.legal_holds
  DROP CONSTRAINT IF EXISTS legal_holds_instance_id_fkey,
  DROP CONSTRAINT IF EXISTS legal_holds_account_membership_fk,
  DROP CONSTRAINT IF EXISTS legal_holds_creator_membership_fk,
  DROP CONSTRAINT IF EXISTS legal_holds_lifter_membership_fk;
DROP INDEX IF EXISTS iam.idx_legal_holds_instance_account_active;

ALTER TABLE iam.account_profile_corrections
  DROP CONSTRAINT IF EXISTS account_profile_corrections_instance_id_fkey,
  DROP CONSTRAINT IF EXISTS account_profile_corrections_account_membership_fk,
  DROP CONSTRAINT IF EXISTS account_profile_corrections_actor_membership_fk;
DROP INDEX IF EXISTS iam.idx_account_profile_corrections_instance_account;

ALTER TABLE iam.data_subject_recipient_notifications
  DROP CONSTRAINT IF EXISTS data_subject_recipient_notifications_instance_id_fkey,
  DROP CONSTRAINT IF EXISTS data_subject_recipient_notifications_unique;
DROP INDEX IF EXISTS iam.idx_data_subject_recipient_notifications_request;

ALTER TABLE iam.idempotency_keys
  DROP CONSTRAINT IF EXISTS idempotency_keys_instance_id_fkey,
  DROP CONSTRAINT IF EXISTS idempotency_keys_actor_membership_fk;

ALTER TABLE iam.instance_memberships
  DROP CONSTRAINT IF EXISTS instance_memberships_pkey,
  DROP CONSTRAINT IF EXISTS instance_memberships_instance_id_fkey;

ALTER TABLE iam.organizations
  DROP CONSTRAINT IF EXISTS organizations_parent_fk;
DROP INDEX IF EXISTS iam.uq_organizations_instance_id_id;
DROP INDEX IF EXISTS iam.idx_organizations_instance_id;

ALTER TABLE iam.roles
  DROP CONSTRAINT IF EXISTS roles_instance_name_uniq,
  DROP CONSTRAINT IF EXISTS roles_instance_id_fkey;
DROP INDEX IF EXISTS iam.uq_roles_instance_id_id;
DROP INDEX IF EXISTS iam.uq_roles_instance_role_key;
DROP INDEX IF EXISTS iam.uq_roles_instance_external_role_name;
DROP INDEX IF EXISTS iam.idx_roles_instance_id;
DROP INDEX IF EXISTS iam.idx_roles_instance_sync_state;
DROP INDEX IF EXISTS iam.idx_roles_managed_scope;

ALTER TABLE iam.permissions
  DROP CONSTRAINT IF EXISTS permissions_instance_key_uniq,
  DROP CONSTRAINT IF EXISTS permissions_instance_id_fkey;
DROP INDEX IF EXISTS iam.uq_permissions_instance_id_id;
DROP INDEX IF EXISTS iam.idx_permissions_instance_id;

ALTER TABLE iam.activity_logs_archive
  DROP CONSTRAINT IF EXISTS activity_logs_archive_instance_id_fkey;
DROP INDEX IF EXISTS iam.idx_activity_logs_archive_instance_created;

ALTER TABLE IF EXISTS iam.instance_integrations
  DROP CONSTRAINT IF EXISTS instance_integrations_instance_id_fkey;
DROP INDEX IF EXISTS iam.idx_instance_integrations_instance_provider;

ALTER TABLE iam.instances
  DROP CONSTRAINT IF EXISTS instances_pkey;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'iam'
      AND table_name = 'instances'
      AND column_name = 'instance_key'
  ) THEN
    ALTER TABLE iam.instances
      ALTER COLUMN id DROP DEFAULT,
      ALTER COLUMN id TYPE TEXT USING instance_key;

    ALTER TABLE iam.instances
      DROP COLUMN IF EXISTS instance_key;
  ELSE
    ALTER TABLE iam.instances
      ALTER COLUMN id DROP DEFAULT;
  END IF;
END
$$;

ALTER TABLE iam.instances
  ADD CONSTRAINT instances_pkey PRIMARY KEY (id);

DO $$
DECLARE
  current_table_name TEXT;
BEGIN
  FOREACH current_table_name IN ARRAY ARRAY[
    'accounts',
    'organizations',
    'roles',
    'permissions',
    'instance_memberships',
    'account_organizations',
    'account_roles',
    'role_permissions',
    'activity_logs',
    'permission_change_requests',
    'delegations',
    'impersonation_sessions',
    'legal_text_versions',
    'legal_text_acceptances',
    'data_subject_requests',
    'data_subject_request_events',
    'data_subject_export_jobs',
    'legal_holds',
    'account_profile_corrections',
    'data_subject_recipient_notifications',
    'idempotency_keys',
    'activity_logs_archive'
  ] LOOP
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'iam'
        AND table_name = current_table_name
        AND column_name = 'instance_id_v2'
    ) THEN
      EXECUTE format('ALTER TABLE iam.%I DROP COLUMN IF EXISTS instance_id;', current_table_name);
      EXECUTE format('ALTER TABLE iam.%I RENAME COLUMN instance_id_v2 TO instance_id;', current_table_name);
    END IF;
  END LOOP;

  FOREACH current_table_name IN ARRAY ARRAY[
    'organizations',
    'roles',
    'permissions',
    'instance_memberships',
    'account_organizations',
    'account_roles',
    'role_permissions',
    'activity_logs',
    'permission_change_requests',
    'delegations',
    'impersonation_sessions',
    'legal_text_versions',
    'legal_text_acceptances',
    'data_subject_requests',
    'data_subject_request_events',
    'data_subject_export_jobs',
    'legal_holds',
    'account_profile_corrections',
    'data_subject_recipient_notifications',
    'idempotency_keys',
    'activity_logs_archive'
  ] LOOP
    EXECUTE format('ALTER TABLE iam.%I ALTER COLUMN instance_id SET NOT NULL;', current_table_name);
  END LOOP;
END
$$;

ALTER TABLE iam.accounts
  ADD CONSTRAINT accounts_instance_id_fkey FOREIGN KEY (instance_id)
    REFERENCES iam.instances(id) ON DELETE CASCADE;
CREATE UNIQUE INDEX IF NOT EXISTS idx_accounts_kc_subject_instance
  ON iam.accounts(keycloak_subject, instance_id)
  WHERE instance_id IS NOT NULL;

ALTER TABLE iam.organizations
  ADD CONSTRAINT organizations_instance_key_uniq UNIQUE (instance_id, organization_key);
CREATE UNIQUE INDEX IF NOT EXISTS uq_organizations_instance_id_id
  ON iam.organizations(instance_id, id);
CREATE INDEX IF NOT EXISTS idx_organizations_instance_id
  ON iam.organizations(instance_id);
ALTER TABLE iam.organizations
  ADD CONSTRAINT organizations_instance_id_fkey FOREIGN KEY (instance_id)
    REFERENCES iam.instances(id) ON DELETE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS uq_roles_instance_id_id
  ON iam.roles(instance_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_roles_instance_role_key
  ON iam.roles(instance_id, role_key);
CREATE UNIQUE INDEX IF NOT EXISTS uq_roles_instance_external_role_name
  ON iam.roles(instance_id, external_role_name);
CREATE INDEX IF NOT EXISTS idx_roles_instance_id
  ON iam.roles(instance_id);
CREATE INDEX IF NOT EXISTS idx_roles_instance_sync_state
  ON iam.roles(instance_id, sync_state, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_roles_managed_scope
  ON iam.roles(instance_id, managed_by, external_role_name);
ALTER TABLE iam.roles
  ADD CONSTRAINT roles_instance_id_fkey FOREIGN KEY (instance_id)
    REFERENCES iam.instances(id) ON DELETE CASCADE;

ALTER TABLE iam.permissions
  ADD CONSTRAINT permissions_instance_key_uniq UNIQUE (instance_id, permission_key);
CREATE UNIQUE INDEX IF NOT EXISTS uq_permissions_instance_id_id
  ON iam.permissions(instance_id, id);
CREATE INDEX IF NOT EXISTS idx_permissions_instance_id
  ON iam.permissions(instance_id);
ALTER TABLE iam.permissions
  ADD CONSTRAINT permissions_instance_id_fkey FOREIGN KEY (instance_id)
    REFERENCES iam.instances(id) ON DELETE CASCADE;

ALTER TABLE iam.instance_memberships
  ADD CONSTRAINT instance_memberships_pkey PRIMARY KEY (instance_id, account_id),
  ADD CONSTRAINT instance_memberships_instance_id_fkey FOREIGN KEY (instance_id)
    REFERENCES iam.instances(id) ON DELETE CASCADE;

ALTER TABLE iam.account_organizations
  ADD CONSTRAINT account_organizations_pkey PRIMARY KEY (instance_id, account_id, organization_id),
  ADD CONSTRAINT account_org_membership_fk FOREIGN KEY (instance_id, account_id)
    REFERENCES iam.instance_memberships(instance_id, account_id) ON DELETE CASCADE,
  ADD CONSTRAINT account_org_organization_fk FOREIGN KEY (instance_id, organization_id)
    REFERENCES iam.organizations(instance_id, id) ON DELETE CASCADE;

ALTER TABLE iam.account_roles
  ADD CONSTRAINT account_roles_pkey PRIMARY KEY (instance_id, account_id, role_id),
  ADD CONSTRAINT account_roles_membership_fk FOREIGN KEY (instance_id, account_id)
    REFERENCES iam.instance_memberships(instance_id, account_id) ON DELETE CASCADE,
  ADD CONSTRAINT account_roles_role_fk FOREIGN KEY (instance_id, role_id)
    REFERENCES iam.roles(instance_id, id) ON DELETE CASCADE;

ALTER TABLE iam.role_permissions
  ADD CONSTRAINT role_permissions_pkey PRIMARY KEY (instance_id, role_id, permission_id),
  ADD CONSTRAINT role_permissions_role_fk FOREIGN KEY (instance_id, role_id)
    REFERENCES iam.roles(instance_id, id) ON DELETE CASCADE,
  ADD CONSTRAINT role_permissions_permission_fk FOREIGN KEY (instance_id, permission_id)
    REFERENCES iam.permissions(instance_id, id) ON DELETE CASCADE;

ALTER TABLE iam.activity_logs
  ADD CONSTRAINT activity_logs_instance_id_fkey FOREIGN KEY (instance_id)
    REFERENCES iam.instances(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_activity_logs_instance_id_created_at
  ON iam.activity_logs(instance_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_subject_created
  ON iam.activity_logs(instance_id, subject_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_account_created
  ON iam.activity_logs(instance_id, account_id, created_at DESC);

ALTER TABLE iam.permission_change_requests
  ADD CONSTRAINT permission_change_requests_instance_id_fkey FOREIGN KEY (instance_id)
    REFERENCES iam.instances(id) ON DELETE CASCADE,
  ADD CONSTRAINT permission_change_requests_membership_requester_fk FOREIGN KEY (instance_id, requester_account_id)
    REFERENCES iam.instance_memberships(instance_id, account_id) ON DELETE RESTRICT,
  ADD CONSTRAINT permission_change_requests_membership_target_fk FOREIGN KEY (instance_id, target_account_id)
    REFERENCES iam.instance_memberships(instance_id, account_id) ON DELETE RESTRICT,
  ADD CONSTRAINT permission_change_requests_role_fk FOREIGN KEY (instance_id, role_id)
    REFERENCES iam.roles(instance_id, id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS idx_permission_change_requests_instance_status
  ON iam.permission_change_requests(instance_id, status, requested_at DESC);

ALTER TABLE iam.delegations
  ADD CONSTRAINT delegations_instance_id_fkey FOREIGN KEY (instance_id)
    REFERENCES iam.instances(id) ON DELETE CASCADE,
  ADD CONSTRAINT delegations_membership_delegator_fk FOREIGN KEY (instance_id, delegator_account_id)
    REFERENCES iam.instance_memberships(instance_id, account_id) ON DELETE RESTRICT,
  ADD CONSTRAINT delegations_membership_delegatee_fk FOREIGN KEY (instance_id, delegatee_account_id)
    REFERENCES iam.instance_memberships(instance_id, account_id) ON DELETE RESTRICT,
  ADD CONSTRAINT delegations_role_fk FOREIGN KEY (instance_id, role_id)
    REFERENCES iam.roles(instance_id, id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS idx_delegations_instance_delegatee_active
  ON iam.delegations(instance_id, delegatee_account_id, status, starts_at, ends_at);

ALTER TABLE iam.impersonation_sessions
  ADD CONSTRAINT impersonation_sessions_instance_id_fkey FOREIGN KEY (instance_id)
    REFERENCES iam.instances(id) ON DELETE CASCADE,
  ADD CONSTRAINT impersonation_sessions_membership_actor_fk FOREIGN KEY (instance_id, actor_account_id)
    REFERENCES iam.instance_memberships(instance_id, account_id) ON DELETE RESTRICT,
  ADD CONSTRAINT impersonation_sessions_membership_target_fk FOREIGN KEY (instance_id, target_account_id)
    REFERENCES iam.instance_memberships(instance_id, account_id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS idx_impersonation_sessions_instance_actor_status
  ON iam.impersonation_sessions(instance_id, actor_account_id, status, expires_at);

ALTER TABLE iam.legal_text_versions
  ADD CONSTRAINT legal_text_versions_instance_id_fkey FOREIGN KEY (instance_id)
    REFERENCES iam.instances(id) ON DELETE CASCADE,
  ADD CONSTRAINT legal_text_versions_instance_unique UNIQUE (instance_id, legal_text_id, legal_text_version, locale);

ALTER TABLE iam.legal_text_acceptances
  ADD CONSTRAINT legal_text_acceptances_instance_id_fkey FOREIGN KEY (instance_id)
    REFERENCES iam.instances(id) ON DELETE CASCADE,
  ADD CONSTRAINT legal_text_acceptances_membership_fk FOREIGN KEY (instance_id, account_id)
    REFERENCES iam.instance_memberships(instance_id, account_id) ON DELETE RESTRICT,
  ADD CONSTRAINT legal_text_acceptances_unique UNIQUE (instance_id, legal_text_version_id, account_id, accepted_at);
CREATE INDEX IF NOT EXISTS idx_legal_text_acceptances_instance_account
  ON iam.legal_text_acceptances(instance_id, account_id, accepted_at DESC);

ALTER TABLE iam.data_subject_requests
  ADD CONSTRAINT data_subject_requests_instance_id_fkey FOREIGN KEY (instance_id)
    REFERENCES iam.instances(id) ON DELETE CASCADE,
  ADD CONSTRAINT data_subject_requests_target_membership_fk FOREIGN KEY (instance_id, target_account_id)
    REFERENCES iam.instance_memberships(instance_id, account_id) ON DELETE RESTRICT,
  ADD CONSTRAINT data_subject_requests_requester_membership_fk FOREIGN KEY (instance_id, requester_account_id)
    REFERENCES iam.instance_memberships(instance_id, account_id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_data_subject_requests_instance_status
  ON iam.data_subject_requests(instance_id, status, request_accepted_at DESC);
CREATE INDEX IF NOT EXISTS idx_data_subject_requests_sla
  ON iam.data_subject_requests(instance_id, sla_deadline_at)
  WHERE status IN ('accepted', 'processing');

ALTER TABLE iam.data_subject_request_events
  ADD CONSTRAINT data_subject_request_events_instance_id_fkey FOREIGN KEY (instance_id)
    REFERENCES iam.instances(id) ON DELETE CASCADE,
  ADD CONSTRAINT data_subject_request_events_actor_membership_fk FOREIGN KEY (instance_id, actor_account_id)
    REFERENCES iam.instance_memberships(instance_id, account_id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_data_subject_request_events_request
  ON iam.data_subject_request_events(instance_id, request_id, created_at DESC);

ALTER TABLE iam.data_subject_export_jobs
  ADD CONSTRAINT data_subject_export_jobs_instance_id_fkey FOREIGN KEY (instance_id)
    REFERENCES iam.instances(id) ON DELETE CASCADE,
  ADD CONSTRAINT data_subject_export_jobs_target_membership_fk FOREIGN KEY (instance_id, target_account_id)
    REFERENCES iam.instance_memberships(instance_id, account_id) ON DELETE RESTRICT,
  ADD CONSTRAINT data_subject_export_jobs_requester_membership_fk FOREIGN KEY (instance_id, requested_by_account_id)
    REFERENCES iam.instance_memberships(instance_id, account_id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_data_subject_export_jobs_instance_status
  ON iam.data_subject_export_jobs(instance_id, status, created_at DESC);

ALTER TABLE iam.legal_holds
  ADD CONSTRAINT legal_holds_instance_id_fkey FOREIGN KEY (instance_id)
    REFERENCES iam.instances(id) ON DELETE CASCADE,
  ADD CONSTRAINT legal_holds_account_membership_fk FOREIGN KEY (instance_id, account_id)
    REFERENCES iam.instance_memberships(instance_id, account_id) ON DELETE RESTRICT,
  ADD CONSTRAINT legal_holds_creator_membership_fk FOREIGN KEY (instance_id, created_by_account_id)
    REFERENCES iam.instance_memberships(instance_id, account_id) ON DELETE SET NULL,
  ADD CONSTRAINT legal_holds_lifter_membership_fk FOREIGN KEY (instance_id, lifted_by_account_id)
    REFERENCES iam.instance_memberships(instance_id, account_id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_legal_holds_instance_account_active
  ON iam.legal_holds(instance_id, account_id, active);

ALTER TABLE iam.account_profile_corrections
  ADD CONSTRAINT account_profile_corrections_instance_id_fkey FOREIGN KEY (instance_id)
    REFERENCES iam.instances(id) ON DELETE CASCADE,
  ADD CONSTRAINT account_profile_corrections_account_membership_fk FOREIGN KEY (instance_id, account_id)
    REFERENCES iam.instance_memberships(instance_id, account_id) ON DELETE RESTRICT,
  ADD CONSTRAINT account_profile_corrections_actor_membership_fk FOREIGN KEY (instance_id, actor_account_id)
    REFERENCES iam.instance_memberships(instance_id, account_id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_account_profile_corrections_instance_account
  ON iam.account_profile_corrections(instance_id, account_id, created_at DESC);

ALTER TABLE iam.data_subject_recipient_notifications
  ADD CONSTRAINT data_subject_recipient_notifications_instance_id_fkey FOREIGN KEY (instance_id)
    REFERENCES iam.instances(id) ON DELETE CASCADE,
  ADD CONSTRAINT data_subject_recipient_notifications_unique UNIQUE (instance_id, request_id, recipient_class);
CREATE INDEX IF NOT EXISTS idx_data_subject_recipient_notifications_request
  ON iam.data_subject_recipient_notifications(instance_id, request_id, created_at DESC);

ALTER TABLE iam.idempotency_keys
  ADD CONSTRAINT idempotency_keys_instance_id_fkey FOREIGN KEY (instance_id)
    REFERENCES iam.instances(id) ON DELETE CASCADE,
  ADD CONSTRAINT idempotency_keys_actor_membership_fk FOREIGN KEY (instance_id, actor_account_id)
    REFERENCES iam.instance_memberships(instance_id, account_id) ON DELETE CASCADE;

ALTER TABLE iam.activity_logs_archive
  ADD CONSTRAINT activity_logs_archive_instance_id_fkey FOREIGN KEY (instance_id)
    REFERENCES iam.instances(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_activity_logs_archive_instance_created
  ON iam.activity_logs_archive(instance_id, original_created_at DESC);

DROP FUNCTION IF EXISTS iam.current_instance_id();

CREATE FUNCTION iam.current_instance_id()
RETURNS TEXT
LANGUAGE SQL
STABLE
AS $$
  SELECT NULLIF(current_setting('app.instance_id', true), '')
$$;

CREATE POLICY instances_isolation_policy
  ON iam.instances
  USING (id = iam.current_instance_id())
  WITH CHECK (id = iam.current_instance_id());
CREATE POLICY accounts_isolation_policy
  ON iam.accounts
  USING (
    EXISTS (
      SELECT 1
      FROM iam.instance_memberships membership
      WHERE membership.account_id = iam.accounts.id
        AND membership.instance_id = iam.current_instance_id()
    )
  )
  WITH CHECK (iam.current_instance_id() IS NOT NULL);
CREATE POLICY organizations_isolation_policy
  ON iam.organizations
  USING (instance_id = iam.current_instance_id())
  WITH CHECK (instance_id = iam.current_instance_id());
CREATE POLICY roles_isolation_policy
  ON iam.roles
  USING (instance_id = iam.current_instance_id())
  WITH CHECK (instance_id = iam.current_instance_id());
CREATE POLICY permissions_isolation_policy
  ON iam.permissions
  USING (instance_id = iam.current_instance_id())
  WITH CHECK (instance_id = iam.current_instance_id());
CREATE POLICY instance_memberships_isolation_policy
  ON iam.instance_memberships
  USING (instance_id = iam.current_instance_id())
  WITH CHECK (instance_id = iam.current_instance_id());
CREATE POLICY account_organizations_isolation_policy
  ON iam.account_organizations
  USING (instance_id = iam.current_instance_id())
  WITH CHECK (instance_id = iam.current_instance_id());
CREATE POLICY account_roles_isolation_policy
  ON iam.account_roles
  USING (instance_id = iam.current_instance_id())
  WITH CHECK (instance_id = iam.current_instance_id());
CREATE POLICY role_permissions_isolation_policy
  ON iam.role_permissions
  USING (instance_id = iam.current_instance_id())
  WITH CHECK (instance_id = iam.current_instance_id());
CREATE POLICY activity_logs_isolation_policy
  ON iam.activity_logs
  USING (instance_id = iam.current_instance_id())
  WITH CHECK (instance_id = iam.current_instance_id());
CREATE POLICY permission_change_requests_isolation_policy
  ON iam.permission_change_requests
  USING (instance_id = iam.current_instance_id())
  WITH CHECK (instance_id = iam.current_instance_id());
CREATE POLICY delegations_isolation_policy
  ON iam.delegations
  USING (instance_id = iam.current_instance_id())
  WITH CHECK (instance_id = iam.current_instance_id());
CREATE POLICY impersonation_sessions_isolation_policy
  ON iam.impersonation_sessions
  USING (instance_id = iam.current_instance_id())
  WITH CHECK (instance_id = iam.current_instance_id());
CREATE POLICY legal_text_versions_isolation_policy
  ON iam.legal_text_versions
  USING (instance_id = iam.current_instance_id())
  WITH CHECK (instance_id = iam.current_instance_id());
CREATE POLICY legal_text_acceptances_isolation_policy
  ON iam.legal_text_acceptances
  USING (instance_id = iam.current_instance_id())
  WITH CHECK (instance_id = iam.current_instance_id());
CREATE POLICY data_subject_requests_isolation_policy
  ON iam.data_subject_requests
  USING (instance_id = iam.current_instance_id())
  WITH CHECK (instance_id = iam.current_instance_id());
CREATE POLICY data_subject_request_events_isolation_policy
  ON iam.data_subject_request_events
  USING (instance_id = iam.current_instance_id())
  WITH CHECK (instance_id = iam.current_instance_id());
CREATE POLICY data_subject_export_jobs_isolation_policy
  ON iam.data_subject_export_jobs
  USING (instance_id = iam.current_instance_id())
  WITH CHECK (instance_id = iam.current_instance_id());
CREATE POLICY legal_holds_isolation_policy
  ON iam.legal_holds
  USING (instance_id = iam.current_instance_id())
  WITH CHECK (instance_id = iam.current_instance_id());
CREATE POLICY account_profile_corrections_isolation_policy
  ON iam.account_profile_corrections
  USING (instance_id = iam.current_instance_id())
  WITH CHECK (instance_id = iam.current_instance_id());
CREATE POLICY data_subject_recipient_notifications_isolation_policy
  ON iam.data_subject_recipient_notifications
  USING (instance_id = iam.current_instance_id())
  WITH CHECK (instance_id = iam.current_instance_id());
CREATE POLICY idempotency_keys_isolation_policy
  ON iam.idempotency_keys
  USING (instance_id = iam.current_instance_id())
  WITH CHECK (instance_id = iam.current_instance_id());
CREATE POLICY activity_logs_archive_isolation_policy
  ON iam.activity_logs_archive
  USING (instance_id = iam.current_instance_id())
  WITH CHECK (instance_id = iam.current_instance_id());


-- packages/data/migrations/0013_iam_instance_integrations.sql

CREATE TABLE IF NOT EXISTS iam.instance_integrations (
  instance_id TEXT NOT NULL REFERENCES iam.instances(id) ON DELETE CASCADE,
  provider_key TEXT NOT NULL,
  graphql_base_url TEXT NOT NULL,
  oauth_token_url TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  last_verified_at TIMESTAMPTZ,
  last_verified_status TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (instance_id, provider_key)
);

CREATE INDEX IF NOT EXISTS idx_instance_integrations_instance_provider
  ON iam.instance_integrations(instance_id, provider_key);

ALTER TABLE iam.instance_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE iam.instance_integrations FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS instance_integrations_isolation_policy ON iam.instance_integrations;
CREATE POLICY instance_integrations_isolation_policy
  ON iam.instance_integrations
  USING (instance_id = iam.current_instance_id())
  WITH CHECK (instance_id = iam.current_instance_id());


-- packages/data/migrations/0014_iam_groups.sql

-- Migration 0014: IAM Groups
-- Instanzgebundene Gruppen als eigenständige IAM-Entität (Paket 3).
-- Gruppen bündeln Rollen im ersten Schnitt (keine direkten Permissions).

CREATE TABLE IF NOT EXISTS iam.groups (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id  TEXT        NOT NULL REFERENCES iam.instances(id) ON DELETE CASCADE,
  group_key    TEXT        NOT NULL,
  display_name TEXT        NOT NULL,
  description  TEXT,
  group_type   TEXT        NOT NULL DEFAULT 'custom',
  is_active    BOOLEAN     NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT groups_instance_key_uniq UNIQUE (instance_id, group_key)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_groups_instance_id_id
  ON iam.groups(instance_id, id);

-- Gruppen bündeln Rollen: group → role (n:m)
CREATE TABLE IF NOT EXISTS iam.group_roles (
  instance_id TEXT NOT NULL,
  group_id    UUID NOT NULL,
  role_id     UUID NOT NULL,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (instance_id, group_id, role_id),
  CONSTRAINT group_roles_group_fk FOREIGN KEY (instance_id, group_id)
    REFERENCES iam.groups(instance_id, id) ON DELETE CASCADE,
  CONSTRAINT group_roles_role_fk FOREIGN KEY (instance_id, role_id)
    REFERENCES iam.roles(instance_id, id) ON DELETE CASCADE
);

-- Account-zu-Gruppen-Zuordnung mit optionalem Gültigkeitszeitraum
CREATE TABLE IF NOT EXISTS iam.account_groups (
  instance_id TEXT        NOT NULL,
  account_id  UUID        NOT NULL,
  group_id    UUID        NOT NULL,
  valid_from  TIMESTAMPTZ,
  valid_until TIMESTAMPTZ,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  assigned_by UUID,
  PRIMARY KEY (instance_id, account_id, group_id),
  CONSTRAINT account_groups_membership_fk FOREIGN KEY (instance_id, account_id)
    REFERENCES iam.instance_memberships(instance_id, account_id) ON DELETE CASCADE,
  CONSTRAINT account_groups_group_fk FOREIGN KEY (instance_id, group_id)
    REFERENCES iam.groups(instance_id, id) ON DELETE CASCADE
);

-- Index: aktive Gruppenmitgliedschaften per Account schnell abrufbar
CREATE INDEX IF NOT EXISTS idx_account_groups_account
  ON iam.account_groups(instance_id, account_id);

CREATE INDEX IF NOT EXISTS idx_account_groups_group
  ON iam.account_groups(instance_id, group_id);

CREATE INDEX IF NOT EXISTS idx_group_roles_group
  ON iam.group_roles(instance_id, group_id);

-- RLS: Instanzisolation
ALTER TABLE iam.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE iam.groups FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS groups_isolation_policy ON iam.groups;
CREATE POLICY groups_isolation_policy
  ON iam.groups
  USING (instance_id = iam.current_instance_id())
  WITH CHECK (instance_id = iam.current_instance_id());

ALTER TABLE iam.group_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE iam.group_roles FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS group_roles_isolation_policy ON iam.group_roles;
CREATE POLICY group_roles_isolation_policy
  ON iam.group_roles
  USING (instance_id = iam.current_instance_id())
  WITH CHECK (instance_id = iam.current_instance_id());

ALTER TABLE iam.account_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE iam.account_groups FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS account_groups_isolation_policy ON iam.account_groups;
CREATE POLICY account_groups_isolation_policy
  ON iam.account_groups
  USING (instance_id = iam.current_instance_id())
  WITH CHECK (instance_id = iam.current_instance_id());


-- packages/data/migrations/0015_iam_groups_geo_units.sql

CREATE TABLE IF NOT EXISTS iam.groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id TEXT NOT NULL REFERENCES iam.instances(id) ON DELETE CASCADE,
  group_key TEXT NOT NULL,
  display_name TEXT NOT NULL,
  description TEXT,
  group_type TEXT NOT NULL DEFAULT 'role_bundle',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT groups_instance_key_uniq UNIQUE (instance_id, group_key)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_groups_instance_id_id
  ON iam.groups(instance_id, id);

CREATE TABLE IF NOT EXISTS iam.group_roles (
  instance_id TEXT NOT NULL,
  group_id UUID NOT NULL,
  role_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (instance_id, group_id, role_id),
  CONSTRAINT group_roles_group_fk FOREIGN KEY (instance_id, group_id)
    REFERENCES iam.groups(instance_id, id) ON DELETE CASCADE,
  CONSTRAINT group_roles_role_fk FOREIGN KEY (instance_id, role_id)
    REFERENCES iam.roles(instance_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS iam.account_groups (
  instance_id TEXT NOT NULL,
  account_id UUID NOT NULL,
  group_id UUID NOT NULL,
  origin TEXT NOT NULL DEFAULT 'manual',
  valid_from TIMESTAMPTZ,
  valid_to TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (instance_id, account_id, group_id),
  CONSTRAINT account_groups_membership_fk FOREIGN KEY (instance_id, account_id)
    REFERENCES iam.instance_memberships(instance_id, account_id) ON DELETE CASCADE,
  CONSTRAINT account_groups_group_fk FOREIGN KEY (instance_id, group_id)
    REFERENCES iam.groups(instance_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS iam.geo_units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id TEXT NOT NULL REFERENCES iam.instances(id) ON DELETE CASCADE,
  geo_key TEXT NOT NULL,
  display_name TEXT NOT NULL,
  geo_type TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  parent_geo_unit_id UUID,
  hierarchy_path UUID[] NOT NULL DEFAULT ARRAY[]::uuid[],
  depth INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT geo_units_instance_key_uniq UNIQUE (instance_id, geo_key)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_geo_units_instance_id_id
  ON iam.geo_units(instance_id, id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'groups_type_chk'
      AND conrelid = 'iam.groups'::regclass
  ) THEN
    ALTER TABLE iam.groups
      ADD CONSTRAINT groups_type_chk
      CHECK (group_type IN ('role_bundle'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'account_groups_origin_chk'
      AND conrelid = 'iam.account_groups'::regclass
  ) AND EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'iam'
      AND table_name = 'account_groups'
      AND column_name = 'origin'
  ) THEN
    ALTER TABLE iam.account_groups
      ADD CONSTRAINT account_groups_origin_chk
      CHECK (origin IN ('manual', 'seed', 'sync'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'account_groups_validity_chk'
      AND conrelid = 'iam.account_groups'::regclass
  ) AND EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'iam'
      AND table_name = 'account_groups'
      AND column_name = 'valid_to'
  ) AND EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'iam'
      AND table_name = 'account_groups'
      AND column_name = 'valid_from'
  ) THEN
    ALTER TABLE iam.account_groups
      ADD CONSTRAINT account_groups_validity_chk
      CHECK (valid_to IS NULL OR valid_from IS NULL OR valid_to >= valid_from);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'geo_units_parent_fk'
      AND conrelid = 'iam.geo_units'::regclass
  ) THEN
    ALTER TABLE iam.geo_units
      ADD CONSTRAINT geo_units_parent_fk
      FOREIGN KEY (instance_id, parent_geo_unit_id)
      REFERENCES iam.geo_units(instance_id, id)
      ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'geo_units_parent_not_self_chk'
      AND conrelid = 'iam.geo_units'::regclass
  ) THEN
    ALTER TABLE iam.geo_units
      ADD CONSTRAINT geo_units_parent_not_self_chk
      CHECK (parent_geo_unit_id IS NULL OR parent_geo_unit_id <> id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'geo_units_depth_nonnegative_chk'
      AND conrelid = 'iam.geo_units'::regclass
  ) THEN
    ALTER TABLE iam.geo_units
      ADD CONSTRAINT geo_units_depth_nonnegative_chk
      CHECK (depth >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'geo_units_type_chk'
      AND conrelid = 'iam.geo_units'::regclass
  ) THEN
    ALTER TABLE iam.geo_units
      ADD CONSTRAINT geo_units_type_chk
      CHECK (geo_type IN ('country', 'state', 'county', 'municipality', 'district', 'custom'));
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_groups_instance_active
  ON iam.groups(instance_id, is_active);

CREATE INDEX IF NOT EXISTS idx_account_groups_group_account
  ON iam.account_groups(instance_id, group_id, account_id);

CREATE INDEX IF NOT EXISTS idx_geo_units_parent
  ON iam.geo_units(instance_id, parent_geo_unit_id);

CREATE INDEX IF NOT EXISTS idx_geo_units_type_active
  ON iam.geo_units(instance_id, geo_type, is_active);

ALTER TABLE iam.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE iam.groups FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS groups_isolation_policy ON iam.groups;
CREATE POLICY groups_isolation_policy
  ON iam.groups
  USING (instance_id = iam.current_instance_id())
  WITH CHECK (instance_id = iam.current_instance_id());

ALTER TABLE iam.group_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE iam.group_roles FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS group_roles_isolation_policy ON iam.group_roles;
CREATE POLICY group_roles_isolation_policy
  ON iam.group_roles
  USING (instance_id = iam.current_instance_id())
  WITH CHECK (instance_id = iam.current_instance_id());

ALTER TABLE iam.account_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE iam.account_groups FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS account_groups_isolation_policy ON iam.account_groups;
CREATE POLICY account_groups_isolation_policy
  ON iam.account_groups
  USING (instance_id = iam.current_instance_id())
  WITH CHECK (instance_id = iam.current_instance_id());

ALTER TABLE iam.geo_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE iam.geo_units FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS geo_units_isolation_policy ON iam.geo_units;
CREATE POLICY geo_units_isolation_policy
  ON iam.geo_units
  USING (instance_id = iam.current_instance_id())
  WITH CHECK (instance_id = iam.current_instance_id());


-- packages/data/migrations/0016_iam_geo_hierarchy.sql

-- Migration 0015: Geo-Hierarchie Closure-Table (Paket 3)
-- Kanonisches Hierarchie-Read-Modell für geografische Einheiten.
-- Key-Format: {ebene}:{schlüssel} (z. B. district:09162, municipality:09162000).
-- Maximale Tiefe: 5 Ebenen.

CREATE TABLE IF NOT EXISTS iam.geo_nodes (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id TEXT        NOT NULL REFERENCES iam.instances(id) ON DELETE CASCADE,
  key         TEXT        NOT NULL,
  display_name TEXT       NOT NULL,
  node_type   TEXT        NOT NULL DEFAULT 'district',
  deleted_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT geo_nodes_instance_key_uniq UNIQUE (instance_id, key)
);

CREATE INDEX IF NOT EXISTS idx_geo_nodes_instance
  ON iam.geo_nodes(instance_id)
  WHERE deleted_at IS NULL;

-- Closure-Table für effiziente Vorfahren-/Nachfahren-Abfragen in O(1)
-- depth = 0: self-referenzierender Eintrag (ancestor_id = descendant_id)
CREATE TABLE IF NOT EXISTS iam.geo_hierarchy (
  ancestor_id   UUID    NOT NULL REFERENCES iam.geo_nodes(id) ON DELETE CASCADE,
  descendant_id UUID    NOT NULL REFERENCES iam.geo_nodes(id) ON DELETE CASCADE,
  depth         INTEGER NOT NULL,
  PRIMARY KEY (ancestor_id, descendant_id),
  CONSTRAINT geo_hierarchy_depth_range_chk CHECK (depth >= 0 AND depth <= 5)
);

CREATE INDEX IF NOT EXISTS idx_geo_hierarchy_descendant
  ON iam.geo_hierarchy(descendant_id, depth);

CREATE INDEX IF NOT EXISTS idx_geo_hierarchy_ancestor
  ON iam.geo_hierarchy(ancestor_id, depth);

-- Trigger-Funktion: verhindert Einfügungen, die Tiefe > 5 erzeugen würden.
-- Applikation prüft zusätzlich und wirft HTTP 422.
CREATE OR REPLACE FUNCTION iam.check_geo_hierarchy_depth()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  max_existing_depth INTEGER;
BEGIN
  IF NEW.depth > 5 THEN
    RAISE EXCEPTION 'geo_hierarchy_depth_exceeded'
      USING DETAIL = 'Maximum geo hierarchy depth is 5',
            ERRCODE = 'check_violation';
  END IF;

  SELECT COALESCE(MAX(h.depth), 0)
    INTO max_existing_depth
    FROM iam.geo_hierarchy h
   WHERE h.ancestor_id = NEW.ancestor_id
      OR h.descendant_id = NEW.descendant_id;

  IF max_existing_depth >= 5 THEN
    RAISE EXCEPTION 'geo_hierarchy_depth_exceeded'
      USING DETAIL = 'Maximum geo hierarchy depth is 5',
            ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS geo_hierarchy_depth_check ON iam.geo_hierarchy;
CREATE TRIGGER geo_hierarchy_depth_check
  BEFORE INSERT ON iam.geo_hierarchy
  FOR EACH ROW EXECUTE FUNCTION iam.check_geo_hierarchy_depth();

-- RLS: Instanzisolation über geo_nodes (geo_hierarchy über FKs abgesichert)
ALTER TABLE iam.geo_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE iam.geo_nodes FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS geo_nodes_isolation_policy ON iam.geo_nodes;
CREATE POLICY geo_nodes_isolation_policy
  ON iam.geo_nodes
  USING (instance_id = iam.current_instance_id())
  WITH CHECK (instance_id = iam.current_instance_id());


-- packages/data/migrations/0017_iam_legal_acceptance_audit.sql

-- Migration 0016: Legal-Text-Acceptance Audit-Felder (Paket 5)
-- Ergänzt die bestehende Tabelle iam.legal_text_acceptances um Pflichtfelder
-- für Compliance-Export und revisionssichere Nachweise.

ALTER TABLE iam.legal_text_acceptances
  ADD COLUMN IF NOT EXISTS workspace_id     TEXT,
  ADD COLUMN IF NOT EXISTS subject_id       TEXT,
  ADD COLUMN IF NOT EXISTS legal_text_version TEXT,
  ADD COLUMN IF NOT EXISTS action_type      TEXT NOT NULL DEFAULT 'accepted';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'legal_text_acceptances_action_type_chk'
      AND conrelid = 'iam.legal_text_acceptances'::regclass
  ) THEN
    ALTER TABLE iam.legal_text_acceptances
      ADD CONSTRAINT legal_text_acceptances_action_type_chk
      CHECK (action_type IN ('accepted', 'revoked', 'prompted'));
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_legal_text_acceptances_workspace_action
  ON iam.legal_text_acceptances(workspace_id, action_type)
  WHERE workspace_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_legal_text_acceptances_subject
  ON iam.legal_text_acceptances(subject_id)
  WHERE subject_id IS NOT NULL;

-- Permission für Legal-Consent-Export (falls noch nicht vorhanden)
-- Wird in den IAM-Seed-Plan integriert; diese Aussage dient als Referenz.
-- INSERT INTO iam.permissions (instance_id, permission_key, action, resource_type, effect, description)
-- wird über den idempotenten Seed-Plan eingespielt, nicht direkt hier.


-- packages/data/migrations/0018_iam_accounts_instance_policy.sql

DROP POLICY IF EXISTS accounts_isolation_policy ON iam.accounts;

CREATE POLICY accounts_isolation_policy
  ON iam.accounts
  USING (instance_id = iam.current_instance_id())
  WITH CHECK (instance_id = iam.current_instance_id());


-- packages/data/migrations/0019_iam_account_groups_origin_compat.sql

ALTER TABLE iam.account_groups
  ADD COLUMN IF NOT EXISTS origin TEXT NOT NULL DEFAULT 'manual';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'account_groups_origin_chk'
      AND conrelid = 'iam.account_groups'::regclass
  ) THEN
    ALTER TABLE iam.account_groups
      ADD CONSTRAINT account_groups_origin_chk
      CHECK (origin IN ('manual', 'seed', 'sync'));
  END IF;
END
$$;


