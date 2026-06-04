import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { HttpResponse, http, studioMswServer } from 'tooling-testing/msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { UserCreatePage } from './-user-create-page';

const navigateMock = vi.fn();
const useRealUsersHook = vi.hoisted(() => ({ current: false }));
const useUsersMock = vi.fn();
const useRolesMock = vi.fn();
const useGroupsMock = vi.fn();
const invalidatePermissionsMock = vi.fn();

vi.mock('@tanstack/react-router', () => ({
  Link: ({ to, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
  useNavigate: () => navigateMock,
}));

vi.mock('../../../hooks/use-users', async () => {
  const actual = await vi.importActual<typeof import('../../../hooks/use-users')>('../../../hooks/use-users');
  return {
    useUsers: () => (useRealUsersHook.current ? actual.useUsers() : useUsersMock()),
  };
});

vi.mock('../../../hooks/use-roles', () => ({
  useRoles: () => useRolesMock(),
}));

vi.mock('../../../hooks/use-groups', () => ({
  useGroups: () => useGroupsMock(),
}));

vi.mock('../../../providers/auth-provider', () => ({
  useAuth: () => ({
    user: {
      id: 'admin-1',
      name: 'Admin',
      roles: ['system_admin'],
      instanceId: 'instance-1',
    },
    isAuthenticated: true,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
    logout: vi.fn(),
    invalidatePermissions: invalidatePermissionsMock,
  }),
}));

vi.mock('../../../lib/browser-operation-logging', () => ({
  createOperationLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
  logBrowserOperationFailure: vi.fn(),
  logBrowserOperationStart: vi.fn(),
  logBrowserOperationSuccess: vi.fn(),
}));

vi.mock('../../../lib/iam-user-events', () => ({
  subscribeIamUsersUpdated: () => () => undefined,
}));

const createUsersApiState = (overrides: Record<string, unknown> = {}) => ({
  createUser: vi.fn(),
  error: null,
  ...overrides,
});

describe('UserCreatePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useRealUsersHook.current = false;
    useRolesMock.mockReturnValue({
      roles: [{ id: 'role-1', roleName: 'Editor' }],
    });
    useGroupsMock.mockReturnValue({
      groups: [{ id: 'group-1', displayName: 'Redaktion', description: 'Redaktionsteam', isActive: true }],
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('renders mutation-specific client errors without load wording', () => {
    useUsersMock.mockReturnValue(
      createUsersApiState({
        mutationError: {
          status: 500,
          code: 'internal_error',
          message: 'Einladungs-E-Mail zum Passwort setzen konnte nicht gesendet werden.',
        },
      })
    );

    render(<UserCreatePage />);

    expect(screen.getByRole('alert').textContent).toContain(
      'Technischer Fehler bei der Nutzeraktion: Einladungs-E-Mail zum Passwort setzen konnte nicht gesendet werden.'
    );
    expect(screen.getByRole('alert').textContent).not.toContain('Technischer Fehler beim Laden der Nutzer');
  });

  it('renders the password setup invite option enabled by default', () => {
    useUsersMock.mockReturnValue(createUsersApiState());

    const { container } = render(<UserCreatePage />);
    const checkbox = container.querySelector<HTMLInputElement>('#create-user-send-password-setup-email');

    expect(checkbox?.checked).toBe(true);
  });

  it('hides the root-only instance_registry_admin role from the advanced role picker', () => {
    useUsersMock.mockReturnValue(createUsersApiState());
    useRolesMock.mockReturnValue({
      roles: [
        { id: 'role-1', roleName: 'Editor', roleKey: 'editor', externalRoleName: 'editor' },
        {
          id: 'role-root',
          roleName: 'instance_registry_admin',
          roleKey: 'instance_registry_admin',
          externalRoleName: 'instance_registry_admin',
        },
      ],
    });

    render(<UserCreatePage />);

    expect(screen.queryByLabelText('instance_registry_admin')).toBeNull();
    expect(screen.getByLabelText('Editor')).toBeTruthy();
  });

  it('shows resolver-driven field errors and blocks invalid submit through the shared RHF path', async () => {
    const createUser = vi.fn();
    useUsersMock.mockReturnValue(createUsersApiState({ createUser }));

    render(<UserCreatePage />);

    fireEvent.click(screen.getByRole('button', { name: 'Nutzer anlegen' }));

    await waitFor(() => {
      expect(createUser).not.toHaveBeenCalled();
      expect(screen.getByRole('alert').textContent).toContain('Bitte eine gültige E-Mail-Adresse eingeben.');
    });

    expect(document.activeElement).toBe(screen.getByLabelText('E-Mail'));
    expect(screen.getByRole('alert').textContent).toContain('Vorname ist ein Pflichtfeld.');
    expect(screen.getByRole('alert').textContent).toContain('Nachname ist ein Pflichtfeld.');
    expect(screen.getByLabelText('E-Mail').getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByLabelText('Vorname').getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByLabelText('Nachname').getAttribute('aria-invalid')).toBe('true');
  });

  it('submits the create request through the shared MSW path and sends the expected payload', async () => {
    useRealUsersHook.current = true;

    let createPayload: unknown;

    studioMswServer.use(
      http.get('/api/v1/iam/users', () =>
        HttpResponse.json({
          data: [],
          pagination: {
            page: 1,
            pageSize: 25,
            total: 0,
          },
        })
      ),
      http.post('/api/v1/iam/users', async ({ request }) => {
        createPayload = await request.json();
        return HttpResponse.json({
          data: {
            user: {
              id: 'user-msw-1',
              keycloakSubject: 'subject-msw-1',
              displayName: 'Alice Example',
              status: 'pending',
              roles: [],
              mainserverUserApplicationSecretSet: false,
            },
            invitation: {
              status: 'failed',
            },
          },
        });
      })
    );

    const { container } = render(<UserCreatePage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Nutzer anlegen' })).toBeTruthy();
    });

    const groupCheckbox = container.querySelector<HTMLInputElement>('#create-user-group-group-1');

    if (!groupCheckbox) {
      throw new Error('Expected group assignment checkbox to be present');
    }

    fireEvent.change(screen.getByLabelText('E-Mail'), { target: { value: 'alice@example.com' } });
    fireEvent.change(screen.getByLabelText('Vorname'), { target: { value: 'Alice' } });
    fireEvent.change(screen.getByLabelText('Nachname'), { target: { value: 'Example' } });
    fireEvent.click(groupCheckbox);
    fireEvent.click(screen.getByRole('button', { name: 'Nutzer anlegen' }));

    await waitFor(() => {
      expect(createPayload).toEqual({
        email: 'alice@example.com',
        firstName: 'Alice',
        lastName: 'Example',
        displayName: 'Alice Example',
        roleIds: [],
        groupIds: ['group-1'],
        sendPasswordSetupEmail: true,
      });
    });

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith({
        to: '/admin/users/$userId',
        params: { userId: 'user-msw-1' },
        search: { invite: 'failed' },
      });
    });
  });

  it('submits selected groups as the primary assignment and navigates with a warning marker when invitation delivery failed', async () => {
    const createUser = vi.fn().mockResolvedValue({
      user: {
        id: 'user-1',
        keycloakSubject: 'subject-1',
        displayName: 'Alice Example',
        status: 'pending',
        roles: [],
        mainserverUserApplicationSecretSet: false,
      },
      invitation: {
        status: 'failed',
        error: {
          code: 'keycloak_user_not_ready',
          message: 'Der Nutzer wurde angelegt, aber Keycloak war fuer den Einladungsversand noch nicht bereit.',
          retryable: true,
        },
      },
    });
    useUsersMock.mockReturnValue(createUsersApiState({ createUser }));

    const { container } = render(<UserCreatePage />);
    const emailInput = container.querySelector<HTMLInputElement>('#create-user-email');
    const firstNameInput = container.querySelector<HTMLInputElement>('#create-user-first-name');
    const lastNameInput = container.querySelector<HTMLInputElement>('#create-user-last-name');
    const groupCheckbox = container.querySelector<HTMLInputElement>('#create-user-group-group-1');

    if (!emailInput || !firstNameInput || !lastNameInput || !groupCheckbox) {
      throw new Error('Expected create-user form inputs to be present');
    }

    fireEvent.change(emailInput, { target: { value: 'alice@example.com' } });
    fireEvent.change(firstNameInput, { target: { value: 'Alice' } });
    fireEvent.change(lastNameInput, { target: { value: 'Example' } });
    fireEvent.click(groupCheckbox);
    fireEvent.click(screen.getByRole('button', { name: 'Nutzer anlegen' }));

    await waitFor(() =>
      expect(createUser).toHaveBeenCalledWith(
        expect.objectContaining({
          groupIds: ['group-1'],
          roleIds: [],
          sendPasswordSetupEmail: true,
        })
      )
    );
    await waitFor(() =>
      expect(navigateMock).toHaveBeenCalledWith({
        to: '/admin/users/$userId',
        params: { userId: 'user-1' },
        search: {
          invite: 'failed',
          inviteCode: 'keycloak_user_not_ready',
          inviteMessage: 'Der Nutzer wurde angelegt, aber Keycloak war fuer den Einladungsversand noch nicht bereit.',
        },
      })
    );
  });

  it('submits the invite flag as false when the checkbox is disabled', async () => {
    const createUser = vi.fn().mockResolvedValue({
      user: {
        id: 'user-1',
        keycloakSubject: 'subject-1',
        displayName: 'Alice Example',
        status: 'pending',
        roles: [],
        mainserverUserApplicationSecretSet: false,
      },
      invitation: {
        status: 'not_requested',
      },
    });
    useUsersMock.mockReturnValue(createUsersApiState({ createUser }));

    const { container } = render(<UserCreatePage />);
    const checkbox = container.querySelector<HTMLInputElement>('#create-user-send-password-setup-email');
    const emailInput = container.querySelector<HTMLInputElement>('#create-user-email');
    const firstNameInput = container.querySelector<HTMLInputElement>('#create-user-first-name');
    const lastNameInput = container.querySelector<HTMLInputElement>('#create-user-last-name');

    if (!checkbox || !emailInput || !firstNameInput || !lastNameInput) {
      throw new Error('Expected create-user form controls to be present');
    }

    fireEvent.click(checkbox);
    fireEvent.change(emailInput, { target: { value: 'alice@example.com' } });
    fireEvent.change(firstNameInput, { target: { value: 'Alice' } });
    fireEvent.change(lastNameInput, { target: { value: 'Example' } });
    fireEvent.click(screen.getByRole('button', { name: 'Nutzer anlegen' }));

    await waitFor(() =>
      expect(createUser).toHaveBeenCalledWith(
        expect.objectContaining({
          sendPasswordSetupEmail: false,
        })
      )
    );
  });

  it('supports additive direct roles in the advanced section together with groups', async () => {
    const createUser = vi.fn().mockResolvedValue({
      user: {
        id: 'user-1',
        keycloakSubject: 'subject-1',
        displayName: 'Alice Example',
        status: 'pending',
        roles: [],
        mainserverUserApplicationSecretSet: false,
      },
      invitation: {
        status: 'not_requested',
      },
    });
    useUsersMock.mockReturnValue(createUsersApiState({ createUser }));

    const { container } = render(<UserCreatePage />);
    const emailInput = container.querySelector<HTMLInputElement>('#create-user-email');
    const firstNameInput = container.querySelector<HTMLInputElement>('#create-user-first-name');
    const lastNameInput = container.querySelector<HTMLInputElement>('#create-user-last-name');
    const groupCheckbox = container.querySelector<HTMLInputElement>('#create-user-group-group-1');
    const roleCheckbox = container.querySelector<HTMLInputElement>('#create-user-role-role-1');

    if (!emailInput || !firstNameInput || !lastNameInput || !groupCheckbox || !roleCheckbox) {
      throw new Error('Expected create-user assignment controls to be present');
    }

    fireEvent.change(emailInput, { target: { value: 'alice@example.com' } });
    fireEvent.change(firstNameInput, { target: { value: 'Alice' } });
    fireEvent.change(lastNameInput, { target: { value: 'Example' } });
    fireEvent.click(groupCheckbox);
    fireEvent.click(roleCheckbox);
    fireEvent.click(screen.getByRole('button', { name: 'Nutzer anlegen' }));

    await waitFor(() =>
      expect(createUser).toHaveBeenCalledWith(
        expect.objectContaining({
          groupIds: ['group-1'],
          roleIds: ['role-1'],
        })
      )
    );
  });

  it('navigates without an invite marker when the invitation was delivered normally', async () => {
    const createUser = vi.fn().mockResolvedValue({
      user: {
        id: 'user-2',
        keycloakSubject: 'subject-2',
        displayName: 'Bob Example',
        status: 'pending',
        roles: [],
        mainserverUserApplicationSecretSet: false,
      },
      invitation: {
        status: 'sent',
      },
    });
    useUsersMock.mockReturnValue(createUsersApiState({ createUser }));

    const { container } = render(<UserCreatePage />);
    const emailInput = container.querySelector<HTMLInputElement>('#create-user-email');
    const firstNameInput = container.querySelector<HTMLInputElement>('#create-user-first-name');
    const lastNameInput = container.querySelector<HTMLInputElement>('#create-user-last-name');

    if (!emailInput || !firstNameInput || !lastNameInput) {
      throw new Error('Expected create-user form inputs to be present');
    }

    fireEvent.change(emailInput, { target: { value: 'bob@example.com' } });
    fireEvent.change(firstNameInput, { target: { value: 'Bob' } });
    fireEvent.change(lastNameInput, { target: { value: 'Example' } });
    fireEvent.click(screen.getByRole('button', { name: 'Nutzer anlegen' }));

    await waitFor(() =>
      expect(navigateMock).toHaveBeenCalledWith({
        to: '/admin/users/$userId',
        params: { userId: 'user-2' },
        search: undefined,
      })
    );
  });

  it('forwards precise invitation failure details to the detail route after a successful user creation', async () => {
    const createUser = vi.fn().mockResolvedValue({
      user: {
        id: 'user-3',
        keycloakSubject: 'subject-3',
        displayName: 'Cara Example',
        status: 'pending',
        roles: [],
        mainserverUserApplicationSecretSet: false,
      },
      invitation: {
        status: 'failed',
        error: {
          code: 'internal_error',
          message: 'smtp failed',
          retryable: false,
        },
      },
    });
    useUsersMock.mockReturnValue(createUsersApiState({ createUser }));

    const { container } = render(<UserCreatePage />);
    const emailInput = container.querySelector<HTMLInputElement>('#create-user-email');
    const firstNameInput = container.querySelector<HTMLInputElement>('#create-user-first-name');
    const lastNameInput = container.querySelector<HTMLInputElement>('#create-user-last-name');

    if (!emailInput || !firstNameInput || !lastNameInput) {
      throw new Error('Expected create-user form inputs to be present');
    }

    fireEvent.change(emailInput, { target: { value: 'cara@example.com' } });
    fireEvent.change(firstNameInput, { target: { value: 'Cara' } });
    fireEvent.change(lastNameInput, { target: { value: 'Example' } });
    fireEvent.click(screen.getByRole('button', { name: 'Nutzer anlegen' }));

    await waitFor(() =>
      expect(navigateMock).toHaveBeenCalledWith({
        to: '/admin/users/$userId',
        params: { userId: 'user-3' },
        search: {
          invite: 'failed',
          inviteCode: 'internal_error',
          inviteMessage: 'smtp failed',
        },
      })
    );
  });

  it('renders empty states when no active groups or direct roles are available', () => {
    useUsersMock.mockReturnValue(createUsersApiState());
    useRolesMock.mockReturnValue({ roles: [] });
    useGroupsMock.mockReturnValue({ groups: [] });

    render(<UserCreatePage />);

    expect(screen.getByText('Es sind keine aktiven Gruppen verfügbar.')).toBeTruthy();
    expect(screen.getByText('Es sind keine direkten Rollen verfügbar.')).toBeTruthy();
  });
});
