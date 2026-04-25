import { describe, expect, it } from 'vitest';

import {
  buildDirectPermissionRowsSql,
  buildPermissionRowsSql,
  buildPermissionTraceRowsSql,
} from './user-detail-permission-sql.js';

describe('user-detail-permission-sql', () => {
  it('includes direct permission rows only when supported by the schema', () => {
    expect(buildPermissionRowsSql(true)).toContain('FROM iam.account_permissions ap');
    expect(buildDirectPermissionRowsSql(true)).toContain("'permission_id', direct.permission_id");
    expect(buildPermissionTraceRowsSql(true, true)).toContain("'direct_permission'::text AS source_kind");

    expect(buildPermissionRowsSql(false)).not.toContain('FROM iam.account_permissions ap');
    expect(buildDirectPermissionRowsSql(false)).toContain("'[]'::json AS direct_permission_rows");
    expect(buildPermissionTraceRowsSql(false, true)).not.toContain("'direct_permission'::text AS source_kind");
  });

  it('falls back to legacy permission projection when structured columns are missing', () => {
    const sql = buildPermissionTraceRowsSql(true, false);

    expect(sql).toContain('p.permission_key AS action');
    expect(sql).toContain("split_part(p.permission_key, '.', 1) AS resource_type");
    expect(sql).toContain('NULL::text AS resource_id');
    expect(sql).toContain("'allow'::text AS effect");
    expect(sql).toContain('NULL::jsonb AS scope');
  });
});
