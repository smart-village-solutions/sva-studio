import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useIamAdminList } from './use-iam-admin-list';

vi.mock('../lib/browser-operation-logging', () => ({
  createOperationLogger: () => ({ info: vi.fn() }),
  logBrowserOperationFailure: vi.fn(),
  logBrowserOperationStart: vi.fn(),
  logBrowserOperationSuccess: vi.fn(),
}));

const createDeferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });
  return { promise, reject, resolve };
};

describe('useIamAdminList', () => {
  it('propagates the latest refresh failure to a superseded refresh', async () => {
    const firstRefresh = createDeferred<{ data: readonly string[] }>();
    const latestRefresh = createDeferred<{ data: readonly string[] }>();
    const listItems = vi
      .fn()
      .mockResolvedValueOnce({ data: ['initial'] })
      .mockReturnValueOnce(firstRefresh.promise)
      .mockReturnValueOnce(latestRefresh.promise);
    const refreshSession = vi.fn();
    const { result } = renderHook(() => useIamAdminList(listItems, refreshSession));

    await waitFor(() => expect(result.current.items).toEqual(['initial']));

    let supersededOutcome!: Promise<boolean>;
    let latestOutcome!: Promise<boolean>;
    act(() => {
      supersededOutcome = result.current.refetchWithOutcome();
      latestOutcome = result.current.refetchWithOutcome();
    });

    await act(async () => {
      firstRefresh.resolve({ data: ['stale'] });
      latestRefresh.reject(new Error('latest refresh failed'));
      await expect(supersededOutcome).resolves.toBe(false);
      await expect(latestOutcome).resolves.toBe(false);
    });

    expect(result.current.items).toEqual(['initial']);
    expect(result.current.error?.message).toBe('latest refresh failed');
  });
});
