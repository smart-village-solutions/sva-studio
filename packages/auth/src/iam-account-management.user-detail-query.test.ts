import { describe, expect, it, vi } from 'vitest';

import { resolveUserDetail } from './iam-account-management/user-detail-query';
import { IamSchemaDriftError } from './runtime-errors.js';

describe('resolveUserDetail', () => {
  it('maps groups, direct permissions and permission traces from the detail query', async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({
        rows: [
          {
            account_permissions_exists: true,
            permissions_action_exists: true,
            permissions_resource_type_exists: true,
            permissions_resource_id_exists: true,
            permissions_effect_exists: true,
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
            direct_permission_rows: [
              {
                permission_id: 'perm-1',
                permission_key: 'content.updatePayload',
                effect: 'deny',
                description: 'Schreiben verweigern',
              },
            ],
            permission_trace_rows: [
              {
                permission_key: 'content.read',
                action: 'content.read',
                resource_type: 'content',
                resource_id: null,
                organization_id: 'org-1',
                effect: 'allow',
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
                valid_from: '2026-03-05T10:00:00.000Z',
                valid_to: null,
              },
              {
                permission_key: 'content.archive',
                action: 'content.archive',
                resource_type: 'content',
                resource_id: null,
                organization_id: null,
                effect: 'deny',
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

    expect(String(query.mock.calls[0]?.[0])).toContain("to_regclass('iam.account_permissions')");
    expect(query.mock.calls[1]).toEqual([
      expect.stringContaining('AS group_rows'),
      ['de-musterhausen', 'bbbbbbbb-bbbb-4111-8bbb-bbbbbbbbbbbb'],
    ]);
    expect(String(query.mock.calls[1]?.[0])).toContain('WHERE ap.instance_id = $1');
    expect(String(query.mock.calls[1]?.[0])).toContain('AND ap.account_id = a.id');
    expect(String(query.mock.calls[1]?.[0])).toContain('WHERE ar.instance_id = $1');
    expect(String(query.mock.calls[1]?.[0])).toContain('AND ar.account_id = a.id');
    expect(String(query.mock.calls[1]?.[0])).toContain('WHERE ag.instance_id = $1');
    expect(String(query.mock.calls[1]?.[0])).toContain('AND ag.account_id = a.id');
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
      directPermissions: [
        {
          permissionId: 'perm-1',
          permissionKey: 'content.updatePayload',
          effect: 'deny',
          description: 'Schreiben verweigern',
        },
      ],
      permissionTrace: [
        {
          permissionKey: 'content.read',
          sourceKind: 'group_role',
          isEffective: true,
          status: 'effective',
          groupKey: 'admins',
          roleKey: 'system_admin',
          organizationId: 'org-1',
        },
        {
          permissionKey: 'content.archive',
          sourceKind: 'direct_role',
          isEffective: false,
          status: 'expired',
          roleKey: 'system_admin',
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
            account_permissions_exists: true,
            permissions_action_exists: true,
            permissions_resource_type_exists: true,
            permissions_resource_id_exists: true,
            permissions_effect_exists: true,
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

  it('fails fast when the account permissions table is not available', async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({
        rows: [
          {
            account_permissions_exists: false,
            permissions_action_exists: true,
            permissions_resource_type_exists: true,
            permissions_resource_id_exists: true,
            permissions_effect_exists: true,
            permissions_scope_exists: true,
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
