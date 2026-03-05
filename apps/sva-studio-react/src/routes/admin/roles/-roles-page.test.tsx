import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { RolesPage } from './-roles-page';

const useRolesMock = vi.fn();

vi.mock('../../../hooks/use-roles', () => ({
  useRoles: () => useRolesMock(),
}));

describe('RolesPage', () => {
  it('renders role list and opens create dialog', () => {
    useRolesMock.mockReturnValue({
      roles: [
        {
          id: 'role-1',
          roleName: 'system_admin',
          description: 'System administration',
          isSystemRole: true,
          roleLevel: 90,
          memberCount: 1,
          permissions: [{ id: 'perm-1', permissionKey: 'content.read' }],
        },
      ],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
      createRole: vi.fn(),
      updateRole: vi.fn(),
      deleteRole: vi.fn(),
    });

    render(<RolesPage />);

    expect(screen.getByRole('heading', { name: 'Rollenverwaltung' })).toBeTruthy();
    expect(screen.getByText('system_admin')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Rolle anlegen' }));
    expect(screen.getByRole('dialog', { name: 'Neue Rolle erstellen' })).toBeTruthy();
  });
});
