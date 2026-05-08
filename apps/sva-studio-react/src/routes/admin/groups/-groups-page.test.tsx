import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { GroupsPage } from './-groups-page';

const useGroupsMock = vi.fn();
const useRolesMock = vi.fn();

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    to,
    children,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }) => (
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

const useAuthMock = vi.fn();

vi.mock('../../../providers/auth-provider', () => ({
  useAuth: () => useAuthMock(),
}));

describe('GroupsPage', () => {
  beforeEach(() => {
    useGroupsMock.mockReset();
    useRolesMock.mockReset();
    useAuthMock.mockReset();
    useAuthMock.mockReturnValue({
      user: {
        id: 'user-1',
        roles: ['system_admin'],
        instanceId: 'de-musterhausen',
      },
    });
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
    detailError: null,
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
    expect(screen.getByRole('link', { name: 'Gruppe anlegen' }).getAttribute('href')).toBe(
      '/admin/groups/new'
    );
    expect(screen.getByRole('link', { name: 'Gruppe bearbeiten' }).getAttribute('href')).toBe(
      '/admin/groups/$groupId'
    );
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

  it('renders the request id for page-level errors', async () => {
    useGroupsMock.mockReturnValue(
      createGroupsState({
        error: {
          status: 503,
          code: 'database_unavailable',
          message: 'kaputt',
          requestId: 'req-groups-1',
        },
      })
    );

    render(<GroupsPage />);

    expect(screen.getByText('Request-ID: req-groups-1')).toBeTruthy();
  });

  it('shows a schema-drift specific page-level error message when the backend exposes reason_code=schema_drift', () => {
    useGroupsMock.mockReturnValue(
      createGroupsState({
        error: {
          status: 503,
          code: 'database_unavailable',
          message: 'kaputt',
          requestId: 'req-groups-2',
          safeDetails: {
            reason_code: 'schema_drift',
            schema_object: 'iam.accounts',
            query_stage: 'group_memberships',
          },
        },
      })
    );

    render(<GroupsPage />);

    expect(screen.getByRole('alert').textContent).toContain(
      'Gruppendetails konnten wegen einer Server- oder Migrationsinkonsistenz nicht vollständig geladen werden. Bitte Deployment und Migrationen prüfen.'
    );
    expect(screen.getByText('Request-ID: req-groups-2')).toBeTruthy();
  });

  it('does not render the page-level error banner when only row detail loading fails', async () => {
    const loadGroupDetail = vi.fn().mockResolvedValue(null);
    useGroupsMock.mockReturnValue(
      createGroupsState({
        error: null,
        loadGroupDetail,
      })
    );

    render(<GroupsPage />);

    expect(screen.getByText('Admins')).toBeTruthy();
    await waitFor(() => expect(loadGroupDetail).toHaveBeenCalledWith('group-1'));
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('shows a guard message without instance context', () => {
    useAuthMock.mockReturnValue({
      user: {
        id: 'user-1',
        roles: ['system_admin'],
      },
    });
    useGroupsMock.mockReturnValue(createGroupsState());

    render(<GroupsPage />);

    expect(
      screen.getByText('Die Gruppenverwaltung ist nur mit aktivem Instanzkontext verfügbar.')
    ).toBeTruthy();
  });
});
