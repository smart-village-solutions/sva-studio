import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { IamViewerPage } from './-iam-page';

const useAuthMock = vi.fn();
const useNavigateMock = vi.fn();
const listGovernanceCasesMock = vi.fn();
const listAdminDsrCasesMock = vi.fn();
const getAllowedIamCockpitTabsMock = vi.fn();
const hasIamCockpitAccessRoleMock = vi.fn();
const isIamCockpitEnabledMock = vi.fn();

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => useNavigateMock,
}));

vi.mock('../../providers/auth-provider', () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock('../../lib/iam-api', () => ({
  listGovernanceCases: (...args: unknown[]) => listGovernanceCasesMock(...args),
  listAdminDsrCases: (...args: unknown[]) => listAdminDsrCasesMock(...args),
}));

vi.mock('../../lib/iam-viewer-access', () => ({
  getAllowedIamCockpitTabs: (...args: unknown[]) => getAllowedIamCockpitTabsMock(...args),
  hasIamCockpitAccessRole: (...args: unknown[]) => hasIamCockpitAccessRoleMock(...args),
  isIamCockpitEnabled: () => isIamCockpitEnabledMock(),
}));

describe('IamViewerPage', () => {
  const adminUser = {
    id: 'user-1',
    name: 'Admin',
    roles: ['system_admin'],
    instanceId: '11111111-1111-1111-8111-111111111111',
  };

  beforeEach(() => {
    useAuthMock.mockReset();
    useNavigateMock.mockReset();
    listGovernanceCasesMock.mockReset();
    listAdminDsrCasesMock.mockReset();
    getAllowedIamCockpitTabsMock.mockReset();
    hasIamCockpitAccessRoleMock.mockReset();
    isIamCockpitEnabledMock.mockReset();
  });

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
    isIamCockpitEnabledMock.mockReturnValue(true);
    hasIamCockpitAccessRoleMock.mockReturnValue(true);
    getAllowedIamCockpitTabsMock.mockReturnValue(['rights']);

    render(<IamViewerPage activeTab="rights" />);

    expect(screen.getByText('IAM Transparenz-Cockpit wird initialisiert ...')).toBeTruthy();
  });

  it('redirects to the first allowed tab when the current tab is not allowed', async () => {
    useAuthMock.mockReturnValue({
      user: { ...adminUser, roles: ['compliance_officer'] },
      isLoading: false,
      error: null,
      invalidatePermissions: vi.fn(),
    });
    isIamCockpitEnabledMock.mockReturnValue(true);
    hasIamCockpitAccessRoleMock.mockReturnValue(true);
    getAllowedIamCockpitTabsMock.mockReturnValue(['governance']);

    render(<IamViewerPage activeTab="rights" />);

    await waitFor(() => {
      expect(useNavigateMock).toHaveBeenCalledWith({
        to: '/admin/iam',
        search: { tab: 'governance' },
        replace: true,
      });
    });
  });

  it('shows a rights fetch error and invalidates permissions on 403', async () => {
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
      user: adminUser,
      isLoading: false,
      error: null,
      invalidatePermissions,
    });
    isIamCockpitEnabledMock.mockReturnValue(true);
    hasIamCockpitAccessRoleMock.mockReturnValue(true);
    getAllowedIamCockpitTabsMock.mockReturnValue(['rights']);

    render(<IamViewerPage activeTab="rights" />);

    await waitFor(() => {
      expect(invalidatePermissions).toHaveBeenCalledTimes(1);
      expect(screen.getByRole('alert').textContent).toContain('forbidden_scope');
    });
  });

  it('submits authorize checks on the rights tab', async () => {
    const fetchMock = vi
      .fn()
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
        new Response(
          JSON.stringify({
            allowed: true,
            reason: 'Policy matched',
            diagnostics: { reason_code: 'policy_allow' },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );
    vi.stubGlobal('fetch', fetchMock);

    useAuthMock.mockReturnValue({
      user: adminUser,
      isLoading: false,
      error: null,
      invalidatePermissions: vi.fn(),
    });
    isIamCockpitEnabledMock.mockReturnValue(true);
    hasIamCockpitAccessRoleMock.mockReturnValue(true);
    getAllowedIamCockpitTabsMock.mockReturnValue(['rights']);

    render(<IamViewerPage activeTab="rights" />);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/iam/me/permissions?'),
        expect.objectContaining({ credentials: 'include' })
      );
    });

    fireEvent.click(screen.getByRole('button', { name: 'Authorize prüfen' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenLastCalledWith(
        '/iam/authorize',
        expect.objectContaining({ method: 'POST' })
      );
      expect(screen.getByText('Erlaubt')).toBeTruthy();
      expect(screen.getByText('policy_allow')).toBeTruthy();
    });
  });

  it('loads governance entries without touching the permissions endpoint', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    listGovernanceCasesMock.mockResolvedValue({
      data: [
        {
          id: 'gov-1',
          type: 'delegation',
          status: 'open',
          title: 'Delegation freigeben',
          summary: 'Zusätzliche Freigabe für Redaktion',
          createdAt: '2026-03-15T10:00:00.000Z',
          metadata: {},
        },
      ],
    });

    useAuthMock.mockReturnValue({
      user: { ...adminUser, roles: ['security_admin'] },
      isLoading: false,
      error: null,
      invalidatePermissions: vi.fn(),
    });
    isIamCockpitEnabledMock.mockReturnValue(true);
    hasIamCockpitAccessRoleMock.mockReturnValue(true);
    getAllowedIamCockpitTabsMock.mockReturnValue(['governance']);

    render(<IamViewerPage activeTab="governance" />);

    await waitFor(() => {
      expect(listGovernanceCasesMock).toHaveBeenCalledTimes(1);
      expect(screen.getAllByText('Delegation freigeben')).toHaveLength(2);
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('loads DSR entries and renders canonical status badges', async () => {
    listAdminDsrCasesMock.mockResolvedValue({
      data: [
        {
          id: 'dsr-1',
          type: 'request',
          canonicalStatus: 'in_progress',
          rawStatus: 'processing',
          title: 'Auskunftsersuchen',
          summary: 'Benutzerkonto Alice',
          createdAt: '2026-03-15T10:00:00.000Z',
          metadata: {},
        },
      ],
    });

    useAuthMock.mockReturnValue({
      user: adminUser,
      isLoading: false,
      error: null,
      invalidatePermissions: vi.fn(),
    });
    isIamCockpitEnabledMock.mockReturnValue(true);
    hasIamCockpitAccessRoleMock.mockReturnValue(true);
    getAllowedIamCockpitTabsMock.mockReturnValue(['dsr']);

    render(<IamViewerPage activeTab="dsr" />);

    await waitFor(() => {
      expect(listAdminDsrCasesMock).toHaveBeenCalledTimes(1);
      expect(screen.getAllByText('Auskunftsersuchen')).toHaveLength(2);
      expect(screen.getAllByText('In Bearbeitung').length).toBeGreaterThan(0);
    });
  });
});
