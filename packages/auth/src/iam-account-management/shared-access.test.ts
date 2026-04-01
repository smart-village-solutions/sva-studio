import { describe, expect, it } from 'vitest';

import { ensureActorCanManageTarget } from './shared-actor-authorization.js';

describe('iam-account-management/shared-actor-authorization', () => {
  it('allows system_admin actors to manage higher-level targets', () => {
    expect(
      ensureActorCanManageTarget({
        actorMaxRoleLevel: 10,
        actorRoles: ['system_admin'],
        targetRoles: [{ roleKey: 'editor', roleLevel: 50 }],
      })
    ).toEqual({ ok: true });
  });

  it('rejects targets above the actor role level', () => {
    expect(
      ensureActorCanManageTarget({
        actorMaxRoleLevel: 20,
        actorRoles: ['tenant_admin'],
        targetRoles: [{ roleKey: 'editor', roleLevel: 30 }],
      })
    ).toEqual({
      ok: false,
      code: 'forbidden',
      message: 'Zielnutzer überschreitet die eigene Berechtigungsstufe.',
    });
  });

  it('rejects system_admin targets for non-system-admin actors', () => {
    expect(
      ensureActorCanManageTarget({
        actorMaxRoleLevel: 100,
        actorRoles: ['tenant_admin'],
        targetRoles: [{ roleKey: 'system_admin', roleLevel: 100 }],
      })
    ).toEqual({
      ok: false,
      code: 'forbidden',
      message: 'Nur system_admin darf system_admin-Nutzer verwalten.',
    });
  });
});
