import { cleanup, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { HomePage } from './index';

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => () => ({}),
}));

describe('HomePage IAM integration', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('calls /iam/authorize after authenticated /auth/me response', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          user: {
            name: 'Test User',
            roles: ['editor'],
            instanceId: '11111111-1111-1111-8111-111111111111',
          },
        }),
      } satisfies Partial<Response>)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          allowed: true,
          reason: 'allowed_by_rbac',
        }),
      } satisfies Partial<Response>);

    vi.stubGlobal('fetch', fetchMock);

    render(<HomePage />);

    await waitFor(() => {
      expect(screen.getByText(/Erlaubt \(allowed_by_rbac\)/)).toBeTruthy();
    });

    expect(fetchMock).toHaveBeenCalledWith(
      '/auth/me',
      expect.objectContaining({ credentials: 'include' })
    );
    expect(fetchMock).toHaveBeenCalledWith(
      '/iam/authorize',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
      })
    );
  });
});

