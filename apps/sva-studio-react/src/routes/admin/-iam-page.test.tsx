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
  fetchWithRequestTimeout: (...args: Parameters<typeof fetch>) => fetch(...args),
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
        undefined,
        expect.objectContaining({
          signal: expect.any(AbortSignal),
          timeoutMs: 10_000,
        })
      );
    });

    fireEvent.click(screen.getByRole('button', { name: 'Authorize prüfen' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenLastCalledWith(
        '/iam/authorize',
        expect.objectContaining({ method: 'POST' }),
        expect.objectContaining({ timeoutMs: 10_000 })
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

  it('renders auth, disabled and forbidden guard states', () => {
    useAuthMock.mockReturnValue({
      user: null,
      isLoading: false,
      error: new Error('auth_down'),
      invalidatePermissions: vi.fn(),
    });
    isIamCockpitEnabledMock.mockReturnValue(true);
    hasIamCockpitAccessRoleMock.mockReturnValue(false);
    getAllowedIamCockpitTabsMock.mockReturnValue([]);

    const { rerender } = render(<IamViewerPage activeTab="rights" />);

    expect(screen.getByRole('alert').textContent).toContain('auth_down');

    useAuthMock.mockReturnValue({
      user: adminUser,
      isLoading: false,
      error: null,
      invalidatePermissions: vi.fn(),
    });
    isIamCockpitEnabledMock.mockReturnValue(false);
    hasIamCockpitAccessRoleMock.mockReturnValue(true);
    getAllowedIamCockpitTabsMock.mockReturnValue(['rights']);

    rerender(<IamViewerPage activeTab="rights" />);
    expect(screen.getByText('Das IAM Transparenz-Cockpit ist derzeit deaktiviert.')).toBeTruthy();

    isIamCockpitEnabledMock.mockReturnValue(true);
    hasIamCockpitAccessRoleMock.mockReturnValue(false);
    getAllowedIamCockpitTabsMock.mockReturnValue([]);

    rerender(<IamViewerPage activeTab="rights" />);
    expect(screen.getByText('Für dieses IAM Transparenz-Cockpit fehlen die erforderlichen Rollen.')).toBeTruthy();
  });

  it('renders permissions, impersonation context and organization filters on the rights tab', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            permissions: [
              {
                action: 'content.read',
                resourceType: 'article',
                resourceId: 'article-1',
                organizationId: 'org-1',
                effect: 'allow',
                scope: { locale: 'de' },
                sourceRoleIds: ['editor'],
                sourceGroupIds: ['group-editor'],
              },
              {
                action: 'content.updatePayload',
                resourceType: 'article',
                resourceId: null,
                organizationId: null,
                effect: null,
                scope: {},
                sourceRoleIds: [],
                sourceGroupIds: [],
              },
            ],
            subject: {
              actorUserId: 'user-2',
              effectiveUserId: 'user-3',
              isImpersonating: true,
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      )
    );

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
      expect(screen.getByText('content.read')).toBeTruthy();
      expect(screen.getByText('content.updatePayload')).toBeTruthy();
      expect(screen.getByText('Impersonation durch user-2')).toBeTruthy();
      expect(screen.getAllByText('org-1').length).toBeGreaterThan(0);
      expect(screen.getByText('locale: de')).toBeTruthy();
      expect(screen.getAllByText('Keine Organisation').length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getByRole('button', { name: 'org-1' }));

    expect(screen.getByRole('button', { name: 'org-1' }).className).toContain('border-primary');
  });

  it('shows governance and dsr fetch errors without stale success state', async () => {
    useAuthMock.mockReturnValue({
      user: { ...adminUser, roles: ['security_admin'] },
      isLoading: false,
      error: null,
      invalidatePermissions: vi.fn(),
    });
    isIamCockpitEnabledMock.mockReturnValue(true);
    hasIamCockpitAccessRoleMock.mockReturnValue(true);
    getAllowedIamCockpitTabsMock.mockReturnValue(['governance', 'dsr']);

    listGovernanceCasesMock.mockRejectedValueOnce(new Error('governance_unavailable'));

    const { rerender } = render(<IamViewerPage activeTab="governance" />);

    await waitFor(() => {
      expect(screen.getByText('governance_unavailable')).toBeTruthy();
    });

    listAdminDsrCasesMock.mockRejectedValueOnce(new Error('dsr_unavailable'));
    rerender(<IamViewerPage activeTab="dsr" />);

    await waitFor(() => {
      expect(screen.getByText('dsr_unavailable')).toBeTruthy();
    });
  });

  it('requires an instance id before authorize checks and handles Home and End tab keys', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
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
    );

    useAuthMock.mockReturnValue({
      user: { ...adminUser, instanceId: '' },
      isLoading: false,
      error: null,
      invalidatePermissions: vi.fn(),
    });
    isIamCockpitEnabledMock.mockReturnValue(true);
    hasIamCockpitAccessRoleMock.mockReturnValue(true);
    getAllowedIamCockpitTabsMock.mockReturnValue(['rights', 'governance', 'dsr']);

    render(<IamViewerPage activeTab="rights" />);

    fireEvent.click(screen.getByRole('button', { name: 'Authorize prüfen' }));

    await waitFor(() => {
      expect(screen.getByText('Instanz-ID fehlt.')).toBeTruthy();
    });

    fireEvent.keyDown(screen.getByRole('tab', { name: 'Rechte' }), { key: 'End' });
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Rechte' }), { key: 'Home' });

    expect(useNavigateMock).toHaveBeenCalledWith({
      to: '/admin/iam',
      search: { tab: 'dsr' },
    });
    expect(useNavigateMock).toHaveBeenCalledWith({
      to: '/admin/iam',
      search: { tab: 'rights' },
    });
  });

  it('renders tab panels with roving tabindex and keyboard navigation', async () => {
    useAuthMock.mockReturnValue({
      user: adminUser,
      isLoading: false,
      error: null,
      invalidatePermissions: vi.fn(),
    });
    isIamCockpitEnabledMock.mockReturnValue(true);
    hasIamCockpitAccessRoleMock.mockReturnValue(true);
    getAllowedIamCockpitTabsMock.mockReturnValue(['rights', 'governance', 'dsr']);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
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
    );

    render(<IamViewerPage activeTab="rights" />);

    const rightsTab = screen.getByRole('tab', { name: 'Rechte' });
    const governanceTab = screen.getByRole('tab', { name: 'Governance' });

    expect(rightsTab.getAttribute('tabindex')).toBe('0');
    expect(governanceTab.getAttribute('tabindex')).toBe('-1');
    expect(screen.getByRole('tabpanel').getAttribute('aria-labelledby')).toBe('iam-tab-rights');

    fireEvent.keyDown(rightsTab, { key: 'ArrowRight' });

    expect(useNavigateMock).toHaveBeenCalledWith({
      to: '/admin/iam',
      search: { tab: 'governance' },
    });
  });

  it('debounces governance filters and ignores aborted requests', async () => {
    vi.useFakeTimers();
    const firstReject = vi.fn();
    const firstRequest = new Promise<{
      data: Array<{
        id: string;
        type: 'delegation';
        status: string;
        title: string;
        summary: string;
        createdAt: string;
        metadata: Record<string, never>;
      }>;
    }>((_, reject) => {
      firstReject.mockImplementation(reject);
    });

    listGovernanceCasesMock
      .mockImplementationOnce((_, options?: { signal?: AbortSignal }) => {
        options?.signal?.addEventListener('abort', () => {
          firstReject(new DOMException('Aborted', 'AbortError'));
        });
        return firstRequest;
      })
      .mockResolvedValueOnce({
        data: [
          {
            id: 'gov-2',
            type: 'delegation',
            status: 'open',
            title: 'Delegation Beta',
            summary: 'Nur der letzte Request darf anzeigen',
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

    await vi.advanceTimersByTimeAsync(300);
    expect(listGovernanceCasesMock).toHaveBeenCalledTimes(1);

    fireEvent.change(screen.getByLabelText('Suche'), {
      target: { value: 'beta' },
    });

    await vi.advanceTimersByTimeAsync(299);
    expect(listGovernanceCasesMock).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1);
    await Promise.resolve();
    await Promise.resolve();
    expect(listGovernanceCasesMock).toHaveBeenCalledTimes(2);
    expect(listGovernanceCasesMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ search: 'beta' }),
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );

    vi.useRealTimers();

    await waitFor(() => {
      expect(screen.getAllByText('Delegation Beta')).toHaveLength(2);
    });

    expect(screen.queryByText('Aborted')).toBeNull();
  });
});
