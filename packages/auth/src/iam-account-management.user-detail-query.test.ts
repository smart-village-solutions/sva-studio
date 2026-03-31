import { describe, expect, it, vi } from 'vitest';

import { resolveUserDetail } from './iam-account-management/user-detail-query';

describe('resolveUserDetail', () => {
  it('maps group memberships, direct permissions and permission rows from the detail query', async () => {
    const query = vi.fn().mockResolvedValue({
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
              permission_key: 'content.write',
              effect: 'deny',
              description: 'Inhalte bearbeiten',
            },
          ],
        },
      ],
    });

    const detail = await resolveUserDetail({ query } as never, {
      instanceId: 'de-musterhausen',
      userId: 'bbbbbbbb-bbbb-4111-8bbb-bbbbbbbbbbbb',
    });

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('AS group_rows'),
      ['de-musterhausen', 'bbbbbbbb-bbbb-4111-8bbb-bbbbbbbbbbbb']
    );
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
          permissionKey: 'content.write',
          effect: 'deny',
          description: 'Inhalte bearbeiten',
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
    const query = vi.fn().mockResolvedValue({ rows: [] });

    await expect(
      resolveUserDetail({ query } as never, {
        instanceId: 'de-musterhausen',
        userId: 'cccccccc-cccc-4111-8ccc-cccccccccccc',
      })
    ).resolves.toBeUndefined();
  });
});
