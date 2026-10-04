import type { IamInstanceId, IamUuid } from '../types.js';
import type { SqlStatement } from './types.js';

const asUuidArrayParameter = (values: readonly IamUuid[]) => ({
  sqlType: 'uuid[]' as const,
  values,
});

export const organizationStatements = {
  upsertInstance: (input: { id: IamInstanceId; displayName: string }): SqlStatement => ({
    text: `
INSERT INTO iam.instances (id, display_name)
VALUES ($1, $2)
ON CONFLICT (id) DO UPDATE
SET
  display_name = EXCLUDED.display_name,
  updated_at = NOW();
`,
    values: [input.id, input.displayName],
  }),

  upsertOrganization: (input: {
    id: IamUuid;
    instanceId: IamInstanceId;
    organizationKey: string;
    displayName: string;
    metadata: string;
    organizationType: 'county' | 'municipality' | 'district' | 'company' | 'agency' | 'association' | 'institution' | 'other';
    contentAuthorPolicy: 'org_only' | 'org_or_personal';
    parentOrganizationId?: IamUuid;
    hierarchyPath: readonly IamUuid[];
    depth: number;
    isActive?: boolean;
  }): SqlStatement => ({
    text: `
INSERT INTO iam.organizations (
  id,
  instance_id,
  organization_key,
  display_name,
  metadata,
  organization_type,
  content_author_policy,
  parent_organization_id,
  hierarchy_path,
  depth,
  is_active
)
VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9::uuid[], $10, $11)
ON CONFLICT (instance_id, organization_key) DO UPDATE
SET
  display_name = EXCLUDED.display_name,
  metadata = EXCLUDED.metadata,
  organization_type = EXCLUDED.organization_type,
  content_author_policy = EXCLUDED.content_author_policy,
  parent_organization_id = EXCLUDED.parent_organization_id,
  hierarchy_path = EXCLUDED.hierarchy_path,
  depth = EXCLUDED.depth,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();
`,
    values: [
      input.id, input.instanceId, input.organizationKey, input.displayName, input.metadata, input.organizationType,
      input.contentAuthorPolicy, input.parentOrganizationId ?? null, asUuidArrayParameter(input.hierarchyPath),
      input.depth, input.isActive ?? true,
    ],
  }),

  upsertGeoUnit: (input: {
    id: IamUuid;
    instanceId: IamInstanceId;
    geoKey: string;
    displayName: string;
    geoType: 'country' | 'state' | 'county' | 'municipality' | 'district' | 'custom';
    metadata: string;
    parentGeoUnitId?: IamUuid;
    hierarchyPath: readonly IamUuid[];
    depth: number;
    isActive?: boolean;
  }): SqlStatement => ({
    text: `
INSERT INTO iam.geo_units (
  id,
  instance_id,
  geo_key,
  display_name,
  geo_type,
  metadata,
  parent_geo_unit_id,
  hierarchy_path,
  depth,
  is_active
)
VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8::uuid[], $9, $10)
ON CONFLICT (instance_id, geo_key) DO UPDATE
SET
  display_name = EXCLUDED.display_name,
  geo_type = EXCLUDED.geo_type,
  metadata = EXCLUDED.metadata,
  parent_geo_unit_id = EXCLUDED.parent_geo_unit_id,
  hierarchy_path = EXCLUDED.hierarchy_path,
  depth = EXCLUDED.depth,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();
`,
    values: [
      input.id,
      input.instanceId,
      input.geoKey,
      input.displayName,
      input.geoType,
      input.metadata,
      input.parentGeoUnitId ?? null,
      asUuidArrayParameter(input.hierarchyPath),
      input.depth,
      input.isActive ?? true,
    ],
  }),
};
