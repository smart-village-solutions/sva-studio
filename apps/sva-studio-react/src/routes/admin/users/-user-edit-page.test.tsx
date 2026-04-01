import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { UserEditPage } from './-user-edit-page';
import { userErrorMessage } from './-user-error-message';

const useUserMock = vi.fn();
const useRolesMock = vi.fn();
const useGroupsMock = vi.fn();
const useRolePermissionsMock = vi.fn();
const getUserTimelineMock = vi.fn();

vi.mock('../../../hooks/use-user', () => ({
  useUser: (...args: unknown[]) => useUserMock(...args),
}));

vi.mock('../../../hooks/use-roles', () => ({
  useRoles: () => useRolesMock(),
}));

vi.mock('../../../hooks/use-groups', () => ({
  useGroups: () => useGroupsMock(),
}));

vi.mock('../../../hooks/use-role-permissions', () => ({
  useRolePermissions: () => useRolePermissionsMock(),
}));

vi.mock('../../../lib/iam-api', () => ({
  getUserTimeline: (...args: unknown[]) => getUserTimelineMock(...args),
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
    avatarUrl: 'https://example.com/avatar.png',
    roles: [{ roleId: 'role-1', roleName: 'system_admin', roleLevel: 90 }],
    groups: [{ groupId: 'group-1', groupKey: 'admins', displayName: 'Admins', groupType: 'role_bundle', origin: 'manual' as const }],
    permissions: ['content.read'],
    directPermissions: [],
    mainserverUserApplicationId: 'app-id-1',
    mainserverUserApplicationSecretSet: true,
  };

  beforeEach(() => {
    useUserMock.mockReset();
    useRolesMock.mockReset();
    useGroupsMock.mockReset();
    useRolePermissionsMock.mockReset();
    getUserTimelineMock.mockReset();
    getUserTimelineMock.mockResolvedValue({ data: [] });
    useGroupsMock.mockReturnValue({
      groups: [],
      isLoading: false,
      error: null,
      mutationError: null,
      refetch: vi.fn(),
      clearMutationError: vi.fn(),
      createGroup: vi.fn(),
      updateGroup: vi.fn(),
      deleteGroup: vi.fn(),
    });
    useRolePermissionsMock.mockReturnValue({
      permissions: [
        { id: 'perm-read', instanceId: 'de-musterhausen', permissionKey: 'content.read', description: 'Inhalte lesen' },
        { id: 'perm-write', instanceId: 'de-musterhausen', permissionKey: 'content.write', description: 'Inhalte bearbeiten' },
      ],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
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
    expect(screen.getByRole('img', { name: 'Profilbild von Alice Admin' })).toBeTruthy();

    fireEvent.click(screen.getByRole('tab', { name: 'Berechtigungen' }));
    expect(screen.getAllByText('content.read').length).toBeGreaterThan(0);
    expect(screen.getByText('Direkte Rechte')).toBeTruthy();

    fireEvent.keyDown(screen.getByRole('tab', { name: 'Berechtigungen' }), { key: 'ArrowRight' });
    expect(screen.getByRole('tab', { name: 'Historie' }).getAttribute('aria-selected')).toBe('true');

    fireEvent.keyDown(screen.getByRole('tab', { name: 'Historie' }), { key: 'Home' });
    expect(screen.getByRole('tab', { name: 'Persönliche Daten' }).getAttribute('aria-selected')).toBe('true');
  });

  it('renders effective and inactive permission traces in the permissions tab', () => {
    useUserMock.mockReturnValue({
      user: {
        ...baseUser,
        directPermissions: [{ permissionId: 'perm-1', permissionKey: 'content.write', effect: 'deny' as const }],
        permissionTrace: [
          {
            permissionKey: 'content.read',
            action: 'content.read',
            resourceType: 'content',
            effect: 'allow' as const,
            isEffective: true,
            status: 'effective' as const,
            sourceKind: 'group_role' as const,
            roleName: 'system_admin',
            groupDisplayName: 'Admins',
            organizationId: 'org-1',
            scope: { geoUnitId: 'geo-1' },
          },
          {
            permissionKey: 'content.archive',
            action: 'content.archive',
            resourceType: 'content',
            effect: 'deny' as const,
            isEffective: false,
            status: 'expired' as const,
            sourceKind: 'direct_role' as const,
            roleName: 'system_admin',
          },
        ],
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

    fireEvent.click(screen.getByRole('tab', { name: 'Berechtigungen' }));

    expect(screen.getByText('Effektive Berechtigungen')).toBeTruthy();
    expect(screen.getByText('Wirksame Quellen')).toBeTruthy();
    expect(screen.getByText('Nicht wirksame Quellen')).toBeTruthy();
    expect(screen.getByText('content.read')).toBeTruthy();
    expect(screen.getByText('content.archive')).toBeTruthy();
    expect(screen.getByText('Direkte Zuweisungen')).toBeTruthy();
    expect(screen.getByText(/Organisation: org-1/)).toBeTruthy();
  });

  it('loads unified history entries and renders role validity windows', async () => {
    useUserMock.mockReturnValue({
      user: {
        ...baseUser,
        roles: [
          {
            roleId: 'role-1',
            roleName: 'system_admin',
            roleLevel: 90,
            validFrom: '2026-03-01T10:00:00.000Z',
            validTo: '2026-03-31T10:00:00.000Z',
          },
        ],
      },
      isLoading: false,
      error: null,
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
    getUserTimelineMock.mockResolvedValue({
      data: [
        {
          id: 'event-1',
          category: 'governance',
          eventType: 'delegation',
          title: 'Delegation erstellt',
          description: 'Rolle editor wurde temporär delegiert',
          occurredAt: '2026-03-16T09:00:00.000Z',
          perspective: 'actor_and_target',
          metadata: { status: 'approved' },
        },
      ],
    });

    render(<UserEditPage userId="user-1" />);

    expect(screen.getByText(/Gültig:/)).toBeTruthy();

    fireEvent.click(screen.getByRole('tab', { name: 'Historie' }));

    await waitFor(() => {
      expect(getUserTimelineMock).toHaveBeenCalledWith('user-1');
      expect(screen.getByText('Delegation erstellt')).toBeTruthy();
      expect(screen.getByText('Auslöser und Ziel')).toBeTruthy();
    });
  });

  it('renders avatar initials and one-sided role validity labels without an avatar image', () => {
    useUserMock.mockReturnValue({
      user: {
        ...baseUser,
        avatarUrl: undefined,
        displayName: 'Alice Admin',
        roles: [
          {
            roleId: 'role-1',
            roleName: 'system_admin',
            roleLevel: 90,
            validFrom: '2026-03-01T10:00:00.000Z',
          },
        ],
      },
      isLoading: false,
      error: null,
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

    const { rerender } = render(<UserEditPage userId="user-1" />);

    expect(screen.getByText('AA')).toBeTruthy();
    expect(screen.getByText(/Gültig ab /)).toBeTruthy();

    useUserMock.mockReturnValue({
      user: {
        ...baseUser,
        avatarUrl: undefined,
        displayName: '   ',
        roles: [
          {
            roleId: 'role-1',
            roleName: 'system_admin',
            roleLevel: 90,
            validTo: '2026-03-31T10:00:00.000Z',
          },
        ],
      },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
      save: vi.fn(),
    });

    rerender(<UserEditPage userId="user-1" />);

    expect(screen.getByText('NA')).toBeTruthy();
    expect(screen.getByText(/Gültig bis /)).toBeTruthy();
  });

  it('submits updates and shows success state', async () => {
    const save = vi.fn().mockResolvedValue({
      ...baseUser,
      displayName: 'Alice Updated',
      firstName: 'Alice',
      lastName: 'Updated',
      notes: 'saved note',
      mainserverUserApplicationId: 'app-id-1',
      mainserverUserApplicationSecretSet: true,
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
      mainserverUserApplicationId: 'app-id-1',
      mainserverUserApplicationSecretSet: true,
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
    const editorCheckbox = screen.getByRole('checkbox', { name: 'editor' }) as HTMLInputElement;
    fireEvent.click(editorCheckbox);

    await waitFor(() => {
      expect(editorCheckbox.checked).toBe(true);
    });

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
        groupIds: ['group-1'],
        directPermissions: [],
        mainserverUserApplicationId: 'app-id-1',
        mainserverUserApplicationSecret: undefined,
      });
    });
  });

  it('filters inactive groups from the management selection', async () => {
    useUserMock.mockReturnValue({
      user: baseUser,
      isLoading: false,
      error: null,
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

    useGroupsMock.mockReturnValue({
      groups: [
        { id: 'group-1', groupKey: 'admins', displayName: 'Admins', isActive: true },
        { id: 'group-2', groupKey: 'legacy', displayName: 'Legacy', isActive: false },
      ],
      isLoading: false,
      error: null,
      mutationError: null,
      refetch: vi.fn(),
      clearMutationError: vi.fn(),
      createGroup: vi.fn(),
      updateGroup: vi.fn(),
      deleteGroup: vi.fn(),
    });

    render(<UserEditPage userId="user-1" />);

    fireEvent.click(screen.getByRole('tab', { name: 'Verwaltung' }));

    expect(screen.getByRole('checkbox', { name: /Admins/i })).toBeTruthy();
    expect(screen.queryByText('Legacy')).toBeNull();
  });

  it('renders the mainserver credential fields and keeps the secret write-only', async () => {
    const save = vi.fn().mockResolvedValue({
      ...baseUser,
      mainserverUserApplicationId: 'updated-app-id',
      mainserverUserApplicationSecretSet: true,
    });

    useUserMock.mockReturnValue({
      user: baseUser,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
      save,
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

    fireEvent.click(screen.getByRole('tab', { name: 'Verwaltung' }));
    expect((screen.getByLabelText('Mainserver Application-ID') as HTMLInputElement).value).toBe('app-id-1');
    expect(screen.getByText('Ein Secret ist bereits hinterlegt.')).toBeTruthy();

    fireEvent.change(screen.getByLabelText('Mainserver Application-ID'), { target: { value: 'updated-app-id' } });
    fireEvent.change(screen.getByPlaceholderText('Neues Secret eingeben'), { target: { value: 'new-secret' } });
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
        roleIds: ['role-1'],
        groupIds: ['group-1'],
        directPermissions: [],
        mainserverUserApplicationId: 'updated-app-id',
        mainserverUserApplicationSecret: 'new-secret',
      });
    });
  });

  it('submits direct user permission assignments from the permissions tab', async () => {
    const save = vi.fn().mockResolvedValue({
      ...baseUser,
      directPermissions: [{ permissionId: 'perm-write', permissionKey: 'content.write', effect: 'deny' as const }],
      mainserverUserApplicationId: 'app-id-1',
      mainserverUserApplicationSecretSet: true,
    });

    useUserMock.mockReturnValue({
      user: baseUser,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
      save,
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
    fireEvent.change(screen.getByLabelText('Direkte Wirkung für content.write'), {
      target: { value: 'deny' },
    });
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
        roleIds: ['role-1'],
        groupIds: ['group-1'],
        directPermissions: [{ permissionId: 'perm-write', effect: 'deny' }],
        mainserverUserApplicationId: 'app-id-1',
        mainserverUserApplicationSecret: undefined,
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
    ['invalid_request', 'Nutzer konnten nicht geladen werden.'],
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

  it('does not submit duplicate role ids when a selected role is toggled again', async () => {
    const save = vi.fn().mockResolvedValue(baseUser);

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
    const systemAdminCheckbox = screen.getByRole('checkbox', { name: 'system_admin' });

    fireEvent.change(systemAdminCheckbox, { target: { checked: true } });
    fireEvent.change(systemAdminCheckbox, { target: { checked: true } });
    fireEvent.click(screen.getByRole('button', { name: 'Änderungen speichern' }));

    await waitFor(() => {
      expect(save).toHaveBeenCalledWith(
        expect.objectContaining({
          roleIds: ['role-1'],
        })
      );
    });
  });
});
