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

describe('GroupsPage', () => {
  beforeEach(() => {
    useGroupsMock.mockReset();
    useRolesMock.mockReset();

    useRolesMock.mockReturnValue({
      roles: [
        { id: 'role-1', roleName: 'Editor' },
        { id: 'role-2', roleName: 'System Admin' },
      ],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
      createRole: vi.fn(),
      updateRole: vi.fn(),
      deleteRole: vi.fn(),
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
          roles: [{ roleId: 'role-2', roleKey: 'system_admin', roleName: 'System Admin' }],
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
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('renders existing groups and bundled roles', () => {
    render(<GroupsPage />);

    expect(screen.getByText('Admins')).toBeTruthy();
    expect(screen.getByText('Administrative Gruppe')).toBeTruthy();
    expect(screen.getByText('System Admin')).toBeTruthy();
  });

  it('creates a new group with selected bundled roles', async () => {
    const createGroup = vi.fn().mockResolvedValue(true);
    const clearMutationError = vi.fn();
    const refetch = vi.fn();
    useGroupsMock.mockReturnValue({
      groups: [],
      isLoading: false,
      error: null,
      createGroup,
      mutationError: null,
      updateGroup: vi.fn().mockResolvedValue(true),
      deleteGroup: vi.fn().mockResolvedValue(true),
      clearMutationError,
      refetch,
    });

    render(<GroupsPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Gruppe anlegen' }));
    fireEvent.change(screen.getByLabelText('Technischer Gruppenschlüssel'), { target: { value: 'Redaktion' } });
    fireEvent.change(screen.getByLabelText('Anzeigename'), { target: { value: 'Redaktion' } });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Editor' }));
    fireEvent.submit(screen.getByLabelText('Technischer Gruppenschlüssel').closest('form') as HTMLFormElement);

    await waitFor(() => {
      expect(createGroup).toHaveBeenCalledWith({
        groupKey: 'redaktion',
        displayName: 'Redaktion',
        description: undefined,
        roleIds: ['role-1'],
      });
    });
  });

  it('filters groups, opens edit dialog and updates group assignments', async () => {
    const clearMutationError = vi.fn();
    const updateGroup = vi.fn().mockResolvedValue(true);
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
          roles: [{ roleId: 'role-2', roleKey: 'system_admin', roleName: 'System Admin' }],
        },
        {
          id: 'group-2',
          groupKey: 'editors',
          displayName: 'Editors',
          description: 'Redaktion',
          groupType: 'role_bundle',
          isActive: false,
          memberCount: 5,
          roles: [{ roleId: 'role-1', roleKey: 'editor', roleName: 'Editor' }],
        },
      ],
      isLoading: false,
      error: null,
      createGroup: vi.fn().mockResolvedValue(true),
      mutationError: null,
      updateGroup,
      deleteGroup: vi.fn().mockResolvedValue(true),
      clearMutationError,
      refetch: vi.fn(),
    });

    render(<GroupsPage />);

    fireEvent.change(screen.getByLabelText('Suche'), { target: { value: 'Editors' } });

    expect(screen.getByText('Editors')).toBeTruthy();
    expect(screen.queryByText('Admins')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Gruppe bearbeiten' }));

    expect(clearMutationError).toHaveBeenCalledTimes(1);
    fireEvent.change(screen.getByLabelText('Anzeigename'), { target: { value: 'Editors Updated' } });
    fireEvent.click(screen.getByRole('checkbox', { name: 'System Admin' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Aktiv' }));
    fireEvent.submit(screen.getByLabelText('Anzeigename').closest('form') as HTMLFormElement);

    await waitFor(() => {
      expect(updateGroup).toHaveBeenCalledWith('group-2', {
        displayName: 'Editors Updated',
        description: 'Redaktion',
        roleIds: ['role-1', 'role-2'],
        isActive: true,
      });
    });
  });

  it('shows list errors, retries reloads and deletes groups via confirmation', async () => {
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
          roles: [],
        },
      ],
      isLoading: false,
      error: {
        status: 503,
        code: 'database_unavailable',
        message: 'db down',
      },
      createGroup: vi.fn().mockResolvedValue(true),
      mutationError: null,
      updateGroup: vi.fn().mockResolvedValue(true),
      deleteGroup,
      clearMutationError: vi.fn(),
      refetch,
    });

    render(<GroupsPage />);

    expect(screen.getByRole('alert').textContent).toContain('Die IAM-Datenbank ist derzeit nicht erreichbar.');

    fireEvent.click(screen.getByRole('button', { name: 'Erneut versuchen' }));
    expect(refetch).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Gruppe deaktivieren' }));
    const dialog = await screen.findByRole('alertdialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Gruppe deaktivieren' }));

    await waitFor(() => {
      expect(deleteGroup).toHaveBeenCalledWith('group-1');
    });
  });

  it('renders empty state after sorting when no groups match', () => {
    useGroupsMock.mockReturnValue({
      groups: [],
      isLoading: false,
      error: null,
      createGroup: vi.fn().mockResolvedValue(true),
      mutationError: null,
      updateGroup: vi.fn().mockResolvedValue(true),
      deleteGroup: vi.fn().mockResolvedValue(true),
      clearMutationError: vi.fn(),
      refetch: vi.fn(),
    });

    render(<GroupsPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Sortierung wechseln' }));

    expect(screen.getByRole('status').textContent).toContain('Keine Gruppen gefunden.');
  });
});
