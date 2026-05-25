import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { IamViewerPage } from './-iam-page';

const useAuthMock = vi.fn();
const useNavigateMock = vi.fn();
const listGovernanceCasesMock = vi.fn();
const listAdminDsrCasesMock = vi.fn();
const getAdminDeletionRulesMock = vi.fn();
const saveAdminDeletionRulesMock = vi.fn();
const getAllowedIamCockpitTabsMock = vi.fn();
const hasGovernanceComplianceExportRoleMock = vi.fn();
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
  getAdminDeletionRules: (...args: unknown[]) => getAdminDeletionRulesMock(...args),
  saveAdminDeletionRules: (...args: unknown[]) => saveAdminDeletionRulesMock(...args),
}));

vi.mock('../../lib/iam-viewer-access', () => ({
  getAllowedIamCockpitTabs: (...args: unknown[]) => getAllowedIamCockpitTabsMock(...args),
  hasGovernanceComplianceExportRole: (...args: unknown[]) => hasGovernanceComplianceExportRoleMock(...args),
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
    getAdminDeletionRulesMock.mockReset();
    saveAdminDeletionRulesMock.mockReset();
    getAllowedIamCockpitTabsMock.mockReset();
    hasGovernanceComplianceExportRoleMock.mockReset();
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
    hasGovernanceComplianceExportRoleMock.mockReturnValue(true);
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
    hasGovernanceComplianceExportRoleMock.mockReturnValue(false);
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
    hasGovernanceComplianceExportRoleMock.mockReturnValue(true);
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

  it('renders the help box for the currently active tab', async () => {
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
    listGovernanceCasesMock.mockResolvedValue({ data: [] });
    listAdminDsrCasesMock.mockResolvedValue({ data: [] });
    getAdminDeletionRulesMock.mockResolvedValue({
      deactivateAfterDays: 30,
      pseudonymizeAfterDays: 60,
      deleteAfterDays: 90,
      defaultContentStrategy: 'retain',
      allowContentPreferenceOverride: true,
      canEdit: true,
    });

    useAuthMock.mockReturnValue({
      user: adminUser,
      isLoading: false,
      error: null,
      invalidatePermissions: vi.fn(),
    });
    isIamCockpitEnabledMock.mockReturnValue(true);
    hasGovernanceComplianceExportRoleMock.mockReturnValue(true);
    hasIamCockpitAccessRoleMock.mockReturnValue(true);

    getAllowedIamCockpitTabsMock.mockReturnValue(['rights']);
    const { rerender } = render(<IamViewerPage activeTab="rights" />);

    await waitFor(() => {
      expect(screen.getByText('Rechte verständlich prüfen')).toBeTruthy();
      expect(screen.getByText('Das können Sie hier tun')).toBeTruthy();
      expect(screen.getByText(/Mit "Authorize prüfen" einen konkreten Zugriff testen/)).toBeTruthy();
    });

    getAllowedIamCockpitTabsMock.mockReturnValue(['governance']);
    rerender(<IamViewerPage activeTab="governance" />);

    await waitFor(() => {
      expect(screen.getByText('Governance-Fälle einordnen')).toBeTruthy();
      expect(screen.getByText(/Bei vorhandener Berechtigung die aktuelle Sicht als CSV exportieren/)).toBeTruthy();
    });

    getAllowedIamCockpitTabsMock.mockReturnValue(['dsr']);
    rerender(<IamViewerPage activeTab="dsr" />);

    await waitFor(() => {
      expect(screen.getByText('Datenschutzfälle im Blick behalten')).toBeTruthy();
      expect(screen.getByText(/Blocker, Metadaten und den genauen Bearbeitungsstand/)).toBeTruthy();
    });

    getAllowedIamCockpitTabsMock.mockReturnValue(['deletion-rules']);
    rerender(<IamViewerPage activeTab="deletion-rules" />);

    await waitFor(() => {
      expect(screen.getByText('Löschregeln tenantweit verwalten')).toBeTruthy();
      expect(screen.getByText(/Fristen in Tagen für Deaktivierung, Pseudonymisierung und Löschung/)).toBeTruthy();
    });
  });

  it('updates rights filters and shows authorize progress and fallback summary values', async () => {
    let resolveAuthorize: (response: Response) => void = () => {
      throw new Error('Expected authorize request promise to be pending.');
    };
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
      .mockImplementationOnce(
        () =>
          new Promise<Response>((resolve) => {
            resolveAuthorize = resolve;
          })
      )
      .mockResolvedValue(
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
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    fireEvent.change(screen.getByLabelText('Handeln als'), {
      target: { value: 'user-9' },
    });
    fireEvent.change(screen.getByLabelText('Suche'), {
      target: { value: 'content.update' },
    });
    fireEvent.change(document.getElementById('iam-authorize-action') as HTMLInputElement, {
      target: { value: 'content.delete' },
    });
    fireEvent.change(document.getElementById('iam-authorize-resource-type') as HTMLInputElement, {
      target: { value: 'news' },
    });
    fireEvent.change(document.getElementById('iam-authorize-resource-id') as HTMLInputElement, {
      target: { value: 'news-1' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Authorize prüfen' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Authorize/ })).toHaveProperty('disabled', true);
    });

    resolveAuthorize(
      new Response(
        JSON.stringify({
          allowed: false,
          reason: 'Denied by policy',
          diagnostics: null,
          provenance: null,
          matchedPermissions: [],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );

    await waitFor(() => {
      expect(screen.getByText('Verweigert')).toBeTruthy();
      expect(screen.getByText('content.delete')).toBeTruthy();
      expect(screen.getByText('news / news-1')).toBeTruthy();
      expect(screen.getByText('Denied by policy')).toBeTruthy();
      expect(screen.getAllByText('—').length).toBeGreaterThan(0);
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
    hasGovernanceComplianceExportRoleMock.mockReturnValue(true);
    hasIamCockpitAccessRoleMock.mockReturnValue(true);
    getAllowedIamCockpitTabsMock.mockReturnValue(['governance']);

    render(<IamViewerPage activeTab="governance" />);

    await waitFor(() => {
      expect(listGovernanceCasesMock).toHaveBeenCalledTimes(1);
      expect(screen.getAllByText('Delegation freigeben')).toHaveLength(2);
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('renders a governance CSV export link without list filters', async () => {
    listGovernanceCasesMock.mockResolvedValue({
      data: [
        {
          id: 'gov-1',
          type: 'permission_change',
          status: 'submitted',
          title: 'Rollenanpassung beantragt',
          summary: 'Redakteurrolle für Benutzerkonto',
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
    hasGovernanceComplianceExportRoleMock.mockReturnValue(true);
    hasIamCockpitAccessRoleMock.mockReturnValue(true);
    getAllowedIamCockpitTabsMock.mockReturnValue(['governance']);

    render(<IamViewerPage activeTab="governance" />);

    await waitFor(() => {
      expect(listGovernanceCasesMock).toHaveBeenCalledTimes(1);
    });

    fireEvent.change(screen.getByLabelText('Suche'), {
      target: { value: 'alice' },
    });
    fireEvent.change(screen.getByLabelText('Typ'), {
      target: { value: 'permission_change' },
    });
    fireEvent.change(screen.getByLabelText('Status'), {
      target: { value: 'submitted' },
    });

    const exportLink = screen.getByRole('link', { name: 'CSV exportieren' });
    const href = exportLink.getAttribute('href');

    expect(href).toContain('/iam/governance/compliance/export?');
    expect(href).toContain('instanceId=11111111-1111-1111-8111-111111111111');
    expect(href).toContain('format=csv');
    expect(href).not.toContain('search=');
    expect(href).not.toContain('type=');
    expect(href).not.toContain('status=');
  });

  it('hides the governance CSV export link without the export-specific role', async () => {
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
      user: { ...adminUser, roles: ['support_admin'] },
      isLoading: false,
      error: null,
      invalidatePermissions: vi.fn(),
    });
    isIamCockpitEnabledMock.mockReturnValue(true);
    hasGovernanceComplianceExportRoleMock.mockReturnValue(false);
    hasIamCockpitAccessRoleMock.mockReturnValue(true);
    getAllowedIamCockpitTabsMock.mockReturnValue(['governance']);

    render(<IamViewerPage activeTab="governance" />);

    await waitFor(() => {
      expect(listGovernanceCasesMock).toHaveBeenCalledTimes(1);
    });

    expect(screen.queryByRole('link', { name: 'CSV exportieren' })).toBeNull();
  });

  it('renders self-service permission change requests as governance detail links without leaking hidden metadata', async () => {
    listGovernanceCasesMock.mockResolvedValue({
      data: [
        {
          id: 'gov-self-1',
          type: 'permission_change',
          status: 'intake',
          title: 'permission_change',
          summary: 'Ich benötige Schreibrechte für die Veranstaltungsredaktion.',
          createdAt: '2026-03-15T10:00:00.000Z',
          metadata: {
            requestNote: 'Ich benötige Schreibrechte für die Veranstaltungsredaktion.',
            requestOrigin: 'self_service',
          },
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
    hasGovernanceComplianceExportRoleMock.mockReturnValue(true);
    hasIamCockpitAccessRoleMock.mockReturnValue(true);
    getAllowedIamCockpitTabsMock.mockReturnValue(['governance']);

    render(<IamViewerPage activeTab="governance" />);

    await waitFor(() => {
      expect(screen.getAllByRole('link', { name: /Rechteänderung/i }).length).toBeGreaterThan(0);
    });

    expect(screen.getAllByText('Ich benötige Schreibrechte für die Veranstaltungsredaktion.').length).toBeGreaterThan(0);
    expect(screen.queryByText('requestOrigin: self_service')).toBeNull();
  });

  it('renders governance rows as detail links without inline detail pane content', async () => {
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
    hasGovernanceComplianceExportRoleMock.mockReturnValue(true);
    hasIamCockpitAccessRoleMock.mockReturnValue(true);
    getAllowedIamCockpitTabsMock.mockReturnValue(['governance']);

    render(<IamViewerPage activeTab="governance" />);

    await waitFor(() => {
      expect(screen.getAllByRole('link', { name: 'Delegation freigeben' })[0]?.getAttribute('href')).toBe('/admin/iam/governance/gov-1');
    });

    expect(screen.queryByText('Wählen Sie links einen Eintrag aus, um Details anzuzeigen.')).toBeNull();
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

  it('renders DSR rows as detail links without inline detail pane content', async () => {
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
      expect(screen.getAllByRole('link', { name: 'Auskunftsersuchen' })[0]?.getAttribute('href')).toBe('/admin/iam/dsr/dsr-1');
    });

    expect(screen.queryByText('Wählen Sie links einen Eintrag aus, um Details anzuzeigen.')).toBeNull();
  });

  it('loads and saves tenant deletion rules in the admin cockpit', async () => {
    getAdminDeletionRulesMock.mockResolvedValue({
      instanceId: '11111111-1111-1111-8111-111111111111',
      deactivateAfterDays: 90,
      pseudonymizeAfterDays: 180,
      deleteAfterDays: 365,
      defaultContentStrategy: 'retain',
      allowContentPreferenceOverride: true,
      canEdit: true,
    });
    saveAdminDeletionRulesMock.mockResolvedValue({
      instanceId: '11111111-1111-1111-8111-111111111111',
      deactivateAfterDays: 120,
      pseudonymizeAfterDays: 180,
      deleteAfterDays: 365,
      defaultContentStrategy: 'with_owner_lifecycle',
      allowContentPreferenceOverride: false,
      canEdit: true,
    });

    useAuthMock.mockReturnValue({
      user: adminUser,
      isLoading: false,
      error: null,
      invalidatePermissions: vi.fn(),
    });
    isIamCockpitEnabledMock.mockReturnValue(true);
    hasIamCockpitAccessRoleMock.mockReturnValue(true);
    getAllowedIamCockpitTabsMock.mockReturnValue(['deletion-rules']);

    render(<IamViewerPage activeTab="deletion-rules" />);

    await waitFor(() => {
      expect(getAdminDeletionRulesMock).toHaveBeenCalledWith('11111111-1111-1111-8111-111111111111');
      expect(screen.getByRole('heading', { name: 'Tenant-Löschregeln' })).toBeTruthy();
    });

    fireEvent.change(screen.getByLabelText('Deaktivierung nach Tagen'), {
      target: { value: '120' },
    });
    fireEvent.change(screen.getByLabelText('Pseudonymisierung nach Tagen'), {
      target: { value: '240' },
    });
    fireEvent.change(screen.getByLabelText('Löschung nach Tagen'), {
      target: { value: '480' },
    });
    fireEvent.change(screen.getByLabelText('Standardregel für Inhalte'), {
      target: { value: 'with_owner_lifecycle' },
    });
    fireEvent.click(screen.getByLabelText('Nutzer dürfen die Standardregel für eigene Inhalte überschreiben'));
    fireEvent.click(screen.getByRole('button', { name: 'Löschregeln speichern' }));

    await waitFor(() => {
      expect(saveAdminDeletionRulesMock).toHaveBeenCalledWith({
        instanceId: '11111111-1111-1111-8111-111111111111',
        deactivateAfterDays: 120,
        pseudonymizeAfterDays: 240,
        deleteAfterDays: 480,
        defaultContentStrategy: 'with_owner_lifecycle',
        allowContentPreferenceOverride: false,
      });
    });
  });

  it('moves focus to the newly selected tab after keyboard navigation', async () => {
    useAuthMock.mockReturnValue({
      user: adminUser,
      isLoading: false,
      error: null,
      invalidatePermissions: vi.fn(),
    });
    isIamCockpitEnabledMock.mockReturnValue(true);
    hasIamCockpitAccessRoleMock.mockReturnValue(true);
    getAllowedIamCockpitTabsMock.mockReturnValue(['rights', 'governance']);
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
    listGovernanceCasesMock.mockResolvedValue({ data: [] });

    const { rerender } = render(<IamViewerPage activeTab="rights" />);

    const rightsTab = screen.getByRole('tab', { name: 'Rechte' });
    fireEvent.keyDown(rightsTab, { key: 'ArrowRight' });

    rerender(<IamViewerPage activeTab="governance" />);

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: 'Governance' })).toBe(document.activeElement);
    });
  });

  it('shows deletion-rules guard, read-only and save-error states', async () => {
    useAuthMock.mockReturnValue({
      user: { ...adminUser, instanceId: '' },
      isLoading: false,
      error: null,
      invalidatePermissions: vi.fn(),
    });
    isIamCockpitEnabledMock.mockReturnValue(true);
    hasIamCockpitAccessRoleMock.mockReturnValue(true);
    getAllowedIamCockpitTabsMock.mockReturnValue(['deletion-rules']);

    render(<IamViewerPage activeTab="deletion-rules" />);

    expect(screen.getByText('Instanzkontext fehlt für Tenant-Löschregeln.')).toBeTruthy();
    cleanup();

    getAdminDeletionRulesMock.mockResolvedValue({
      instanceId: '11111111-1111-1111-8111-111111111111',
      deactivateAfterDays: 90,
      pseudonymizeAfterDays: 180,
      deleteAfterDays: 365,
      defaultContentStrategy: 'retain',
      allowContentPreferenceOverride: false,
      canEdit: false,
    });
    useAuthMock.mockReturnValue({
      user: adminUser,
      isLoading: false,
      error: null,
      invalidatePermissions: vi.fn(),
    });

    render(<IamViewerPage activeTab="deletion-rules" />);

    await waitFor(() => {
      expect(screen.getByText('Diese Löschregeln sind nur lesbar.')).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Löschregeln speichern' })).toHaveProperty('disabled', true);
    });
    cleanup();

    getAdminDeletionRulesMock.mockResolvedValueOnce({
      instanceId: '11111111-1111-1111-8111-111111111111',
      deactivateAfterDays: 90,
      pseudonymizeAfterDays: 180,
      deleteAfterDays: 365,
      defaultContentStrategy: 'retain',
      allowContentPreferenceOverride: false,
      canEdit: true,
    });
    saveAdminDeletionRulesMock.mockRejectedValueOnce(new Error('save_failed'));

    render(<IamViewerPage activeTab="deletion-rules" />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Löschregeln speichern' })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Löschregeln speichern' }));

    await waitFor(() => {
      expect(screen.getByText('save_failed')).toBeTruthy();
    });
  });

  it('shows deletion-rules loading errors and authorize 403 errors with permission invalidation', async () => {
    const invalidatePermissions = vi.fn().mockResolvedValue(undefined);
    getAdminDeletionRulesMock.mockRejectedValueOnce(new Error('rules_down'));
    useAuthMock.mockReturnValue({
      user: adminUser,
      isLoading: false,
      error: null,
      invalidatePermissions,
    });
    isIamCockpitEnabledMock.mockReturnValue(true);
    hasIamCockpitAccessRoleMock.mockReturnValue(true);
    hasGovernanceComplianceExportRoleMock.mockReturnValue(true);
    getAllowedIamCockpitTabsMock.mockReturnValue(['deletion-rules', 'rights']);

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
        new Response(JSON.stringify({ error: 'authorize_forbidden' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        })
      );
    vi.stubGlobal('fetch', fetchMock);

    const { rerender } = render(<IamViewerPage activeTab="deletion-rules" />);

    await waitFor(() => {
      expect(screen.getByText('rules_down')).toBeTruthy();
    });

    rerender(<IamViewerPage activeTab="rights" />);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByRole('button', { name: 'Authorize prüfen' }));

    await waitFor(() => {
      expect(invalidatePermissions).toHaveBeenCalledTimes(1);
      expect(screen.getByText('authorize_forbidden')).toBeTruthy();
    });
  });

  it('renders empty governance and dsr states and keeps export hidden without an instance id', async () => {
    listGovernanceCasesMock.mockResolvedValue({ data: [] });
    listAdminDsrCasesMock.mockResolvedValue({ data: [] });
    useAuthMock.mockReturnValue({
      user: { ...adminUser, instanceId: '' },
      isLoading: false,
      error: null,
      invalidatePermissions: vi.fn(),
    });
    isIamCockpitEnabledMock.mockReturnValue(true);
    hasGovernanceComplianceExportRoleMock.mockReturnValue(true);
    hasIamCockpitAccessRoleMock.mockReturnValue(true);
    getAllowedIamCockpitTabsMock.mockReturnValue(['governance', 'dsr']);

    const { rerender } = render(<IamViewerPage activeTab="governance" />);

    await waitFor(() => {
      expect(screen.getByText('Keine Governance-Fälle gefunden.')).toBeTruthy();
    });
    expect(screen.queryByRole('link', { name: 'CSV exportieren' })).toBeNull();

    rerender(<IamViewerPage activeTab="dsr" />);

    await waitFor(() => {
      expect(screen.getByText('Keine Datenschutzfälle gefunden.')).toBeTruthy();
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
    hasGovernanceComplianceExportRoleMock.mockReturnValue(false);
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
                groupName: 'Redaktion Standard',
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
    hasGovernanceComplianceExportRoleMock.mockReturnValue(true);
    hasIamCockpitAccessRoleMock.mockReturnValue(true);
    getAllowedIamCockpitTabsMock.mockReturnValue(['rights']);

    render(<IamViewerPage activeTab="rights" />);

    await waitFor(() => {
      expect(screen.getByText('content.read')).toBeTruthy();
      expect(screen.getByText('content.updatePayload')).toBeTruthy();
      expect(screen.getByText('Impersonation durch user-2')).toBeTruthy();
      expect(screen.getAllByText('org-1').length).toBeGreaterThan(0);
      expect(screen.getByText('locale: de')).toBeTruthy();
      expect(screen.getByText('Redaktion Standard')).toBeTruthy();
      expect(screen.queryByText('group-editor')).toBeNull();
      expect(screen.getAllByText('Keine Organisation').length).toBeGreaterThan(0);
      expect((screen.getByLabelText('Organisation', { selector: '#iam-organization-filter' }) as HTMLSelectElement).value).toBe('');
      expect((screen.getByLabelText('Organisation', { selector: '#iam-authorize-organization-id' }) as HTMLSelectElement).value).toBe('');
    });

    fireEvent.click(screen.getByRole('button', { name: 'org-1' }));
    fireEvent.change(screen.getByLabelText('Organisation', { selector: '#iam-organization-filter' }), {
      target: { value: 'org-1' },
    });
    fireEvent.change(screen.getByLabelText('Organisation', { selector: '#iam-authorize-organization-id' }), {
      target: { value: 'org-1' },
    });

    expect(screen.getByRole('button', { name: 'org-1' }).className).toContain('border-primary');
    expect((screen.getByLabelText('Organisation', { selector: '#iam-organization-filter' }) as HTMLSelectElement).value).toBe('org-1');
    expect((screen.getByLabelText('Organisation', { selector: '#iam-authorize-organization-id' }) as HTMLSelectElement).value).toBe('org-1');
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
    hasGovernanceComplianceExportRoleMock.mockReturnValue(true);
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

  it('renders governance status as a select with loaded status options', async () => {
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
        {
          id: 'gov-2',
          type: 'permission_change',
          status: 'submitted',
          title: 'Rollenanpassung beantragt',
          summary: 'Rolle prüfen',
          createdAt: '2026-03-16T10:00:00.000Z',
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
    hasGovernanceComplianceExportRoleMock.mockReturnValue(true);
    hasIamCockpitAccessRoleMock.mockReturnValue(true);
    getAllowedIamCockpitTabsMock.mockReturnValue(['governance']);

    render(<IamViewerPage activeTab="governance" />);

    await waitFor(() => {
      expect(listGovernanceCasesMock).toHaveBeenCalledTimes(1);
    });

    const statusSelect = screen.getByLabelText('Status', { selector: '#iam-governance-status' }) as HTMLSelectElement;
    expect(Array.from(statusSelect.options).map((option) => option.value)).toEqual(['', 'open', 'submitted']);

    fireEvent.change(statusSelect, { target: { value: 'submitted' } });

    expect(statusSelect.value).toBe('submitted');
  });

  it('falls back to account ids in governance and dsr tables when display names are missing', async () => {
    listGovernanceCasesMock.mockResolvedValue({
      data: [
        {
          id: 'gov-1',
          type: 'delegation',
          status: 'open',
          title: 'Delegation freigeben',
          summary: 'Zusätzliche Freigabe für Redaktion',
          actorAccountId: 'account-actor-1',
          targetAccountId: 'account-target-1',
          createdAt: '2026-03-15T10:00:00.000Z',
          metadata: {},
        },
      ],
    });
    listAdminDsrCasesMock.mockResolvedValue({
      data: [
        {
          id: 'dsr-1',
          type: 'request',
          canonicalStatus: 'queued',
          rawStatus: 'queued',
          title: 'Auskunftsersuchen',
          summary: 'Benutzerkonto Alice',
          targetAccountId: 'account-target-2',
          requesterAccountId: 'account-requester-2',
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
    hasGovernanceComplianceExportRoleMock.mockReturnValue(true);
    hasIamCockpitAccessRoleMock.mockReturnValue(true);
    getAllowedIamCockpitTabsMock.mockReturnValue(['governance', 'dsr']);

    const { rerender } = render(<IamViewerPage activeTab="governance" />);

    await waitFor(() => {
      expect(screen.getAllByText('account-actor-1 -> account-target-1').length).toBeGreaterThan(0);
    });

    rerender(<IamViewerPage activeTab="dsr" />);

    await waitFor(() => {
      expect(screen.getAllByText('account-target-2 / account-requester-2').length).toBeGreaterThan(0);
    });
  });
});
