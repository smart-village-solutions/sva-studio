import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { RolesPage } from './-roles-page';

const useRolesMock = vi.fn();

vi.mock('../../../hooks/use-roles', () => ({
  useRoles: () => useRolesMock(),
}));

describe('RolesPage', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders role list and supports search, sort and permission expand', () => {
    useRolesMock.mockReturnValue({
      roles: [
        {
          id: 'role-1',
          roleName: 'system_admin',
          description: 'System administration',
          isSystemRole: true,
          roleLevel: 90,
          memberCount: 1,
          permissions: [{ id: 'perm-1', permissionKey: 'content.read', description: 'Lesen' }],
        },
        {
          id: 'role-2',
          roleName: 'editor',
          description: 'Editorial role',
          isSystemRole: false,
          roleLevel: 20,
          memberCount: 3,
          permissions: [{ id: 'perm-2', permissionKey: 'content.write', description: null }],
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
    expect(screen.getByText('editor')).toBeTruthy();

    fireEvent.change(screen.getByPlaceholderText('Nach Rolle oder Berechtigung suchen'), {
      target: { value: 'write' },
    });

    expect(screen.queryByText('system_admin')).toBeNull();
    expect(screen.getByText('editor')).toBeTruthy();

    fireEvent.change(screen.getByPlaceholderText('Nach Rolle oder Berechtigung suchen'), {
      target: { value: '' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Sortierung wechseln' }));
    const roleToggleButtons = screen.getAllByRole('button', { name: /system_admin|editor/ });
    expect(roleToggleButtons[0]?.textContent).toContain('system_admin');

    fireEvent.click(screen.getAllByRole('button', { name: /editor/i })[0]!);
    expect(screen.getByText('content.write')).toBeTruthy();
  });

  it('opens create dialog and submits normalized payload', async () => {
    const createRole = vi.fn().mockResolvedValue(true);

    useRolesMock.mockReturnValue({
      roles: [],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
      createRole,
      updateRole: vi.fn(),
      deleteRole: vi.fn(),
    });

    render(<RolesPage />);

    fireEvent.click(screen.getAllByRole('button', { name: 'Rolle anlegen' })[0]!);
    const dialog = screen.getByRole('dialog', { name: 'Neue Rolle erstellen' });

    fireEvent.change(within(dialog).getByLabelText('Rollenname'), {
      target: { value: '  Team Lead  ' },
    });
    fireEvent.change(within(dialog).getByLabelText('Beschreibung'), {
      target: { value: ' Verantwortlich für Teamkoordination ' },
    });
    fireEvent.change(within(dialog).getByLabelText('Rollenlevel'), {
      target: { value: '42' },
    });

    fireEvent.submit(within(dialog).getByRole('button', { name: 'Rolle anlegen' }).closest('form')!);

    expect(createRole).toHaveBeenCalledWith({
      roleName: 'team_lead',
      description: 'Verantwortlich für Teamkoordination',
      roleLevel: 42,
      permissionIds: [],
    });
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Neue Rolle erstellen' })).toBeNull();
    });
  });

  it('shows retry on list error and keeps create dialog open on create failure', () => {
    const refetch = vi.fn().mockResolvedValue(undefined);
    const createRole = vi.fn().mockResolvedValue(false);

    useRolesMock.mockReturnValue({
      roles: [],
      isLoading: false,
      error: new Error('boom'),
      refetch,
      createRole,
      updateRole: vi.fn(),
      deleteRole: vi.fn(),
    });

    render(<RolesPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Erneut versuchen' }));
    expect(refetch).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getAllByRole('button', { name: 'Rolle anlegen' })[0]!);
    const dialog = screen.getByRole('dialog', { name: 'Neue Rolle erstellen' });
    fireEvent.change(within(dialog).getByLabelText('Rollenname'), {
      target: { value: 'Support' },
    });
    fireEvent.submit(within(dialog).getByRole('button', { name: 'Rolle anlegen' }).closest('form')!);

    expect(createRole).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('dialog', { name: 'Neue Rolle erstellen' })).toBeTruthy();
  });

  it('triggers delete confirmation for custom roles', () => {
    const deleteRole = vi.fn().mockResolvedValue(true);

    useRolesMock.mockReturnValue({
      roles: [
        {
          id: 'role-custom',
          roleName: 'custom_editor',
          description: 'Custom',
          isSystemRole: false,
          roleLevel: 30,
          memberCount: 0,
          permissions: [],
        },
      ],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
      createRole: vi.fn(),
      updateRole: vi.fn(),
      deleteRole,
    });

    render(<RolesPage />);

    const row = screen.getByText('custom_editor').closest('tr');
    expect(row).toBeTruthy();
    fireEvent.click(within(row!).getByRole('button', { name: 'Rolle löschen' }));
    const dialog = screen.getByRole('alertdialog', { name: 'Rolle löschen' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Rolle löschen' }));

    expect(deleteRole).toHaveBeenCalledWith('role-custom');
  });
});
