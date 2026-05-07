import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { UserCreatePage } from './-user-create-page';

const navigateMock = vi.fn();
const useUsersMock = vi.fn();
const useRolesMock = vi.fn();

vi.mock('@tanstack/react-router', () => ({
  Link: ({ to, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
  useNavigate: () => navigateMock,
}));

vi.mock('../../../hooks/use-users', () => ({
  useUsers: () => useUsersMock(),
}));

vi.mock('../../../hooks/use-roles', () => ({
  useRoles: () => useRolesMock(),
}));

const createUsersApiState = (overrides: Record<string, unknown> = {}) => ({
  createUser: vi.fn(),
  error: null,
  ...overrides,
});

describe('UserCreatePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useRolesMock.mockReturnValue({
      roles: [{ id: 'role-1', roleName: 'Editor' }],
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

  it('submits the invite flag and navigates with a warning marker when invitation delivery failed', async () => {
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
      },
    });
    useUsersMock.mockReturnValue(createUsersApiState({ createUser }));

    const { container } = render(<UserCreatePage />);
    const emailInput = container.querySelector<HTMLInputElement>('#create-user-email');
    const firstNameInput = container.querySelector<HTMLInputElement>('#create-user-first-name');
    const lastNameInput = container.querySelector<HTMLInputElement>('#create-user-last-name');
    const roleSelect = container.querySelector<HTMLSelectElement>('#create-user-role');

    if (!emailInput || !firstNameInput || !lastNameInput || !roleSelect) {
      throw new Error('Expected create-user form inputs to be present');
    }

    fireEvent.change(emailInput, { target: { value: 'alice@example.com' } });
    fireEvent.change(firstNameInput, { target: { value: 'Alice' } });
    fireEvent.change(lastNameInput, { target: { value: 'Example' } });
    fireEvent.change(roleSelect, { target: { value: 'role-1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Nutzer anlegen' }));

    await waitFor(() =>
      expect(createUser).toHaveBeenCalledWith(
        expect.objectContaining({
          sendPasswordSetupEmail: true,
        })
      )
    );
    await waitFor(() =>
      expect(navigateMock).toHaveBeenCalledWith({
        to: '/admin/users/$userId',
        params: { userId: 'user-1' },
        search: { invite: 'failed' },
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
});
