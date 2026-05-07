import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { UserCreatePage } from './-user-create-page';

const navigateMock = vi.fn();
const useUsersMock = vi.fn();
const useRolesMock = vi.fn();

vi.mock('@tanstack/react-router', () => ({
  Link: ({ to, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
  useNavigate: () => navigateMock,
}));

vi.mock('../../../hooks/use-users', () => ({
  useUsers: () => useUsersMock(),
}));

vi.mock('../../../hooks/use-roles', () => ({
  useRoles: () => useRolesMock(),
}));

describe('UserCreatePage', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    navigateMock.mockReset();
    useUsersMock.mockReset();
    useRolesMock.mockReset();

    useRolesMock.mockReturnValue({
      roles: [{ id: 'role-1', roleName: 'system_admin' }],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
      createRole: vi.fn(),
      updateRole: vi.fn(),
      deleteRole: vi.fn(),
    });
  });

  it('renders mutation-specific client errors without load wording', () => {
    useUsersMock.mockReturnValue({
      users: [],
      total: 0,
      page: 1,
      pageSize: 25,
      isLoading: false,
      error: null,
      mutationError: {
        status: 500,
        code: 'internal_error',
        message: 'Einladungs-E-Mail zum Passwort setzen konnte nicht gesendet werden.',
      },
      filters: { page: 1, pageSize: 25, search: '', status: 'all', role: '' },
      setSearch: vi.fn(),
      setStatus: vi.fn(),
      setRole: vi.fn(),
      setPage: vi.fn(),
      refetch: vi.fn(),
      createUser: vi.fn(),
      updateUser: vi.fn(),
      deactivateUser: vi.fn(),
      bulkDeactivate: vi.fn(),
      syncUsersFromKeycloak: vi.fn(),
    });

    render(<UserCreatePage />);

    expect(screen.getByRole('alert').textContent).toContain(
      'Technischer Fehler bei der Nutzeraktion: Einladungs-E-Mail zum Passwort setzen konnte nicht gesendet werden.'
    );
    expect(screen.getByRole('alert').textContent).not.toContain('Technischer Fehler beim Laden der Nutzer');
  });

  it('navigates to the created user after successful submit', async () => {
    const createUser = vi.fn().mockResolvedValue({
      id: 'user-2',
    });

    useUsersMock.mockReturnValue({
      users: [],
      total: 0,
      page: 1,
      pageSize: 25,
      isLoading: false,
      error: null,
      mutationError: null,
      filters: { page: 1, pageSize: 25, search: '', status: 'all', role: '' },
      setSearch: vi.fn(),
      setStatus: vi.fn(),
      setRole: vi.fn(),
      setPage: vi.fn(),
      refetch: vi.fn(),
      createUser,
      updateUser: vi.fn(),
      deactivateUser: vi.fn(),
      bulkDeactivate: vi.fn(),
      syncUsersFromKeycloak: vi.fn(),
    });

    render(<UserCreatePage />);

    fireEvent.change(screen.getByLabelText('E-Mail'), { target: { value: 'user@example.com' } });
    fireEvent.change(screen.getByLabelText('Vorname'), { target: { value: 'Ada' } });
    fireEvent.change(screen.getByLabelText('Nachname'), { target: { value: 'Lovelace' } });
    fireEvent.click(screen.getByRole('button', { name: 'Nutzer anlegen' }));

    await waitFor(() => {
      expect(createUser).toHaveBeenCalledWith({
        email: 'user@example.com',
        firstName: 'Ada',
        lastName: 'Lovelace',
        displayName: 'Ada Lovelace',
        roleIds: [],
      });
    });

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith({
        to: '/admin/users/$userId',
        params: { userId: 'user-2' },
      });
    });
  });
});
