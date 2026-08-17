import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { RoleCreatePage } from './-role-create-page';

const navigateMock = vi.fn();
const createRoleMock = vi.fn();

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    to,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
  useNavigate: () => navigateMock,
}));

vi.mock('../../../lib/iam-api', async () => {
  const actual =
    await vi.importActual<typeof import('../../../lib/iam-api')>('../../../lib/iam-api');
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

    fireEvent.change(screen.getByLabelText('Anzeigename'), {
      target: { value: ' Team Lead ' },
    });
    fireEvent.change(screen.getByLabelText('Beschreibung'), {
      target: { value: ' Verantwortlich für Teamkoordination ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Rolle anlegen' }));

    await waitFor(() => {
      expect(createRoleMock).toHaveBeenCalledWith({
        displayName: 'Team Lead',
        description: 'Verantwortlich für Teamkoordination',
        permissionIds: [],
      });
    });

    expect(navigateMock).toHaveBeenCalledWith({
      to: '/admin/roles/$roleId',
      params: { roleId: 'role-new' },
      state: expect.any(Function),
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

    fireEvent.change(screen.getByLabelText('Anzeigename'), {
      target: { value: 'Support' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Rolle anlegen' }));

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain(
        'Die Rollenänderung steht in Konflikt'
      );
    });

    expect(navigateMock).not.toHaveBeenCalled();
  });

  it('hides technical key and role level inputs from the normal creation form', () => {
    render(<RoleCreatePage />);

    expect(screen.queryByLabelText('Technischer Rollenschlüssel')).toBeNull();
    expect(screen.queryByLabelText('Rollenlevel')).toBeNull();
    expect(createRoleMock).not.toHaveBeenCalled();
  });
});
