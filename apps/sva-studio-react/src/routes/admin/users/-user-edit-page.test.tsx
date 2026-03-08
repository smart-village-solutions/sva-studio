import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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

  it('renders error state when user is missing', () => {
    useUserMock.mockReturnValue({
      user: null,
      isLoading: false,
      error: new Error('not found'),
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

    expect(screen.getByRole('alert')).toBeTruthy();
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
  });

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
});
