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
