import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { UserKeycloakRolesPanel } from './-user-keycloak-roles';

const getUserKeycloakRolesMock = vi.fn();
const mutateUserKeycloakRoleMock = vi.fn();

vi.mock('../../../lib/iam-api', () => ({
  asIamError: (error: unknown) => error,
  getUserKeycloakRoles: (...args: unknown[]) => getUserKeycloakRolesMock(...args),
  mutateUserKeycloakRole: (...args: unknown[]) => mutateUserKeycloakRoleMock(...args),
}));

describe('UserKeycloakRolesPanel', () => {
  beforeEach(() => {
    getUserKeycloakRolesMock.mockResolvedValue({
      data: {
        userRef: 'keycloak:app-user-1',
        mappingStatus: 'unmapped',
        roles: [
          {
            id: 'news',
            roleName: 'news_editor',
            composite: false,
            managedBy: 'external',
            category: 'assignable',
            assignable: true,
            direct: true,
            effective: true,
            origin: 'direct',
          },
          {
            id: 'event',
            roleName: 'event_editor',
            composite: false,
            managedBy: 'external',
            category: 'assignable',
            assignable: true,
            direct: false,
            effective: true,
            origin: 'composite',
          },
          {
            id: 'builtin',
            roleName: 'offline_access',
            composite: false,
            managedBy: 'keycloak_builtin',
            category: 'keycloak_builtin',
            assignable: false,
            direct: true,
            effective: true,
            origin: 'direct',
            reasonCode: 'keycloak_builtin_role',
          },
        ],
      },
    });
    mutateUserKeycloakRoleMock.mockResolvedValue({ data: { status: 'confirmed' } });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('shows direct, inherited and protected roles without relying on color alone', async () => {
    render(<UserKeycloakRolesPanel canWrite userRef="keycloak:app-user-1" />);

    expect(await screen.findByText('news_editor')).toBeTruthy();
    expect(screen.getByText('event_editor')).toBeTruthy();
    expect(screen.getByText('offline_access')).toBeTruthy();
    expect(screen.getByText('Geerbt')).toBeTruthy();

    const protectedCheckbox = screen.getByLabelText(/offline_access/i);
    expect((protectedCheckbox as HTMLInputElement).disabled).toBe(true);
  });

  it('sends one role delta for an assignable role', async () => {
    render(<UserKeycloakRolesPanel canWrite userRef="keycloak:app-user-1" />);
    const inheritedCheckbox = await screen.findByLabelText(/event_editor/i);

    fireEvent.click(inheritedCheckbox);

    await waitFor(() =>
      expect(mutateUserKeycloakRoleMock).toHaveBeenCalledWith('keycloak:app-user-1', {
        roleName: 'event_editor',
        operation: 'assign',
      })
    );
  });
});
