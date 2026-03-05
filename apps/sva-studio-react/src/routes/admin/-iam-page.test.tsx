import { render, screen } from '@testing-library/react';
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
});
