-- +goose Up
-- +goose StatementBegin
CREATE TABLE iam.mainserver_data_provider_bindings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id TEXT NOT NULL REFERENCES iam.instances(id) ON DELETE CASCADE,
  principal_type TEXT NOT NULL,
  principal_id UUID NOT NULL,
  credential_fingerprint TEXT NOT NULL,
  data_provider_id TEXT NOT NULL,
  data_provider_name TEXT,
  status TEXT NOT NULL DEFAULT 'verified',
  evidence_kind TEXT NOT NULL,
  first_observed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_observed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  superseded_at TIMESTAMPTZ,
  CONSTRAINT mainserver_data_provider_bindings_principal_type_chk
    CHECK (principal_type IN ('organization', 'user')),
  CONSTRAINT mainserver_data_provider_bindings_fingerprint_chk
    CHECK (credential_fingerprint ~ '^[a-f0-9]{64}$'),
  CONSTRAINT mainserver_data_provider_bindings_provider_id_chk
    CHECK (length(btrim(data_provider_id)) > 0),
  CONSTRAINT mainserver_data_provider_bindings_status_chk
    CHECK (status IN ('pending', 'verified', 'conflict', 'historical', 'revoked')),
  CONSTRAINT mainserver_data_provider_bindings_evidence_chk
    CHECK (evidence_kind IN ('create_response', 'create_reread', 'identity_endpoint')),
  CONSTRAINT mainserver_data_provider_bindings_observation_key
    UNIQUE (
      instance_id,
      principal_type,
      principal_id,
      credential_fingerprint,
      data_provider_id
    )
);

CREATE INDEX mainserver_data_provider_bindings_principal_idx
  ON iam.mainserver_data_provider_bindings (
    instance_id,
    principal_type,
    principal_id,
    credential_fingerprint,
    status
  );

CREATE INDEX mainserver_data_provider_bindings_provider_idx
  ON iam.mainserver_data_provider_bindings (instance_id, data_provider_id, status);

ALTER TABLE iam.mainserver_data_provider_bindings ENABLE ROW LEVEL SECURITY;
ALTER TABLE iam.mainserver_data_provider_bindings FORCE ROW LEVEL SECURITY;
CREATE POLICY mainserver_data_provider_bindings_isolation_policy
  ON iam.mainserver_data_provider_bindings
  USING (instance_id = iam.current_instance_id())
  WITH CHECK (instance_id = iam.current_instance_id());

