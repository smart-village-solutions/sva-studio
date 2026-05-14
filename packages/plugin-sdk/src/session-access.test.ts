import { describe, expect, it } from 'vitest';

import {
  publishSessionAccessSnapshot,
  readSessionAccessSnapshot,
  resetSessionAccessSnapshot,
  type SessionAccessSnapshot,
  subscribeSessionAccessSnapshot,
} from './session-access.js';

describe('plugin-sdk session access store', () => {
  it('publishes resolved permission actions to subscribers', () => {
    resetSessionAccessSnapshot();
    const notifications: SessionAccessSnapshot[] = [];
    const unsubscribe = subscribeSessionAccessSnapshot(() => {
      notifications.push(readSessionAccessSnapshot());
    });

    publishSessionAccessSnapshot({
      isResolved: true,
      permissionActions: ['waste-management.read', 'waste-management.settings.manage'],
    });

    expect(readSessionAccessSnapshot()).toEqual({
      isResolved: true,
      permissionActions: ['waste-management.read', 'waste-management.settings.manage'],
    });
    expect(notifications).toEqual([
      {
        isResolved: true,
        permissionActions: ['waste-management.read', 'waste-management.settings.manage'],
      },
    ]);

    unsubscribe();
    resetSessionAccessSnapshot();
  });

  it('suppresses duplicate snapshot notifications', () => {
    resetSessionAccessSnapshot();
    let notifications = 0;
    const unsubscribe = subscribeSessionAccessSnapshot(() => {
      notifications += 1;
    });

    publishSessionAccessSnapshot({
      isResolved: true,
      permissionActions: ['waste-management.read'],
    });
    publishSessionAccessSnapshot({
      isResolved: true,
      permissionActions: ['waste-management.read'],
    });

    expect(notifications).toBe(1);

    unsubscribe();
    resetSessionAccessSnapshot();
  });
});
