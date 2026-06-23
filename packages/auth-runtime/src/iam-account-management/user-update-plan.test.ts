import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  getRoleExternalName: vi.fn((role: { role_key?: string; externalName?: string }) => role.externalName ?? role.role_key ?? 'unknown'),
  resolveActorMaxRoleLevel: vi.fn(),
  resolveUserDetail: vi.fn(),
  ensureActorCanManageTarget: vi.fn(),
  ensureTenantManageableRoleAssignments: vi.fn(),
  ensureRoleAssignmentWithinActorLevel: vi.fn(),
  resolveRolesByIds: vi.fn(),
  resolveGroupsByIds: vi.fn(),
  resolveRoleIdsForGroups: vi.fn(),
  resolveSystemAdminCount: vi.fn(),
  hasSystemAdminRole: vi.fn(),
}));

vi.mock('./role-audit.js', () => ({
  getRoleExternalName: state.getRoleExternalName,
}));

vi.mock('./shared.js', () => ({
  ensureActorCanManageTarget: state.ensureActorCanManageTarget,
  ensureTenantManageableRoleAssignments: state.ensureTenantManageableRoleAssignments,
  ensureRoleAssignmentWithinActorLevel: state.ensureRoleAssignmentWithinActorLevel,
  resolveActorMaxRoleLevel: state.resolveActorMaxRoleLevel,
  resolveGroupsByIds: state.resolveGroupsByIds,
  resolveRoleIdsForGroups: state.resolveRoleIdsForGroups,
  resolveRolesByIds: state.resolveRolesByIds,
  resolveSystemAdminCount: state.resolveSystemAdminCount,
}));

vi.mock('./user-detail-query.js', () => ({
  resolveUserDetail: state.resolveUserDetail,
}));

vi.mock('./user-update-utils.js', () => ({
  hasSystemAdminRole: state.hasSystemAdminRole,
}));

