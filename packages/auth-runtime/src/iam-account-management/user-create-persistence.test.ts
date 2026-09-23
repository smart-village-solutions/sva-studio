import { describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  createUserCreatePersistence: vi.fn(() => ({
    persistCreatedUser: vi.fn(),
    prepareCreatedUserAssignments: vi.fn(),
  })),
  protectField: vi.fn(),
  assignGroups: vi.fn(),
  assignRoles: vi.fn(),
  emitActivityLog: vi.fn(),
  ensureRoleAssignmentWithinActorLevel: vi.fn(),
  notifyPermissionInvalidation: vi.fn(),
  resolveGroupsByIds: vi.fn(),
  resolveRoleIdsForGroups: vi.fn(),
  resolveRolesByIds: vi.fn(),
}));

vi.mock('@sva/iam-admin', () => ({
  createUserCreatePersistence: state.createUserCreatePersistence,
}));

vi.mock('./encryption.js', () => ({ protectField: state.protectField }));

vi.mock('./shared.js', () => ({
  assignGroups: state.assignGroups,
  assignRoles: state.assignRoles,
  emitActivityLog: state.emitActivityLog,
  ensureRoleAssignmentWithinActorLevel: state.ensureRoleAssignmentWithinActorLevel,
  notifyPermissionInvalidation: state.notifyPermissionInvalidation,
  resolveGroupsByIds: state.resolveGroupsByIds,
  resolveRoleIdsForGroups: state.resolveRoleIdsForGroups,
  resolveRolesByIds: state.resolveRolesByIds,
}));

describe('user-create-persistence', () => {
  it('wires the existing runtime dependencies into the shared persistence factory', async () => {
    const persistence = await import('./user-create-persistence.js');

    expect(state.createUserCreatePersistence).toHaveBeenCalledWith({
      assignGroups: state.assignGroups,
      assignRoles: state.assignRoles,
      emitActivityLog: state.emitActivityLog,
      ensureRoleAssignmentWithinActorLevel: state.ensureRoleAssignmentWithinActorLevel,
      notifyPermissionInvalidation: state.notifyPermissionInvalidation,
      protectField: state.protectField,
      resolveGroupsByIds: state.resolveGroupsByIds,
      resolveRoleIdsForGroups: state.resolveRoleIdsForGroups,
      resolveRolesByIds: state.resolveRolesByIds,
    });
    expect(persistence.persistCreatedUser).toBe(
      state.createUserCreatePersistence.mock.results[0]?.value.persistCreatedUser
    );
    expect(persistence.prepareCreatedUserAssignments).toBe(
      state.createUserCreatePersistence.mock.results[0]?.value.prepareCreatedUserAssignments
    );
  });
});
