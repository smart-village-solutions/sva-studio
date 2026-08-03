-- +goose Up
-- +goose StatementBegin
CREATE TABLE IF NOT EXISTS iam.external_content_references (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id TEXT NOT NULL REFERENCES iam.instances(id) ON DELETE CASCADE,
  content_id UUID NOT NULL REFERENCES iam.contents(id) ON DELETE CASCADE,
  source_system TEXT NOT NULL,
  source_entity_type TEXT NOT NULL,
  source_entity_id TEXT,
  operation_external_id TEXT NOT NULL,
  reconciliation_status TEXT NOT NULL DEFAULT 'pending',
  last_error_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT external_content_references_source_system_chk
    CHECK (source_system ~ '^[a-z][a-z0-9-]{1,62}$'),
  CONSTRAINT external_content_references_source_entity_type_chk
    CHECK (length(btrim(source_entity_type)) > 0),
  CONSTRAINT external_content_references_operation_external_id_chk
    CHECK (length(btrim(operation_external_id)) > 0),
  CONSTRAINT external_content_references_reconciliation_status_chk
    CHECK (reconciliation_status IN ('pending', 'bound', 'reconciliation_required', 'failed')),
  CONSTRAINT external_content_references_local_source_key
    UNIQUE (instance_id, content_id, source_system, source_entity_type),
  CONSTRAINT external_content_references_operation_key
    UNIQUE (instance_id, source_system, source_entity_type, operation_external_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS external_content_references_external_source_key
  ON iam.external_content_references (
    instance_id,
    source_system,
    source_entity_type,
    source_entity_id
  )
  WHERE source_entity_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS external_content_references_reconciliation_idx
  ON iam.external_content_references (instance_id, reconciliation_status, updated_at);

ALTER TABLE iam.external_content_references ENABLE ROW LEVEL SECURITY;
ALTER TABLE iam.external_content_references FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS external_content_references_isolation_policy
  ON iam.external_content_references;
CREATE POLICY external_content_references_isolation_policy
  ON iam.external_content_references
  USING (instance_id = iam.current_instance_id())
  WITH CHECK (instance_id = iam.current_instance_id());
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP POLICY IF EXISTS external_content_references_isolation_policy
  ON iam.external_content_references;
DROP TABLE IF EXISTS iam.external_content_references;
-- +goose StatementEnd
