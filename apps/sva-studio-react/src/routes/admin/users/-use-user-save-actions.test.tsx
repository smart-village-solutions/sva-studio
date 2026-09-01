import { act, renderHook } from '@testing-library/react';
import { useForm } from 'react-hook-form';
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
    const save = vi.fn(async () => null);
    const { result } = renderHook(() => {
      const form = useForm({ defaultValues: toUserFormValues(null) });
      return useUserSaveActions(createUserApi({ save }), form, false);
    });

    await act(async () => {
      await result.current.onSave();
    });

    expect(save).toHaveBeenCalledOnce();
    expect(result.current.saveStatus).toBe('idle');
  });

  it('keeps optional account operations safe when unavailable or unsuccessful', async () => {
    const resendPasswordSetupEmail = vi.fn(async () => false);
    const reprovisionMainserverData = vi.fn(async () => false);
    const { result, rerender } = renderHook(
      ({ userApi }: { userApi: UserApi }) => {
        const form = useForm({ defaultValues: toUserFormValues(null) });
        return useUserSaveActions(userApi, form, true);
      },
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
