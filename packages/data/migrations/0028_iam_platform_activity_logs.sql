-- +goose Up
-- +goose StatementBegin
CREATE TABLE IF NOT EXISTS iam.platform_activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope_kind TEXT NOT NULL DEFAULT 'platform',
  account_id UUID REFERENCES iam.accounts(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  actor_user_id TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  request_id TEXT,
  trace_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT platform_activity_logs_scope_kind_chk CHECK (scope_kind = 'platform')
);

CREATE INDEX IF NOT EXISTS idx_platform_activity_logs_created_at
  ON iam.platform_activity_logs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_platform_activity_logs_event_type_created_at
  ON iam.platform_activity_logs(event_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_platform_activity_logs_request_id
  ON iam.platform_activity_logs(request_id)
  WHERE request_id IS NOT NULL;

CREATE OR REPLACE FUNCTION iam.prevent_platform_activity_logs_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'iam.platform_activity_logs is immutable';
END;
$$;

DROP TRIGGER IF EXISTS trg_immutable_platform_activity_logs ON iam.platform_activity_logs;
CREATE TRIGGER trg_immutable_platform_activity_logs
BEFORE UPDATE OR DELETE ON iam.platform_activity_logs
FOR EACH ROW
EXECUTE FUNCTION iam.prevent_platform_activity_logs_mutation();

GRANT SELECT, INSERT ON iam.platform_activity_logs TO iam_app;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TRIGGER IF EXISTS trg_immutable_platform_activity_logs ON iam.platform_activity_logs;
DROP FUNCTION IF EXISTS iam.prevent_platform_activity_logs_mutation();
DROP INDEX IF EXISTS iam.idx_platform_activity_logs_request_id;
DROP INDEX IF EXISTS iam.idx_platform_activity_logs_event_type_created_at;
DROP INDEX IF EXISTS iam.idx_platform_activity_logs_created_at;
DROP TABLE IF EXISTS iam.platform_activity_logs;
-- +goose StatementEnd
