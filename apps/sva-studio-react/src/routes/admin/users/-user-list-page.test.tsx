import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { UserListPage } from './-user-list-page';

const useUsersMock = vi.fn();
const useRolesMock = vi.fn();
const isIamBulkEnabledMock = vi.fn();

vi.mock('@tanstack/react-router', () => ({
  Link: ({ to, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('../../../hooks/use-users', () => ({
  useUsers: () => useUsersMock(),
}));

vi.mock('../../../hooks/use-roles', () => ({
  useRoles: () => useRolesMock(),
}));

vi.mock('../../../lib/iam-admin-access', () => ({
  isIamBulkEnabled: () => isIamBulkEnabledMock(),
}));

const createUsersApiState = (overrides: Record<string, unknown> = {}) => ({
  users: [
    {
      id: 'user-1',
      keycloakSubject: 'subject-1',
      displayName: 'Alice',
      email: 'alice@example.com',
      status: 'active',
      lastLoginAt: '2026-03-04T10:00:00Z',
      roles: [{ roleId: 'role-1', roleName: 'system_admin', roleLevel: 90 }],
    },
    {
      id: 'user-2',
      keycloakSubject: 'subject-2',
      displayName: 'Bob',
      email: 'bob@example.com',
      status: 'inactive',
      lastLoginAt: '2026-03-03T08:00:00Z',
      roles: [{ roleId: 'role-2', roleName: 'editor', roleLevel: 40 }],
    },
  ],
  total: 2,
  page: 1,
  pageSize: 25,
  isLoading: false,
  error: null,
  filters: {
    page: 1,
    pageSize: 25,
    search: '',
    status: 'all',
    role: '',
  },
  setSearch: vi.fn(),
  setStatus: vi.fn(),
  setRole: vi.fn(),
  setPage: vi.fn(),
  refetch: vi.fn(),
  createUser: vi.fn().mockResolvedValue(true),
  updateUser: vi.fn(),
  deactivateUser: vi.fn().mockResolvedValue(true),
  bulkDeactivate: vi.fn().mockResolvedValue(true),
  syncUsersFromKeycloak: vi.fn().mockResolvedValue({
    importedCount: 1,
    updatedCount: 2,
    skippedCount: 3,
    totalKeycloakUsers: 6,
  }),
  ...overrides,
});

const createRolesApiState = (overrides: Record<string, unknown> = {}) => ({
  roles: [
    { id: 'role-1', roleName: 'system_admin' },
    { id: 'role-2', roleName: 'editor' },
  ],
  isLoading: false,
  error: null,
  refetch: vi.fn(),
  createRole: vi.fn(),
  updateRole: vi.fn(),
  deleteRole: vi.fn(),
  ...overrides,
});

describe('UserListPage', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    useUsersMock.mockReset();
    useRolesMock.mockReset();
    isIamBulkEnabledMock.mockReset();
    isIamBulkEnabledMock.mockReturnValue(true);
  });

  it('renders user table and opens create dialog', () => {
    useUsersMock.mockReturnValue(createUsersApiState({ users: [createUsersApiState().users[0]], total: 1 }));
    useRolesMock.mockReturnValue(createRolesApiState({ roles: [{ id: 'role-1', roleName: 'system_admin' }] }));

    render(<UserListPage />);

    expect(screen.getByRole('heading', { name: 'Benutzerverwaltung' })).toBeTruthy();
    expect(screen.getAllByText('Alice').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: 'Nutzer anlegen' }));
    expect(screen.getByRole('dialog', { name: 'Nutzer anlegen' })).toBeTruthy();
  });

  it('renders error state and triggers refetch via retry', () => {
    const refetch = vi.fn();

    useUsersMock.mockReturnValue(createUsersApiState({ users: [], total: 0, error: new Error('failed'), refetch }));
    useRolesMock.mockReturnValue(createRolesApiState({ roles: [] }));

    render(<UserListPage />);

    const alert = screen.getByRole('alert');
    const retryButton = alert.querySelector('button');
    expect(retryButton).toBeTruthy();

    fireEvent.click(retryButton as HTMLButtonElement);
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('updates filters and pagination controls', () => {
    const setSearch = vi.fn();
    const setStatus = vi.fn();
    const setPage = vi.fn();
    useUsersMock.mockReturnValue(
      createUsersApiState({
        setSearch,
        setStatus,
        setPage,
        page: 2,
        pageSize: 1,
        total: 3,
        filters: { page: 2, pageSize: 1, search: 'ali', status: 'active', role: '' },
      })
    );
    useRolesMock.mockReturnValue(createRolesApiState());

    render(<UserListPage />);

    fireEvent.change(screen.getByPlaceholderText('Nach Name oder E-Mail suchen'), { target: { value: 'bob' } });
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'inactive' } });
    fireEvent.click(screen.getByRole('button', { name: 'Zurück' }));
    fireEvent.click(screen.getByRole('button', { name: 'Weiter' }));

    expect(setSearch).toHaveBeenCalledWith('bob');
    expect(setStatus).toHaveBeenCalledWith('inactive');
    expect(setPage).toHaveBeenCalledWith(1);
    expect(setPage).toHaveBeenCalledWith(3);
  });

  it('submits create user form and closes dialog on success', async () => {
    const createUser = vi.fn().mockResolvedValue(true);
    useUsersMock.mockReturnValue(createUsersApiState({ createUser }));
    useRolesMock.mockReturnValue(createRolesApiState());

    render(<UserListPage />);

    fireEvent.click(screen.getAllByRole('button', { name: 'Nutzer anlegen' })[0]);
    const dialog = screen.getByRole('dialog', { name: 'Nutzer anlegen' });
    fireEvent.change(within(dialog).getByLabelText('E-Mail'), { target: { value: ' new@example.com ' } });
    fireEvent.change(within(dialog).getByLabelText('Vorname'), { target: { value: ' New ' } });
    fireEvent.change(within(dialog).getByLabelText('Nachname'), { target: { value: ' User ' } });
    fireEvent.change(within(dialog).getByLabelText('Startrolle'), { target: { value: 'role-2' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Nutzer anlegen' }));

    await waitFor(() => {
      expect(createUser).toHaveBeenCalledWith({
        email: 'new@example.com',
        firstName: 'New',
        lastName: 'User',
        displayName: 'New   User',
        roleIds: ['role-2'],
      });
    });

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Nutzer anlegen' })).toBeNull();
    });
  }, 15000);

  it('keeps create dialog open when create user fails', async () => {
    const createUser = vi.fn().mockResolvedValue(false);
    useUsersMock.mockReturnValue(createUsersApiState({ createUser }));
    useRolesMock.mockReturnValue(createRolesApiState());

    render(<UserListPage />);

    fireEvent.click(screen.getAllByRole('button', { name: 'Nutzer anlegen' })[0]);
    const dialog = screen.getByRole('dialog', { name: 'Nutzer anlegen' });
    fireEvent.change(within(dialog).getByLabelText('E-Mail'), { target: { value: 'fail@example.com' } });
    fireEvent.change(within(dialog).getByLabelText('Vorname'), { target: { value: 'Fail' } });
    fireEvent.change(within(dialog).getByLabelText('Nachname'), { target: { value: 'Case' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Nutzer anlegen' }));

    await waitFor(() => {
      expect(createUser).toHaveBeenCalledTimes(1);
      expect(screen.getByRole('dialog', { name: 'Nutzer anlegen' })).toBeTruthy();
    });
  });

  it('executes single deactivate and bulk deactivate actions', async () => {
    const deactivateUser = vi.fn().mockResolvedValue(true);
    const bulkDeactivate = vi.fn().mockResolvedValue(true);
    useUsersMock.mockReturnValue(createUsersApiState({ deactivateUser, bulkDeactivate }));
    useRolesMock.mockReturnValue(createRolesApiState());

    render(<UserListPage />);

    fireEvent.click(screen.getAllByRole('button', { name: 'Deaktivieren' })[0]);
    fireEvent.click(screen.getAllByRole('button', { name: 'Deaktivieren' }).at(-1) as HTMLButtonElement);

    await waitFor(() => {
      expect(deactivateUser).toHaveBeenCalledWith('user-1');
    });

    fireEvent.click(screen.getByRole('checkbox', { name: 'Alle Nutzer markieren' }));
    fireEvent.click(screen.getByRole('button', { name: 'Auswahl deaktivieren' }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Deaktivieren' }).at(-1) as HTMLButtonElement);

    await waitFor(() => {
      expect(bulkDeactivate).toHaveBeenCalledWith(['user-1', 'user-2']);
    });
  });

  it('triggers keycloak sync and shows the sync result', async () => {
    const syncUsersFromKeycloak = vi.fn().mockResolvedValue({
      importedCount: 2,
      updatedCount: 1,
      skippedCount: 4,
      totalKeycloakUsers: 7,
    });
    useUsersMock.mockReturnValue(createUsersApiState({ syncUsersFromKeycloak }));
    useRolesMock.mockReturnValue(createRolesApiState());

    render(<UserListPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Aus Keycloak synchronisieren' }));

    await waitFor(() => {
      expect(syncUsersFromKeycloak).toHaveBeenCalledTimes(1);
      expect(
        screen.getByText('2 importiert, 1 aktualisiert, 4 ohne passenden Instanzkontext übersprungen.')
      ).toBeTruthy();
    });
  });
});
