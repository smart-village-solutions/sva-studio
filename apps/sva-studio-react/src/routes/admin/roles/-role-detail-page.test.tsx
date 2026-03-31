import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';

import { RoleDetailPage } from './-role-detail-page';

const useRolesMock = vi.fn();
const useRolePermissionsMock = vi.fn();
const useUsersMock = vi.fn();
const navigateMock = vi.fn();

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    to,
    params,
    search,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & {
    to: string;
    params?: Record<string, string>;
    search?: Record<string, string>;
  }) => {
    let href = to;
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        href = href.replace(`$${key}`, value);
      }
    }
    if (search?.tab) {
      href = `${href}?tab=${search.tab}`;
    }
    return (
      <a href={href} {...props}>
        {children}
      </a>
    );
  },
  useNavigate: () => navigateMock,
}));

vi.mock('../../../hooks/use-roles', () => ({
  useRoles: () => useRolesMock(),
}));

vi.mock('../../../hooks/use-role-permissions', () => ({
  useRolePermissions: () => useRolePermissionsMock(),
}));

vi.mock('../../../hooks/use-users', () => ({
  useUsers: () => useUsersMock(),
}));

describe('RoleDetailPage', () => {
  beforeEach(() => {
    useRolesMock.mockReset();
    useRolePermissionsMock.mockReset();
    navigateMock.mockReset();

    useRolePermissionsMock.mockReturnValue({
      permissions: [
        { id: 'perm-1', instanceId: 'de-musterhausen', permissionKey: 'content.read', description: 'Lesen' },
        { id: 'perm-2', instanceId: 'de-musterhausen', permissionKey: 'content.write', description: 'Schreiben' },
        { id: 'perm-3', instanceId: 'de-musterhausen', permissionKey: 'iam.configure', description: 'Konfigurieren' },
      ],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    useUsersMock.mockReturnValue({
      users: [
        {
          id: 'user-1',
          keycloakSubject: 'subject-1',
          displayName: 'Alice Editor',
          email: 'alice@example.org',
          status: 'active',
          roles: [{ roleId: 'role-2', roleKey: 'editor', roleName: 'Editor', roleLevel: 20 }],
        },
        {
          id: 'user-2',
          keycloakSubject: 'subject-2',
          displayName: 'Bob Manager',
          email: 'bob@example.org',
          status: 'active',
          roles: [{ roleId: 'role-other', roleKey: 'manager', roleName: 'Manager', roleLevel: 40 }],
        },
      ],
      total: 2,
      page: 1,
      pageSize: 100,
      isLoading: false,
      error: null,
      filters: { page: 1, pageSize: 100, search: '', status: 'all', role: '' },
      setSearch: vi.fn(),
      setStatus: vi.fn(),
      setRole: vi.fn(),
      setPage: vi.fn(),
      refetch: vi.fn(),
      createUser: vi.fn(),
      updateUser: vi.fn().mockResolvedValue(null),
      deactivateUser: vi.fn(),
      bulkDeactivate: vi.fn(),
      syncUsersFromKeycloak: vi.fn(),
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('renders tabbed role detail page and saves general data', async () => {
    const updateRole = vi.fn().mockResolvedValue(true);

    useRolesMock.mockReturnValue({
      roles: [
        {
          id: 'role-2',
          roleKey: 'editor',
          roleName: 'Editor',
          externalRoleName: 'editor',
          managedBy: 'studio',
          description: 'Editorial role',
          isSystemRole: false,
          roleLevel: 20,
          memberCount: 3,
          syncState: 'failed',
          syncError: { code: 'IDP_UNAVAILABLE' },
          permissions: [{ id: 'perm-2', permissionKey: 'content.write', description: null }],
        },
      ],
      isLoading: false,
      error: null,
      mutationError: null,
      reconcileReport: null,
      refetch: vi.fn(),
      clearMutationError: vi.fn(),
      createRole: vi.fn(),
      updateRole,
      deleteRole: vi.fn(),
      retryRoleSync: vi.fn(),
      reconcile: vi.fn(),
    });

    render(<RoleDetailPage roleId="role-2" activeTab="general" />);

    expect(screen.getByRole('heading', { name: 'Editor' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Allgemein' }).getAttribute('aria-selected')).toBe('true');
    fireEvent.change(screen.getByLabelText('Anzeigename'), { target: { value: 'Content Editor' } });
    fireEvent.change(screen.getByLabelText('Beschreibung'), { target: { value: 'Updated description' } });
    fireEvent.change(screen.getByLabelText('Rollenlevel'), { target: { value: '33' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Allgemeine Daten speichern' }).closest('form')!);

    await waitFor(() => {
      expect(updateRole).toHaveBeenCalledWith('role-2', {
        displayName: 'Content Editor',
        description: 'Updated description',
        roleLevel: 33,
      });
    });
  });

  it('allows switching to permissions tab and saving permission changes', async () => {
    const updateRole = vi.fn().mockResolvedValue(true);

    useRolesMock.mockReturnValue({
      roles: [
        {
          id: 'role-2',
          roleKey: 'editor',
          roleName: 'Editor',
          externalRoleName: 'editor',
          managedBy: 'studio',
          description: 'Editorial role',
          isSystemRole: false,
          roleLevel: 20,
          memberCount: 3,
          syncState: 'synced',
          permissions: [{ id: 'perm-2', permissionKey: 'content.write', description: null }],
        },
      ],
      isLoading: false,
      error: null,
      mutationError: null,
      reconcileReport: null,
      refetch: vi.fn(),
      clearMutationError: vi.fn(),
      createRole: vi.fn(),
      updateRole,
      deleteRole: vi.fn(),
      retryRoleSync: vi.fn(),
      reconcile: vi.fn(),
    });

    render(<RoleDetailPage roleId="role-2" activeTab="permissions" />);

    expect(screen.getByRole('tab', { name: 'Berechtigungen' }).getAttribute('aria-selected')).toBe('true');

    fireEvent.click(screen.getByLabelText(/Lesen/));
    fireEvent.click(screen.getByRole('button', { name: 'Rechte speichern' }));

    await waitFor(() => {
      expect(updateRole).toHaveBeenCalledWith('role-2', {
        permissionIds: ['perm-1', 'perm-2'],
      });
    });
  });

  it('can reveal technical permission details and links to the IAM cockpit', () => {
    useRolesMock.mockReturnValue({
      roles: [
        {
          id: 'role-2',
          roleKey: 'editor',
          roleName: 'Editor',
          externalRoleName: 'editor',
          managedBy: 'studio',
          description: 'Editorial role',
          isSystemRole: false,
          roleLevel: 20,
          memberCount: 3,
          syncState: 'synced',
          permissions: [{ id: 'perm-2', permissionKey: 'content.write', description: null }],
        },
      ],
      isLoading: false,
      error: null,
      mutationError: null,
      reconcileReport: null,
      refetch: vi.fn(),
      clearMutationError: vi.fn(),
      createRole: vi.fn(),
      updateRole: vi.fn(),
      deleteRole: vi.fn(),
      retryRoleSync: vi.fn(),
      reconcile: vi.fn(),
    });

    render(<RoleDetailPage roleId="role-2" activeTab="permissions" />);

    const cockpitLinks = screen.getAllByRole('link', { name: 'Im IAM-Cockpit prüfen' });
    expect(cockpitLinks).toHaveLength(2);
    expect(cockpitLinks[0]?.getAttribute('href')).toBe('/admin/iam?tab=rights');
    expect(cockpitLinks[1]?.getAttribute('href')).toBe('/admin/iam?tab=rights');
    expect(screen.queryByText('Technischer Schlüssel: content.read')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Technische Details anzeigen' }));

    expect(screen.getByText('Technischer Schlüssel: content.read')).toBeTruthy();
    expect(screen.getAllByText('Fachbereich: Inhalte').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Aktion: Lesen')).toBeTruthy();
    expect(screen.getByText('Aktion: Bearbeiten')).toBeTruthy();
    expect(screen.getByText('Zugeordnet')).toBeTruthy();
    expect(screen.getAllByText('Nicht zugeordnet').length).toBeGreaterThanOrEqual(1);
  });

  it('renders system roles as read-only on the detail page', () => {
    useRolesMock.mockReturnValue({
      roles: [
        {
          id: 'role-1',
          roleKey: 'system_admin',
          roleName: 'system_admin',
          externalRoleName: 'system_admin',
          managedBy: 'studio',
          description: 'System administration',
          isSystemRole: true,
          roleLevel: 90,
          memberCount: 1,
          syncState: 'synced',
          permissions: [{ id: 'perm-3', permissionKey: 'iam.configure', description: 'System konfigurieren' }],
        },
      ],
      isLoading: false,
      error: null,
      mutationError: null,
      reconcileReport: null,
      refetch: vi.fn(),
      clearMutationError: vi.fn(),
      createRole: vi.fn(),
      updateRole: vi.fn(),
      deleteRole: vi.fn(),
      retryRoleSync: vi.fn(),
      reconcile: vi.fn(),
    });

    render(<RoleDetailPage roleId="role-1" activeTab="general" />);

    expect(
      screen.getByText('Systemrollen bleiben schreibgeschützt, damit Baseline-Rechte konsistent und nachvollziehbar bleiben.')
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Allgemeine Daten speichern' }).hasAttribute('disabled')).toBe(true);
  });

  it('navigates between tabs through tab buttons', () => {
    useRolesMock.mockReturnValue({
      roles: [
        {
          id: 'role-2',
          roleKey: 'editor',
          roleName: 'Editor',
          externalRoleName: 'editor',
          managedBy: 'studio',
          description: 'Editorial role',
          isSystemRole: false,
          roleLevel: 20,
          memberCount: 3,
          syncState: 'synced',
          permissions: [{ id: 'perm-2', permissionKey: 'content.write', description: null }],
        },
      ],
      isLoading: false,
      error: null,
      mutationError: null,
      reconcileReport: null,
      refetch: vi.fn(),
      clearMutationError: vi.fn(),
      createRole: vi.fn(),
      updateRole: vi.fn(),
      deleteRole: vi.fn(),
      retryRoleSync: vi.fn(),
      reconcile: vi.fn(),
    });

    render(<RoleDetailPage roleId="role-2" activeTab="general" />);

    fireEvent.click(screen.getByRole('tab', { name: 'Berechtigungen' }));

    expect(navigateMock).toHaveBeenCalledWith({
      to: '/admin/roles/$roleId',
      params: { roleId: 'role-2' },
      search: { tab: 'permissions' },
      replace: true,
    });
  });

  it('updates user assignments from the assignments tab', async () => {
    const updateUser = vi.fn().mockResolvedValue(null);

    useUsersMock.mockReturnValue({
      users: [
        {
          id: 'user-1',
          keycloakSubject: 'subject-1',
          displayName: 'Alice Editor',
          email: 'alice@example.org',
          status: 'active',
          roles: [{ roleId: 'role-2', roleKey: 'editor', roleName: 'Editor', roleLevel: 20 }],
        },
        {
          id: 'user-2',
          keycloakSubject: 'subject-2',
          displayName: 'Bob Manager',
          email: 'bob@example.org',
          status: 'active',
          roles: [{ roleId: 'role-other', roleKey: 'manager', roleName: 'Manager', roleLevel: 40 }],
        },
      ],
      total: 2,
      page: 1,
      pageSize: 100,
      isLoading: false,
      error: null,
      filters: { page: 1, pageSize: 100, search: '', status: 'all', role: '' },
      setSearch: vi.fn(),
      setStatus: vi.fn(),
      setRole: vi.fn(),
      setPage: vi.fn(),
      refetch: vi.fn(),
      createUser: vi.fn(),
      updateUser,
      deactivateUser: vi.fn(),
      bulkDeactivate: vi.fn(),
      syncUsersFromKeycloak: vi.fn(),
    });

    useRolesMock.mockReturnValue({
      roles: [
        {
          id: 'role-2',
          roleKey: 'editor',
          roleName: 'Editor',
          externalRoleName: 'editor',
          managedBy: 'studio',
          description: 'Editorial role',
          isSystemRole: false,
          roleLevel: 20,
          memberCount: 3,
          syncState: 'synced',
          permissions: [{ id: 'perm-2', permissionKey: 'content.write', description: null }],
        },
      ],
      isLoading: false,
      error: null,
      mutationError: null,
      reconcileReport: null,
      refetch: vi.fn(),
      clearMutationError: vi.fn(),
      createRole: vi.fn(),
      updateRole: vi.fn(),
      deleteRole: vi.fn(),
      retryRoleSync: vi.fn(),
      reconcile: vi.fn(),
    });

    render(<RoleDetailPage roleId="role-2" activeTab="assignments" />);

    fireEvent.click(screen.getByRole('button', { name: 'Entfernen' }));
    await waitFor(() => {
      expect(updateUser).toHaveBeenCalledWith('user-1', {
        roleIds: [],
      });
    });

    fireEvent.click(screen.getByRole('button', { name: 'Zuweisen' }));
    await waitFor(() => {
      expect(updateUser).toHaveBeenCalledWith('user-2', {
        roleIds: ['role-other', 'role-2'],
      });
    });
  });

  it('shows sync tab as Keycloak metadata sync only', () => {
    useRolesMock.mockReturnValue({
      roles: [
        {
          id: 'role-2',
          roleKey: 'editor',
          roleName: 'Editor',
          externalRoleName: 'editor',
          managedBy: 'studio',
          description: 'Editorial role',
          isSystemRole: false,
          roleLevel: 20,
          memberCount: 3,
          syncState: 'failed',
          lastSyncedAt: '2026-03-31T10:15:00.000Z',
          syncError: { code: 'IDP_UNAVAILABLE' },
          permissions: [{ id: 'perm-2', permissionKey: 'content.write', description: null }],
        },
      ],
      isLoading: false,
      error: null,
      mutationError: null,
      reconcileReport: null,
      refetch: vi.fn(),
      clearMutationError: vi.fn(),
      createRole: vi.fn(),
      updateRole: vi.fn(),
      deleteRole: vi.fn(),
      retryRoleSync: vi.fn(),
      reconcile: vi.fn(),
    });

    render(<RoleDetailPage roleId="role-2" activeTab="sync" />);

    expect(screen.getByText('Diese Ansicht beschreibt ausschließlich den Abgleich der Studio-Rollenmetadaten mit Keycloak.')).toBeTruthy();
    expect(
      screen.getByText(
        'Berechtigungen, Zuweisungen und lokale Rollenlevel werden im Studio gespeichert und verändern diesen Keycloak-Status nicht.'
      )
    ).toBeTruthy();
    expect(screen.getByText('Keycloak-Metadatenstatus')).toBeTruthy();
    expect(screen.getByText('IDP_UNAVAILABLE')).toBeTruthy();
    expect(screen.getByText('Berechtigungen der Rolle')).toBeTruthy();
    expect(screen.getByText('Benutzerzuweisungen zur Rolle')).toBeTruthy();
  });
});
