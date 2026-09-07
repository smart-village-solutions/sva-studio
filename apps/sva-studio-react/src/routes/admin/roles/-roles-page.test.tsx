import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';

import { RolesPage } from './-roles-page';

const useRolesMock = vi.fn();
const useKeycloakRolesMock = vi.fn();
const useAuthMock = vi.fn();
const iamAccessAllowedMock = vi.fn();

vi.mock('../../../hooks/use-iam-resource-access', () => ({
  useIamResourceAccess: () => ({
    read: { status: iamAccessAllowedMock() ? 'allowed' : 'denied' },
    create: { status: iamAccessAllowedMock() ? 'allowed' : 'denied' },
    update: { status: iamAccessAllowedMock() ? 'allowed' : 'denied' },
    delete: { status: iamAccessAllowedMock() ? 'allowed' : 'denied' },
  }),
  isIamAccessAllowed: (decision: { status: string }) => decision.status === 'allowed',
}));

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

vi.mock('../../../hooks/use-keycloak-roles', () => ({
  useKeycloakRoles: (enabled: boolean) => useKeycloakRolesMock(enabled),
}));

vi.mock('../../../providers/auth-provider', () => ({
  useAuth: () => useAuthMock(),
}));

describe('RolesPage', () => {
  beforeEach(() => {
    iamAccessAllowedMock.mockReset();
    iamAccessAllowedMock.mockReturnValue(true);
    useRolesMock.mockReset();
    useKeycloakRolesMock.mockReset();
    useKeycloakRolesMock.mockReturnValue({
      roles: [],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    useAuthMock.mockReset();
    useAuthMock.mockReturnValue({
      user: { id: 'user-admin', instanceId: 'de-musterhausen', roles: ['system_admin'] },
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('renders role list and routes edit actions to the detail page', () => {
    useRolesMock.mockReturnValue({
      roles: [
        {
          id: 'role-root',
          roleKey: 'instance_registry_admin',
          roleName: 'instance_registry_admin',
          externalRoleName: 'instance_registry_admin',
          managedBy: 'external',
          description: 'Root-only role',
          isSystemRole: true,
          roleLevel: 90,
          memberCount: 0,
          syncState: 'synced',
          permissions: [],
        },
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
          permissions: [
            { id: 'perm-2', permissionKey: 'content.updatePayload', description: null },
          ],
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
    expect(screen.queryByText('instance_registry_admin')).toBeNull();
    expect(screen.getAllByText('system_admin').length).toBeGreaterThan(0);
    expect(screen.getAllByText('editor').length).toBeGreaterThan(0);
    expect((screen.getByLabelText('Rollentyp') as HTMLSelectElement).value).toBe('studio');

    fireEvent.change(screen.getByPlaceholderText('Nach Rolle oder Berechtigung suchen'), {
      target: { value: 'payload' },
    });

    expect(screen.queryAllByText('system_admin')).toHaveLength(0);
    expect(screen.getAllByText('editor').length).toBeGreaterThan(0);

    fireEvent.change(screen.getByPlaceholderText('Nach Rolle oder Berechtigung suchen'), {
      target: { value: '' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Rolle' }));

    expect(screen.getAllByRole('link', { name: 'Rolle bearbeiten' })[0]?.getAttribute('href')).toBe(
      '/admin/roles/role-2'
    );
    expect(screen.getAllByText('Editorial role').length).toBeGreaterThan(0);
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

    expect(screen.getByRole('link', { name: 'Rolle anlegen' }).getAttribute('href')).toBe(
      '/admin/roles/new'
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Bereits in Keycloak angelegte Rollen importieren' })
    );
    expect(reconcile).toHaveBeenCalledTimes(1);
  });

  it('switches from Studio roles to external and built-in Keycloak roles', () => {
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
      reconcile: vi.fn(),
    });
    useKeycloakRolesMock.mockReturnValue({
      roles: [
        {
          id: 'external:news-editor',
          roleName: 'news_editor',
          managedBy: 'external',
          composite: false,
          category: 'assignable',
          assignable: true,
        },
        {
          id: 'realm:default-roles',
          roleName: 'default-roles-de-musterhausen',
          managedBy: 'keycloak_builtin',
          description: 'Default roles',
          composite: true,
          category: 'keycloak_builtin',
          assignable: false,
          reasonCode: 'keycloak_builtin_role',
        },
      ],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<RolesPage />);

    fireEvent.change(screen.getByLabelText('Rollentyp'), {
      target: { value: 'external' },
    });
    expect(screen.getAllByText('news_editor').length).toBeGreaterThan(0);
    expect(screen.queryByText('default-roles-de-musterhausen')).toBeNull();

    fireEvent.change(screen.getByLabelText('Rollentyp'), {
      target: { value: 'builtin' },
    });

    expect(screen.getAllByText('Keycloak-Built-in-Rolle').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Read-only').length).toBeGreaterThan(0);
    expect(screen.queryByText('Synchronisierung')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Rolle löschen' })).toBeNull();
    expect(useKeycloakRolesMock).toHaveBeenCalledWith(true);
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
    expect(
      within(dialog).getByText(
        'Beim Löschen werden bestehende Benutzer- und Gruppenzuordnungen dieser Rolle entfernt und anschließend die Rolle dauerhaft gelöscht.'
      )
    ).toBeTruthy();
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

  it('renders object diagnostics from reconcile reports', () => {
    useRolesMock.mockReturnValue({
      roles: [],
      isLoading: false,
      error: null,
      mutationError: null,
      reconcileReport: {
        outcome: 'partial_failure',
        checkedCount: 2,
        correctedCount: 1,
        failedCount: 1,
        manualReviewCount: 1,
        requiresManualActionCount: 1,
        roles: [
          {
            externalRoleName: 'default-roles-de-musterhausen',
            action: 'report',
            status: 'requires_manual_action',
            errorCode: 'IDP_FORBIDDEN',
            diagnostics: [
              { code: 'forbidden_role_mapping', objectId: 'role-1', objectType: 'role' },
            ],
          },
        ],
      },
      refetch: vi.fn(),
      clearMutationError: vi.fn(),
      createRole: vi.fn(),
      updateRole: vi.fn(),
      deleteRole: vi.fn(),
      retryRoleSync: vi.fn(),
      reconcile: vi.fn(),
    });

    render(<RolesPage />);

    expect(screen.getByText(/Reconcile abgeschlossen\. Geprüft: 2, korrigiert: 1/i)).toBeTruthy();
    expect(
      screen.getByText('1 Rollenobjekte mit Diagnose: IDP_FORBIDDEN, forbidden_role_mapping')
    ).toBeTruthy();
  });

  it('renders platform roles on root scope without tenant mutations', () => {
    const reconcile = vi.fn();
    useAuthMock.mockReturnValue({
      user: { id: 'platform-admin', roles: ['instance_registry_admin'] },
    });
    useRolesMock.mockReturnValue({
      roles: [
        {
          id: 'platform:instance_registry_admin',
          roleKey: 'instance_registry_admin',
          roleName: 'instance_registry_admin',
          externalRoleName: 'instance_registry_admin',
          managedBy: 'external',
          description: 'Platform admin',
          isSystemRole: true,
          roleLevel: 90,
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
    expect(screen.getAllByText('instance_registry_admin').length).toBeGreaterThan(0);
    expect(screen.queryByRole('link', { name: 'Rolle anlegen' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Rolle bearbeiten' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Rolle löschen' })).toBeNull();
    fireEvent.change(screen.getByLabelText('Rollentyp'), {
      target: { value: 'external' },
    });
    expect(screen.getAllByText('instance_registry_admin').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: 'Plattform-Rollen abgleichen' }));
    expect(reconcile).toHaveBeenCalledTimes(1);
  });

  it('does not switch into platform scope for rootless sessions without the platform role', () => {
    useAuthMock.mockReturnValue({ user: { id: 'broken-session', roles: ['system_admin'] } });
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
      reconcile: vi.fn(),
    });

    render(<RolesPage />);

    expect(screen.getByRole('heading', { name: 'Rollenverwaltung' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Plattform-Rollen' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Rolle anlegen' })).toBeTruthy();
  });

  it('uses compact icon actions for editable roles', () => {
    useRolesMock.mockReturnValue({
      roles: [
        {
          id: 'role-9',
          roleKey: 'writer',
          roleName: 'writer',
          externalRoleName: 'writer',
          managedBy: 'studio',
          description: 'Writes content',
          isSystemRole: false,
          roleLevel: 15,
          memberCount: 2,
          syncState: 'failed',
          syncError: { code: 'IDP_UNAVAILABLE' },
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
      reconcile: vi.fn(),
    });

    render(<RolesPage />);

    expect(screen.getAllByRole('link', { name: 'Rolle bearbeiten' }).length).toBeGreaterThan(0);
    expect(
      screen.getAllByRole('button', { name: 'Erneut synchronisieren' }).length
    ).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: 'Rolle löschen' }).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Writes content').length).toBeGreaterThan(0);
  });

  it('removes all role mutation controls without write access', () => {
    iamAccessAllowedMock.mockReturnValue(false);
    useRolesMock.mockReturnValue({
      roles: [
        {
          id: 'role-9',
          roleKey: 'writer',
          roleName: 'writer',
          externalRoleName: 'writer',
          managedBy: 'studio',
          description: 'Writes content',
          isSystemRole: false,
          roleLevel: 15,
          memberCount: 2,
          syncState: 'failed',
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
      reconcile: vi.fn(),
    });

    render(<RolesPage />);

    expect(screen.queryByRole('link', { name: 'Rolle anlegen' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Aus Keycloak importieren' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Erneut synchronisieren' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Rolle löschen' })).toBeNull();
  });
});
