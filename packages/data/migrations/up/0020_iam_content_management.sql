CREATE TABLE IF NOT EXISTS iam.contents (
  id UUID PRIMARY KEY,
  instance_id TEXT NOT NULL,
  content_type TEXT NOT NULL,
  title TEXT NOT NULL,
  published_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  author_account_id UUID NOT NULL REFERENCES iam.accounts(id),
  author_display_name TEXT NOT NULL,
  payload_json JSONB NOT NULL,
  status TEXT NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'contents_status_chk'
      AND conrelid = 'iam.contents'::regclass
  ) THEN
    ALTER TABLE iam.contents
      ADD CONSTRAINT contents_status_chk
      CHECK (status IN ('draft', 'in_review', 'approved', 'published', 'archived'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS iam_contents_instance_updated_idx
  ON iam.contents (instance_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS iam.content_history (
  id UUID PRIMARY KEY,
  instance_id TEXT NOT NULL,
  content_id UUID NOT NULL REFERENCES iam.contents(id) ON DELETE CASCADE,
  actor_account_id UUID NOT NULL REFERENCES iam.accounts(id),
  actor_display_name TEXT NOT NULL,
  action TEXT NOT NULL,
  changed_fields TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  previous_status TEXT NULL,
  next_status TEXT NULL,
  summary TEXT NULL,
  snapshot_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'content_history_action_chk'
      AND conrelid = 'iam.content_history'::regclass
  ) THEN
    ALTER TABLE iam.content_history
      ADD CONSTRAINT content_history_action_chk
      CHECK (action IN ('created', 'updated', 'status_changed'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS iam_content_history_instance_content_created_idx
  ON iam.content_history (instance_id, content_id, created_at DESC);
