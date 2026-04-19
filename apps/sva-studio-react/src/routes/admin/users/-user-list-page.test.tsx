import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { UserListPage } from './-user-list-page';

const useUsersMock = vi.fn();
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
  bulkDeactivate: vi.fn().mockResolvedValue(true),
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
  });

  it('renders list actions and uses route links for create and edit', () => {
    useUsersMock.mockReturnValue(createUsersApiState());

    render(<UserListPage />);

    expect(screen.getByRole('heading', { name: 'Benutzerverwaltung' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Nutzer anlegen' }).getAttribute('href')).toBe('/admin/users/new');
    expect(screen.getAllByRole('link', { name: 'Bearbeiten' })[0]!.getAttribute('href')).toBe('/admin/users/$userId');
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
        screen.getByText(/Realm de-musterhausen, Quelle Instanz-Realm\. 2 Benutzer ohne `instanceId`/i)
      ).toBeTruthy()
    );
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

    fireEvent.click(screen.getAllByRole('button', { name: 'Deaktivieren' })[0]!);
    fireEvent.click(screen.getByRole('button', { name: 'Deaktivieren' }));

    await waitFor(() => expect(deactivateUser).toHaveBeenCalledWith('user-1'));
  });
});
