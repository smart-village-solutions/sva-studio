import { describe, expect, it, vi } from 'vitest';

import { resolveUserDetail } from './user-detail-query.js';
import { readEffectiveAccountDeletionContentStrategy } from './user-detail-query.sql.js';
import { IamSchemaDriftError } from './runtime-errors.js';

describe('resolveUserDetail', () => {
  it('maps groups and role/group permission traces from the detail query', async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({
        rows: [
          {
            account_permissions_exists: false,
            permissions_action_exists: true,
            permissions_resource_type_exists: true,
            permissions_resource_id_exists: true,
            permissions_effect_exists: false,
            permissions_scope_exists: true,
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
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
            avatar_url: 'https://example.com/avatar.png',
            notes: 'Gruppenpflege aktiv',
            status: 'active',
            last_login_at: '2026-03-17T12:00:00.000Z',
            role_rows: [
              {
                id: 'role-1',
                role_key: 'system_admin',
                role_name: 'system_admin',
                display_name: 'System Admin',
                role_level: 90,
                is_system_role: true,
                valid_from: '2026-03-01T10:00:00.000Z',
                valid_to: null,
              },
            ],
            group_rows: [
              {
                id: 'group-1',
                group_key: 'admins',
                display_name: 'Admins',
                group_type: 'role_bundle',
                origin: 'manual',
                valid_from: '2026-03-05T10:00:00.000Z',
                valid_to: null,
              },
            ],
            permission_rows: [{ permission_key: 'content.read' }],
            permission_trace_rows: [
              {
                permission_key: 'content.read',
                action: 'content.read',
                resource_type: 'content',
                resource_id: null,
                organization_id: 'org-1',
                scope: { geoUnitId: 'geo-1' },
                is_effective: true,
                status: 'effective',
                source_kind: 'group_role',
                role_id: 'role-1',
                role_key: 'system_admin',
                role_name: 'system_admin',
                group_id: 'group-1',
                group_key: 'admins',
                group_display_name: 'Admins',
                group_active: true,
                assignment_origin: 'manual',
                inherited_from_organization_id: 'org-1',
                inherited_from_geo_unit_id: 'geo-parent-1',
                restricted_by_geo_unit_id: 'geo-child-1',
                inactive_reason: null,
                valid_from: '2026-03-05T10:00:00.000Z',
                valid_to: null,
              },
              {
                permission_key: 'media.read',
                action: 'media.read',
                resource_type: 'media',
                resource_id: null,
                organization_id: null,
                scope: null,
                access_scope: null,
                is_effective: true,
                status: 'effective',
                source_kind: 'direct_role',
                role_id: 'role-1',
                role_key: 'system_admin',
                role_name: 'system_admin',
                group_id: null,
                group_key: null,
                group_display_name: null,
                group_active: null,
                assignment_origin: null,
                inherited_from_organization_id: null,
                inherited_from_geo_unit_id: null,
                restricted_by_geo_unit_id: null,
                inactive_reason: null,
                valid_from: '2026-03-05T10:00:00.000Z',
                valid_to: null,
              },
              {
                permission_key: 'content.archive',
                action: 'content.archive',
                resource_type: 'content',
                resource_id: null,
                organization_id: null,
                scope: null,
                is_effective: false,
                status: 'expired',
                source_kind: 'direct_role',
                role_id: 'role-1',
                role_key: 'system_admin',
                role_name: 'system_admin',
                group_id: null,
                group_key: null,
                group_display_name: null,
                group_active: null,
                assignment_origin: null,
                inherited_from_organization_id: null,
                inherited_from_geo_unit_id: null,
                restricted_by_geo_unit_id: null,
                inactive_reason: 'assignment_expired',
                valid_from: '2026-02-01T10:00:00.000Z',
                valid_to: '2026-02-28T10:00:00.000Z',
              },
            ],
          },
        ],
      });

    const detail = await resolveUserDetail({ query } as never, {
      instanceId: 'de-musterhausen',
      userId: 'bbbbbbbb-bbbb-4111-8bbb-bbbbbbbbbbbb',
    });

    expect(String(query.mock.calls[0]?.[0])).not.toContain("to_regclass('iam.account_permissions')");
    expect(query.mock.calls[1]).toEqual([
      expect.stringContaining('AS group_rows'),
      ['de-musterhausen', 'bbbbbbbb-bbbb-4111-8bbb-bbbbbbbbbbbb'],
    ]);
    expect(String(query.mock.calls[1]?.[0])).not.toContain('FROM iam.account_permissions');
    expect(String(query.mock.calls[1]?.[0])).toContain('WHERE ar.instance_id = $1');
    expect(String(query.mock.calls[1]?.[0])).toContain('AND ar.account_id = a.id');
    expect(String(query.mock.calls[1]?.[0])).toContain('WHERE ag.instance_id = $1');
    expect(String(query.mock.calls[1]?.[0])).toContain('AND ag.account_id = a.id');
    expect(String(query.mock.calls[1]?.[0])).toContain('p.permission_key = ANY(ARRAY[');
    expect(detail).toMatchObject({
      id: 'bbbbbbbb-bbbb-4111-8bbb-bbbbbbbbbbbb',
      keycloakSubject: 'keycloak-target-1',
      displayName: 'Alice Admin',
      email: 'alice@example.com',
      firstName: 'Alice',
      lastName: 'Admin',
      phone: '+4912345',
      preferredLanguage: 'de',
      timezone: 'Europe/Berlin',
      avatarUrl: 'https://example.com/avatar.png',
      notes: 'Gruppenpflege aktiv',
      permissions: ['content.read'],
      permissionTrace: [
        {
          permissionKey: 'content.read',
          runtimeScope: 'record',
          sourceKind: 'group_role',
          isEffective: true,
          status: 'effective',
          groupKey: 'admins',
          roleKey: 'system_admin',
          organizationId: 'org-1',
          inheritedFromOrganizationId: 'org-1',
          inheritedFromGeoUnitId: 'geo-parent-1',
          restrictedByGeoUnitId: 'geo-child-1',
        },
        {
          permissionKey: 'media.read',
          runtimeScope: 'instance',
          sourceKind: 'direct_role',
          isEffective: true,
          status: 'effective',
          roleKey: 'system_admin',
          organizationId: undefined,
        },
        {
          permissionKey: 'content.archive',
          runtimeScope: 'record',
          sourceKind: 'direct_role',
          isEffective: false,
          status: 'expired',
          roleKey: 'system_admin',
          inactiveReason: 'assignment_expired',
        },
      ],
      groups: [
        {
          groupId: 'group-1',
          groupKey: 'admins',
          displayName: 'Admins',
          groupType: 'role_bundle',
          origin: 'manual',
          validFrom: '2026-03-05T10:00:00.000Z',
        },
      ],
      mainserverUserApplicationSecretSet: false,
    });
  });

  it('returns undefined when the detail query finds no matching user', async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({
        rows: [
          {
            account_permissions_exists: false,
            permissions_action_exists: true,
            permissions_resource_type_exists: true,
            permissions_resource_id_exists: true,
            permissions_effect_exists: false,
            permissions_scope_exists: true,
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [] });

    await expect(
      resolveUserDetail({ query } as never, {
        instanceId: 'de-musterhausen',
        userId: 'cccccccc-cccc-4111-8ccc-cccccccccccc',
      })
    ).resolves.toBeUndefined();
  });

  it('reads the effective account deletion content strategy from tenant default plus account override', async () => {
    const query = vi.fn().mockResolvedValue({
      rowCount: 1,
      rows: [{ effective_content_strategy: 'with_owner_lifecycle' }],
    });

    await expect(
      readEffectiveAccountDeletionContentStrategy({ query } as never, {
        instanceId: 'de-musterhausen',
        accountId: 'bbbbbbbb-bbbb-4111-8bbb-bbbbbbbbbbbb',
      })
    ).resolves.toBe('with_owner_lifecycle');

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('account_deletion_content_preferences'),
      ['de-musterhausen', 'bbbbbbbb-bbbb-4111-8bbb-bbbbbbbbbbbb']
    );
    expect(String(query.mock.calls[0]?.[0])).toContain('allow_content_preference_override');
    expect(String(query.mock.calls[0]?.[0])).toContain('COALESCE(rules.allow_content_preference_override, false) = true');
    expect(String(query.mock.calls[0]?.[0])).toContain('preference.content_strategy IS NOT NULL');
    expect(String(query.mock.calls[0]?.[0])).toContain("COALESCE(rules.default_content_strategy, 'retain')");
  });

  it('falls back to retain when no tenant deletion rules row exists', async () => {
    const query = vi.fn().mockResolvedValue({
      rowCount: 0,
      rows: [],
    });

    await expect(
      readEffectiveAccountDeletionContentStrategy({ query } as never, {
        instanceId: 'de-musterhausen',
        accountId: 'cccccccc-cccc-4111-8ccc-cccccccccccc',
      })
    ).resolves.toBe('retain');
  });

  it('does not require the legacy account permissions table', async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({
        rows: [
          {
            account_permissions_exists: false,
            permissions_action_exists: true,
            permissions_resource_type_exists: true,
            permissions_resource_id_exists: true,
            permissions_effect_exists: false,
            permissions_scope_exists: true,
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [] });

    await expect(
      resolveUserDetail({ query } as never, {
        instanceId: 'de-musterhausen',
        userId: 'bbbbbbbb-bbbb-4111-8bbb-bbbbbbbbbbbb',
      })
    ).resolves.toBeUndefined();
    expect(query).toHaveBeenCalledTimes(2);
  });

  it('fails fast when structured permission columns are not available', async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({
        rows: [
          {
            account_permissions_exists: false,
            permissions_action_exists: false,
            permissions_resource_type_exists: false,
            permissions_resource_id_exists: false,
            permissions_effect_exists: false,
            permissions_scope_exists: false,
          },
        ],
      });

    await expect(
      resolveUserDetail({ query } as never, {
        instanceId: 'de-musterhausen',
        userId: 'bbbbbbbb-bbbb-4111-8bbb-bbbbbbbbbbbb',
      })
    ).rejects.toBeInstanceOf(IamSchemaDriftError);
    expect(query).toHaveBeenCalledTimes(1);
  });
});
