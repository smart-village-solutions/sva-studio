import { describe, expect, it, vi } from 'vitest';

import {
  ensureActorCanManageTarget,
  ensureRoleAssignmentWithinActorLevel,
  isSystemAdminAccount,
  resolveActorMaxRoleLevel,
  resolveSystemAdminCount,
} from './actor-authorization.js';
import type { QueryClient } from './query-client.js';

const createClient = (handler: (text: string, values?: readonly unknown[]) => unknown): QueryClient => ({
  query: vi.fn(async (text, values) => handler(text, values) as never),
});

describe('actor-authorization', () => {
  it('combines persisted and session role levels', async () => {
    const client = createClient((text) => {
      if (text.includes('COALESCE(MAX')) {
        return { rowCount: 1, rows: [{ max_role_level: 20 }] };
      }
      return { rowCount: 1, rows: [{ id: 'role-1', role_key: 'editor', role_level: 50 }] };
    });

    await expect(
      resolveActorMaxRoleLevel(client, {
        instanceId: 'inst-1',
        keycloakSubject: 'subject-1',
        sessionRoleNames: [' Editor ', ''],
      })
    ).resolves.toBe(50);
  });

  it('treats system_admin from the session as level 100', async () => {
    const client = createClient(() => ({ rowCount: 1, rows: [{ max_role_level: 20 }] }));

    await expect(
      resolveActorMaxRoleLevel(client, {
        instanceId: 'inst-1',
        keycloakSubject: 'subject-1',
        sessionRoleNames: ['system_admin'],
      })
    ).resolves.toBe(100);
  });

  it('rejects target management above the actor level', () => {
    expect(
      ensureActorCanManageTarget({
        actorMaxRoleLevel: 20,
        actorRoles: ['editor'],
        targetRoles: [{ roleKey: 'admin', roleLevel: 50 }],
      })
    ).toEqual({
      ok: false,
      code: 'forbidden',
      message: 'Zielnutzer überschreitet die eigene Berechtigungsstufe.',
    });
  });

  it('allows system_admin to manage system_admin targets', () => {
    expect(
      ensureActorCanManageTarget({
        actorMaxRoleLevel: 0,
        actorRoles: ['system_admin'],
        targetRoles: [{ roleKey: 'system_admin', roleLevel: 100 }],
      })
    ).toEqual({ ok: true });
  });

  it('resolves system admin count and account state', async () => {
    const client = createClient((text) => {
      if (text.includes('COUNT(DISTINCT')) {
        return { rowCount: 1, rows: [{ admin_count: 2 }] };
      }
      return { rowCount: 1, rows: [{ has_role: true }] };
    });

    await expect(resolveSystemAdminCount(client, 'inst-1')).resolves.toBe(2);
    await expect(isSystemAdminAccount(client, { instanceId: 'inst-1', accountId: 'account-1' })).resolves.toBe(true);
  });

  it('rejects role assignment when one target role is missing', async () => {
    const client = createClient(() => ({ rowCount: 1, rows: [{ id: 'role-1', role_key: 'editor', role_level: 10 }] }));

    await expect(
      ensureRoleAssignmentWithinActorLevel({
        client,
        instanceId: 'inst-1',
        actorSubject: 'subject-1',
        roleIds: ['role-1', 'role-2'],
      })
    ).resolves.toEqual({
      ok: false,
      code: 'invalid_request',
      message: 'Mindestens eine Rolle existiert nicht.',
    });
  });
});