CREATE TABLE iam.mainserver_mutation_journal (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id TEXT NOT NULL REFERENCES iam.instances(id) ON DELETE CASCADE,
  operation_external_id TEXT NOT NULL,
  actor_account_id UUID,
  acting_principal_type TEXT NOT NULL,
  acting_principal_id UUID NOT NULL,
  active_organization_id UUID,
  credential_source TEXT NOT NULL,
  credential_fingerprint TEXT NOT NULL,
  action_id TEXT NOT NULL,
  content_type TEXT NOT NULL,
  content_id TEXT,
  expected_data_provider_id TEXT,
  observed_data_provider_id TEXT,
  authorization_mode TEXT NOT NULL,
  resolver_mode TEXT NOT NULL DEFAULT 'shadow',
  candidate_authorization_mode TEXT,
  candidate_allowed BOOLEAN,
  shadow_difference BOOLEAN NOT NULL DEFAULT FALSE,
  provider_outcome TEXT NOT NULL DEFAULT 'pending',
  reconciliation_status TEXT NOT NULL DEFAULT 'pending',
  attempt_count INTEGER NOT NULL DEFAULT 1,
  completed_steps JSONB NOT NULL DEFAULT '[]'::jsonb,
  preimage JSONB,
  last_error_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  CONSTRAINT mainserver_mutation_journal_operation_key
    UNIQUE (instance_id, operation_external_id),
  CONSTRAINT mainserver_mutation_journal_principal_type_chk
    CHECK (acting_principal_type IN ('organization', 'user')),
  CONSTRAINT mainserver_mutation_journal_credential_source_chk
    CHECK (credential_source IN ('organization', 'user')),
  CONSTRAINT mainserver_mutation_journal_fingerprint_chk
    CHECK (credential_fingerprint ~ '^[a-f0-9]{64}$'),
  CONSTRAINT mainserver_mutation_journal_action_chk
    CHECK (action_id ~ '^[a-z][a-z0-9-]{1,30}\.[A-Za-z][A-Za-z0-9-]*$'),
  CONSTRAINT mainserver_mutation_journal_authorization_mode_chk
    CHECK (authorization_mode IN ('credential_visible_compatibility', 'exact')),
  CONSTRAINT mainserver_mutation_journal_resolver_mode_chk
    CHECK (resolver_mode IN ('shadow', 'automatic', 'compatibility')),
  CONSTRAINT mainserver_mutation_journal_candidate_mode_chk
    CHECK (candidate_authorization_mode IS NULL OR candidate_authorization_mode IN ('credential_visible_compatibility', 'exact')),
  CONSTRAINT mainserver_mutation_journal_shadow_evidence_chk
    CHECK (
      (resolver_mode = 'shadow') OR
      (candidate_authorization_mode IS NULL AND candidate_allowed IS NULL AND shadow_difference = FALSE)
    ),
  CONSTRAINT mainserver_mutation_journal_provider_outcome_chk
    CHECK (provider_outcome IN ('pending', 'succeeded', 'failed', 'unknown')),
  CONSTRAINT mainserver_mutation_journal_reconciliation_chk
    CHECK (reconciliation_status IN ('pending', 'complete', 'reconciliation_required', 'failed')),
  CONSTRAINT mainserver_mutation_journal_attempt_count_chk
    CHECK (attempt_count > 0),
  CONSTRAINT mainserver_mutation_journal_steps_chk
    CHECK (jsonb_typeof(completed_steps) = 'array'),
  CONSTRAINT mainserver_mutation_journal_preimage_chk
    CHECK (preimage IS NULL OR jsonb_typeof(preimage) = 'object')
);

CREATE INDEX mainserver_mutation_journal_reconciliation_idx
  ON iam.mainserver_mutation_journal (instance_id, reconciliation_status, updated_at);

CREATE INDEX mainserver_mutation_journal_content_idx
  ON iam.mainserver_mutation_journal (instance_id, content_type, content_id, created_at DESC);

ALTER TABLE iam.mainserver_mutation_journal ENABLE ROW LEVEL SECURITY;
ALTER TABLE iam.mainserver_mutation_journal FORCE ROW LEVEL SECURITY;
CREATE POLICY mainserver_mutation_journal_isolation_policy
  ON iam.mainserver_mutation_journal
  USING (instance_id = iam.current_instance_id())
  WITH CHECK (instance_id = iam.current_instance_id());

ALTER TABLE iam.content_list_projection
  ADD COLUMN credential_fingerprint TEXT,
  ADD COLUMN authorization_mode TEXT NOT NULL DEFAULT 'credential_visible_compatibility';

ALTER TABLE iam.content_list_projection
  ADD CONSTRAINT content_list_projection_credential_fingerprint_chk
    CHECK (credential_fingerprint IS NULL OR credential_fingerprint ~ '^[a-f0-9]{64}$'),
  ADD CONSTRAINT content_list_projection_authorization_mode_chk
    CHECK (authorization_mode IN ('credential_visible_compatibility', 'exact'));
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
ALTER TABLE iam.content_list_projection
  DROP CONSTRAINT IF EXISTS content_list_projection_authorization_mode_chk,
  DROP CONSTRAINT IF EXISTS content_list_projection_credential_fingerprint_chk,
  DROP COLUMN IF EXISTS authorization_mode,
  DROP COLUMN IF EXISTS credential_fingerprint;

DROP POLICY IF EXISTS mainserver_mutation_journal_isolation_policy
  ON iam.mainserver_mutation_journal;
DROP TABLE IF EXISTS iam.mainserver_mutation_journal;

DROP POLICY IF EXISTS mainserver_data_provider_bindings_isolation_policy
  ON iam.mainserver_data_provider_bindings;
DROP TABLE IF EXISTS iam.mainserver_data_provider_bindings;
-- +goose StatementEnd
