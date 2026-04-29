-- +goose Up
-- +goose StatementBegin
CREATE TABLE IF NOT EXISTS iam.instance_modules (
  instance_id TEXT NOT NULL REFERENCES iam.instances(id) ON DELETE CASCADE,
  module_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (instance_id, module_id)
);

CREATE INDEX IF NOT EXISTS idx_instance_modules_instance_created
  ON iam.instance_modules(instance_id, created_at DESC);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP INDEX IF EXISTS iam.idx_instance_modules_instance_created;
DROP TABLE IF EXISTS iam.instance_modules;
-- +goose StatementEnd
