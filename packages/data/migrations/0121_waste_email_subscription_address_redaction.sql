-- +goose Up
ALTER TABLE public.waste_email_reminder_subscriptions
  ALTER COLUMN email DROP NOT NULL,
  ALTER COLUMN email_hash DROP NOT NULL,
  ADD CONSTRAINT waste_email_reminder_subscriptions_live_address_check
    CHECK (status NOT IN ('pending', 'active') OR (email IS NOT NULL AND email_hash IS NOT NULL));

-- +goose Down
-- Restoring NOT NULL is possible only before the first redaction. Deleted addresses are not recoverable.
ALTER TABLE public.waste_email_reminder_subscriptions
  DROP CONSTRAINT waste_email_reminder_subscriptions_live_address_check,
  ALTER COLUMN email SET NOT NULL,
  ALTER COLUMN email_hash SET NOT NULL;
