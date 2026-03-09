import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { UserEditPage } from './-user-edit-page';
import { userErrorMessage } from './-user-error-message';

const useUserMock = vi.fn();
const useRolesMock = vi.fn();

vi.mock('../../../hooks/use-user', () => ({
  useUser: (...args: unknown[]) => useUserMock(...args),
}));

vi.mock('../../../hooks/use-roles', () => ({
  useRoles: () => useRolesMock(),
}));

describe('UserEditPage', () => {
  afterEach(() => {
    cleanup();
  });

  const baseUser = {
    id: 'user-1',
    keycloakSubject: 'subject-1',
    displayName: 'Alice Admin',
    firstName: 'Alice',
    lastName: 'Admin',
    email: 'alice@example.com',
    status: 'active' as const,
    notes: '',
    roles: [{ roleId: 'role-1', roleName: 'system_admin', roleLevel: 90 }],
    permissions: ['content.read'],
  };

  beforeEach(() => {
    useUserMock.mockReset();
    useRolesMock.mockReset();
  });

  it('renders loading state', () => {
    useUserMock.mockReturnValue({
      user: null,
      isLoading: true,
      error: null,
      refetch: vi.fn(),
      save: vi.fn(),
    });

    useRolesMock.mockReturnValue({
      roles: [],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
      createRole: vi.fn(),
      updateRole: vi.fn(),
      deleteRole: vi.fn(),
    });

    render(<UserEditPage userId="user-1" />);

    expect(screen.getByRole('status')).toBeTruthy();
  });

  it('renders localized initial load errors when user is missing', () => {
    useUserMock.mockReturnValue({
      user: null,
      isLoading: false,
      error: {
        status: 503,
        code: 'keycloak_unavailable',
        message: 'sync failed',
      },
      refetch: vi.fn(),
      save: vi.fn(),
    });

    useRolesMock.mockReturnValue({
      roles: [],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
      createRole: vi.fn(),
      updateRole: vi.fn(),
      deleteRole: vi.fn(),
    });

    render(<UserEditPage userId="user-404" />);

    expect(screen.getByRole('alert').textContent).toContain(
      'Die Verbindung zu Keycloak ist derzeit nicht verfügbar. Bitte später erneut versuchen.'
    );
  });

  it('renders tabs and allows switching', () => {
    useUserMock.mockReturnValue({
      user: baseUser,
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

    fireEvent.keyDown(screen.getByRole('tab', { name: 'Berechtigungen' }), { key: 'ArrowRight' });
    expect(screen.getByRole('tab', { name: 'Historie' }).getAttribute('aria-selected')).toBe('true');

    fireEvent.keyDown(screen.getByRole('tab', { name: 'Historie' }), { key: 'Home' });
    expect(screen.getByRole('tab', { name: 'Persönliche Daten' }).getAttribute('aria-selected')).toBe('true');
  });

  it('submits updates and shows success state', async () => {
    const save = vi.fn().mockResolvedValue({
      ...baseUser,
      displayName: 'Alice Updated',
      firstName: 'Alice',
      lastName: 'Updated',
      notes: 'saved note',
    });

    useUserMock.mockReturnValue({
      user: baseUser,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
      save,
    });

    useRolesMock.mockReturnValue({
      roles: [
        { id: 'role-1', roleName: 'system_admin' },
        { id: 'role-2', roleName: 'editor' },
      ],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
      createRole: vi.fn(),
      updateRole: vi.fn(),
      deleteRole: vi.fn(),
    });

    render(<UserEditPage userId="user-1" />);

    fireEvent.change(screen.getByLabelText('Anzeigename'), { target: { value: 'Alice Updated' } });
    fireEvent.click(screen.getByRole('tab', { name: 'Verwaltung' }));
    const notesField = document.querySelector('textarea');
    expect(notesField).toBeTruthy();
    fireEvent.change(notesField as HTMLTextAreaElement, { target: { value: 'saved note' } });
    fireEvent.click(screen.getByRole('button', { name: 'Änderungen speichern' }));

    await waitFor(() => {
      expect(save).toHaveBeenCalledTimes(1);
      expect(screen.getByText('Nutzerdaten wurden gespeichert.')).toBeTruthy();
    });
  });

  it('submits selected role ids when assigning an additional role', async () => {
    const save = vi.fn().mockResolvedValue({
      ...baseUser,
      roles: [
        { roleId: 'role-1', roleName: 'system_admin', roleLevel: 90 },
        { roleId: 'role-2', roleName: 'editor', roleLevel: 10 },
      ],
    });

    useUserMock.mockReturnValue({
      user: baseUser,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
      save,
    });

    useRolesMock.mockReturnValue({
      roles: [
        { id: 'role-1', roleName: 'system_admin' },
        { id: 'role-2', roleName: 'editor' },
      ],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
      createRole: vi.fn(),
      updateRole: vi.fn(),
      deleteRole: vi.fn(),
    });

    render(<UserEditPage userId="user-1" />);

    fireEvent.click(screen.getByRole('tab', { name: 'Verwaltung' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'editor' }));
    fireEvent.click(screen.getByRole('button', { name: 'Änderungen speichern' }));

    await waitFor(() => {
      expect(save).toHaveBeenCalledWith({
        firstName: 'Alice',
        lastName: 'Admin',
        displayName: 'Alice Admin',
        email: 'alice@example.com',
        phone: undefined,
        position: undefined,
        department: undefined,
        status: 'active',
        preferredLanguage: 'de',
        timezone: 'Europe/Berlin',
        notes: undefined,
        roleIds: ['role-1', 'role-2'],
      });
    });
  });

  it('shows permissions empty state and handles unsaved-tab dialog', async () => {
    useUserMock.mockReturnValue({
      user: {
        ...baseUser,
        permissions: [],
      },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
      save: vi.fn().mockResolvedValue(baseUser),
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

    fireEvent.click(screen.getByRole('tab', { name: 'Berechtigungen' }));
    expect(screen.getByText('Keine effektiven Berechtigungen vorhanden.')).toBeTruthy();

    fireEvent.click(screen.getByRole('tab', { name: 'Verwaltung' }));
    const notesField = document.querySelector('textarea');
    expect(notesField).toBeTruthy();
    fireEvent.change(notesField as HTMLTextAreaElement, { target: { value: 'unsaved text' } });
    fireEvent.click(screen.getByRole('tab', { name: 'Historie' }));

    expect(screen.getByRole('alertdialog', { name: 'Nicht gespeicherte Änderungen' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Zurück zum Formular' }));
    expect(screen.queryByRole('alertdialog', { name: 'Nicht gespeicherte Änderungen' })).toBeNull();

    fireEvent.click(screen.getByRole('tab', { name: 'Historie' }));
    fireEvent.click(screen.getByRole('button', { name: 'Verwerfen und wechseln' }));

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: 'Historie' }).getAttribute('aria-selected')).toBe('true');
      expect(screen.getByText('Keine Historieneinträge vorhanden.')).toBeTruthy();
    });
  }, 15000);

  it('shows localized save errors instead of the generic load error', () => {
    useUserMock.mockReturnValue({
      user: baseUser,
      isLoading: false,
      error: {
        status: 503,
        code: 'keycloak_unavailable',
        message: 'sync failed',
      },
      refetch: vi.fn(),
      save: vi.fn(),
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

    expect(screen.getByRole('alert').textContent).toContain(
      'Die Verbindung zu Keycloak ist derzeit nicht verfügbar. Bitte später erneut versuchen.'
    );
    expect(screen.getByRole('alert').textContent).not.toContain('Nutzer konnten nicht geladen werden.');
  });

  it.each([
    ['forbidden', 'Unzureichende Berechtigungen für diese Nutzeraktion.'],
    ['csrf_validation_failed', 'Sicherheitsprüfung fehlgeschlagen. Bitte Seite neu laden und erneut versuchen.'],
    ['rate_limited', 'Zu viele Anfragen in kurzer Zeit. Bitte kurz warten und erneut versuchen.'],
    ['conflict', 'Die Nutzeränderung steht in Konflikt mit dem aktuellen Zustand. Bitte aktualisieren und erneut versuchen.'],
    ['keycloak_unavailable', 'Die Verbindung zu Keycloak ist derzeit nicht verfügbar. Bitte später erneut versuchen.'],
    ['database_unavailable', 'Die IAM-Datenbank ist derzeit nicht erreichbar. Bitte später erneut versuchen.'],
    ['last_admin_protection', 'Der letzte aktive System-Administrator kann nicht entfernt oder deaktiviert werden.'],
    ['self_protection', 'Das aktuell angemeldete Konto kann nicht auf diese Weise deaktiviert werden.'],
  ])('maps %s save errors to the localized alert message', (code, expectedMessage) => {
    useUserMock.mockReturnValue({
      user: baseUser,
      isLoading: false,
      error: {
        status: 503,
        code,
        message: 'save failed',
      },
      refetch: vi.fn(),
      save: vi.fn(),
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

    expect(screen.getByRole('alert').textContent).toContain(expectedMessage);
  });

  it('falls back to the generic message for null and unknown errors', () => {
    expect(userErrorMessage(null)).toBe('Nutzer konnten nicht geladen werden.');
    expect(
      userErrorMessage({
        status: 404,
        code: 'internal_error',
        message: 'http_404',
      } as never)
    ).toBe('Unerwartete Serverantwort (HTTP 404).');
    expect(
      userErrorMessage({
        status: 500,
        code: 'internal_error',
        message: 'Failed to fetch',
      } as never)
    ).toBe('Technischer Fehler beim Laden der Nutzer: Failed to fetch');
    expect(
      userErrorMessage({
        status: 500,
        code: 'unknown_error',
        message: 'unexpected failure',
      } as never)
    ).toBe('Nutzer konnten nicht geladen werden.');
  });
});
