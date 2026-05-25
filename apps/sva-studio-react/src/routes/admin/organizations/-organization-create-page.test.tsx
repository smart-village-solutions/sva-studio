import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { OrganizationCreatePage } from './-organization-create-page';

const useOrganizationsMock = vi.fn();
const navigateMock = vi.fn().mockResolvedValue(undefined);
const listOrganizationsMock = vi.fn();

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

vi.mock('../../../lib/iam-api', async () => {
  const actual = await vi.importActual('../../../lib/iam-api');
  return {
    ...actual,
    listOrganizations: (...args: unknown[]) => listOrganizationsMock(...args),
  };
});

const createState = (overrides: Record<string, unknown> = {}) => ({
  organizations: [{ id: 'parent-1', displayName: 'Landkreis Alpha', organizationKey: 'landkreis-alpha' }],
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
    listOrganizationsMock.mockReset();
    listOrganizationsMock.mockResolvedValue({
      data: [{ id: 'parent-1', displayName: 'Landkreis Alpha', organizationKey: 'landkreis-alpha' }],
      pagination: { page: 1, pageSize: 100, total: 1 },
    });
  });

  it('creates an organization and navigates to its detail page', async () => {
    const createOrganization = vi.fn().mockResolvedValue({ id: 'org-2' });
    useOrganizationsMock.mockReturnValue(createState({ createOrganization }));

    render(<OrganizationCreatePage />);

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

  it('generates a suffixed technical key when the base key already exists', async () => {
    const createOrganization = vi.fn().mockResolvedValue({ id: 'org-3' });
    useOrganizationsMock.mockReturnValue(
      createState({
        createOrganization,
        organizations: [
          { id: 'parent-1', displayName: 'Landkreis Alpha', organizationKey: 'landkreis-alpha' },
          { id: 'org-2', displayName: 'Landkreis Alpha', organizationKey: 'landkreis-alpha-2' },
        ],
      })
    );

    render(<OrganizationCreatePage />);

    fireEvent.change(screen.getByLabelText('Anzeigename', { selector: '#organization-name' }), {
      target: { value: 'Landkreis Alpha' },
    });

    await waitFor(() => {
      expect((screen.getByLabelText('Technischer Schlüssel', { selector: '#organization-key' }) as HTMLInputElement).value).toBe(
        'landkreis-alpha-3'
      );
    });
  });

  it('keeps a manually overridden technical key', async () => {
    const createOrganization = vi.fn().mockResolvedValue({ id: 'org-4' });
    useOrganizationsMock.mockReturnValue(createState({ createOrganization }));

    render(<OrganizationCreatePage />);

    fireEvent.change(screen.getByLabelText('Anzeigename', { selector: '#organization-name' }), {
      target: { value: 'Landkreis Gamma' },
    });
    fireEvent.change(screen.getByLabelText('Technischer Schlüssel', { selector: '#organization-key' }), {
      target: { value: 'gamma-custom' },
    });
    fireEvent.change(screen.getByLabelText('Anzeigename', { selector: '#organization-name' }), {
      target: { value: 'Landkreis Gamma Neu' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Organisation anlegen' }));

    await waitFor(() => {
      expect(createOrganization).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationKey: 'gamma-custom',
          displayName: 'Landkreis Gamma Neu',
        })
      );
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

  it('loads parent options and key suggestions across multiple organization pages', async () => {
    const createOrganization = vi.fn().mockResolvedValue({ id: 'org-9' });
    useOrganizationsMock.mockReturnValue(
      createState({
        createOrganization,
        organizations: [{ id: 'parent-1', displayName: 'Landkreis Alpha', organizationKey: 'landkreis-alpha' }],
      })
    );
    listOrganizationsMock
      .mockResolvedValueOnce({
        data: [
          { id: 'parent-1', displayName: 'Landkreis Alpha', organizationKey: 'landkreis-alpha' },
          { id: 'org-2', displayName: 'Landkreis Alpha', organizationKey: 'landkreis-alpha-2' },
        ],
        pagination: { page: 1, pageSize: 100, total: 101 },
      })
      .mockResolvedValueOnce({
        data: [{ id: 'parent-2', displayName: 'Landkreis Beta', organizationKey: 'landkreis-beta' }],
        pagination: { page: 2, pageSize: 100, total: 101 },
      });

    render(<OrganizationCreatePage />);

    await waitFor(() => {
      expect(listOrganizationsMock).toHaveBeenNthCalledWith(1, {
        page: 1,
        pageSize: 100,
      });
      expect(listOrganizationsMock).toHaveBeenNthCalledWith(2, {
        page: 2,
        pageSize: 100,
      });
    });

    fireEvent.change(screen.getByLabelText('Anzeigename', { selector: '#organization-name' }), {
      target: { value: 'Landkreis Alpha' },
    });

    await waitFor(() => {
      expect((screen.getByLabelText('Technischer Schlüssel', { selector: '#organization-key' }) as HTMLInputElement).value).toBe(
        'landkreis-alpha-3'
      );
      expect(screen.getByRole('option', { name: 'Landkreis Beta' })).toBeTruthy();
    });

    fireEvent.change(screen.getByLabelText('Parent-Organisation', { selector: '#organization-parent' }), {
      target: { value: 'parent-2' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Organisation anlegen' }));

    await waitFor(() => {
      expect(createOrganization).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationKey: 'landkreis-alpha-3',
          parentOrganizationId: 'parent-2',
        })
      );
    });
  });
});
