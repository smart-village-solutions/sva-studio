import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { OrganizationCreatePage } from './-organization-create-page';

const useOrganizationsMock = vi.fn();
const navigateMock = vi.fn().mockResolvedValue(undefined);

vi.mock('@tanstack/react-router', () => ({
  Link: ({ to, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
  useNavigate: () => navigateMock,
}));

vi.mock('../../../hooks/use-organizations', () => ({
  useOrganizations: () => useOrganizationsMock(),
}));

const createState = (overrides: Record<string, unknown> = {}) => ({
  organizations: [{ id: 'parent-1', displayName: 'Landkreis Alpha' }],
  total: 1,
  page: 1,
  pageSize: 25,
  isLoading: false,
  error: null,
  mutationError: null,
  selectedOrganization: null,
  detailLoading: false,
  filters: {
    page: 1,
    pageSize: 25,
    search: '',
    organizationType: 'all',
    status: 'all',
  },
  setSearch: vi.fn(),
  setOrganizationType: vi.fn(),
  setStatus: vi.fn(),
  setPage: vi.fn(),
  refetch: vi.fn(),
  loadOrganization: vi.fn(),
  clearSelectedOrganization: vi.fn(),
  clearMutationError: vi.fn(),
  createOrganization: vi.fn().mockResolvedValue({ id: 'org-2' }),
  updateOrganization: vi.fn().mockResolvedValue(true),
  deactivateOrganization: vi.fn().mockResolvedValue(true),
  assignMembership: vi.fn().mockResolvedValue(true),
  removeMembership: vi.fn().mockResolvedValue(true),
  ...overrides,
});

describe('OrganizationCreatePage', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    useOrganizationsMock.mockReset();
    navigateMock.mockClear();
  });

  it('creates an organization and navigates to its detail page', async () => {
    const createOrganization = vi.fn().mockResolvedValue({ id: 'org-2' });
    useOrganizationsMock.mockReturnValue(createState({ createOrganization }));

    render(<OrganizationCreatePage />);

    fireEvent.change(screen.getByLabelText('Technischer Schlüssel', { selector: '#organization-key' }), {
      target: { value: ' landkreis-beta ' },
    });
    fireEvent.change(screen.getByLabelText('Anzeigename', { selector: '#organization-name' }), {
      target: { value: ' Landkreis Beta ' },
    });
    fireEvent.change(screen.getByLabelText('Organisationstyp', { selector: '#organization-type' }), {
      target: { value: 'county' },
    });
    fireEvent.change(screen.getByLabelText('Autoren-Policy', { selector: '#organization-policy' }), {
      target: { value: 'org_or_personal' },
    });
    fireEvent.change(screen.getByLabelText('Parent-Organisation', { selector: '#organization-parent' }), {
      target: { value: 'parent-1' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Organisation anlegen' }));

    await waitFor(() => {
      expect(createOrganization).toHaveBeenCalledWith({
        organizationKey: 'landkreis-beta',
        displayName: 'Landkreis Beta',
        organizationType: 'county',
        parentOrganizationId: 'parent-1',
        contentAuthorPolicy: 'org_or_personal',
      });
    });
    expect(navigateMock).toHaveBeenCalledWith({
      to: '/admin/organizations/$organizationId',
      params: { organizationId: 'org-2' },
    });
  });

  it('renders mutation errors', () => {
    useOrganizationsMock.mockReturnValue(
      createState({
        mutationError: { status: 503, code: 'database_unavailable', message: 'kaputt' },
      })
    );

    render(<OrganizationCreatePage />);

    expect(screen.getByRole('alert').textContent).toContain('Die IAM-Datenbank ist derzeit nicht erreichbar.');
  });
});
