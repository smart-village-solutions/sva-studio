import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { OrganizationsPage } from './-organizations-page';

const useOrganizationsMock = vi.fn();
const useUsersMock = vi.fn();

vi.mock('../../../hooks/use-organizations', () => ({
  useOrganizations: () => useOrganizationsMock(),
}));

vi.mock('../../../hooks/use-users', () => ({
  useUsers: () => useUsersMock(),
}));

describe('OrganizationsPage', () => {
  afterEach(() => {
    cleanup();
    useOrganizationsMock.mockReset();
    useUsersMock.mockReset();
  });

  it('renders the organization list with hierarchy and status information', () => {
    useOrganizationsMock.mockReturnValue({
      organizations: [
        {
          id: 'org-1',
          organizationKey: 'landkreis-alpha',
          displayName: 'Landkreis Alpha',
          parentOrganizationId: undefined,
          parentDisplayName: undefined,
          organizationType: 'county',
          contentAuthorPolicy: 'org_only',
          isActive: true,
          depth: 0,
          hierarchyPath: [],
          childCount: 2,
          membershipCount: 4,
        },
        {
          id: 'org-2',
          organizationKey: 'gemeinde-beta',
          displayName: 'Gemeinde Beta',
          parentOrganizationId: 'org-1',
          parentDisplayName: 'Landkreis Alpha',
          organizationType: 'municipality',
          contentAuthorPolicy: 'org_or_personal',
          isActive: false,
          depth: 1,
          hierarchyPath: ['org-1'],
          childCount: 0,
          membershipCount: 1,
        },
      ],
      total: 2,
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
      createOrganization: vi.fn(),
      updateOrganization: vi.fn(),
      deactivateOrganization: vi.fn(),
      assignMembership: vi.fn(),
      removeMembership: vi.fn(),
    });
    useUsersMock.mockReturnValue({
      users: [],
    });

    render(<OrganizationsPage />);

    expect(screen.getByRole('heading', { name: 'Organisationsverwaltung' })).toBeTruthy();
    expect(screen.getAllByText('Landkreis Alpha').length).toBeGreaterThan(0);
    expect(screen.getByText('gemeinde-beta')).toBeTruthy();
    expect(screen.getAllByText('Landkreis').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Gemeinde').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Aktiv').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Inaktiv').length).toBeGreaterThan(0);
    expect(screen.getByText('2 Organisationen gefunden.')).toBeTruthy();
  });

  it('opens the create dialog and submits a normalized payload', async () => {
    const createOrganization = vi.fn().mockResolvedValue({
      id: 'org-new',
    });

    useOrganizationsMock.mockReturnValue({
      organizations: [],
      total: 0,
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
      createOrganization,
      updateOrganization: vi.fn(),
      deactivateOrganization: vi.fn(),
      assignMembership: vi.fn(),
      removeMembership: vi.fn(),
    });
    useUsersMock.mockReturnValue({
      users: [],
    });

    render(<OrganizationsPage />);

    const [openCreateButton] = screen.getAllByRole('button', { name: 'Organisation anlegen' });
    expect(openCreateButton).toBeDefined();
    fireEvent.click(openCreateButton);

    const dialog = screen.getByRole('dialog', { name: 'Organisation anlegen' });
    fireEvent.change(within(dialog).getByLabelText('Technischer Schlüssel'), {
      target: { value: '  gemeinde_nord  ' },
    });
    fireEvent.change(within(dialog).getByLabelText('Anzeigename'), {
      target: { value: ' Gemeinde Nord ' },
    });
    fireEvent.change(within(dialog).getByLabelText('Organisationstyp'), {
      target: { value: 'municipality' },
    });
    fireEvent.change(within(dialog).getByLabelText('Autoren-Policy'), {
      target: { value: 'org_or_personal' },
    });

    const createForm = within(dialog).getByRole('button', { name: 'Organisation anlegen' }).closest('form');
    expect(createForm).not.toBeNull();
    fireEvent.submit(createForm);

    expect(createOrganization).toHaveBeenCalledWith({
      organizationKey: 'gemeinde_nord',
      displayName: 'Gemeinde Nord',
      organizationType: 'municipality',
      parentOrganizationId: undefined,
      contentAuthorPolicy: 'org_or_personal',
    });

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Organisation anlegen' })).toBeNull();
    });
  });
});
