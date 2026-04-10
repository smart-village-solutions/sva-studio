import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { IamHttpError } from '../../../lib/iam-api';
import { OrganizationsPage } from './-organizations-page';

const useOrganizationsMock = vi.fn();

vi.mock('@tanstack/react-router', () => ({
  Link: ({ to, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('../../../hooks/use-organizations', () => ({
  useOrganizations: () => useOrganizationsMock(),
}));

const createOrganizationsApiState = (overrides: Record<string, unknown> = {}) => ({
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
  ],
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
  createOrganization: vi.fn(),
  updateOrganization: vi.fn(),
  deactivateOrganization: vi.fn().mockResolvedValue(true),
  assignMembership: vi.fn(),
  removeMembership: vi.fn(),
  ...overrides,
});

describe('OrganizationsPage', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    useOrganizationsMock.mockReset();
  });

  it('renders list content and route links', () => {
    useOrganizationsMock.mockReturnValue(createOrganizationsApiState());

    render(<OrganizationsPage />);

    expect(screen.getByRole('heading', { name: 'Organisationsverwaltung' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Organisation anlegen' }).getAttribute('href')).toBe('/admin/organizations/new');
    expect(screen.getAllByRole('link', { name: 'Bearbeiten' })[0]!.getAttribute('href')).toBe('/admin/organizations/$organizationId');
    expect(screen.getByText('1 Organisationen gefunden.')).toBeTruthy();
  });

  it('forwards filter and pagination actions', () => {
    const setSearch = vi.fn();
    const setOrganizationType = vi.fn();
    const setStatus = vi.fn();
    const setPage = vi.fn();

    useOrganizationsMock.mockReturnValue(
      createOrganizationsApiState({
        setSearch,
        setOrganizationType,
        setStatus,
        setPage,
        total: 52,
        page: 2,
      })
    );

    render(<OrganizationsPage />);

    fireEvent.change(screen.getByLabelText('Suche'), { target: { value: 'Alpha' } });
    fireEvent.change(screen.getByLabelText('Typ'), { target: { value: 'county' } });
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'active' } });
    fireEvent.click(screen.getByRole('button', { name: 'Zurück' }));
    fireEvent.click(screen.getByRole('button', { name: 'Weiter' }));

    expect(setSearch).toHaveBeenCalledWith('Alpha');
    expect(setOrganizationType).toHaveBeenCalledWith('county');
    expect(setStatus).toHaveBeenCalledWith('active');
    expect(setPage).toHaveBeenNthCalledWith(1, 1);
    expect(setPage).toHaveBeenNthCalledWith(2, 3);
  });

  it('shows retryable list errors', () => {
    const refetch = vi.fn();
    useOrganizationsMock.mockReturnValue(
      createOrganizationsApiState({
        error: new IamHttpError({ status: 400, code: 'forbidden', message: 'forbidden' }),
        refetch,
      })
    );

    render(<OrganizationsPage />);

    expect(screen.getByRole('alert').textContent).toContain('Unzureichende Berechtigungen');
    fireEvent.click(screen.getByRole('button', { name: 'Erneut versuchen' }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('deactivates organizations via the confirmation dialog', async () => {
    const deactivateOrganization = vi.fn().mockResolvedValue(true);
    useOrganizationsMock.mockReturnValue(createOrganizationsApiState({ deactivateOrganization }));

    render(<OrganizationsPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Deaktivieren' }));
    fireEvent.click(screen.getByRole('button', { name: 'Deaktivieren' }));

    await waitFor(() => expect(deactivateOrganization).toHaveBeenCalledWith('org-1'));
  });
});
