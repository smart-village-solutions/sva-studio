import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { HttpResponse, http, studioMswServer } from 'tooling-testing/msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { RoleCreatePage } from './-role-create-page';

const navigateMock = vi.fn();
const createRoleMock = vi.fn();
const useRealRoleApi = vi.hoisted(() => ({ current: false }));

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
    createRole: (...args: Parameters<typeof actual.createRole>) =>
      useRealRoleApi.current ? actual.createRole(...args) : createRoleMock(...args),
  };
});

describe('RoleCreatePage', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    createRoleMock.mockReset();
    navigateMock.mockReset();
    useRealRoleApi.current = false;
  });

  it('creates a role through HTTP and navigates to the detail page', async () => {
    useRealRoleApi.current = true;
    let createPayload: unknown;

    studioMswServer.use(
      http.post('/api/v1/iam/roles', async ({ request }) => {
        createPayload = await request.json();
        return HttpResponse.json({ data: { id: 'role-new' } });
      })
    );

    render(<RoleCreatePage />);

    fireEvent.change(screen.getByLabelText('Anzeigename'), {
      target: { value: ' Team Lead ' },
    });
    fireEvent.change(screen.getByLabelText('Beschreibung'), {
      target: { value: ' Verantwortlich für Teamkoordination ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Rolle anlegen' }));

    await waitFor(() => {
      expect(createPayload).toEqual({
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

  it('renders HTTP mutation errors and stays on the page', async () => {
    useRealRoleApi.current = true;
    studioMswServer.use(
      http.post('/api/v1/iam/roles', () =>
        HttpResponse.json({ error: { code: 'conflict', message: 'conflict' } }, { status: 409 })
      )
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

  it('shows resolver-driven errors and blocks an empty display name', async () => {
    render(<RoleCreatePage />);

    expect((screen.getByLabelText('Anzeigename') as HTMLInputElement).required).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Rolle anlegen' }));

    await waitFor(() => {
      expect(createRoleMock).not.toHaveBeenCalled();
      expect(screen.getByRole('alert').textContent).toContain('Bitte einen Anzeigenamen angeben.');
    });

    expect(document.activeElement).toBe(screen.getByLabelText('Anzeigename'));
    expect(screen.getByLabelText('Anzeigename').getAttribute('aria-invalid')).toBe('true');
  });

  it('hides technical key and role level inputs from the normal creation form', () => {
    render(<RoleCreatePage />);

    expect(screen.queryByLabelText('Technischer Rollenschlüssel')).toBeNull();
    expect(screen.queryByLabelText('Rollenlevel')).toBeNull();
    expect(createRoleMock).not.toHaveBeenCalled();
  });
});
