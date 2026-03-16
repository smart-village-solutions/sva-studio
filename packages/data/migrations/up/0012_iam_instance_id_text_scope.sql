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