describe('resolveUserUpdatePlan', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.resolveActorMaxRoleLevel.mockResolvedValue(50);
    state.resolveUserDetail.mockResolvedValue({
      id: 'user-1',
      status: 'active',
      roles: [{ roleId: 'role-1', roleKey: 'editor', roleName: 'Editor' }],
    });
    state.ensureActorCanManageTarget.mockReturnValue({ ok: true });
    state.ensureTenantManageableRoleAssignments.mockResolvedValue({
      ok: true,
      roles: [{ role_key: 'editor', externalName: 'editor' }],
    });
    state.ensureRoleAssignmentWithinActorLevel.mockResolvedValue({
      ok: true,
      roles: [{ role_key: 'editor', externalName: 'editor' }],
    });
    state.resolveRolesByIds.mockResolvedValue([
      { role_key: 'editor', externalName: 'editor' },
      { role_key: 'system_admin', externalName: 'system_admin' },
    ]);
    state.resolveGroupsByIds.mockResolvedValue([{ id: 'group-1' }]);
    state.resolveRoleIdsForGroups.mockResolvedValue(['role-1']);
    state.resolveSystemAdminCount.mockResolvedValue(2);
    state.hasSystemAdminRole.mockReturnValue(false);
  });

  it('returns undefined when the target user does not exist', async () => {
    const { resolveUserUpdatePlan } = await import('./user-update-plan.js');
    state.resolveUserDetail.mockResolvedValueOnce(undefined);

    await expect(
      resolveUserUpdatePlan({} as never, {
        instanceId: 'instance-1',
        actorSubject: 'kc-actor',
        actorRoles: ['editor'],
        userId: 'user-1',
        payload: {},
      } as never)
    ).resolves.toBeUndefined();
  });

  it('enforces target access and role assignment validation for non-system-admin actors', async () => {
    const { resolveUserUpdatePlan } = await import('./user-update-plan.js');

    state.ensureActorCanManageTarget.mockReturnValueOnce({
      ok: false,
      code: 'forbidden',
      message: 'Nicht erlaubt',
    });
    await expect(
      resolveUserUpdatePlan({} as never, {
        instanceId: 'instance-1',
        actorSubject: 'kc-actor',
        actorRoles: ['editor'],
        userId: 'user-1',
        payload: {},
      } as never)
    ).rejects.toThrow('forbidden:Nicht erlaubt');

    state.ensureRoleAssignmentWithinActorLevel.mockResolvedValueOnce({
      ok: false,
      code: 'forbidden',
      message: 'Rollen zu hoch',
    });
    await expect(
      resolveUserUpdatePlan({} as never, {
        instanceId: 'instance-1',
        actorSubject: 'kc-actor',
        actorRoles: ['editor'],
        userId: 'user-1',
        payload: { roleIds: ['role-1'] },
      } as never)
    ).rejects.toThrow('forbidden:Rollen zu hoch');
  });

  it('guards system-admin removal, missing groups and bundled group roles', async () => {
    const { resolveUserUpdatePlan } = await import('./user-update-plan.js');
    state.resolveUserDetail.mockResolvedValueOnce({
      id: 'user-1',
      status: 'active',
      roles: [{ roleId: 'role-2', roleKey: 'system_admin', roleName: 'System Admin' }],
    });
    state.hasSystemAdminRole.mockReturnValue(true);
    state.resolveRolesByIds
      .mockResolvedValueOnce([{ role_key: 'system_admin', externalName: 'system_admin' }])
      .mockResolvedValueOnce([{ role_key: 'editor', externalName: 'editor' }]);
    state.resolveSystemAdminCount.mockResolvedValueOnce(1);

    await expect(
      resolveUserUpdatePlan({} as never, {
        instanceId: 'instance-1',
        actorSubject: 'kc-actor',
        actorRoles: ['editor'],
        userId: 'user-1',
        payload: { roleIds: ['role-1'] },
      } as never)
    ).rejects.toThrow('last_admin_protection');

    state.resolveGroupsByIds.mockResolvedValueOnce([]);
    await expect(
      resolveUserUpdatePlan({} as never, {
        instanceId: 'instance-1',
        actorSubject: 'kc-actor',
        actorRoles: ['system_admin'],
        userId: 'user-1',
        payload: { groupIds: ['group-1'] },
      } as never)
    ).rejects.toThrow('invalid_request:Mindestens eine aktive Gruppe existiert nicht.');

    state.resolveGroupsByIds.mockResolvedValueOnce([{ id: 'group-1' }]);
    state.resolveRoleIdsForGroups.mockResolvedValueOnce(['role-bundled']);
    state.ensureTenantManageableRoleAssignments.mockResolvedValueOnce({
      ok: true,
      roles: [{ role_key: 'role-bundled', externalName: 'role-bundled' }],
    });
    state.ensureRoleAssignmentWithinActorLevel.mockResolvedValueOnce({
      ok: false,
      code: 'forbidden',
      message: 'Gruppenrolle zu hoch',
    });
    await expect(
      resolveUserUpdatePlan({} as never, {
        instanceId: 'instance-1',
        actorSubject: 'kc-actor',
        actorRoles: ['editor'],
        userId: 'user-1',
        payload: { groupIds: ['group-1'] },
      } as never)
    ).rejects.toThrow('forbidden:Gruppenrolle zu hoch');
  });

  it('returns a plan with technical role names and skips actor checks for system admins', async () => {
    const { resolveUserUpdatePlan } = await import('./user-update-plan.js');
    state.resolveUserDetail.mockResolvedValueOnce({
      id: 'user-1',
      status: 'active',
      roles: [{ roleId: 'role-1', roleKey: 'editor', roleName: 'Editor' }],
    });
    state.resolveRolesByIds.mockResolvedValueOnce([{ role_key: 'editor', externalName: 'external-editor' }]);
    state.ensureTenantManageableRoleAssignments.mockResolvedValueOnce({
      ok: true,
      roles: [{ role_key: 'editor', externalName: 'editor' }],
    });

    const plan = await resolveUserUpdatePlan({} as never, {
      instanceId: 'instance-1',
      actorSubject: 'kc-actor',
      actorRoles: ['system_admin'],
      userId: 'user-1',
      payload: { roleIds: ['role-9'], status: 'active' },
    } as never);

    expect(plan).toMatchObject({
      previousRoleNames: [],
      nextRoleNames: [],
    });
    expect(state.ensureActorCanManageTarget).not.toHaveBeenCalled();
  });

  it('adds canonical technical role names for aliased system_admin rows', async () => {
    const { resolveUserUpdatePlan } = await import('./user-update-plan.js');
    state.resolveUserDetail.mockResolvedValueOnce({
      id: 'user-1',
      status: 'active',
      roles: [{ roleId: 'role-admin', roleKey: 'system_admin', roleName: 'System Admin' }],
    });
    state.resolveRolesByIds.mockResolvedValueOnce([
      { role_key: 'system_admin', externalName: 'legacy-system-admin' },
    ]);
    state.ensureTenantManageableRoleAssignments.mockResolvedValueOnce({
      ok: true,
      roles: [{ role_key: 'system_admin', externalName: 'legacy-system-admin' }],
    });

    const plan = await resolveUserUpdatePlan({} as never, {
      instanceId: 'instance-1',
      actorSubject: 'kc-actor',
      actorRoles: ['system_admin'],
      userId: 'user-1',
      payload: { roleIds: ['role-admin'], status: 'active' },
    } as never);

    expect(plan).toMatchObject({
      previousRoleNames: ['system_admin'],
      nextRoleNames: ['system_admin'],
    });
  });

  it('rejects root-only tenant role assignments even for system_admin actors', async () => {
    const { resolveUserUpdatePlan } = await import('./user-update-plan.js');
    state.resolveUserDetail.mockResolvedValueOnce({
      id: 'user-1',
      status: 'active',
      roles: [{ roleId: 'role-1', roleKey: 'editor', roleName: 'Editor' }],
    });
    state.resolveRolesByIds.mockResolvedValueOnce([{ role_key: 'editor', externalName: 'external-editor' }]);
    state.ensureTenantManageableRoleAssignments.mockResolvedValueOnce({
      ok: false,
      code: 'invalid_request',
      message: 'Mindestens eine Rolle ist im Tenant nicht verwaltbar.',
    });

    await expect(
      resolveUserUpdatePlan({} as never, {
        instanceId: 'instance-1',
        actorSubject: 'kc-actor',
        actorRoles: ['system_admin'],
        userId: 'user-1',
        payload: { roleIds: ['role-root'], status: 'active' },
      } as never)
    ).rejects.toThrow('invalid_request:Mindestens eine Rolle ist im Tenant nicht verwaltbar.');
  });
});
