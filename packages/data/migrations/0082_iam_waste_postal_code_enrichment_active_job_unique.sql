-- +goose Up
CREATE UNIQUE INDEX idx_studio_jobs_active_waste_postal_code_enrichment
  ON iam.studio_jobs (instance_id, job_type_id)
  WHERE job_type_id = 'waste-management.enrich-postal-codes'
    AND status IN ('queued', 'running', 'retrying');

-- +goose Down
DROP INDEX IF EXISTS iam.idx_studio_jobs_active_waste_postal_code_enrichment;
