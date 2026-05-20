BEGIN;

INSERT INTO iam.instance_deletion_rules (
  instance_id,
  deactivate_after_days,
  pseudonymize_after_days,
  delete_after_days,
  default_content_strategy
)
VALUES
  ('de-musterhausen', 90, 180, 365, 'retain')
ON CONFLICT (instance_id) DO UPDATE
SET
  deactivate_after_days = EXCLUDED.deactivate_after_days,
  pseudonymize_after_days = EXCLUDED.pseudonymize_after_days,
  delete_after_days = EXCLUDED.delete_after_days,
  default_content_strategy = EXCLUDED.default_content_strategy,
  updated_at = NOW();

COMMIT;
