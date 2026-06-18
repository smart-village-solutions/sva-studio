import { describe, expect, it, vi } from 'vitest';

import {
  executeStatusAction,
  getStatusActionDialogTranslationKeys,
  resolveSyncStatus,
} from './user-list-model';

const createUsersApiState = (overrides: Record<string, unknown> = {}) => ({
  updateUser: vi.fn(),
  deactivateUser: vi.fn(),
  bulkDeactivate: vi.fn(),
  ...overrides,
});

describe('user-list-model', () => {
  it('routes activation to updateUser', async () => {
    const usersApi = createUsersApiState();

    await executeStatusAction(usersApi as never, {
      action: 'activate',
      mode: 'single',
      userId: 'user-1',
    });

    expect(usersApi.updateUser).toHaveBeenCalledWith('user-1', { status: 'active' });
    expect(usersApi.deactivateUser).not.toHaveBeenCalled();
    expect(usersApi.bulkDeactivate).not.toHaveBeenCalled();
  });

  it('routes bulk deactivation to bulkDeactivate', async () => {
    const usersApi = createUsersApiState();

    await executeStatusAction(usersApi as never, {
      action: 'deactivate',
      mode: 'bulk',
      userIds: ['user-1', 'user-2'],
    });

    expect(usersApi.bulkDeactivate).toHaveBeenCalledWith(['user-1', 'user-2']);
    expect(usersApi.updateUser).not.toHaveBeenCalled();
    expect(usersApi.deactivateUser).not.toHaveBeenCalled();
  });

  it('detects empty sync reports without imported, updated, or review items', () => {
    expect(
      resolveSyncStatus({
        outcome: 'success',
        checkedCount: 3,
        correctedCount: 0,
        manualReviewCount: 0,
        importedCount: 0,
        updatedCount: 0,
        skippedCount: 3,
        totalKeycloakUsers: 3,
      })
    ).toBe('empty');
  });

  it('returns translation keys for activation dialogs', () => {
    expect(
      getStatusActionDialogTranslationKeys({
        action: 'activate',
        mode: 'single',
        userId: 'user-1',
      })
    ).toEqual({
      title: 'admin.users.confirm.activateTitle',
      description: 'admin.users.confirm.activateDescription',
      confirmLabel: 'admin.users.actions.activate',
    });
  });
});
