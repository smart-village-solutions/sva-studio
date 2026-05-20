-- +goose Up
-- +goose StatementBegin
ALTER TABLE iam.permission_change_requests
  ALTER COLUMN role_id DROP NOT NULL;

ALTER TABLE iam.permission_change_requests
  ADD COLUMN IF NOT EXISTS request_note TEXT,
  ADD COLUMN IF NOT EXISTS request_origin TEXT NOT NULL DEFAULT 'admin';

UPDATE iam.permission_change_requests
SET request_note = COALESCE(request_note, '')
WHERE request_note IS NULL;

ALTER TABLE iam.permission_change_requests
  ALTER COLUMN request_note SET NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'permission_change_requests_status_chk'
      AND conrelid = 'iam.permission_change_requests'::regclass
  ) THEN
    ALTER TABLE iam.permission_change_requests
      DROP CONSTRAINT permission_change_requests_status_chk;
  END IF;
END
$$;

ALTER TABLE iam.permission_change_requests
  ADD CONSTRAINT permission_change_requests_status_chk CHECK (
    status IN ('draft', 'intake', 'triaged', 'submitted', 'approved', 'rejected', 'applied')
  );

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'permission_change_requests_role_fk'
      AND conrelid = 'iam.permission_change_requests'::regclass
  ) THEN
    ALTER TABLE iam.permission_change_requests
      DROP CONSTRAINT permission_change_requests_role_fk;
  END IF;
END
$$;

ALTER TABLE iam.permission_change_requests
  ADD CONSTRAINT permission_change_requests_role_fk FOREIGN KEY (instance_id, role_id)
    REFERENCES iam.roles(instance_id, id) ON DELETE RESTRICT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'permission_change_requests_request_origin_chk'
      AND conrelid = 'iam.permission_change_requests'::regclass
  ) THEN
    ALTER TABLE iam.permission_change_requests
      ADD CONSTRAINT permission_change_requests_request_origin_chk CHECK (
        request_origin IN ('admin', 'self_service')
      );
  END IF;
END
$$;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
ALTER TABLE iam.permission_change_requests
  DROP CONSTRAINT IF EXISTS permission_change_requests_request_origin_chk;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'permission_change_requests_role_fk'
      AND conrelid = 'iam.permission_change_requests'::regclass
  ) THEN
    ALTER TABLE iam.permission_change_requests
      DROP CONSTRAINT permission_change_requests_role_fk;
  END IF;
END
$$;

ALTER TABLE iam.permission_change_requests
  ADD CONSTRAINT permission_change_requests_role_fk FOREIGN KEY (instance_id, role_id)
    REFERENCES iam.roles(instance_id, id) ON DELETE RESTRICT;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'permission_change_requests_status_chk'
      AND conrelid = 'iam.permission_change_requests'::regclass
  ) THEN
    ALTER TABLE iam.permission_change_requests
      DROP CONSTRAINT permission_change_requests_status_chk;
  END IF;
END
$$;

ALTER TABLE iam.permission_change_requests
  ADD CONSTRAINT permission_change_requests_status_chk CHECK (
    status IN ('draft', 'submitted', 'approved', 'rejected', 'applied')
  );

ALTER TABLE iam.permission_change_requests
  DROP COLUMN IF EXISTS request_origin,
  DROP COLUMN IF EXISTS request_note;

UPDATE iam.permission_change_requests
SET role_id = (
  SELECT id
  FROM iam.roles
  WHERE iam.roles.instance_id = iam.permission_change_requests.instance_id
  ORDER BY created_at ASC
  LIMIT 1
)
WHERE role_id IS NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM iam.permission_change_requests
    WHERE role_id IS NULL
  ) THEN
    RAISE EXCEPTION 'Cannot restore role_id NOT NULL: permission_change_requests still contains rows without a role_id. Ensure each affected instance has at least one role or delete unresolved rows before rollback.';
  END IF;
END
$$;

ALTER TABLE iam.permission_change_requests
  ALTER COLUMN role_id SET NOT NULL;
-- +goose StatementEnd
