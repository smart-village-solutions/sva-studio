import { describe, expect, it, vi } from 'vitest';

import {
  ensureActorCanManageTarget,
  ensureDeleteTargetIsAllowed,
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
  it('deduplicates normalized session role names before resolving role levels', async () => {
    let resolvedRoleNames: readonly unknown[] | undefined;
    const client = createClient((text, values) => {
      if (text.includes('COALESCE(MAX')) {
        return { rowCount: 1, rows: [{ max_role_level: 20 }] };
      }
      resolvedRoleNames = values?.[1] as readonly unknown[] | undefined;
      return { rowCount: 1, rows: [{ id: 'role-1', role_key: 'editor', role_level: 50 }] };
    });

    await expect(
      resolveActorMaxRoleLevel(client, {
        instanceId: 'inst-1',
        keycloakSubject: 'subject-1',
        sessionRoleNames: [' Editor ', 'Editor', ''],
      })
    ).resolves.toBe(50);
    expect(resolvedRoleNames).toEqual(['Editor']);
  });

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

  it('falls back to the persisted role level when no session roles are present', async () => {
    const client = createClient(() => ({ rowCount: 1, rows: [{ max_role_level: 20 }] }));

    await expect(
      resolveActorMaxRoleLevel(client, {
        instanceId: 'inst-1',
        keycloakSubject: 'subject-1',
      })
    ).resolves.toBe(20);
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

  it('rejects non-admin actors from managing system_admin targets', () => {
    expect(
      ensureActorCanManageTarget({
        actorMaxRoleLevel: 100,
        actorRoles: ['editor'],
        targetRoles: [{ roleKey: 'system_admin', roleLevel: 100 }],
      })
    ).toEqual({
      ok: false,
      code: 'forbidden',
      message: 'Nur system_admin darf system_admin-Nutzer verwalten.',
    });
  });

  it('allows managing targets within the actor level', () => {
    expect(
      ensureActorCanManageTarget({
        actorMaxRoleLevel: 50,
        actorRoles: ['editor'],
        targetRoles: [{ roleKey: 'editor', roleLevel: 20 }],
      })
    ).toEqual({ ok: true });
  });

  it('blocks deleting system_admin targets even for system_admin actors', () => {
    expect(
      ensureDeleteTargetIsAllowed({
        targetRoles: [{ roleKey: 'system_admin', roleLevel: 100 }],
      })
    ).toEqual({
      ok: false,
      code: 'system_admin_delete_protection',
      message: 'system_admin muss vor der Löschung entzogen werden.',
    });
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

  it('allows role assignment immediately for system_admin actors', async () => {
    const client = createClient(() => ({
      rowCount: 1,
      rows: [{ id: 'role-1', role_key: 'editor', role_level: 10 }],
    }));

    await expect(
      ensureRoleAssignmentWithinActorLevel({
        client,
        instanceId: 'inst-1',
        actorSubject: 'subject-1',
        actorRoles: ['system_admin'],
        roleIds: ['role-1'],
      })
    ).resolves.toMatchObject({
      ok: true,
      roles: [{ role_key: 'editor', role_level: 10 }],
    });
  });

  it('rejects role assignments above the actor level', async () => {
    const client = createClient((text) => {
      if (text.includes('COALESCE(MAX')) {
        return { rowCount: 1, rows: [{ max_role_level: 10 }] };
      }
      return { rowCount: 1, rows: [{ id: 'role-1', role_key: 'manager', role_level: 20 }] };
    });

    await expect(
      ensureRoleAssignmentWithinActorLevel({
        client,
        instanceId: 'inst-1',
        actorSubject: 'subject-1',
        roleIds: ['role-1'],
      })
    ).resolves.toEqual({
      ok: false,
      code: 'forbidden',
      message: 'Rollenzuweisung überschreitet die eigene Berechtigungsstufe.',
    });
  });

  it('rejects assigning the root-only instance_registry_admin role even for system_admin actors', async () => {
    const client = createClient(() => ({
      rowCount: 1,
      rows: [
        {
          id: 'role-root',
          role_key: 'instance_registry_admin',
          external_role_name: 'instance_registry_admin',
          role_level: 90,
        },
      ],
    }));

    await expect(
      ensureRoleAssignmentWithinActorLevel({
        client,
        instanceId: 'inst-1',
        actorSubject: 'subject-1',
        actorRoles: ['system_admin'],
        roleIds: ['role-root'],
      })
    ).resolves.toEqual({
      ok: false,
      code: 'invalid_request',
      message: 'Mindestens eine Rolle ist im Tenant nicht verwaltbar.',
    });
  });
});
