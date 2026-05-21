import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { IamDsrDetailPage } from './-iam-dsr-detail-page';

const useNavigateMock = vi.fn();
const useAuthMock = vi.fn();
const getAdminDsrCaseMock = vi.fn();
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
  getAdminDsrCase: (...args: unknown[]) => getAdminDsrCaseMock(...args),
}));

vi.mock('../../lib/iam-viewer-access', () => ({
  getAllowedIamCockpitTabs: (...args: unknown[]) => getAllowedIamCockpitTabsMock(...args),
  hasIamCockpitAccessRole: (...args: unknown[]) => hasIamCockpitAccessRoleMock(...args),
  isIamCockpitEnabled: () => isIamCockpitEnabledMock(),
}));

describe('IamDsrDetailPage', () => {
  const user = {
    id: 'user-1',
    name: 'Admin',
    roles: ['system_admin'],
    instanceId: '11111111-1111-1111-8111-111111111111',
  };

  beforeEach(() => {
    useNavigateMock.mockReset();
    useAuthMock.mockReset();
    getAdminDsrCaseMock.mockReset();
    getAllowedIamCockpitTabsMock.mockReset();
    hasIamCockpitAccessRoleMock.mockReset();
    isIamCockpitEnabledMock.mockReset();

    useAuthMock.mockReturnValue({
      user,
      isLoading: false,
      error: null,
    });
    getAllowedIamCockpitTabsMock.mockReturnValue(['dsr']);
    hasIamCockpitAccessRoleMock.mockReturnValue(true);
    isIamCockpitEnabledMock.mockReturnValue(true);
  });

  afterEach(() => {
    cleanup();
  });

  it('loads and renders DSR detail data and supports back navigation', async () => {
    getAdminDsrCaseMock.mockResolvedValue({
      data: {
        id: 'dsr-1',
        type: 'request',
        canonicalStatus: 'in_progress',
        rawStatus: 'processing',
        title: 'Auskunftsersuchen',
        summary: 'Benutzerkonto Alice',
        requesterDisplayName: 'Alice',
        targetDisplayName: 'Alice A.',
        blockedReason: 'legal_hold',
        createdAt: '2026-03-12T10:00:00.000Z',
        updatedAt: '2026-03-12T10:10:00.000Z',
        completedAt: null,
        metadata: { requestId: 'req-1' },
      },
    });

    render(<IamDsrDetailPage caseId="dsr-1" />);

    await waitFor(() => {
      expect(getAdminDsrCaseMock).toHaveBeenCalledWith('dsr-1', expect.objectContaining({ signal: expect.any(AbortSignal) }));
    });

    expect(screen.getAllByText('Auskunftsersuchen').length).toBeGreaterThan(0);
    expect(screen.getByText('processing')).toBeTruthy();
    expect(screen.getByText('Alice')).toBeTruthy();
    expect(screen.getByText('legal_hold')).toBeTruthy();
    expect(screen.getByText('requestId: req-1')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Zur Datenschutz-Übersicht' }));
    expect(useNavigateMock).toHaveBeenCalledWith({ to: '/admin/iam', search: { tab: 'dsr' } });
  });

  it('renders not-found and forbidden states without loading detail data', async () => {
    getAdminDsrCaseMock.mockResolvedValue({ data: null });

    render(<IamDsrDetailPage caseId="dsr-1" />);
    await waitFor(() => {
      expect(screen.getByText('Der Datenschutzfall wurde nicht gefunden.')).toBeTruthy();
    });

    cleanup();
    hasIamCockpitAccessRoleMock.mockReturnValue(false);
    render(<IamDsrDetailPage caseId="dsr-1" />);
    expect(screen.getByText('Für dieses IAM Transparenz-Cockpit fehlen die erforderlichen Rollen.')).toBeTruthy();
    expect(getAdminDsrCaseMock).toHaveBeenCalledTimes(1);
  });
});
