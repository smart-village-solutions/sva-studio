import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { UserEditPage } from './-user-edit-page';

const useUserMock = vi.fn();
const useRolesMock = vi.fn();

vi.mock('../../../hooks/use-user', () => ({
  useUser: (...args: unknown[]) => useUserMock(...args),
}));

vi.mock('../../../hooks/use-roles', () => ({
  useRoles: () => useRolesMock(),
}));

describe('UserEditPage', () => {
  it('renders tabs and allows switching', () => {
    useUserMock.mockReturnValue({
      user: {
        id: 'user-1',
        keycloakSubject: 'subject-1',
        displayName: 'Alice Admin',
        email: 'alice@example.com',
        status: 'active',
        roles: [{ roleId: 'role-1', roleName: 'system_admin', roleLevel: 90 }],
        permissions: ['content.read'],
      },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
      save: vi.fn().mockResolvedValue(null),
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

    render(<UserEditPage userId="user-1" />);

    expect(screen.getByRole('heading', { name: 'Alice Admin' })).toBeTruthy();

    fireEvent.click(screen.getByRole('tab', { name: 'Berechtigungen' }));
    expect(screen.getByText('content.read')).toBeTruthy();
  });
});
