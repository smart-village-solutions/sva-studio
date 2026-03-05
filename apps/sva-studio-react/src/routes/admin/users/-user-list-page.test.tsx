import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { UserListPage } from './-user-list-page';

const useUsersMock = vi.fn();
const useRolesMock = vi.fn();

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

describe('UserListPage', () => {
  it('renders user table and opens create dialog', () => {
    useUsersMock.mockReturnValue({
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
      ],
      total: 1,
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
      createUser: vi.fn(),
      updateUser: vi.fn(),
      deactivateUser: vi.fn(),
      bulkDeactivate: vi.fn(),
    });

    useRolesMock.mockReturnValue({
      roles: [{ id: 'role-1', roleName: 'system_admin' }],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
      createRole: vi.fn(),
      updateRole: vi.fn(),
      deleteRole: vi.fn(),
    });

    render(<UserListPage />);

    expect(screen.getByRole('heading', { name: 'Benutzerverwaltung' })).toBeTruthy();
    expect(screen.getAllByText('Alice').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: 'Nutzer anlegen' }));
    expect(screen.getByRole('dialog', { name: 'Nutzer anlegen' })).toBeTruthy();
  });
});
