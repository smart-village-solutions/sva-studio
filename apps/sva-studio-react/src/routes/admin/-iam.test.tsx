import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { IamViewerPage } from './-iam-page';

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => () => ({}),
}));

describe('IamViewerPage', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('shows access denied for non-admin users when feature flag is enabled', async () => {
    vi.stubEnv('VITE_ENABLE_IAM_ADMIN_VIEWER', 'true');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          user: {
            id: 'user-1',
            name: 'User',
            roles: ['editor'],
            instanceId: '11111111-1111-1111-8111-111111111111',
          },
        }),
      } satisfies Partial<Response>)
    );

    render(<IamViewerPage />);

    await waitFor(() => {
      expect(screen.getByText('Zugriff verweigert: Admin-Rolle erforderlich.')).toBeTruthy();
    });
  });

  it('reloads permissions when scope input changes', async () => {
    vi.stubEnv('VITE_ENABLE_IAM_ADMIN_VIEWER', 'true');

    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const path = typeof input === 'string' ? input : input.toString();
      if (path === '/auth/me') {
        return {
          ok: true,
          json: async () => ({
            user: {
              id: 'user-1',
              name: 'Admin',
              roles: ['admin'],
              instanceId: '11111111-1111-1111-8111-111111111111',
            },
          }),
        } satisfies Partial<Response>;
      }

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
