DROP INDEX IF EXISTS iam.uq_account_organizations_default_context;
DROP INDEX IF EXISTS iam.idx_account_organizations_org_account;
DROP INDEX IF EXISTS iam.idx_organizations_type_active;
DROP INDEX IF EXISTS iam.idx_organizations_parent;

ALTER TABLE iam.account_organizations
  DROP CONSTRAINT IF EXISTS account_organizations_visibility_chk;

ALTER TABLE iam.organizations
  DROP CONSTRAINT IF EXISTS organizations_parent_fk,
  DROP CONSTRAINT IF EXISTS organizations_parent_not_self_chk,
  DROP CONSTRAINT IF EXISTS organizations_type_chk,
  DROP CONSTRAINT IF EXISTS organizations_content_author_policy_chk,
  DROP CONSTRAINT IF EXISTS organizations_depth_nonnegative_chk;

ALTER TABLE iam.account_organizations
  DROP COLUMN IF EXISTS is_default_context,
  DROP COLUMN IF EXISTS membership_visibility;

ALTER TABLE iam.organizations
  DROP COLUMN IF EXISTS parent_organization_id,
  DROP COLUMN IF EXISTS organization_type,
  DROP COLUMN IF EXISTS content_author_policy,
  DROP COLUMN IF EXISTS is_active,
  DROP COLUMN IF EXISTS hierarchy_path,
  DROP COLUMN IF EXISTS depth;
