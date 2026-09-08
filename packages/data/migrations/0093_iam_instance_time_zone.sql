-- +goose Up
-- +goose StatementBegin
ALTER TABLE iam.instances
  ADD COLUMN time_zone text NOT NULL DEFAULT 'Europe/Berlin',
  ADD CONSTRAINT instances_time_zone_nonempty_chk CHECK (
    char_length(BTRIM(time_zone)) BETWEEN 1 AND 100
  );
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
ALTER TABLE iam.instances
  DROP CONSTRAINT instances_time_zone_nonempty_chk,
  DROP COLUMN time_zone;
-- +goose StatementEnd
