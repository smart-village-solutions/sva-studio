import { describe, expect, it, vi } from 'vitest';

import { notifyIamUsersUpdated, subscribeIamUsersUpdated } from './iam-user-events';

describe('iam-user-events', () => {
  it('dispatches the users-updated event in the browser', () => {
    const listener = vi.fn();
    window.addEventListener('sva:iam-users-updated', listener);

    notifyIamUsersUpdated();

    expect(listener).toHaveBeenCalledTimes(1);
    window.removeEventListener('sva:iam-users-updated', listener);
  });

  it('subscribes and unsubscribes listeners', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeIamUsersUpdated(listener);

    notifyIamUsersUpdated();
    unsubscribe();
    notifyIamUsersUpdated();

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('is safe when window is unavailable', () => {
    const originalWindow = globalThis.window;

    vi.stubGlobal('window', undefined);

    expect(() => notifyIamUsersUpdated()).not.toThrow();
    expect(subscribeIamUsersUpdated(() => undefined)()).toBeUndefined();

    vi.stubGlobal('window', originalWindow);
  });
});
