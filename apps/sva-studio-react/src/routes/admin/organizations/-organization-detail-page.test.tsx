import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { OrganizationDetailPage } from './-organization-detail-page';

const useOrganizationsMock = vi.fn();
const listUsersMock = vi.fn();

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

vi.mock('../../../lib/iam-api', async () => {
  const actual = await vi.importActual('../../../lib/iam-api');
  return {
    ...actual,
    listUsers: (...args: unknown[]) => listUsersMock(...args),
  };
});

const organizationFixture = {
  id: 'org-1',
  organizationKey: 'landkreis-alpha',
  displayName: 'Landkreis Alpha',
  parentOrganizationId: undefined,
  parentDisplayName: undefined,
  organizationType: 'county',
  contentAuthorPolicy: 'org_only',
  isActive: true,
  depth: 0,
  hierarchyPath: ['Landkreis Alpha'],
  childCount: 2,
  membershipCount: 1,
  metadata: { source: 'seed' },
  memberships: [
    {
      accountId: 'user-1',
      keycloakSubject: 'kc-user-1',
      displayName: 'Anna Admin',
      email: 'anna@example.org',
      visibility: 'internal' as const,
      isDefaultContext: true,
      createdAt: '2026-04-01T09:00:00.000Z',
    },
  ],
};

const createState = (overrides: Record<string, unknown> = {}) => ({
  organizations: [
    organizationFixture,
    {
      id: 'parent-2',
      organizationKey: 'landkreis-beta',
      displayName: 'Landkreis Beta',
    },
  ],
  total: 1,
  page: 1,
  pageSize: 25,
  isLoading: false,
  error: null,
  mutationError: null,
  selectedOrganization: organizationFixture,
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
  loadOrganization: vi.fn().mockResolvedValue(organizationFixture),
  clearSelectedOrganization: vi.fn(),
  clearMutationError: vi.fn(),
  createOrganization: vi.fn().mockResolvedValue({ id: 'org-2' }),
  updateOrganization: vi.fn().mockResolvedValue(true),
  deactivateOrganization: vi.fn().mockResolvedValue(true),
  assignMembership: vi.fn().mockResolvedValue(true),
  removeMembership: vi.fn().mockResolvedValue(true),
  ...overrides,
});

