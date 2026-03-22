import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { GroupsPage } from './-groups-page';

const useGroupsMock = vi.fn();
const useRolesMock = vi.fn();

vi.mock('../../../hooks/use-groups', () => ({
  useGroups: () => useGroupsMock(),
}));

vi.mock('../../../hooks/use-roles', () => ({
  useRoles: () => useRolesMock(),
}));

const baseRolesApi = {
  roles: [
    { id: 'role-1', roleName: 'Editor' },
    { id: 'role-2', roleName: 'System Admin' },
  ],
  isLoading: false,
  error: null,
  mutationError: null,
  reconcileReport: null,
  refetch: vi.fn(),
  clearMutationError: vi.fn(),
  createRole: vi.fn(),
  updateRole: vi.fn(),
  deleteRole: vi.fn(),
  retryRoleSync: vi.fn(),
  reconcile: vi.fn(),
};

describe('GroupsPage', () => {
  beforeEach(() => {
    useGroupsMock.mockReset();
    useRolesMock.mockReset();
    useRolesMock.mockReturnValue(baseRolesApi);
  });

  afterEach(() => {
    cleanup();
  });

  it('renders groups and resolves bundled role labels from detail data', async () => {
    const loadGroupDetail = vi.fn().mockResolvedValue({
      id: 'group-1',
      groupKey: 'admins',
      displayName: 'Admins',
      description: 'Administrative Gruppe',
      groupType: 'role_bundle',
      isActive: true,
      memberCount: 2,
      roleCount: 1,
      assignedRoleIds: ['role-2'],
      memberships: [],
    });

    useGroupsMock.mockReturnValue({
      groups: [
        {
          id: 'group-1',
          groupKey: 'admins',
          displayName: 'Admins',
          description: 'Administrative Gruppe',
          groupType: 'role_bundle',
          isActive: true,
          memberCount: 2,
          roleCount: 1,
        },
      ],
      isLoading: false,
      error: null,
      mutationError: null,
      refetch: vi.fn(),
      clearMutationError: vi.fn(),
      createGroup: vi.fn().mockResolvedValue(true),
      updateGroup: vi.fn().mockResolvedValue(true),
      deleteGroup: vi.fn().mockResolvedValue(true),
      loadGroupDetail,
      assignRole: vi.fn().mockResolvedValue(true),
      removeRole: vi.fn().mockResolvedValue(true),
      assignMembership: vi.fn().mockResolvedValue(true),
      removeMembership: vi.fn().mockResolvedValue(true),
    });

    render(<GroupsPage />);

    expect(screen.getByText('Admins')).toBeTruthy();
    expect(screen.getByText('Administrative Gruppe')).toBeTruthy();

    await waitFor(() => {
      expect(loadGroupDetail).toHaveBeenCalledWith('group-1');
      expect(screen.getByText('System Admin')).toBeTruthy();
    });
  });

  it('creates a new group with normalized payload', async () => {
    const createGroup = vi.fn().mockResolvedValue(true);
    useGroupsMock.mockReturnValue({
      groups: [],
      isLoading: false,
      error: null,
      mutationError: null,
      refetch: vi.fn(),
      clearMutationError: vi.fn(),
      createGroup,
      updateGroup: vi.fn().mockResolvedValue(true),
      deleteGroup: vi.fn().mockResolvedValue(true),
      loadGroupDetail: vi.fn().mockResolvedValue(null),
      assignRole: vi.fn().mockResolvedValue(true),
      removeRole: vi.fn().mockResolvedValue(true),
      assignMembership: vi.fn().mockResolvedValue(true),
      removeMembership: vi.fn().mockResolvedValue(true),
    });

    render(<GroupsPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Gruppe anlegen' }));
    const dialog = screen.getByRole('dialog', { name: 'Neue Gruppe erstellen' });
    fireEvent.change(within(dialog).getByLabelText('Technischer Gruppenschlüssel'), {
      target: { value: ' Redaktion Team ' },
    });
    fireEvent.change(within(dialog).getByLabelText('Anzeigename'), {
      target: { value: ' Redaktion ' },
    });
    fireEvent.change(within(dialog).getByLabelText('Beschreibung'), {
      target: { value: ' Bündelt Redaktionsrechte ' },
    });
    fireEvent.submit(within(dialog).getByRole('button', { name: 'Gruppe anlegen' }).closest('form')!);

    await waitFor(() => {
      expect(createGroup).toHaveBeenCalledWith({
        groupKey: 'redaktion_team',
        displayName: 'Redaktion',
        description: 'Bündelt Redaktionsrechte',
      });
    });
  });

  it('filters groups, edits role assignments and saves the active flag', async () => {
    const clearMutationError = vi.fn();
    const updateGroup = vi.fn().mockResolvedValue(true);
    const assignRole = vi.fn().mockResolvedValue(true);
    const detailMap = {
      'group-1': {
        id: 'group-1',
        groupKey: 'admins',
        displayName: 'Admins',
        description: 'Administrative Gruppe',
        groupType: 'role_bundle',
        isActive: true,
        memberCount: 2,
        roleCount: 1,
        assignedRoleIds: ['role-2'],
        memberships: [],
      },
      'group-2': {
        id: 'group-2',
        groupKey: 'editors',
        displayName: 'Editors',
        description: 'Redaktion',
        groupType: 'role_bundle',
        isActive: false,
        memberCount: 5,
        roleCount: 1,
        assignedRoleIds: ['role-1'],
        memberships: [],
      },
    };
    const loadGroupDetail = vi.fn(async (groupId: string) => detailMap[groupId as keyof typeof detailMap] ?? null);

    useGroupsMock.mockReturnValue({
      groups: [
        {
          id: 'group-1',
          groupKey: 'admins',
          displayName: 'Admins',
          description: 'Administrative Gruppe',
          groupType: 'role_bundle',
          isActive: true,
          memberCount: 2,
          roleCount: 1,
        },
        {
          id: 'group-2',
          groupKey: 'editors',
          displayName: 'Editors',
          description: 'Redaktion',
          groupType: 'role_bundle',
          isActive: false,
          memberCount: 5,
          roleCount: 1,
        },
      ],
      isLoading: false,
      error: null,
      mutationError: null,
      refetch: vi.fn(),
      clearMutationError,
      createGroup: vi.fn().mockResolvedValue(true),
      updateGroup,
      deleteGroup: vi.fn().mockResolvedValue(true),
      loadGroupDetail,
      assignRole,
      removeRole: vi.fn().mockResolvedValue(true),
      assignMembership: vi.fn().mockResolvedValue(true),
      removeMembership: vi.fn().mockResolvedValue(true),
    });

    render(<GroupsPage />);

    await waitFor(() => {
      expect(loadGroupDetail).toHaveBeenCalledWith('group-1');
      expect(loadGroupDetail).toHaveBeenCalledWith('group-2');
    });

    fireEvent.change(screen.getByLabelText('Suche'), { target: { value: 'Editors' } });

    expect(screen.getByText('Editors')).toBeTruthy();
    expect(screen.queryByText('Admins')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Gruppe bearbeiten' }));

    const dialog = await screen.findByRole('dialog', { name: 'Gruppe bearbeiten' });
    expect(clearMutationError).toHaveBeenCalledTimes(1);
    fireEvent.change(within(dialog).getByLabelText('Anzeigename'), { target: { value: 'Editors Updated' } });
    fireEvent.click(within(dialog).getByRole('checkbox', { name: 'System Admin' }));
    fireEvent.click(within(dialog).getByRole('checkbox', { name: 'Aktiv' }));
    fireEvent.submit(within(dialog).getByRole('button', { name: 'Änderungen speichern' }).closest('form')!);

    await waitFor(() => {
      expect(updateGroup).toHaveBeenCalledWith('group-2', {
        displayName: 'Editors Updated',
        description: 'Redaktion',
        isActive: true,
      });
      expect(assignRole).toHaveBeenCalledWith('group-2', 'role-2');
    });
  });

  it('assigns and removes memberships inside the edit dialog', async () => {
    const assignMembership = vi.fn().mockResolvedValue(true);
    const removeMembership = vi.fn().mockResolvedValue(true);
    const loadGroupDetail = vi
      .fn()
      .mockResolvedValueOnce({
        id: 'group-1',
        groupKey: 'admins',
        displayName: 'Admins',
        description: 'Administrative Gruppe',
        groupType: 'role_bundle',
        isActive: true,
        memberCount: 1,
        roleCount: 1,
        assignedRoleIds: ['role-2'],
        memberships: [
          {
            accountId: 'acc-1',
            groupId: 'group-1',
            keycloakSubject: 'subject-1',
            displayName: 'Editor User',
            validFrom: '2025-01-01T00:00:00.000Z',
            validUntil: undefined,
            assignedAt: '2025-01-01T00:00:00.000Z',
            assignedByAccountId: 'acc-admin',
          },
        ],
      })
      .mockResolvedValue({
        id: 'group-1',
        groupKey: 'admins',
        displayName: 'Admins',
        description: 'Administrative Gruppe',
        groupType: 'role_bundle',
        isActive: true,
        memberCount: 1,
        roleCount: 1,
        assignedRoleIds: ['role-2'],
        memberships: [],
      });

    useGroupsMock.mockReturnValue({
      groups: [
        {
          id: 'group-1',
          groupKey: 'admins',
          displayName: 'Admins',
          description: 'Administrative Gruppe',
          groupType: 'role_bundle',
          isActive: true,
          memberCount: 1,
          roleCount: 1,
        },
      ],
      isLoading: false,
      error: null,
      mutationError: null,
      refetch: vi.fn(),
      clearMutationError: vi.fn(),
      createGroup: vi.fn().mockResolvedValue(true),
      updateGroup: vi.fn().mockResolvedValue(true),
      deleteGroup: vi.fn().mockResolvedValue(true),
      loadGroupDetail,
      assignRole: vi.fn().mockResolvedValue(true),
      removeRole: vi.fn().mockResolvedValue(true),
      assignMembership,
      removeMembership,
    });

    render(<GroupsPage />);

    await waitFor(() => {
      expect(loadGroupDetail).toHaveBeenCalledWith('group-1');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Gruppe bearbeiten' }));
    const dialog = await screen.findByRole('dialog', { name: 'Gruppe bearbeiten' });

    expect(within(dialog).getByText('Editor User')).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Entfernen' }));
    await waitFor(() => {
      expect(removeMembership).toHaveBeenCalledWith('group-1', 'subject-1');
    });

    fireEvent.change(within(dialog).getByLabelText('Keycloak-Subject'), { target: { value: 'subject-2' } });
    fireEvent.change(within(dialog).getByLabelText('Gültig ab'), { target: { value: '2025-03-01T12:00' } });
    fireEvent.submit(within(dialog).getByRole('button', { name: 'Mitgliedschaft zuweisen' }).closest('form')!);

    await waitFor(() => {
      expect(assignMembership).toHaveBeenCalledWith('group-1', {
        keycloakSubject: 'subject-2',
        validFrom: new Date('2025-03-01T12:00').toISOString(),
        validUntil: undefined,
      });
    });
  });

  it('shows load errors, retries reloads and deletes groups via confirmation', async () => {
    const refetch = vi.fn();
    const deleteGroup = vi.fn().mockResolvedValue(true);
    useGroupsMock.mockReturnValue({
      groups: [
        {
          id: 'group-1',
          groupKey: 'admins',
          displayName: 'Admins',
          description: 'Administrative Gruppe',
          groupType: 'role_bundle',
          isActive: true,
          memberCount: 2,
          roleCount: 0,
        },
      ],
      isLoading: false,
      error: {
        status: 503,
        code: 'database_unavailable',
        message: 'db down',
      },
      mutationError: null,
      refetch,
      clearMutationError: vi.fn(),
      createGroup: vi.fn().mockResolvedValue(true),
      updateGroup: vi.fn().mockResolvedValue(true),
      deleteGroup,
      loadGroupDetail: vi.fn().mockResolvedValue(null),
      assignRole: vi.fn().mockResolvedValue(true),
      removeRole: vi.fn().mockResolvedValue(true),
      assignMembership: vi.fn().mockResolvedValue(true),
      removeMembership: vi.fn().mockResolvedValue(true),
    });

    render(<GroupsPage />);

    expect(screen.getByRole('alert').textContent).toContain('Die IAM-Datenbank ist derzeit nicht erreichbar.');

    fireEvent.click(screen.getByRole('button', { name: 'Erneut versuchen' }));
    expect(refetch).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Gruppe löschen' }));
    const dialog = await screen.findByRole('alertdialog', { name: 'Gruppe löschen' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Gruppe löschen' }));

    await waitFor(() => {
      expect(deleteGroup).toHaveBeenCalledWith('group-1');
    });
  });

  it('renders the empty state when no groups match the filter', () => {
    useGroupsMock.mockReturnValue({
      groups: [],
      isLoading: false,
      error: null,
      mutationError: null,
      refetch: vi.fn(),
      clearMutationError: vi.fn(),
      createGroup: vi.fn().mockResolvedValue(true),
      updateGroup: vi.fn().mockResolvedValue(true),
      deleteGroup: vi.fn().mockResolvedValue(true),
      loadGroupDetail: vi.fn().mockResolvedValue(null),
      assignRole: vi.fn().mockResolvedValue(true),
      removeRole: vi.fn().mockResolvedValue(true),
      assignMembership: vi.fn().mockResolvedValue(true),
      removeMembership: vi.fn().mockResolvedValue(true),
    });

    render(<GroupsPage />);

    expect(screen.getByRole('status').textContent).toContain('Keine Gruppen gefunden.');
  });
});
