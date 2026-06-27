import { describe, expect, it } from 'vitest';

import {
  buildDirectPermissionRowsSql,
  buildPermissionRowsSql,
  buildPermissionTraceRowsSql,
} from './user-detail-permission-sql.js';

describe('user-detail-permission-sql', () => {
  it('omits legacy direct permission rows regardless of schema support', () => {
    expect(buildPermissionRowsSql(true)).not.toContain('FROM iam.account_permissions ap');
    expect(buildDirectPermissionRowsSql(true)).toContain("'[]'::json AS direct_permission_rows");
    expect(buildPermissionTraceRowsSql(true, true)).not.toContain("'direct_permission'::text AS source_kind");
    expect(buildPermissionRowsSql(false)).not.toContain('FROM iam.account_permissions ap');
    expect(buildDirectPermissionRowsSql(false)).toContain("'[]'::json AS direct_permission_rows");
    expect(buildPermissionTraceRowsSql(false, true)).not.toContain("'direct_permission'::text AS source_kind");
  });

  it('falls back to legacy permission projection when structured columns are missing', () => {
    const sql = buildPermissionTraceRowsSql(true, false);

    expect(sql).toContain('p.permission_key AS action');
    expect(sql).toContain("split_part(p.permission_key, '.', 1) AS resource_type");
    expect(sql).toContain('NULL::text AS resource_id');
    expect(sql).not.toContain(' AS effect');
    expect(sql).toContain('NULL::jsonb AS scope');
  });

  it('projects inheritance and inactive-reason fields into the permission trace', () => {
    const sql = buildPermissionTraceRowsSql(true, true);

    expect(sql).toContain("'inherited_from_organization_id'");
    expect(sql).toContain("'inherited_from_geo_unit_id'");
    expect(sql).toContain("'restricted_by_geo_unit_id'");
    expect(sql).toContain("'inactive_reason'");
    expect(sql).toContain("'group_disabled'");
    expect(sql).toContain("'membership_not_started'");
    expect(sql).toContain("'assignment_expired'");
    expect(sql).toContain('p.permission_key = ANY(ARRAY[');
    expect(sql).toContain('THEN ao.organization_id::text');
    expect(sql).toContain('ELSE NULL::text');
  });
});