describe('OrganizationDetailPage', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    useOrganizationsMock.mockReset();
    listUsersMock.mockReset();
  });

  it('loads detail state, saves changes, manages memberships, and deactivates', async () => {
    const loadOrganization = vi.fn().mockResolvedValue(organizationFixture);
    const updateOrganization = vi.fn().mockResolvedValue(true);
    const assignMembership = vi.fn().mockResolvedValue(true);
    const removeMembership = vi.fn().mockResolvedValue(true);
    const deactivateOrganization = vi.fn().mockResolvedValue(true);
    useOrganizationsMock.mockReturnValue(
      createState({
        loadOrganization,
        updateOrganization,
        assignMembership,
        removeMembership,
        deactivateOrganization,
      })
    );
    const firstPageUsers = Array.from({ length: 100 }, (_, index) => ({
      id: `user-${index + 1}`,
      keycloakSubject: `kc-user-${index + 1}`,
      displayName: index === 0 ? 'Anna Admin' : `User ${index + 1}`,
      email: index === 0 ? 'anna@example.org' : `user${index + 1}@example.org`,
      status: 'active' as const,
      roles: [],
    }));
    const secondPageUser = {
      id: 'user-101',
      keycloakSubject: 'kc-user-101',
      displayName: 'Zoe Zebra',
      email: 'zoe@example.org',
      status: 'active' as const,
      roles: [],
    };
    listUsersMock
      .mockResolvedValueOnce({
        data: firstPageUsers,
        pagination: { page: 1, pageSize: 100, total: 101 },
      })
      .mockResolvedValueOnce({
        data: [secondPageUser],
        pagination: { page: 2, pageSize: 100, total: 101 },
      });

    render(<OrganizationDetailPage organizationId="org-1" />);

    await waitFor(() => {
      expect(loadOrganization).toHaveBeenCalledWith('org-1');
    });
    await waitFor(() => {
      expect(listUsersMock).toHaveBeenCalledTimes(2);
    });

    fireEvent.change(screen.getByLabelText('Technischer Schlüssel', { selector: '#organization-key' }), {
      target: { value: ' landkreis-alpha-neu ' },
    });
    fireEvent.change(screen.getByLabelText('Anzeigename', { selector: '#organization-name' }), {
      target: { value: ' Landkreis Alpha Neu ' },
    });
    fireEvent.change(screen.getByLabelText('Organisationstyp', { selector: '#organization-type' }), {
      target: { value: 'district' },
    });
    fireEvent.change(screen.getByLabelText('Autoren-Policy', { selector: '#organization-policy' }), {
      target: { value: 'org_or_personal' },
    });
    fireEvent.change(screen.getByLabelText('Parent-Organisation', { selector: '#organization-parent' }), {
      target: { value: 'parent-2' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    await waitFor(() => {
      expect(updateOrganization).toHaveBeenCalledWith('org-1', {
        organizationKey: 'landkreis-alpha-neu',
        displayName: 'Landkreis Alpha Neu',
        organizationType: 'district',
        parentOrganizationId: 'parent-2',
        contentAuthorPolicy: 'org_or_personal',
      });
    });

    expect(screen.queryByRole('option', { name: 'Anna Admin <anna@example.org>' })).toBeNull();
    fireEvent.change(screen.getByLabelText('Mitglieder suchen', { selector: '#membership-account-search' }), {
      target: { value: 'zoe' },
    });
    expect(screen.getByRole('option', { name: 'Zoe Zebra <zoe@example.org>' })).toBeTruthy();

    fireEvent.change(document.getElementById('membership-account') as HTMLSelectElement, {
      target: { value: 'user-101' },
    });
    fireEvent.change(screen.getByLabelText('Sichtbarkeit', { selector: '#membership-visibility' }), {
      target: { value: 'external' },
    });
    fireEvent.click(document.getElementById('membership-default') as HTMLInputElement);
    fireEvent.click(screen.getByRole('button', { name: 'Mitglied zuweisen' }));

    await waitFor(() => {
      expect(assignMembership).toHaveBeenCalledWith('org-1', {
        accountId: 'user-101',
        visibility: 'external',
        isDefaultContext: true,
      });
    });

    fireEvent.click(screen.getByRole('button', { name: 'Mitglied entfernen' }));
    await waitFor(() => {
      expect(removeMembership).toHaveBeenCalledWith('org-1', 'user-1');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Deaktivieren' }));
    fireEvent.click(screen.getByRole('button', { name: 'Deaktivieren' }));

    await waitFor(() => {
      expect(deactivateOrganization).toHaveBeenCalledWith('org-1');
    });
  });

  it('does not reload organization detail on rerender when the load callback is stable', async () => {
    const loadOrganization = vi.fn().mockResolvedValue(organizationFixture);
    useOrganizationsMock.mockImplementation(() =>
      createState({
        loadOrganization,
      })
    );

    const { rerender } = render(<OrganizationDetailPage organizationId="org-1" />);

    await waitFor(() => {
      expect(loadOrganization).toHaveBeenCalledTimes(1);
      expect(loadOrganization).toHaveBeenCalledWith('org-1');
    });

    rerender(<OrganizationDetailPage organizationId="org-1" />);

    await waitFor(() => {
      expect(loadOrganization).toHaveBeenCalledTimes(1);
    });
  });

  it('renders the top-level error state', () => {
    useOrganizationsMock.mockReturnValue(
      createState({
        error: { status: 403, code: 'forbidden', message: 'forbidden' },
      })
    );

    render(<OrganizationDetailPage organizationId="org-1" />);

    expect(screen.getByRole('alert').textContent).toContain('Unzureichende Berechtigungen');
    expect(screen.getByRole('link', { name: 'Zur Organisationsliste' }).getAttribute('href')).toBe('/admin/organizations');
  });
});
