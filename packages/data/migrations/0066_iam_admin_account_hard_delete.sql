-- +goose Up
-- +goose StatementBegin
-- Referenzpfade mit historischer Retention werden für privilegierten Admin-Hard-Delete NULL-verträglich.
ALTER TABLE iam.content_history
  ALTER COLUMN actor_account_id DROP NOT NULL;

ALTER TABLE iam.content_history
  DROP CONSTRAINT IF EXISTS content_history_actor_account_id_fkey,
  ADD CONSTRAINT content_history_actor_account_id_fkey
    FOREIGN KEY (actor_account_id) REFERENCES iam.accounts(id) ON DELETE SET NULL;

ALTER TABLE iam.contents
  ALTER COLUMN author_account_id DROP NOT NULL,
  ALTER COLUMN creator_account_id DROP NOT NULL,
  ALTER COLUMN updater_account_id DROP NOT NULL;

ALTER TABLE iam.contents
  DROP CONSTRAINT IF EXISTS contents_author_account_id_fkey,
  ADD CONSTRAINT contents_author_account_id_fkey
    FOREIGN KEY (author_account_id) REFERENCES iam.accounts(id) ON DELETE SET NULL,
  DROP CONSTRAINT IF EXISTS contents_creator_account_id_fkey,
  ADD CONSTRAINT contents_creator_account_id_fkey
    FOREIGN KEY (creator_account_id) REFERENCES iam.accounts(id) ON DELETE SET NULL,
  DROP CONSTRAINT IF EXISTS contents_updater_account_id_fkey,
  ADD CONSTRAINT contents_updater_account_id_fkey
    FOREIGN KEY (updater_account_id) REFERENCES iam.accounts(id) ON DELETE SET NULL;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM iam.content_history
    WHERE actor_account_id IS NULL
  ) OR EXISTS (
    SELECT 1
    FROM iam.contents
    WHERE author_account_id IS NULL
       OR creator_account_id IS NULL
       OR updater_account_id IS NULL
  ) THEN
    RAISE EXCEPTION 'Cannot restore content account hard-delete constraints while anonymized rows exist.';
  END IF;
END $$;

ALTER TABLE iam.content_history
  DROP CONSTRAINT IF EXISTS content_history_actor_account_id_fkey,
  ADD CONSTRAINT content_history_actor_account_id_fkey
    FOREIGN KEY (actor_account_id) REFERENCES iam.accounts(id);

ALTER TABLE iam.content_history
  ALTER COLUMN actor_account_id SET NOT NULL;

ALTER TABLE iam.contents
  DROP CONSTRAINT IF EXISTS contents_author_account_id_fkey,
  ADD CONSTRAINT contents_author_account_id_fkey
    FOREIGN KEY (author_account_id) REFERENCES iam.accounts(id),
  DROP CONSTRAINT IF EXISTS contents_creator_account_id_fkey,
  ADD CONSTRAINT contents_creator_account_id_fkey
    FOREIGN KEY (creator_account_id) REFERENCES iam.accounts(id),
  DROP CONSTRAINT IF EXISTS contents_updater_account_id_fkey,
  ADD CONSTRAINT contents_updater_account_id_fkey
    FOREIGN KEY (updater_account_id) REFERENCES iam.accounts(id);

ALTER TABLE iam.contents
  ALTER COLUMN author_account_id SET NOT NULL,
  ALTER COLUMN creator_account_id SET NOT NULL,
  ALTER COLUMN updater_account_id SET NOT NULL;
-- +goose StatementEnd
