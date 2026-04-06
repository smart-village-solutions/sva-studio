import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { RoleCreatePage } from './-role-create-page';

const navigateMock = vi.fn();
const createRoleMock = vi.fn();

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
  useNavigate: () => navigateMock,
}));

vi.mock('../../../lib/iam-api', async () => {
  const actual = await vi.importActual<typeof import('../../../lib/iam-api')>('../../../lib/iam-api');
  return {
    ...actual,
    createRole: (...args: Parameters<typeof actual.createRole>) => createRoleMock(...args),
  };
});

describe('RoleCreatePage', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    createRoleMock.mockReset();
    navigateMock.mockReset();
  });

  it('creates a role and navigates to the detail page', async () => {
    createRoleMock.mockResolvedValue({
      data: {
        id: 'role-new',
      },
    });

    render(<RoleCreatePage />);

    fireEvent.change(screen.getByLabelText('Technischer Rollenschlüssel'), {
      target: { value: ' Team Lead ' },
    });
    fireEvent.change(screen.getByLabelText('Anzeigename'), {
      target: { value: ' Team Lead ' },
    });
    fireEvent.change(screen.getByLabelText('Beschreibung'), {
      target: { value: ' Verantwortlich für Teamkoordination ' },
    });
    fireEvent.change(screen.getByLabelText('Rollenlevel'), {
      target: { value: '42' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Rolle anlegen' }));

    await waitFor(() => {
      expect(createRoleMock).toHaveBeenCalledWith({
        roleName: 'team_lead',
        displayName: 'Team Lead',
        description: 'Verantwortlich für Teamkoordination',
        roleLevel: 42,
        permissionIds: [],
      });
    });

    expect(navigateMock).toHaveBeenCalledWith({
      to: '/admin/roles/$roleId',
      params: { roleId: 'role-new' },
    });
  });

  it('renders mutation errors and stays on the page', async () => {
    const { IamHttpError } = await import('../../../lib/iam-api');
    createRoleMock.mockRejectedValue(
      new IamHttpError({
        status: 409,
        code: 'conflict',
        message: 'conflict',
      })
    );

    render(<RoleCreatePage />);

    fireEvent.change(screen.getByLabelText('Technischer Rollenschlüssel'), {
      target: { value: 'Support' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Rolle anlegen' }));

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain('Die Rollenänderung steht in Konflikt');
    });

    expect(navigateMock).not.toHaveBeenCalled();
  });

  it('validates the role key before sending the request', async () => {
    render(<RoleCreatePage />);

    fireEvent.change(screen.getByLabelText('Technischer Rollenschlüssel'), {
      target: { value: 'AB' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Rolle anlegen' }));

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain(
        'Der Rollenschlüssel muss 3 bis 64 Zeichen lang sein und darf nur Kleinbuchstaben, Ziffern und Unterstriche enthalten.'
      );
    });

    expect(createRoleMock).not.toHaveBeenCalled();
    expect(navigateMock).not.toHaveBeenCalled();
  });
});
