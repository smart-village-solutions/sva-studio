import { act, renderHook } from '@testing-library/react';
import type React from 'react';
import { describe, expect, it, vi } from 'vitest';

import type { useUser } from '../../../hooks/use-user';
import { useUserSaveActions } from './-use-user-save-actions';
import { toUserFormValues } from './user-edit-model';

type UserApi = ReturnType<typeof useUser>;

const createUserApi = (overrides: Partial<UserApi> = {}): UserApi => ({
  user: null,
  isLoading: false,
  error: null,
  mutationError: null,
  refetch: vi.fn(async () => undefined),
  clearMutationError: vi.fn(),
  save: vi.fn(async () => null),
  ...overrides,
});

describe('useUserSaveActions', () => {
  it('returns to idle when the user update fails', async () => {
    const preventDefault = vi.fn();
    const setFormValues: React.Dispatch<React.SetStateAction<ReturnType<typeof toUserFormValues>>> =
      vi.fn();
    const { result } = renderHook(() =>
      useUserSaveActions(createUserApi(), toUserFormValues(null), setFormValues, false)
    );

    await act(async () => {
      await result.current.onSave({
        preventDefault,
      } as unknown as React.FormEvent<HTMLFormElement>);
    });

    expect(preventDefault).toHaveBeenCalledOnce();
    expect(setFormValues).not.toHaveBeenCalled();
    expect(result.current.saveStatus).toBe('idle');
  });

  it('keeps optional account operations safe when unavailable or unsuccessful', async () => {
    const resendPasswordSetupEmail = vi.fn(async () => false);
    const reprovisionMainserverData = vi.fn(async () => false);
    const setFormValues: React.Dispatch<React.SetStateAction<ReturnType<typeof toUserFormValues>>> =
      vi.fn();
    const { result, rerender } = renderHook(
      ({ userApi }: { userApi: UserApi }) =>
        useUserSaveActions(userApi, toUserFormValues(null), setFormValues, true),
      { initialProps: { userApi: createUserApi() } }
    );

    await act(async () => {
      await result.current.onSendPasswordSetupEmail();
      await result.current.onReprovisionMainserverData();
    });
    expect(result.current.passwordSetupEmailSuccess).toBe(false);
    expect(result.current.mainserverReprovisionSuccess).toBe(false);

    rerender({
      userApi: createUserApi({ resendPasswordSetupEmail, reprovisionMainserverData }),
    });
    await act(async () => {
      await result.current.onSendPasswordSetupEmail();
      await result.current.onReprovisionMainserverData();
    });

    expect(resendPasswordSetupEmail).toHaveBeenCalledOnce();
    expect(reprovisionMainserverData).toHaveBeenCalledOnce();
    expect(result.current.passwordSetupEmailSuccess).toBe(false);
    expect(result.current.mainserverReprovisionSuccess).toBe(false);
  });
});
