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

    expect(screen.queryByRole('button', { name: /system_admin/i })).toBeNull();
    expect(screen.getByRole('button', { name: /editor/i })).toBeTruthy();

    fireEvent.change(screen.getByPlaceholderText('Nach Rolle oder Berechtigung suchen'), {
      target: { value: '' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Sortierung wechseln' }));
    const roleToggleButtons = screen.getAllByRole('button', { name: /system_admin|editor/ });
    expect(roleToggleButtons[0]?.textContent).toContain('system_admin');

    fireEvent.click(screen.getAllByRole('button', { name: /editor/i })[0]!);
    expect(screen.getByText('content.write')).toBeTruthy();
  }, 15000);

  it('opens create dialog and submits normalized payload', async () => {
    const createRole = vi.fn().mockResolvedValue(true);

    useRolesMock.mockReturnValue({
      roles: [],
      isLoading: false,
      error: null,
      mutationError: null,
      reconcileReport: null,
      refetch: vi.fn(),
      clearMutationError: vi.fn(),
      createRole,
      updateRole: vi.fn(),
      deleteRole: vi.fn(),
      retryRoleSync: vi.fn(),
      reconcile: vi.fn(),
    });

    render(<RolesPage />);

    fireEvent.click(screen.getAllByRole('button', { name: 'Rolle anlegen' })[0]!);
    const dialog = screen.getByRole('dialog', { name: 'Neue Rolle erstellen' });

    fireEvent.change(within(dialog).getByLabelText('Technischer Rollenschlüssel'), {
      target: { value: '  Team Lead  ' },
    });
    fireEvent.change(within(dialog).getByLabelText('Anzeigename'), {
      target: { value: ' Team Lead ' },
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
      displayName: 'Team Lead',
      description: 'Verantwortlich für Teamkoordination',
      roleLevel: 42,
      permissionIds: [],
    });
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Neue Rolle erstellen' })).toBeNull();
    });
  });

  it('shows retry on list error and keeps create dialog open on create failure', () => {
    const createRole = vi.fn().mockResolvedValue(false);
    const clearMutationError = vi.fn();

    useRolesMock.mockReturnValue({
      roles: [],
      isLoading: false,
      error: null,
      mutationError: {
        status: 409,
        code: 'conflict',
        message: 'conflict',
      },
      reconcileReport: null,
      refetch: vi.fn(),
      clearMutationError,
      createRole,
      updateRole: vi.fn(),
      deleteRole: vi.fn(),
      retryRoleSync: vi.fn(),
      reconcile: vi.fn(),
    });

    render(<RolesPage />);

    fireEvent.click(screen.getAllByRole('button', { name: 'Rolle anlegen' })[0]!);
    const dialog = screen.getByRole('dialog', { name: 'Neue Rolle erstellen' });
    fireEvent.change(within(dialog).getByLabelText('Technischer Rollenschlüssel'), {
      target: { value: 'Support' },
    });
    fireEvent.submit(within(dialog).getByRole('button', { name: 'Rolle anlegen' }).closest('form')!);

    expect(createRole).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('dialog', { name: 'Neue Rolle erstellen' })).toBeTruthy();
    expect(within(dialog).getByRole('alert').textContent).toContain('Die Rollenänderung steht in Konflikt');
    expect(screen.queryByText('Rollen konnten nicht geladen werden.')).toBeNull();
    expect(clearMutationError).toHaveBeenCalledTimes(1);
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

    const row = screen.getByRole('button', { name: /custom_editor/i }).closest('tr');
    expect(row).toBeTruthy();
    fireEvent.click(within(row!).getByRole('button', { name: 'Rolle löschen' }));
    const dialog = screen.getByRole('alertdialog', { name: 'Rolle löschen' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Rolle löschen' }));

    expect(deleteRole).toHaveBeenCalledWith('role-custom');
  });

  it('offers retry sync, edit and reconcile summary for failed roles', async () => {
    const retryRoleSync = vi.fn().mockResolvedValue(true);
    const updateRole = vi.fn().mockResolvedValue(true);
    const reconcile = vi.fn().mockResolvedValue(true);

    useRolesMock.mockReturnValue({
      roles: [
        {
          id: 'role-failed',
          roleKey: 'custom_editor',
          roleName: 'Custom Editor',
          externalRoleName: 'custom_editor',
          managedBy: 'studio',
          description: 'Custom',
          isSystemRole: false,
          roleLevel: 30,
          memberCount: 0,
          syncState: 'failed',
          syncError: { code: 'IDP_TIMEOUT' },
          permissions: [],
        },
      ],
      isLoading: false,
      error: null,
      mutationError: null,
      reconcileReport: {
        checkedCount: 1,
        correctedCount: 0,
        failedCount: 1,
        requiresManualActionCount: 0,
        roles: [],
      },
      refetch: vi.fn(),
      clearMutationError: vi.fn(),
      createRole: vi.fn(),
      updateRole,
      deleteRole: vi.fn(),
      retryRoleSync,
      reconcile,
    });

    render(<RolesPage />);

    expect(screen.getByText(/Reconcile abgeschlossen/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Erneut synchronisieren' }));
    expect(retryRoleSync).toHaveBeenCalledWith('role-failed');

    fireEvent.click(screen.getByRole('button', { name: 'Abgleich starten' }));
    expect(reconcile).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Rolle bearbeiten' }));
    const dialog = screen.getByRole('dialog', { name: 'Rolle bearbeiten' });
    fireEvent.change(within(dialog).getByLabelText('Anzeigename'), {
      target: { value: 'Custom Editors' },
    });
    fireEvent.submit(within(dialog).getByRole('button', { name: 'Rolle bearbeiten' }).closest('form')!);

    await waitFor(() => {
      expect(updateRole).toHaveBeenCalledWith('role-failed', {
        displayName: 'Custom Editors',
        description: 'Custom',
        roleLevel: 30,
      });
    });
  });

  it('maps load errors to localized role messages', () => {
    useRolesMock.mockReturnValue({
      roles: [],
      isLoading: false,
      error: {
        status: 503,
        code: 'keycloak_unavailable',
        message: 'Keycloak Admin API ist nicht konfiguriert.',
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

    expect(screen.getByRole('alert').textContent).toContain('Die Verbindung zu Keycloak ist derzeit nicht verfügbar.');
  });

  it('renders external roles as read-only', () => {
    useRolesMock.mockReturnValue({
      roles: [
        {
          id: 'role-external',
          roleKey: 'mainserver_editor',
          roleName: 'Editor',
          externalRoleName: 'Editor',
          managedBy: 'external',
          description: 'Mainserver-Rolle',
          isSystemRole: false,
          roleLevel: 40,
          memberCount: 0,
          syncState: 'failed',
          syncError: { code: 'IDP_TIMEOUT' },
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

    expect(screen.getByText('Externe Rolle')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Rolle bearbeiten' }).hasAttribute('disabled')).toBe(true);
    expect(screen.getByRole('button', { name: 'Erneut synchronisieren' }).hasAttribute('disabled')).toBe(true);
    expect(screen.getByRole('button', { name: 'Rolle löschen' }).hasAttribute('disabled')).toBe(true);
  });

  it('renders pending sync roles and empty state when no roles match', () => {
    useRolesMock.mockReturnValue({
      roles: [
        {
          id: 'role-pending',
          roleKey: 'account_manager',
          roleName: 'Account Manager',
          externalRoleName: 'account_manager',
          managedBy: 'studio',
          description: 'Pending sync role',
          isSystemRole: false,
          roleLevel: 30,
          memberCount: 0,
          syncState: 'pending',
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

    expect(screen.getByText('Ausstehend')).toBeTruthy();

    fireEvent.change(screen.getByPlaceholderText('Nach Rolle oder Berechtigung suchen'), {
      target: { value: 'does-not-exist' },
    });

    expect(screen.getByRole('status').textContent).toContain('Keine Rollen gefunden.');
  });

  it('clears mutation errors when create dialog is cancelled', async () => {
    const clearMutationError = vi.fn();

    useRolesMock.mockReturnValue({
      roles: [],
      isLoading: false,
      error: null,
      mutationError: new Error('temporär'),
      reconcileReport: null,
      refetch: vi.fn(),
      clearMutationError,
      createRole: vi.fn(),
      updateRole: vi.fn(),
      deleteRole: vi.fn(),
      retryRoleSync: vi.fn(),
      reconcile: vi.fn(),
    });

    render(<RolesPage />);

    fireEvent.click(screen.getAllByRole('button', { name: 'Rolle anlegen' })[0]!);
    const dialog = screen.getByRole('dialog', { name: 'Neue Rolle erstellen' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Abbrechen' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Neue Rolle erstellen' })).toBeNull();
    });

    expect(clearMutationError).toHaveBeenCalledTimes(2);
  });

  it('closes the create dialog when the overlay is clicked', async () => {
    const clearMutationError = vi.fn();

    useRolesMock.mockReturnValue({
      roles: [],
      isLoading: false,
      error: null,
      mutationError: null,
      reconcileReport: null,
      refetch: vi.fn(),
      clearMutationError,
      createRole: vi.fn(),
      updateRole: vi.fn(),
      deleteRole: vi.fn(),
      retryRoleSync: vi.fn(),
      reconcile: vi.fn(),
    });

    render(<RolesPage />);

    fireEvent.click(screen.getAllByRole('button', { name: 'Rolle anlegen' })[0]!);
    fireEvent.click(document.querySelector('[data-slot="dialog-overlay"]') as HTMLElement);

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Neue Rolle erstellen' })).toBeNull();
    });

    expect(clearMutationError).toHaveBeenCalledTimes(2);
  });

  it('keeps edit dialog open on failed save and clears mutation error on cancel', async () => {
    const clearMutationError = vi.fn();
    const updateRole = vi.fn().mockResolvedValue(false);

    useRolesMock.mockReturnValue({
      roles: [
        {
          id: 'role-edit',
          roleKey: 'custom_editor',
          roleName: 'Custom Editor',
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
      mutationError: new Error('Speichern fehlgeschlagen.'),
      reconcileReport: null,
      refetch: vi.fn(),
      clearMutationError,
      createRole: vi.fn(),
      updateRole,
      deleteRole: vi.fn(),
      retryRoleSync: vi.fn(),
      reconcile: vi.fn(),
    });

    render(<RolesPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Rolle bearbeiten' }));

    const dialog = screen.getByRole('dialog', { name: 'Rolle bearbeiten' });
    fireEvent.change(within(dialog).getByLabelText('Anzeigename'), {
      target: { value: 'Custom Editors' },
    });
    fireEvent.change(within(dialog).getByLabelText('Beschreibung'), {
      target: { value: 'Updated custom role' },
    });
    fireEvent.change(within(dialog).getByLabelText('Rollenlevel'), {
      target: { value: '31' },
    });
    fireEvent.submit(within(dialog).getByRole('button', { name: 'Rolle bearbeiten' }).closest('form')!);

    await waitFor(() => {
      expect(updateRole).toHaveBeenCalledWith('role-edit', {
        displayName: 'Custom Editors',
        description: 'Updated custom role',
        roleLevel: 31,
      });
    });

    expect(screen.getByRole('dialog', { name: 'Rolle bearbeiten' })).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Abbrechen' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Rolle bearbeiten' })).toBeNull();
    });

    expect(clearMutationError).toHaveBeenCalledTimes(2);
  });

  it('closes the edit dialog when the overlay is clicked', async () => {
    const clearMutationError = vi.fn();

    useRolesMock.mockReturnValue({
      roles: [
        {
          id: 'role-edit-overlay',
          roleKey: 'custom_editor',
          roleName: 'Custom Editor',
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
      clearMutationError,
      createRole: vi.fn(),
      updateRole: vi.fn(),
      deleteRole: vi.fn(),
      retryRoleSync: vi.fn(),
      reconcile: vi.fn(),
    });

    render(<RolesPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Rolle bearbeiten' }));
    fireEvent.click(document.querySelector('[data-slot="dialog-overlay"]') as HTMLElement);

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Rolle bearbeiten' })).toBeNull();
    });

    expect(clearMutationError).toHaveBeenCalledTimes(2);
  });
});
