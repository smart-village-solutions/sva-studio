import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { IamGovernanceDetailPage } from './-iam-governance-detail-page';

const useNavigateMock = vi.fn();
const useAuthMock = vi.fn();
const getGovernanceCaseMock = vi.fn();
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
  getGovernanceCase: (...args: unknown[]) => getGovernanceCaseMock(...args),
}));

vi.mock('../../lib/iam-viewer-access', () => ({
  getAllowedIamCockpitTabs: (...args: unknown[]) => getAllowedIamCockpitTabsMock(...args),
  hasIamCockpitAccessRole: (...args: unknown[]) => hasIamCockpitAccessRoleMock(...args),
  isIamCockpitEnabled: () => isIamCockpitEnabledMock(),
}));

describe('IamGovernanceDetailPage', () => {
  const user = {
    id: 'user-1',
    name: 'Admin',
    roles: ['security_admin'],
    instanceId: '11111111-1111-1111-8111-111111111111',
  };

  beforeEach(() => {
    useNavigateMock.mockReset();
    useAuthMock.mockReset();
    getGovernanceCaseMock.mockReset();
    getAllowedIamCockpitTabsMock.mockReset();
    hasIamCockpitAccessRoleMock.mockReset();
    isIamCockpitEnabledMock.mockReset();

    useAuthMock.mockReturnValue({
      user,
      isLoading: false,
      error: null,
    });
    getAllowedIamCockpitTabsMock.mockReturnValue(['governance']);
    hasIamCockpitAccessRoleMock.mockReturnValue(true);
    isIamCockpitEnabledMock.mockReturnValue(true);
  });

  afterEach(() => {
    cleanup();
  });

  it('loads and renders governance detail data and supports back navigation', async () => {
    getGovernanceCaseMock.mockResolvedValue({
      data: {
        id: 'gov-1',
        type: 'impersonation',
        status: 'approved',
        title: 'Impersonation für Support-Fall',
        summary: 'Temporäre Einsicht für Incident-Analyse.',
        ticketId: 'INC-42',
        actorDisplayName: 'Security Reviewer',
        targetDisplayName: 'User Two',
        createdAt: '2026-03-12T10:00:00.000Z',
        updatedAt: '2026-03-12T10:10:00.000Z',
        metadata: { reason: 'incident_review' },
      },
    });

    render(<IamGovernanceDetailPage caseId="gov-1" />);

    await waitFor(() => {
      expect(getGovernanceCaseMock).toHaveBeenCalledWith('gov-1', expect.objectContaining({ signal: expect.any(AbortSignal) }));
    });

    expect(screen.getByRole('heading', { level: 1, name: 'Impersonation für Support-Fall' })).toBeTruthy();
    expect(screen.getByText('Temporäre Einsicht für Incident-Analyse.')).toBeTruthy();
    expect(screen.getByText('INC-42')).toBeTruthy();
    expect(screen.getByText('reason: incident_review')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Zur Governance-Übersicht' }));
    expect(useNavigateMock).toHaveBeenCalledWith({ to: '/admin/iam', search: { tab: 'governance' } });
  });

  it('renders not-found and forbidden states without loading detail data', async () => {
    getGovernanceCaseMock.mockResolvedValue({ data: null });

    render(<IamGovernanceDetailPage caseId="gov-1" />);
    await waitFor(() => {
      expect(screen.getByText('Der Governance-Fall wurde nicht gefunden.')).toBeTruthy();
    });

    cleanup();
    hasIamCockpitAccessRoleMock.mockReturnValue(false);
    render(<IamGovernanceDetailPage caseId="gov-1" />);
    expect(screen.getByText('Für dieses IAM Transparenz-Cockpit fehlen die erforderlichen Rollen.')).toBeTruthy();
    expect(getGovernanceCaseMock).toHaveBeenCalledTimes(1);
  });
});
