ALTER TABLE iam.organizations
  ADD COLUMN IF NOT EXISTS parent_organization_id UUID,
  ADD COLUMN IF NOT EXISTS organization_type TEXT NOT NULL DEFAULT 'other',
  ADD COLUMN IF NOT EXISTS content_author_policy TEXT NOT NULL DEFAULT 'org_only',
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS hierarchy_path UUID[] NOT NULL DEFAULT ARRAY[]::uuid[],
  ADD COLUMN IF NOT EXISTS depth INTEGER NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'organizations_parent_fk'
      AND conrelid = 'iam.organizations'::regclass
  ) THEN
    ALTER TABLE iam.organizations
      ADD CONSTRAINT organizations_parent_fk
      FOREIGN KEY (instance_id, parent_organization_id)
      REFERENCES iam.organizations (instance_id, id)
      ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'organizations_parent_not_self_chk'
      AND conrelid = 'iam.organizations'::regclass
  ) THEN
    ALTER TABLE iam.organizations
      ADD CONSTRAINT organizations_parent_not_self_chk
      CHECK (parent_organization_id IS NULL OR parent_organization_id <> id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'organizations_type_chk'
      AND conrelid = 'iam.organizations'::regclass
  ) THEN
    ALTER TABLE iam.organizations
      ADD CONSTRAINT organizations_type_chk
      CHECK (organization_type IN ('county', 'municipality', 'district', 'company', 'agency', 'other'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'organizations_content_author_policy_chk'
      AND conrelid = 'iam.organizations'::regclass
  ) THEN
    ALTER TABLE iam.organizations
      ADD CONSTRAINT organizations_content_author_policy_chk
      CHECK (content_author_policy IN ('org_only', 'org_or_personal'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'organizations_depth_nonnegative_chk'
      AND conrelid = 'iam.organizations'::regclass
  ) THEN
    ALTER TABLE iam.organizations
      ADD CONSTRAINT organizations_depth_nonnegative_chk
      CHECK (depth >= 0);
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_organizations_parent
  ON iam.organizations(instance_id, parent_organization_id);

CREATE INDEX IF NOT EXISTS idx_organizations_type_active
  ON iam.organizations(instance_id, organization_type, is_active);

ALTER TABLE iam.account_organizations
  ADD COLUMN IF NOT EXISTS is_default_context BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS membership_visibility TEXT NOT NULL DEFAULT 'internal';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'account_organizations_visibility_chk'
      AND conrelid = 'iam.account_organizations'::regclass
  ) THEN
    ALTER TABLE iam.account_organizations
      ADD CONSTRAINT account_organizations_visibility_chk
      CHECK (membership_visibility IN ('internal', 'external'));
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_account_organizations_org_account
  ON iam.account_organizations(instance_id, organization_id, account_id);

WITH ranked_memberships AS (
  SELECT
    instance_id,
    account_id,
    organization_id,
    ROW_NUMBER() OVER (PARTITION BY instance_id, account_id ORDER BY created_at ASC, organization_id ASC) AS membership_rank
  FROM iam.account_organizations
)
UPDATE iam.account_organizations AS membership
SET is_default_context = false
WHERE membership.is_default_context;

WITH ranked_memberships AS (
  SELECT
    instance_id,
    account_id,
    organization_id,
    ROW_NUMBER() OVER (PARTITION BY instance_id, account_id ORDER BY created_at ASC, organization_id ASC) AS membership_rank
  FROM iam.account_organizations
)
UPDATE iam.account_organizations AS membership
SET is_default_context = true
FROM ranked_memberships
WHERE membership.instance_id = ranked_memberships.instance_id
  AND membership.account_id = ranked_memberships.account_id
  AND membership.organization_id = ranked_memberships.organization_id
  AND ranked_memberships.membership_rank = 1;

CREATE UNIQUE INDEX IF NOT EXISTS uq_account_organizations_default_context
  ON iam.account_organizations(instance_id, account_id)
  WHERE is_default_context;

UPDATE iam.organizations
SET
  hierarchy_path = ARRAY[]::uuid[],
  depth = 0
WHERE parent_organization_id IS NULL;

WITH RECURSIVE organization_tree AS (
  SELECT
    organization.id,
    organization.instance_id,
    organization.parent_organization_id,
    ARRAY[]::uuid[] AS hierarchy_path,
    0 AS depth
  FROM iam.organizations AS organization
  WHERE organization.parent_organization_id IS NULL

  UNION ALL

  SELECT
    child.id,
    child.instance_id,
    child.parent_organization_id,
    organization_tree.hierarchy_path || child.parent_organization_id,
    organization_tree.depth + 1
  FROM iam.organizations AS child
  JOIN organization_tree
    ON organization_tree.instance_id = child.instance_id
   AND organization_tree.id = child.parent_organization_id
)
UPDATE iam.organizations AS organization
SET
  hierarchy_path = organization_tree.hierarchy_path,
  depth = organization_tree.depth
FROM organization_tree
WHERE organization.id = organization_tree.id
  AND organization.instance_id = organization_tree.instance_id;
