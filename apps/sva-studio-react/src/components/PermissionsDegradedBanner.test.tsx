import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const useAuthMock = vi.fn();
const invalidatePermissionsMock = vi.fn();

vi.mock('../providers/auth-provider', () => ({
  useAuth: () => useAuthMock(),
}));

describe('PermissionsDegradedBanner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('stays hidden when loading, healthy, or already dismissed state should not render', async () => {
    const { PermissionsDegradedBanner } = await import('./PermissionsDegradedBanner');

    useAuthMock.mockReturnValue({
      permissionsDegraded: false,
      invalidatePermissions: invalidatePermissionsMock,
      isLoading: false,
    });
    const healthy = render(<PermissionsDegradedBanner />);
    expect(screen.queryByRole('alert')).toBeNull();
    healthy.unmount();

    useAuthMock.mockReturnValue({
      permissionsDegraded: true,
      invalidatePermissions: invalidatePermissionsMock,
      isLoading: true,
    });
    render(<PermissionsDegradedBanner />);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('retries permission invalidation and disables the retry button while pending', async () => {
    let resolveInvalidate: (() => void) | undefined;
    invalidatePermissionsMock.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveInvalidate = resolve;
        })
    );
    useAuthMock.mockReturnValue({
      permissionsDegraded: true,
      invalidatePermissions: invalidatePermissionsMock,
      isLoading: false,
    });

    const { PermissionsDegradedBanner } = await import('./PermissionsDegradedBanner');
    render(<PermissionsDegradedBanner />);

    const retryButton = screen.getByRole('button', { name: 'Neu laden' });
    fireEvent.click(retryButton);

    expect(invalidatePermissionsMock).toHaveBeenCalledTimes(1);
    expect(retryButton.hasAttribute('disabled')).toBe(true);

    resolveInvalidate?.();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Neu laden' }).hasAttribute('disabled')).toBe(false);
    });
  });

  it('can be dismissed and becomes visible again once permissions recover and degrade again', async () => {
    const { PermissionsDegradedBanner } = await import('./PermissionsDegradedBanner');
    useAuthMock.mockReturnValue({
      permissionsDegraded: true,
      invalidatePermissions: invalidatePermissionsMock,
      isLoading: false,
    });

    const view = render(<PermissionsDegradedBanner />);
    fireEvent.click(screen.getByRole('button', { name: 'Schließen' }));
    expect(screen.queryByRole('alert')).toBeNull();

    useAuthMock.mockReturnValue({
      permissionsDegraded: false,
      invalidatePermissions: invalidatePermissionsMock,
      isLoading: false,
    });
    view.rerender(<PermissionsDegradedBanner />);
    expect(screen.queryByRole('alert')).toBeNull();

    useAuthMock.mockReturnValue({
      permissionsDegraded: true,
      invalidatePermissions: invalidatePermissionsMock,
      isLoading: false,
    });
    view.rerender(<PermissionsDegradedBanner />);
    expect(screen.getByRole('alert')).toBeTruthy();
  });
});
