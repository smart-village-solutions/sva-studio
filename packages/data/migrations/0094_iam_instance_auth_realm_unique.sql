-- +goose Up
-- +goose StatementBegin
LOCK TABLE iam.instances IN SHARE ROW EXCLUSIVE MODE;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM iam.instances
    GROUP BY auth_realm
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'Cannot enforce exclusive Keycloak realm ownership: duplicate iam.instances.auth_realm values exist',
      HINT = 'List duplicates with SELECT auth_realm, array_agg(id ORDER BY id) FROM iam.instances GROUP BY auth_realm HAVING COUNT(*) > 1; verify ownership and assign each instance a unique realm before retrying the migration.';
  END IF;
END
$$;

ALTER TABLE iam.instances
  ADD CONSTRAINT instances_auth_realm_unique UNIQUE (auth_realm);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
ALTER TABLE iam.instances
  DROP CONSTRAINT instances_auth_realm_unique;
-- +goose StatementEnd
