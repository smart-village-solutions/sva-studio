import { describe, expect, it, vi } from 'vitest';

import { loadMappedUsersBySubject } from './tenant-keycloak-user-query.js';

describe('tenant-keycloak-user-query', () => {
  it('skips the database when no subjects are requested', async () => {
    const client = {
      query: vi.fn(),
    };

    const result = await loadMappedUsersBySubject(client, {
      instanceId: 'de-musterhausen',
      subjects: [],
    });

    expect(result).toEqual(new Map());
    expect(client.query).not.toHaveBeenCalled();
  });

  it('loads mapped users by Keycloak subject and preserves external role names', async () => {
    const client = {
      query: vi.fn(async () => ({
        rows: [
          {
            id: 'account-1',
            keycloak_subject: 'kc-user-1',
            display_name_ciphertext: 'Alice Admin',
            first_name_ciphertext: null,
            last_name_ciphertext: null,
            email_ciphertext: 'alice@example.org',
            position: null,
            department: null,
            status: 'active',
            last_login_at: '2026-04-25T10:00:00.000Z',
            role_rows: [
              {
                id: 'role-1',
                role_key: 'editor',
                role_name: 'editor',
                display_name: 'Editor',
                external_role_name: 'mainserver_editor',
                role_level: 10,
                is_system_role: false,
              },
            ],
          },
        ],
      })),
    };

    const result = await loadMappedUsersBySubject(client, {
      instanceId: 'de-musterhausen',
      subjects: ['kc-user-1'],
    });

    expect(client.query).toHaveBeenCalledWith(expect.stringContaining('WHERE a.keycloak_subject = ANY($2::text[])'), [
      'de-musterhausen',
      ['kc-user-1'],
    ]);
    expect(result.get('kc-user-1')).toMatchObject({
      id: 'account-1',
      keycloakSubject: 'kc-user-1',
      displayName: 'Alice Admin',
      email: 'alice@example.org',
      roles: [
        {
          roleId: 'role-1',
          roleKey: 'editor',
          roleName: 'Editor',
          roleLevel: 10,
        },
      ],
    });
  });
});
