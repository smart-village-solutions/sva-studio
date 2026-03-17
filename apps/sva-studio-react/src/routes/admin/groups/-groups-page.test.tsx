import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
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
});
