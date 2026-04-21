import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';

import { RolesPage } from './-roles-page';

const useRolesMock = vi.fn();
const useAuthMock = vi.fn();

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
}));

vi.mock('../../../hooks/use-roles', () => ({
  useRoles: () => useRolesMock(),
}));

vi.mock('../../../providers/auth-provider', () => ({
  useAuth: () => useAuthMock(),
}));

describe('RolesPage', () => {
  beforeEach(() => {
    useRolesMock.mockReset();
    useAuthMock.mockReset();
    useAuthMock.mockReturnValue({ user: { id: 'user-admin', instanceId: 'de-musterhausen', roles: ['system_admin'] } });
  });

  afterEach(() => {
    cleanup();
  });

  it('renders role list and routes edit actions to the detail page', () => {
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
          permissions: [{ id: 'perm-1', permissionKey: 'content.read', description: 'Lesen' }],
        },
        {
          id: 'role-2',
          roleKey: 'editor',
          roleName: 'editor',
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
      updateRole: vi.fn(),
      deleteRole: vi.fn(),
      retryRoleSync: vi.fn(),
      reconcile: vi.fn(),
    });

    render(<RolesPage />);

    expect(screen.getByRole('heading', { name: 'Rollenverwaltung' })).toBeTruthy();
    expect(screen.getAllByText('system_admin').length).toBeGreaterThan(0);
    expect(screen.getAllByText('editor').length).toBeGreaterThan(0);

    fireEvent.change(screen.getByPlaceholderText('Nach Rolle oder Berechtigung suchen'), {
      target: { value: 'write' },
    });

    expect(screen.queryAllByText('system_admin')).toHaveLength(0);
    expect(screen.getAllByText('editor').length).toBeGreaterThan(0);

    fireEvent.change(screen.getByPlaceholderText('Nach Rolle oder Berechtigung suchen'), {
      target: { value: '' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Rolle' }));

    expect(screen.getAllByRole('link', { name: 'Rolle bearbeiten' })[0]?.getAttribute('href')).toBe('/admin/roles/role-2');
  });

  it('links the create action to the dedicated creation page', () => {
    const reconcile = vi.fn();

    useRolesMock.mockReturnValue({
      roles: [],
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
      reconcile,
    });

    render(<RolesPage />);

    expect(screen.getByRole('link', { name: 'Rolle anlegen' }).getAttribute('href')).toBe('/admin/roles/new');
    fireEvent.click(screen.getByRole('button', { name: 'Bereits in Keycloak angelegte Rollen importieren' }));
    expect(reconcile).toHaveBeenCalledTimes(1);
  });

  it('triggers delete confirmation for custom roles', () => {
    const deleteRole = vi.fn().mockResolvedValue(true);

    useRolesMock.mockReturnValue({
      roles: [
        {
          id: 'role-custom',
          roleKey: 'custom_editor',
          roleName: 'custom_editor',
          externalRoleName: 'custom_editor',
          managedBy: 'studio',
          description: 'Custom',
          isSystemRole: false,
          roleLevel: 30,
          memberCount: 0,
          syncState: 'synced',
          permissions: [],
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
      deleteRole,
      retryRoleSync: vi.fn(),
      reconcile: vi.fn(),
    });

    render(<RolesPage />);

    const row = screen.getAllByText('custom_editor')[0]?.closest('tr');
    expect(row).toBeTruthy();
    fireEvent.click(within(row!).getByRole('button', { name: 'Rolle löschen' }));
    const dialog = screen.getByRole('alertdialog', { name: 'Rolle löschen' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Rolle löschen' }));

    expect(deleteRole).toHaveBeenCalledWith('role-custom');
  });

  it('renders runtime diagnostics for role list errors', () => {
    useRolesMock.mockReturnValue({
      roles: [],
      isLoading: false,
      error: {
        name: 'IamHttpError',
        message: 'reconcile failed',
        status: 503,
        code: 'keycloak_unavailable',
        classification: 'keycloak_reconcile',
        diagnosticStatus: 'manuelle_pruefung_erforderlich',
        recommendedAction: 'rollenabgleich_pruefen',
        requestId: 'req-role-list-7',
        safeDetails: { sync_error_code: 'IDP_UNAVAILABLE' },
      },
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

    render(<RolesPage />);

    expect(
      screen.getByText(
        'Der Rollenabgleich mit Keycloak ist fehlgeschlagen oder erfordert manuelle Nacharbeit. Bitte den Reconcile-Befund prüfen.'
      )
    ).toBeTruthy();
    expect(screen.getByText('Diagnose: Keycloak-Reconcile')).toBeTruthy();
    expect(screen.getByText('Empfohlene Aktion: Rollenabgleich prüfen')).toBeTruthy();
    expect(screen.getByText('Sync-Fehlercode: IDP_UNAVAILABLE')).toBeTruthy();
    expect(screen.getByText('Request-ID: req-role-list-7')).toBeTruthy();
  });

  it('renders platform roles on root scope without tenant mutations', () => {
    const reconcile = vi.fn();
    useAuthMock.mockReturnValue({ user: { id: 'platform-admin', roles: ['system_admin'] } });
    useRolesMock.mockReturnValue({
      roles: [
        {
          id: 'platform:system_admin',
          roleKey: 'system_admin',
          roleName: 'system_admin',
          externalRoleName: 'system_admin',
          managedBy: 'external',
          description: 'Platform admin',
          isSystemRole: true,
          roleLevel: 100,
          memberCount: 0,
          syncState: 'synced',
          permissions: [],
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
      reconcile,
    });

    render(<RolesPage />);

    expect(screen.getByRole('heading', { name: 'Plattform-Rollen' })).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Rolle anlegen' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Rolle bearbeiten' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Rolle löschen' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Plattform-Rollen abgleichen' }));
    expect(reconcile).toHaveBeenCalledTimes(1);
  });
});
