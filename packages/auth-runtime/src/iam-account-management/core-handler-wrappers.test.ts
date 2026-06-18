import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  withAuthenticatedIamHandler: vi.fn(),
  userHandlers: {
    bulkDeactivateInternal: vi.fn(),
    createUserInternal: vi.fn(),
    deactivateUserInternal: vi.fn(),
    getMyProfileInternal: vi.fn(),
    getUserInternal: vi.fn(),
    getUserTimelineInternal: vi.fn(),
    listUsersInternal: vi.fn(),
    sendPasswordSetupEmailInternal: vi.fn(),
    syncUsersFromKeycloakInternal: vi.fn(),
    updateMyProfileInternal: vi.fn(),
    updateUserInternal: vi.fn(),
  },
  roleHandlers: {
    createRoleInternal: vi.fn(),
    deleteRoleInternal: vi.fn(),
    listPermissionsInternal: vi.fn(),
    listRolesInternal: vi.fn(),
    updateRoleInternal: vi.fn(),
  },
  reconcilePlaceholderInternal: vi.fn(),
}));

vi.mock('./core-shared.js', () => ({
  withAuthenticatedIamHandler: state.withAuthenticatedIamHandler,
}));

vi.mock('./user-bulk-deactivate-handler.js', () => ({
  bulkDeactivateInternal: state.userHandlers.bulkDeactivateInternal,
}));
vi.mock('./user-create-handler.js', () => ({
  createUserInternal: state.userHandlers.createUserInternal,
}));
vi.mock('./user-deactivate-handler.js', () => ({
  deactivateUserInternal: state.userHandlers.deactivateUserInternal,
}));
vi.mock('./user-import-sync-handler.js', () => ({
  syncUsersFromKeycloakInternal: state.userHandlers.syncUsersFromKeycloakInternal,
}));
vi.mock('./user-password-setup-email-handler.js', () => ({
  sendPasswordSetupEmailInternal: state.userHandlers.sendPasswordSetupEmailInternal,
}));
vi.mock('./profile-handlers.js', () => ({
  getMyProfileInternal: state.userHandlers.getMyProfileInternal,
  updateMyProfileInternal: state.userHandlers.updateMyProfileInternal,
}));
vi.mock('./user-read-handlers.js', () => ({
  getUserInternal: state.userHandlers.getUserInternal,
  getUserTimelineInternal: state.userHandlers.getUserTimelineInternal,
  listUsersInternal: state.userHandlers.listUsersInternal,
}));
vi.mock('./user-update-handler.js', () => ({
  updateUserInternal: state.userHandlers.updateUserInternal,
}));
vi.mock('./roles-handlers.js', () => ({
  listPermissionsInternal: state.roleHandlers.listPermissionsInternal,
  listRolesInternal: state.roleHandlers.listRolesInternal,
}));
vi.mock('./roles-handlers.create.js', () => ({
  createRoleInternal: state.roleHandlers.createRoleInternal,
}));
vi.mock('./roles-handlers.delete.js', () => ({
  deleteRoleInternal: state.roleHandlers.deleteRoleInternal,
}));
vi.mock('./roles-handlers.update.js', () => ({
  updateRoleInternal: state.roleHandlers.updateRoleInternal,
}));
vi.mock('./reconcile-handler.js', () => ({
  reconcilePlaceholderInternal: state.reconcilePlaceholderInternal,
}));

describe('IAM core handler wrappers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.withAuthenticatedIamHandler.mockResolvedValue(new Response('wrapped'));
  });

  it('forwards every user handler through withAuthenticatedIamHandler', async () => {
    const request = new Request('https://example.test/api/v1/iam/users');
    const module = await import('./core.js');

    await module.listUsersHandler(request);
    await module.getUserHandler(request);
    await module.getUserTimelineHandler(request);
    await module.createUserHandler(request);
    await module.sendPasswordSetupEmailHandler(request);
    await module.updateUserHandler(request);
    await module.deactivateUserHandler(request);
    await module.bulkDeactivateUsersHandler(request);
    await module.syncUsersFromKeycloakHandler(request);
    await module.updateMyProfileHandler(request);
    await module.getMyProfileHandler(request);

    expect(state.withAuthenticatedIamHandler.mock.calls).toEqual([
      [request, state.userHandlers.listUsersInternal],
      [request, state.userHandlers.getUserInternal],
      [request, state.userHandlers.getUserTimelineInternal],
      [request, state.userHandlers.createUserInternal],
      [request, state.userHandlers.sendPasswordSetupEmailInternal],
      [request, state.userHandlers.updateUserInternal],
      [request, state.userHandlers.deactivateUserInternal],
      [request, state.userHandlers.bulkDeactivateInternal],
      [request, state.userHandlers.syncUsersFromKeycloakInternal],
      [request, state.userHandlers.updateMyProfileInternal],
      [request, state.userHandlers.getMyProfileInternal],
    ]);
  });

  it('forwards every role handler through withAuthenticatedIamHandler', async () => {
    const request = new Request('https://example.test/api/v1/iam/roles');
    const module = await import('./core.js');

    await module.listRolesHandler(request);
    await module.listPermissionsHandler(request);
    await module.createRoleHandler(request);
    await module.updateRoleHandler(request);
    await module.deleteRoleHandler(request);
    await module.reconcileHandler(request);

    expect(state.withAuthenticatedIamHandler.mock.calls).toEqual([
      [request, state.roleHandlers.listRolesInternal],
      [request, state.roleHandlers.listPermissionsInternal],
      [request, state.roleHandlers.createRoleInternal],
      [request, state.roleHandlers.updateRoleInternal],
      [request, state.roleHandlers.deleteRoleInternal],
      [request, state.reconcilePlaceholderInternal],
    ]);
  });
});
