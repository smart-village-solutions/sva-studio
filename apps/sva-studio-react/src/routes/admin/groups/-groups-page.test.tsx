import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { GroupsPage } from './-groups-page';

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

describe('GroupsPage', () => {
  beforeEach(() => {
    useGroupsMock.mockReset();
    useRolesMock.mockReset();
    useRolesMock.mockReturnValue({
      roles: [{ id: 'role-1', roleName: 'Editor' }],
      isLoading: false,
      error: null,
      mutationError: null,
      refetch: vi.fn(),
      clearMutationError: vi.fn(),
    });
  });

  afterEach(() => {
    cleanup();
  });

  const createGroupsState = (overrides: Record<string, unknown> = {}) => ({
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
    loadGroupDetail: vi.fn().mockResolvedValue({
      id: 'group-1',
      groupKey: 'admins',
      displayName: 'Admins',
      description: 'Administrative Gruppe',
      groupType: 'role_bundle',
      isActive: true,
      memberCount: 2,
      roleCount: 1,
      assignedRoleIds: ['role-1'],
      memberships: [],
    }),
    assignRole: vi.fn().mockResolvedValue(true),
    removeRole: vi.fn().mockResolvedValue(true),
    assignMembership: vi.fn().mockResolvedValue(true),
    removeMembership: vi.fn().mockResolvedValue(true),
    ...overrides,
  });

  it('renders groups and route links', async () => {
    const loadGroupDetail = vi.fn().mockResolvedValue({
      id: 'group-1',
      groupKey: 'admins',
      displayName: 'Admins',
      description: 'Administrative Gruppe',
      groupType: 'role_bundle',
      isActive: true,
      memberCount: 2,
      roleCount: 1,
      assignedRoleIds: ['role-1'],
      memberships: [],
    });

    useGroupsMock.mockReturnValue(createGroupsState({ loadGroupDetail }));

    render(<GroupsPage />);

    expect(screen.getByText('Admins')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Gruppe anlegen' }).getAttribute('href')).toBe('/admin/groups/new');
    expect(screen.getByRole('link', { name: 'Gruppe bearbeiten' }).getAttribute('href')).toBe('/admin/groups/$groupId');
    await waitFor(() => expect(loadGroupDetail).toHaveBeenCalledWith('group-1'));
  });

  it('filters groups and shows empty state', () => {
    useGroupsMock.mockReturnValue(
      createGroupsState({
        groups: [],
      })
    );

    render(<GroupsPage />);
    expect(screen.getByText('Keine Gruppen gefunden.')).toBeTruthy();
  });

  it('retries loading and deletes groups via confirmation', async () => {
    const refetch = vi.fn();
    const deleteGroup = vi.fn().mockResolvedValue(true);
    useGroupsMock.mockReturnValue(
      createGroupsState({
        error: { code: 'database_unavailable' },
        refetch,
        deleteGroup,
      })
    );

    render(<GroupsPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Erneut versuchen' }));
    fireEvent.click(screen.getByRole('button', { name: 'Gruppe löschen' }));
    fireEvent.click(screen.getByRole('button', { name: 'Gruppe löschen' }));

    expect(refetch).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(deleteGroup).toHaveBeenCalledWith('group-1'));
  });
});
