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
