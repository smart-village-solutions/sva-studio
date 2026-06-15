-- +goose Up
-- +goose StatementBegin
CREATE TABLE IF NOT EXISTS waste_email_reminder_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  email_hash text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  region_id uuid,
  city_id uuid NOT NULL,
  street_id text NOT NULL,
  house_number_id uuid,
  location_label text NOT NULL,
  consent_version text NOT NULL,
  consent_accepted_at timestamptz NOT NULL,
  doi_token_hash text NOT NULL,
  unsubscribe_token_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  activated_at timestamptz,
  unsubscribed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT waste_email_reminder_subscriptions_status_check
    CHECK (status IN ('pending', 'active', 'unsubscribed', 'expired')),
  CONSTRAINT waste_email_reminder_subscriptions_doi_token_hash_unique UNIQUE (doi_token_hash),
  CONSTRAINT waste_email_reminder_subscriptions_unsubscribe_token_hash_unique UNIQUE (unsubscribe_token_hash)
);

CREATE INDEX IF NOT EXISTS idx_waste_email_reminder_subscriptions_email_location_status
  ON waste_email_reminder_subscriptions (email_hash, city_id, street_id, house_number_id, status);

CREATE INDEX IF NOT EXISTS idx_waste_email_reminder_subscriptions_status_expires_at
  ON waste_email_reminder_subscriptions (status, expires_at);

CREATE TABLE IF NOT EXISTS waste_email_reminder_subscription_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL REFERENCES waste_email_reminder_subscriptions (id) ON DELETE CASCADE,
  fraction_id uuid NOT NULL,
  slot_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT waste_email_reminder_subscription_items_unique UNIQUE (subscription_id, fraction_id, slot_id)
);

CREATE INDEX IF NOT EXISTS idx_waste_email_reminder_subscription_items_subscription_id
  ON waste_email_reminder_subscription_items (subscription_id);

CREATE TABLE IF NOT EXISTS waste_email_reminder_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL REFERENCES waste_email_reminder_subscriptions (id) ON DELETE CASCADE,
  message_kind text NOT NULL,
  transport_id text NOT NULL,
  template_key text NOT NULL,
  send_at timestamptz NOT NULL,
  dedupe_key text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  payload jsonb NOT NULL,
  leased_at timestamptz,
  sent_at timestamptz,
  attempt_count integer NOT NULL DEFAULT 0,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT waste_email_reminder_outbox_message_kind_check
    CHECK (message_kind IN ('doi', 'reminder')),
  CONSTRAINT waste_email_reminder_outbox_status_check
    CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'cancelled')),
  CONSTRAINT waste_email_reminder_outbox_dedupe_key_unique UNIQUE (dedupe_key)
);

CREATE INDEX IF NOT EXISTS idx_waste_email_reminder_outbox_status_send_at
  ON waste_email_reminder_outbox (status, send_at);

CREATE INDEX IF NOT EXISTS idx_waste_email_reminder_outbox_subscription_id
  ON waste_email_reminder_outbox (subscription_id);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TABLE IF EXISTS waste_email_reminder_outbox;
DROP TABLE IF EXISTS waste_email_reminder_subscription_items;
DROP TABLE IF EXISTS waste_email_reminder_subscriptions;
-- +goose StatementEnd
