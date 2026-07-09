import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { UserListPage } from './-user-list-page';

const useUsersMock = vi.fn();
const isIamBulkEnabledMock = vi.fn();
const useAuthMock = vi.fn();

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

vi.mock('../../../lib/iam-admin-access', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../lib/iam-admin-access')>();
  return {
    ...actual,
    isIamBulkEnabled: () => isIamBulkEnabledMock(),
    hasUserDeleteAccess: (user: { permissionActions?: readonly string[] } | null | undefined) =>
      user?.permissionActions?.includes('iam.accounts.delete') === true,
  };
});

vi.mock('../../../providers/auth-provider', () => ({
  useAuth: () => useAuthMock(),
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
      roles: [{ roleId: 'role-1', roleKey: 'system_admin', roleName: 'system_admin', roleLevel: 90 }],
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
  createUser: vi.fn().mockResolvedValue(true),
  updateUser: vi.fn(),
  deactivateUser: vi.fn().mockResolvedValue(true),
  deleteUser: vi.fn().mockResolvedValue(true),
  bulkDeactivate: vi.fn().mockResolvedValue(true),
  bulkReprovisionMainserver: vi.fn().mockResolvedValue({
    successes: [{ id: 'user-1' }],
    failures: [],
    successCount: 1,
    failureCount: 0,
  }),
  syncUsersFromKeycloak: vi.fn().mockResolvedValue({
    ok: true,
    report: {
      outcome: 'success',
      checkedCount: 1,
      correctedCount: 1,
      manualReviewCount: 0,
      importedCount: 1,
      updatedCount: 0,
      skippedCount: 0,
      totalKeycloakUsers: 1,
    },
  }),
  ...overrides,
});

describe('UserListPage', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    useUsersMock.mockReset();
    isIamBulkEnabledMock.mockReset();
    isIamBulkEnabledMock.mockReturnValue(true);
    useAuthMock.mockReset();
    useAuthMock.mockReturnValue({
      user: {
        id: 'user-admin',
        instanceId: 'de-musterhausen',
        roles: ['system_admin'],
        permissionActions: ['iam.user.read', 'iam.accounts.delete'],
      },
    });
  });

  it('renders list actions and uses route links for create and edit', () => {
    useUsersMock.mockReturnValue(createUsersApiState());

    render(<UserListPage />);

    expect(screen.getByRole('heading', { name: 'Benutzerverwaltung' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Nutzer anlegen' }).getAttribute('href')).toBe('/admin/users/new');
    expect(screen.getAllByRole('link', { name: 'Bearbeiten' })[0]!.getAttribute('href')).toBe('/admin/users/$userId');
    expect(screen.getAllByRole('button', { name: 'Löschen' }).length).toBeGreaterThan(0);
  });

  it('shows Keycloak mapping diagnostics and disables blocked row actions', () => {
    useUsersMock.mockReturnValue(
      createUsersApiState({
        users: [
          {
            id: 'keycloak:subject-unmapped',
            keycloakSubject: 'subject-unmapped',
            displayName: 'Unmapped User',
            email: 'unmapped@example.com',
            status: 'active',
            mappingStatus: 'manual_review',
            editability: 'blocked',
            diagnostics: [{ code: 'missing_instance_attribute', objectId: 'subject-unmapped', objectType: 'user' }],
            roles: [],
          },
        ],
      })
    );

    render(<UserListPage />);

    expect(screen.getAllByText('Manuell prüfen').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Blockiert').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Diagnose: missing_instance_attribute').length).toBeGreaterThan(0);
    expect(screen.queryByRole('link', { name: 'Bearbeiten' })).toBeNull();
    screen
      .getAllByRole('button', { name: 'Bearbeiten' })
      .forEach((button) => expect(button.hasAttribute('disabled')).toBe(true));
    screen
      .getAllByRole('switch', { name: 'Aktivstatus für Unmapped User' })
      .forEach((button) => expect(button.hasAttribute('disabled')).toBe(true));
    screen
      .getAllByRole('button', { name: 'Löschen' })
      .forEach((button) => expect(button.hasAttribute('disabled')).toBe(true));
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

  it('shows retryable list errors and sync feedback', async () => {
    const refetch = vi.fn();
    const syncUsersFromKeycloak = vi.fn().mockResolvedValue({
      ok: true,
      report: {
        outcome: 'partial_failure',
        checkedCount: 6,
        correctedCount: 3,
        manualReviewCount: 1,
        importedCount: 1,
        updatedCount: 2,
        skippedCount: 3,
        totalKeycloakUsers: 6,
        diagnostics: {
          authRealm: 'de-musterhausen',
          providerSource: 'instance',
          matchedWithoutInstanceAttributeCount: 2,
        },
        objects: [
          {
            keycloakSubject: 'subject-2',
            mappingStatus: 'manual_review',
            diagnostics: [{ code: 'missing_instance_attribute', objectId: 'subject-2', objectType: 'user' }],
          },
        ],
      },
    });

    useUsersMock.mockReturnValue(
      createUsersApiState({
        error: new Error('failed'),
        refetch,
        syncUsersFromKeycloak,
      })
    );

    render(<UserListPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Erneut versuchen' }));
    fireEvent.click(screen.getByRole('button', { name: 'Aus Keycloak synchronisieren' }));

    expect(refetch).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(syncUsersFromKeycloak).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByText(/6 geprüft: 3 korrigiert, 1 manuell prüfen/i)).toBeTruthy());
    await waitFor(() =>
      expect(
        screen.getByText(/Realm de-musterhausen, Quelle Instanz-Realm\./i)
      ).toBeTruthy()
    );
    expect(screen.getByText('1 Benutzerobjekte mit Diagnose: missing_instance_attribute')).toBeTruthy();
    expect(screen.getByText(/teilweisen Fehlern oder manuellem Nachlauf/i)).toBeTruthy();
  });

  it('renders diagnostic details for sync and list errors', async () => {
    const syncUsersFromKeycloak = vi.fn().mockResolvedValue({
      ok: false,
      error: {
        name: 'IamHttpError',
        message: 'sync failed',
        status: 503,
        code: 'keycloak_unavailable',
        classification: 'keycloak_reconcile',
        diagnosticStatus: 'manuelle_pruefung_erforderlich',
        recommendedAction: 'keycloak_pruefen',
        requestId: 'req-sync-42',
        safeDetails: { sync_error_code: 'IDP_UNAVAILABLE' },
      },
    });

    useUsersMock.mockReturnValue(
      createUsersApiState({
        error: {
          name: 'IamHttpError',
          message: 'list failed',
          status: 503,
          code: 'keycloak_unavailable',
          classification: 'keycloak_dependency',
          diagnosticStatus: 'degradiert',
          recommendedAction: 'erneut_versuchen',
          requestId: 'req-list-24',
        },
        syncUsersFromKeycloak,
      })
    );

    render(<UserListPage />);

    expect(screen.getByText('Diagnose: Keycloak-Abhängigkeit')).toBeTruthy();
    expect(screen.getByText('Empfohlene Aktion: Erneut versuchen')).toBeTruthy();
    expect(screen.getByText('Request-ID: req-list-24')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Aus Keycloak synchronisieren' }));

    await waitFor(() => expect(syncUsersFromKeycloak).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByText('Diagnose: Keycloak-Reconcile')).toBeTruthy());
    expect(screen.getByText('Empfohlene Aktion: Keycloak prüfen')).toBeTruthy();
    expect(screen.getByText('Sync-Fehlercode: IDP_UNAVAILABLE')).toBeTruthy();
    expect(screen.getByText('Request-ID: req-sync-42')).toBeTruthy();
  });

  it('confirms single-user deactivation', async () => {
    const deactivateUser = vi.fn().mockResolvedValue(true);
    useUsersMock.mockReturnValue(createUsersApiState({ deactivateUser }));

    render(<UserListPage />);

    fireEvent.click(screen.getAllByRole('switch', { name: 'Aktivstatus für Alice' })[0]!);
    fireEvent.click(screen.getByRole('button', { name: 'Deaktivieren' }));

    await waitFor(() => expect(deactivateUser).toHaveBeenCalledWith('user-1'));
  });

  it('confirms bulk mainserver reprovision and shows summarized feedback', async () => {
    const bulkReprovisionMainserver = vi.fn().mockResolvedValue({
      successes: [{ id: 'user-1' }],
      failures: [{ id: 'user-2', code: 'conflict', message: 'Für den Nutzer ist keine E-Mail-Adresse hinterlegt.' }],
      successCount: 1,
      failureCount: 1,
    });
    useUsersMock.mockReturnValue(
      createUsersApiState({
        bulkReprovisionMainserver,
        users: [
          {
            id: 'user-1',
            keycloakSubject: 'subject-1',
            displayName: 'Alice',
            email: 'alice@example.com',
            status: 'active',
            lastLoginAt: '2026-03-04T10:00:00Z',
            roles: [{ roleId: 'role-1', roleKey: 'editor', roleName: 'editor', roleLevel: 20 }],
          },
          {
            id: 'user-2',
            keycloakSubject: 'subject-2',
            displayName: 'Bob',
            email: null,
            status: 'active',
            lastLoginAt: '2026-03-04T10:00:00Z',
            roles: [{ roleId: 'role-2', roleKey: 'editor', roleName: 'editor', roleLevel: 20 }],
          },
        ],
        total: 2,
      })
    );

    render(<UserListPage />);

    fireEvent.click(screen.getAllByRole('checkbox', { name: 'Benutzertabelle: Zeile user-1 auswählen' })[0]!);
    fireEvent.click(screen.getAllByRole('checkbox', { name: 'Benutzertabelle: Zeile user-2 auswählen' })[0]!);
    fireEvent.click(screen.getByRole('button', { name: 'Mainserver-Daten aktualisieren' }));

    expect(screen.getByText(/maximal 50/i)).toBeTruthy();
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Mainserver-Daten aktualisieren' }));

    await waitFor(() => expect(bulkReprovisionMainserver).toHaveBeenCalledWith(['user-1', 'user-2']));
    expect(screen.getByText('1 Nutzer erfolgreich aktualisiert.')).toBeTruthy();
    expect(screen.getByText('1 Nutzer konnten nicht aktualisiert werden.')).toBeTruthy();
    expect(screen.getByText(/user-2/)).toBeTruthy();
    expect(
      screen.getByText(/Die Nutzeränderung steht in Konflikt mit dem aktuellen Zustand/)
    ).toBeTruthy();
  });

  it('confirms hard delete only for actors with the explicit delete permission', async () => {
    const deleteUser = vi.fn().mockResolvedValue(true);
    useUsersMock.mockReturnValue(
      createUsersApiState({
        deleteUser,
        users: [
          {
            id: 'user-2',
            keycloakSubject: 'subject-2',
            displayName: 'Bob',
            email: 'bob@example.com',
            status: 'active',
            lastLoginAt: '2026-03-04T10:00:00Z',
            roles: [{ roleId: 'role-2', roleKey: 'editor', roleName: 'editor', roleLevel: 20 }],
          },
        ],
      })
    );

    render(<UserListPage />);

    fireEvent.click(screen.getAllByRole('button', { name: 'Löschen' })[0]!);
    expect(screen.getByText(/physisch in Studio und Keycloak gelöscht/i)).toBeTruthy();

    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Löschen' }));

    await waitFor(() => expect(deleteUser).toHaveBeenCalledWith('user-2'));
  });

  it('disables hard delete for targets with the system_admin role', () => {
    useUsersMock.mockReturnValue(createUsersApiState());

    render(<UserListPage />);

    const deleteButton = screen.getAllByRole('button', { name: 'Löschen' })[0]!;
    expect(deleteButton.hasAttribute('disabled')).toBe(true);
  });

  it('hides hard delete without the explicit delete permission', () => {
    useAuthMock.mockReturnValue({
      user: {
        id: 'user-admin',
        instanceId: 'de-musterhausen',
        roles: ['system_admin'],
        permissionActions: ['iam.user.read'],
      },
    });
    useUsersMock.mockReturnValue(
      createUsersApiState({
        users: [
          {
            id: 'user-2',
            keycloakSubject: 'subject-2',
            displayName: 'Bob',
            email: 'bob@example.com',
            status: 'active',
            lastLoginAt: '2026-03-04T10:00:00Z',
            roles: [{ roleId: 'role-2', roleKey: 'editor', roleName: 'editor', roleLevel: 20 }],
          },
        ],
      })
    );

    render(<UserListPage />);

    expect(screen.queryByRole('button', { name: 'Löschen' })).toBeNull();
  });

  it('shows an activation action for inactive users and confirms single-user activation', async () => {
    const updateUser = vi.fn().mockResolvedValue({ id: 'user-1', status: 'active' });
    useUsersMock.mockReturnValue(
      createUsersApiState({
        updateUser,
        users: [
          {
            id: 'user-1',
            keycloakSubject: 'subject-1',
            displayName: 'Alice',
            email: 'alice@example.com',
            status: 'inactive',
            lastLoginAt: '2026-03-04T10:00:00Z',
            roles: [{ roleId: 'role-1', roleKey: 'system_admin', roleName: 'system_admin', roleLevel: 90 }],
          },
        ],
      })
    );

    render(<UserListPage />);

    fireEvent.click(screen.getAllByRole('switch', { name: 'Aktivstatus für Alice' })[0]!);

    expect(screen.getByText('Die ausgewählte Person wird wieder aktiviert.')).toBeTruthy();

    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Aktivieren' }));

    await waitFor(() => expect(updateUser).toHaveBeenCalledWith('user-1', { status: 'active' }));
  });

  it('renders platform user management on root scope without tenant mutations', () => {
    useAuthMock.mockReturnValue({ user: { id: 'platform-admin', roles: ['instance_registry_admin'] } });
    useUsersMock.mockReturnValue(createUsersApiState());

    render(<UserListPage />);

    expect(screen.getByRole('heading', { name: 'Plattform-Benutzer' })).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Nutzer anlegen' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Bearbeiten' })).toBeNull();
    expect(screen.queryByRole('switch', { name: 'Aktivstatus für Alice' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Aus Keycloak synchronisieren' })).toBeTruthy();
  });

  it('does not switch into platform scope for rootless sessions without the platform role', () => {
    useAuthMock.mockReturnValue({ user: { id: 'broken-session', roles: ['system_admin'] } });
    useUsersMock.mockReturnValue(createUsersApiState());

    render(<UserListPage />);

    expect(screen.getByRole('heading', { name: 'Benutzerverwaltung' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Plattform-Benutzer' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Nutzer anlegen' })).toBeTruthy();
  });
});
