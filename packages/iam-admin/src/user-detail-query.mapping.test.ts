import { describe, expect, it } from 'vitest';

import { mapUserDetailRow } from './user-detail-query.mapping.js';
import type { UserDetailRow } from './user-detail-query.types.js';

describe('user-detail-query.mapping', () => {
  it('maps inheritance and inactive-reason metadata on permission trace entries', () => {
    const detail = mapUserDetailRow({
      id: 'bbbbbbbb-bbbb-4111-8bbb-bbbbbbbbbbbb',
      keycloak_subject: 'keycloak-target-1',
      username_ciphertext: 'alice',
      display_name_ciphertext: 'Alice Admin',
      email_ciphertext: 'alice@example.com',
      first_name_ciphertext: 'Alice',
      last_name_ciphertext: 'Admin',
      phone_ciphertext: '+4912345',
      position: 'Leitung',
      department: 'IAM',
      preferred_language: 'de',
      timezone: 'Europe/Berlin',
      avatar_url: null,
      notes: null,
      status: 'active',
      last_login_at: null,
      role_rows: [],
      group_rows: [],
      permission_rows: [],
      direct_permission_rows: [],
      permission_trace_rows: [
        {
          permission_key: 'content.read',
          action: 'content.read',
          resource_type: 'content',
          resource_id: null,
          organization_id: 'org-1',
          effect: 'allow',
          scope: { allowedGeoUnitIds: ['geo-parent-1'] },
          is_effective: false,
          status: 'disabled',
          source_kind: 'group_role',
          role_id: 'role-1',
          role_key: 'system_admin',
          role_name: 'system_admin',
          group_id: 'group-1',
          group_key: 'admins',
          group_display_name: 'Admins',
          group_active: false,
          assignment_origin: 'manual',
          inherited_from_organization_id: 'org-1',
          inherited_from_geo_unit_id: 'geo-parent-1',
          restricted_by_geo_unit_id: 'geo-child-1',
          inactive_reason: 'group_disabled',
          valid_from: '2026-03-05T10:00:00.000Z',
          valid_to: null,
        },
      ],
    } satisfies UserDetailRow);

    expect(detail.permissionTrace).toEqual([
      expect.objectContaining({
        permissionKey: 'content.read',
        inheritedFromOrganizationId: 'org-1',
        inheritedFromGeoUnitId: 'geo-parent-1',
        restrictedByGeoUnitId: 'geo-child-1',
        inactiveReason: 'group_disabled',
      }),
    ]);
  });
});
