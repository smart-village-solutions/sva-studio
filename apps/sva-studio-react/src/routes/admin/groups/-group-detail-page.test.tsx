import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { GroupDetailPage } from './-group-detail-page';

const useGroupsMock = vi.fn();
const useRolesMock = vi.fn();

vi.mock('@tanstack/react-router', () => ({
  Link: ({ to, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('../../../hooks/use-groups', () => ({
  useGroups: () => useGroupsMock(),
}));

vi.mock('../../../hooks/use-roles', () => ({
  useRoles: () => useRolesMock(),
}));

const detailFixture = {
  id: 'group-1',
  groupKey: 'admins',
  displayName: 'Admins',
  description: 'Administrative Gruppe',
  groupType: 'role_bundle',
  isActive: true,
  memberCount: 1,
  roleCount: 1,
  assignedRoleIds: ['role-1'],
  memberships: [
    {
      groupId: 'group-1',
      accountId: 'account-1',
      keycloakSubject: 'kc-1',
      displayName: 'Max Mustermann',
      assignedByAccountId: 'admin-1',
      validFrom: '2026-04-01T09:00:00.000Z',
      validUntil: '2026-04-30T09:00:00.000Z',
    },
  ],
};

const createGroupsState = (overrides: Record<string, unknown> = {}) => ({
  groups: [],
  isLoading: false,
  error: null,
  mutationError: null,
  refetch: vi.fn(),
  clearMutationError: vi.fn(),
  createGroup: vi.fn().mockResolvedValue(true),
  updateGroup: vi.fn().mockResolvedValue(true),
  deleteGroup: vi.fn().mockResolvedValue(true),
  loadGroupDetail: vi.fn().mockResolvedValue(detailFixture),
  assignRole: vi.fn().mockResolvedValue(true),
  removeRole: vi.fn().mockResolvedValue(true),
  assignMembership: vi.fn().mockResolvedValue(true),
  removeMembership: vi.fn().mockResolvedValue(true),
  ...overrides,
});

describe('GroupDetailPage', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    useGroupsMock.mockReset();
    useRolesMock.mockReset();
    useRolesMock.mockReturnValue({
      roles: [
        { id: 'role-1', roleName: 'Editor' },
        { id: 'role-2', roleName: 'Manager' },
      ],
      isLoading: false,
      error: null,
      mutationError: null,
      refetch: vi.fn(),
      clearMutationError: vi.fn(),
    });
  });

  it('loads the detail view and persists edits, roles, and memberships', async () => {
    const loadGroupDetail = vi
      .fn()
      .mockResolvedValueOnce(detailFixture)
      .mockResolvedValueOnce({ ...detailFixture, memberships: [] })
      .mockResolvedValueOnce({ ...detailFixture, assignedRoleIds: ['role-2'], memberships: [] })
      .mockResolvedValue({ ...detailFixture, assignedRoleIds: ['role-2'], memberships: [] });
    const updateGroup = vi.fn().mockResolvedValue(true);
    const assignRole = vi.fn().mockResolvedValue(true);
    const removeRole = vi.fn().mockResolvedValue(true);
    const assignMembership = vi.fn().mockResolvedValue(true);
    const removeMembership = vi.fn().mockResolvedValue(true);
    useGroupsMock.mockReturnValue(
      createGroupsState({
        loadGroupDetail,
        updateGroup,
        assignRole,
        removeRole,
        assignMembership,
        removeMembership,
      })
    );

    render(<GroupDetailPage groupId="group-1" />);

    await waitFor(() => {
      expect(loadGroupDetail).toHaveBeenCalledWith('group-1');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Entfernen' }));
    await waitFor(() => {
      expect(removeMembership).toHaveBeenCalledWith('group-1', 'kc-1');
    });

    fireEvent.change(screen.getByLabelText('Anzeigename', { selector: '#edit-group-name' }), {
      target: { value: ' Admins Updated ' },
    });
    fireEvent.change(screen.getByLabelText('Beschreibung', { selector: '#edit-group-description' }), {
      target: { value: ' Neue Beschreibung ' },
    });
    fireEvent.click(screen.getByLabelText('Editor'));
    fireEvent.click(screen.getByLabelText('Manager'));
    fireEvent.click(screen.getByRole('button', { name: 'Änderungen speichern' }));

    await waitFor(() => {
      expect(updateGroup).toHaveBeenCalledWith('group-1', {
        displayName: 'Admins Updated',
        description: 'Neue Beschreibung',
        isActive: true,
      });
    });
    expect(assignRole).toHaveBeenCalledWith('group-1', 'role-2');
    expect(removeRole).toHaveBeenCalledWith('group-1', 'role-1');

    fireEvent.change(screen.getByLabelText('Keycloak-Subject', { selector: '#group-membership-subject' }), {
      target: { value: ' user-2 ' },
    });
    fireEvent.change(screen.getByLabelText('Gültig ab', { selector: '#group-membership-valid-from' }), {
      target: { value: '2026-04-10T12:00' },
    });
    fireEvent.change(screen.getByLabelText('Gültig bis', { selector: '#group-membership-valid-until' }), {
      target: { value: '2026-04-20T12:00' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Mitgliedschaft zuweisen' }));

    await waitFor(() => {
      expect(assignMembership).toHaveBeenCalledWith('group-1', {
        keycloakSubject: 'user-2',
        validFrom: new Date('2026-04-10T12:00').toISOString(),
        validUntil: new Date('2026-04-20T12:00').toISOString(),
      });
    });
  });

  it('renders mutation errors and deletes after confirmation', async () => {
    const deleteGroup = vi.fn().mockResolvedValue(true);
    useGroupsMock.mockReturnValue(
      createGroupsState({
        deleteGroup,
        mutationError: { status: 503, code: 'database_unavailable', message: 'kaputt' },
      })
    );

    render(<GroupDetailPage groupId="group-1" />);

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain(
        'Die IAM-Datenbank ist derzeit nicht erreichbar. Bitte später erneut versuchen.'
      );
    });

    fireEvent.click(screen.getByRole('button', { name: 'Gruppe löschen' }));
    fireEvent.click(screen.getByRole('button', { name: 'Gruppe löschen' }));

    await waitFor(() => {
      expect(deleteGroup).toHaveBeenCalledWith('group-1');
    });
  });

  it('renders the not-found state when the detail is missing', async () => {
    useGroupsMock.mockReturnValue(
      createGroupsState({
        loadGroupDetail: vi.fn().mockResolvedValue(null),
      })
    );

    render(<GroupDetailPage groupId="missing" />);

    await waitFor(() => {
      expect(screen.getByText('Die angeforderte Gruppe wurde nicht gefunden.')).toBeTruthy();
    });
  });
});
