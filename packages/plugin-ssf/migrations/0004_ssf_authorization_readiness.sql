-- +goose Up
-- +goose StatementBegin
ALTER TABLE ssf.authorization_projections
  DROP CONSTRAINT authorization_projections_status_check,
  ADD CONSTRAINT authorization_projections_status_check CHECK (
    status IN (
      'pending',
      'projecting',
      'activation_pending',
      'revocation_pending',
      'ready',
      'blocked'
    )
  ),
  DROP CONSTRAINT authorization_projections_ready_check,
  ADD CONSTRAINT authorization_projections_ready_check CHECK (
    status <> 'ready'
    OR (
      confirmed_revision = desired_revision
      AND last_error_code IS NULL
    )
  );
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
UPDATE ssf.authorization_projections
   SET status = 'revocation_pending',
       updated_at = now()
 WHERE status = 'activation_pending'
    OR (
      status = 'ready'
      AND sessions_revoked_revision IS DISTINCT FROM confirmed_revision
    );

ALTER TABLE ssf.authorization_projections
  DROP CONSTRAINT authorization_projections_ready_check,
  ADD CONSTRAINT authorization_projections_ready_check CHECK (
    status <> 'ready'
    OR (
      confirmed_revision = desired_revision
      AND sessions_revoked_revision = confirmed_revision
      AND last_error_code IS NULL
    )
  ),
  DROP CONSTRAINT authorization_projections_status_check,
  ADD CONSTRAINT authorization_projections_status_check CHECK (
    status IN ('pending', 'projecting', 'revocation_pending', 'ready', 'blocked')
  );
-- +goose StatementEnd
