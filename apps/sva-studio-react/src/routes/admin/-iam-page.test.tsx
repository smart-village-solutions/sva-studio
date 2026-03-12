import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { IamViewerPage } from './-iam-page';

const useAuthMock = vi.fn();
const isIamViewerEnabledMock = vi.fn();
const hasIamViewerAdminRoleMock = vi.fn();

vi.mock('../../providers/auth-provider', () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock('../../lib/iam-viewer-access', () => ({
  isIamViewerEnabled: () => isIamViewerEnabledMock(),
  hasIamViewerAdminRole: () => hasIamViewerAdminRoleMock(),
}));

describe('IamViewerPage', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    cleanup();
  });

  it('renders loading state while auth is loading', () => {
    useAuthMock.mockReturnValue({
      user: null,
      isLoading: true,
      error: null,
      invalidatePermissions: vi.fn(),
    });
    isIamViewerEnabledMock.mockReturnValue(true);
    hasIamViewerAdminRoleMock.mockReturnValue(true);

    render(<IamViewerPage />);

    expect(screen.getByText('IAM-Viewer wird initialisiert ...')).toBeTruthy();
  });

  it('renders feature-disabled state', () => {
    useAuthMock.mockReturnValue({
      user: { id: 'user-1', instanceId: '11111111-1111-1111-8111-111111111111' },
      isLoading: false,
      error: null,
      invalidatePermissions: vi.fn(),
    });
    isIamViewerEnabledMock.mockReturnValue(false);
    hasIamViewerAdminRoleMock.mockReturnValue(true);

    render(<IamViewerPage />);

    expect(screen.getByText(/IAM-Viewer ist deaktiviert/)).toBeTruthy();
  });

  it('renders auth error state', () => {
    useAuthMock.mockReturnValue({
      user: null,
      isLoading: false,
      error: new Error('auth failed'),
      invalidatePermissions: vi.fn(),
    });
    isIamViewerEnabledMock.mockReturnValue(true);
    hasIamViewerAdminRoleMock.mockReturnValue(true);

    render(<IamViewerPage />);

    expect(screen.getByRole('alert').textContent).toContain('auth failed');
  });

  it('renders access denied for non-admin user', () => {
    useAuthMock.mockReturnValue({
      user: { id: 'user-1', instanceId: '11111111-1111-1111-8111-111111111111' },
      isLoading: false,
      error: null,
      invalidatePermissions: vi.fn(),
    });
    isIamViewerEnabledMock.mockReturnValue(true);
    hasIamViewerAdminRoleMock.mockReturnValue(false);

    render(<IamViewerPage />);

    expect(screen.getByText('Zugriff verweigert: Admin-Rolle erforderlich.')).toBeTruthy();
  });

  it('renders viewer content for admin users', () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            permissions: [],
            requestId: 'req-test',
            traceId: 'trace-test',
            subject: {
              actorUserId: 'user-1',
              effectiveUserId: 'user-1',
              isImpersonating: false,
            },
          }),
          { status: 200 }
        )
      )
    );

    useAuthMock.mockReturnValue({
      user: { id: 'user-1', instanceId: '11111111-1111-1111-8111-111111111111' },
      isLoading: false,
      error: null,
      invalidatePermissions: vi.fn(),
    });
    isIamViewerEnabledMock.mockReturnValue(true);
    hasIamViewerAdminRoleMock.mockReturnValue(true);

    render(<IamViewerPage />);

    expect(screen.getByRole('heading', { name: 'IAM Rechte-Matrix-Viewer' })).toBeTruthy();
  });

  it('shows permissions fetch error and invalidates permissions on 403', async () => {
    vi.useRealTimers();
    const invalidatePermissions = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify({ error: 'forbidden_scope' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    );

    useAuthMock.mockReturnValue({
      user: { id: 'user-1', instanceId: '11111111-1111-1111-8111-111111111111' },
      isLoading: false,
      error: null,
      invalidatePermissions,
    });
    isIamViewerEnabledMock.mockReturnValue(true);
    hasIamViewerAdminRoleMock.mockReturnValue(true);

    render(<IamViewerPage />);

    await waitFor(() => {
      expect(invalidatePermissions).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByRole('alert').textContent).toContain('forbidden_scope');
  });

  it('submits authorize request and shows ALLOWED decision', async () => {
    vi.useRealTimers();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            permissions: [],
            requestId: 'req-test',
            traceId: 'trace-test',
            subject: {
              actorUserId: 'user-1',
              effectiveUserId: 'user-1',
              isImpersonating: false,
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            allowed: true,
            reason: 'Policy matched',
            reasonCode: 'policy_allow',
            diagnostics: { evaluatedRules: 1 },
            evaluatedAt: '2026-03-05T20:00:00.000Z',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );
    vi.stubGlobal('fetch', fetchMock);

    useAuthMock.mockReturnValue({
      user: { id: 'user-1', instanceId: '11111111-1111-1111-8111-111111111111' },
      isLoading: false,
      error: null,
      invalidatePermissions: vi.fn(),
    });
    isIamViewerEnabledMock.mockReturnValue(true);
    hasIamViewerAdminRoleMock.mockReturnValue(true);

    render(<IamViewerPage />);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/iam/me/permissions?'),
        expect.objectContaining({ credentials: 'include' })
      );
    });

    fireEvent.click(screen.getAllByRole('button', { name: 'Authorize prüfen' })[0]!);

    await waitFor(() => {
      expect(screen.getByText('ALLOWED')).toBeTruthy();
      expect(screen.getByText(/Reason: Policy matched/)).toBeTruthy();
    });

    expect(fetchMock).toHaveBeenLastCalledWith(
      '/iam/authorize',
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('shows an empty state when no permissions are returned', async () => {
    vi.useRealTimers();
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          permissions: [],
          subject: {
            actorUserId: 'user-1',
            effectiveUserId: 'user-1',
            isImpersonating: false,
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );
    vi.stubGlobal('fetch', fetchMock);

    useAuthMock.mockReturnValue({
      user: { id: 'user-1', instanceId: '11111111-1111-1111-8111-111111111111' },
      isLoading: false,
      error: null,
      invalidatePermissions: vi.fn(),
    });
    isIamViewerEnabledMock.mockReturnValue(true);
    hasIamViewerAdminRoleMock.mockReturnValue(true);

    render(<IamViewerPage />);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });

    expect(screen.getByText('Keine Berechtigungen gefunden.')).toBeTruthy();
  });

  it('shows a client-side validation error when instance id is missing on authorize', async () => {
    vi.useRealTimers();
    useAuthMock.mockReturnValue({
      user: { id: 'user-1', instanceId: '' },
      isLoading: false,
      error: null,
      invalidatePermissions: vi.fn(),
    });
    isIamViewerEnabledMock.mockReturnValue(true);
    hasIamViewerAdminRoleMock.mockReturnValue(true);
    vi.stubGlobal('fetch', vi.fn());

    render(<IamViewerPage />);

    fireEvent.change(screen.getByLabelText('Instance ID'), { target: { value: '' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Authorize prüfen' })[0]!);

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain('instanceId fehlt');
    });
  });

  it('shows authorize errors from failed requests', async () => {
    vi.useRealTimers();
    const invalidatePermissions = vi.fn().mockResolvedValue(undefined);
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            permissions: [],
            subject: {
              actorUserId: 'user-1',
              effectiveUserId: 'user-1',
              isImpersonating: false,
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'forbidden_scope' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        })
      );
    vi.stubGlobal('fetch', fetchMock);

    useAuthMock.mockReturnValue({
      user: { id: 'user-1', instanceId: '11111111-1111-1111-8111-111111111111' },
      isLoading: false,
      error: null,
      invalidatePermissions,
    });
    isIamViewerEnabledMock.mockReturnValue(true);
    hasIamViewerAdminRoleMock.mockReturnValue(true);

    render(<IamViewerPage />);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getAllByRole('button', { name: 'Authorize prüfen' })[0]!);

    await waitFor(() => {
      expect(invalidatePermissions).toHaveBeenCalledTimes(1);
      expect(screen.getByRole('alert').textContent).toContain('forbidden_scope');
    });
  });
});
