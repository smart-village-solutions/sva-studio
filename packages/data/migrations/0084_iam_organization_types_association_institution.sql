-- +goose Up
ALTER TABLE iam.organizations
  DROP CONSTRAINT IF EXISTS organizations_type_chk,
  ADD CONSTRAINT organizations_type_chk CHECK (
    organization_type IN (
      'county',
      'municipality',
      'district',
      'company',
      'agency',
      'association',
      'institution',
      'other'
    )
  );

-- +goose Down
ALTER TABLE iam.organizations
  DROP CONSTRAINT IF EXISTS organizations_type_chk,
  ADD CONSTRAINT organizations_type_chk CHECK (
    organization_type IN ('county', 'municipality', 'district', 'company', 'agency', 'other')
  );
