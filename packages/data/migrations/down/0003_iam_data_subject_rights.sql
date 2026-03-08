DROP TABLE IF EXISTS iam.data_subject_recipient_notifications;
DROP TABLE IF EXISTS iam.account_profile_corrections;
DROP TABLE IF EXISTS iam.legal_holds;
DROP TABLE IF EXISTS iam.data_subject_export_jobs;
DROP TABLE IF EXISTS iam.data_subject_request_events;
DROP TABLE IF EXISTS iam.data_subject_requests;

ALTER TABLE iam.accounts
  DROP COLUMN IF EXISTS non_essential_processing_opt_out_at,
  DROP COLUMN IF EXISTS processing_restriction_reason,
  DROP COLUMN IF EXISTS processing_restricted_at,
  DROP COLUMN IF EXISTS permanently_deleted_at,
  DROP COLUMN IF EXISTS delete_after,
  DROP COLUMN IF EXISTS soft_deleted_at,
  DROP COLUMN IF EXISTS is_blocked;
