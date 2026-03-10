import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { IamViewerPage } from './-iam-page';

const useAuthMock = vi.fn();

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => () => ({}),
}));

vi.mock('../../providers/auth-provider', () => ({
  useAuth: () => useAuthMock(),
}));

describe('IamViewerPage', () => {
  afterEach(() => {
    cleanup();
    useAuthMock.mockReset();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('shows access denied for non-admin users when feature flag is enabled', async () => {
    vi.stubEnv('VITE_ENABLE_IAM_ADMIN_VIEWER', 'true');
    useAuthMock.mockReturnValue({
      user: {
        id: 'user-1',
        name: 'User',
        roles: ['editor'],
        instanceId: '11111111-1111-1111-8111-111111111111',
      },
      isAuthenticated: true,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
      logout: vi.fn(),
      invalidatePermissions: vi.fn(),
    });

    render(<IamViewerPage />);

    await waitFor(() => {
      expect(screen.getByText('Zugriff verweigert: Admin-Rolle erforderlich.')).toBeTruthy();
    });
  });

  it('reloads permissions when scope input changes', async () => {
    vi.stubEnv('VITE_ENABLE_IAM_ADMIN_VIEWER', 'true');
    useAuthMock.mockReturnValue({
      user: {
        id: 'user-1',
        name: 'Admin',
        roles: ['admin'],
        instanceId: '11111111-1111-1111-8111-111111111111',
      },
      isAuthenticated: true,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
      logout: vi.fn(),
      invalidatePermissions: vi.fn(),
    });

    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const path = typeof input === 'string' ? input : input.toString();
      if (path.startsWith('/iam/me/permissions')) {
        return {
          ok: true,
          json: async () => ({
            instanceId: '11111111-1111-1111-8111-111111111111',
            permissions: [],
            subject: {
              actorUserId: 'user-1',
              effectiveUserId: 'user-1',
              isImpersonating: false,
            },
            evaluatedAt: '2026-03-01T12:00:00.000Z',
          }),
        } satisfies Partial<Response>;
      }

      return {
        ok: false,
        status: 404,
        json: async () => ({ error: 'not_found' }),
      } satisfies Partial<Response>;
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<IamViewerPage />);

    await waitFor(() => {
      expect(screen.getByText('IAM Rechte-Matrix-Viewer')).toBeTruthy();
    });

    await new Promise((resolve) => setTimeout(resolve, 350));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/iam/me/permissions?'),
        expect.objectContaining({ credentials: 'include' })
      );
    });

    const actingAsInput = screen.getByLabelText('actingAsUserId (optional)');
    fireEvent.change(actingAsInput, { target: { value: 'target-user' } });

    await new Promise((resolve) => setTimeout(resolve, 350));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('actingAsUserId=target-user'),
        expect.objectContaining({ credentials: 'include' })
      );
    });
  });
});
