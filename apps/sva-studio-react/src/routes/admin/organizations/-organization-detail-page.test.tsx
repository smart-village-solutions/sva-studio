import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { OrganizationDetailPage, sortMembershipUsersByLabel } from './-organization-detail-page';

const useOrganizationsMock = vi.fn();
const listUsersMock = vi.fn();
const listOrganizationsMock = vi.fn();

vi.mock('../../../hooks/use-iam-resource-access', () => ({
  useIamResourceAccess: () => ({
    read: { status: 'allowed' },
    create: { status: 'allowed' },
    update: { status: 'allowed' },
    delete: { status: 'allowed' },
  }),
  isIamAccessAllowed: (decision: { status: string }) => decision.status === 'allowed',
}));

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    to,
    children,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
  useLocation: () => ({ state: {} }),
  useNavigate: () => vi.fn(),
}));

vi.mock('../../../hooks/use-organizations', () => ({
  useOrganizations: () => useOrganizationsMock(),
}));

vi.mock('../../../lib/iam-api', async () => {
  const actual = await vi.importActual('../../../lib/iam-api');
  return {
    ...actual,
    listUsers: (...args: unknown[]) => listUsersMock(...args),
    listOrganizations: (...args: unknown[]) => listOrganizationsMock(...args),
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
  mainserverApplicationId: 'org-app-1',
  mainserverApplicationSecretSet: true,
  mainserverProvisioning: {
    status: 'failed' as const,
    technicalAccountId: 'technical-account-1',
    attemptCount: 1,
    lastErrorCode: 'missing_credentials',
    operationInProgress: false,
  },
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

const readyOrganizationFixture = {
  ...organizationFixture,
  mainserverProvisioning: {
    ...organizationFixture.mainserverProvisioning,
    status: 'ready' as const,
    lastErrorCode: undefined,
  },
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
  deleteOrganization: vi.fn().mockResolvedValue(true),
  provisionMainserver: vi.fn().mockResolvedValue(organizationFixture),
  assignMembership: vi.fn().mockResolvedValue(true),
  updateMembership: vi.fn().mockResolvedValue(true),
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
    listOrganizationsMock.mockReset();
    listUsersMock.mockResolvedValue({
      data: [],
      pagination: { page: 1, pageSize: 100, total: 0 },
    });
    listOrganizationsMock.mockResolvedValue({
      data: [
        { id: 'org-1', displayName: 'Landkreis Alpha', organizationKey: 'landkreis-alpha' },
        { id: 'parent-2', displayName: 'Landkreis Beta', organizationKey: 'landkreis-beta' },
      ],
      pagination: { page: 1, pageSize: 100, total: 2 },
    });
  });

  it('loads detail state, saves changes, manages memberships, and deletes', async () => {
    const loadOrganization = vi.fn().mockResolvedValue(organizationFixture);
    const updateOrganization = vi.fn().mockResolvedValue(true);
    const assignMembership = vi.fn().mockResolvedValue(true);
    const updateMembership = vi.fn().mockResolvedValue(true);
    const removeMembership = vi.fn().mockResolvedValue(true);
    const deleteOrganization = vi.fn().mockResolvedValue(true);
    useOrganizationsMock.mockReturnValue(
      createState({
        selectedOrganization: {
          ...organizationFixture,
          childCount: 0,
        },
        loadOrganization,
        updateOrganization,
        assignMembership,
        updateMembership,
        removeMembership,
        deleteOrganization,
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
    const searchedUsers = [
      {
        id: 'user-101',
        keycloakSubject: 'kc-user-101',
        displayName: 'Zoe Zebra',
        email: 'zoe@example.org',
        status: 'active' as const,
        roles: [],
      },
      {
        id: 'user-102',
        keycloakSubject: 'kc-user-102',
        displayName: 'Zoe Zimmer',
        email: 'zimmer@example.org',
        status: 'active' as const,
        roles: [],
      },
    ];
    listUsersMock
      .mockResolvedValueOnce({
        data: firstPageUsers,
        pagination: { page: 1, pageSize: 100, total: 100 },
      })
      .mockResolvedValueOnce({
        data: searchedUsers,
        pagination: { page: 1, pageSize: 100, total: 2 },
      });

    render(<OrganizationDetailPage organizationId="org-1" />);

    await waitFor(() => {
      expect(loadOrganization).toHaveBeenCalledWith('org-1');
    });
    await waitFor(() => {
      expect(listUsersMock).toHaveBeenCalledTimes(1);
      expect(listUsersMock).toHaveBeenCalledWith({
        page: 1,
        pageSize: 100,
        search: undefined,
        status: 'active',
      });
    });

    fireEvent.change(
      screen.getByLabelText('Technischer Schlüssel', { selector: '#organization-key' }),
      {
        target: { value: ' landkreis-alpha-neu ' },
      }
    );
    fireEvent.change(screen.getByLabelText('Anzeigename', { selector: '#organization-name' }), {
      target: { value: ' Landkreis Alpha Neu ' },
    });
    fireEvent.change(
      screen.getByLabelText('Organisationstyp', { selector: '#organization-type' }),
      {
        target: { value: 'district' },
      }
    );
    fireEvent.change(
      screen.getByLabelText('Autoren-Policy', { selector: '#organization-policy' }),
      {
        target: { value: 'org_or_personal' },
      }
    );
    fireEvent.change(
      screen.getByLabelText('Parent-Organisation', { selector: '#organization-parent' }),
      {
        target: { value: 'parent-2' },
      }
    );
    fireEvent.change(
      screen.getByLabelText('Mainserver Application-ID', {
        selector: '#organization-mainserver-app-id',
      }),
      {
        target: { value: ' org-app-2 ' },
      }
    );
    fireEvent.change(
      screen.getByLabelText('Mainserver Application-Secret', {
        selector: '#organization-mainserver-app-secret',
      }),
      {
        target: { value: ' org-secret-2 ' },
      }
    );

    expect(screen.getByText('Ein Secret ist bereits hinterlegt.')).toBeTruthy();
    expect(
      screen.getByText('Leer lassen, um das bestehende Secret unverändert zu lassen.')
    ).toBeTruthy();
    fireEvent.click(screen.getAllByRole('button', { name: 'Speichern' })[0]!);

    await waitFor(() => {
      expect(updateOrganization).toHaveBeenCalledWith('org-1', {
        organizationKey: 'landkreis-alpha-neu',
        displayName: 'Landkreis Alpha Neu',
        organizationType: 'district',
        parentOrganizationId: 'parent-2',
        contentAuthorPolicy: 'org_or_personal',
        mainserverApplicationId: 'org-app-2',
        mainserverApplicationSecret: 'org-secret-2',
      });
    });

    expect(screen.queryByRole('option', { name: 'Anna Admin <anna@example.org>' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Accounts' }));
    fireEvent.change(screen.getByPlaceholderText('Nach Name, E-Mail oder Kennung suchen'), {
      target: { value: 'zoe' },
    });
    expect(listUsersMock).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(listUsersMock).toHaveBeenCalledTimes(2);
      expect(listUsersMock).toHaveBeenLastCalledWith({
        page: 1,
        pageSize: 100,
        search: 'zoe',
        status: 'active',
      });
      expect(screen.getByRole('option', { name: 'Zoe Zebra <zoe@example.org>' })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('option', { name: 'Zoe Zebra <zoe@example.org>' }));
    fireEvent.click(screen.getByRole('option', { name: 'Zoe Zimmer <zimmer@example.org>' }));
    expect(screen.getByRole('button', { name: 'Accounts' }).textContent).toContain('2 ausgewählt');
    expect(screen.queryByText('Sichtbarkeit')).toBeNull();
    fireEvent.click(document.getElementById('membership-default') as HTMLInputElement);
    fireEvent.click(screen.getByRole('button', { name: 'Mitglieder zuweisen' }));

    await waitFor(() => {
      expect(assignMembership).toHaveBeenNthCalledWith(
        1,
        'org-1',
        {
          accountId: 'user-101',
          isDefaultContext: true,
        },
        { reload: false }
      );
      expect(assignMembership).toHaveBeenNthCalledWith(
        2,
        'org-1',
        {
          accountId: 'user-102',
          isDefaultContext: true,
        },
        { reload: false }
      );
    });

    fireEvent.click(document.getElementById('membership-default-user-1') as HTMLInputElement);
    fireEvent.click(
      screen.getByRole('button', { name: 'Mitgliedschaft für Anna Admin speichern' })
    );

    await waitFor(() => {
      expect(updateMembership).toHaveBeenCalledWith('org-1', 'user-1', {
        isDefaultContext: false,
      });
    });

    fireEvent.click(screen.getByRole('button', { name: 'Mitglied entfernen' }));
    await waitFor(() => {
      expect(removeMembership).toHaveBeenCalledWith('org-1', 'user-1');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Löschen' }));
    fireEvent.click(screen.getByRole('button', { name: 'Löschen' }));

    await waitFor(() => {
      expect(deleteOrganization).toHaveBeenCalledWith('org-1');
    });
  }, 15_000);

  it('keeps failed and unattempted accounts selected after a partial assignment failure', async () => {
    const assignMembership = vi.fn().mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    const refetch = vi.fn().mockResolvedValue(undefined);
    const loadOrganization = vi.fn().mockResolvedValue(organizationFixture);
    useOrganizationsMock.mockReturnValue(
      createState({ assignMembership, loadOrganization, refetch })
    );
    listUsersMock.mockResolvedValue({
      data: [
        {
          id: 'user-2',
          keycloakSubject: 'kc-user-2',
          displayName: 'Account Eins',
          email: 'eins@example.org',
          status: 'active',
          roles: [],
        },
        {
          id: 'user-3',
          keycloakSubject: 'kc-user-3',
          displayName: 'Account Zwei',
          email: 'zwei@example.org',
          status: 'active',
          roles: [],
        },
        {
          id: 'user-4',
          keycloakSubject: 'kc-user-4',
          displayName: 'Account Drei',
          email: 'drei@example.org',
          status: 'active',
          roles: [],
        },
      ],
      pagination: { page: 1, pageSize: 100, total: 3 },
    });

    render(<OrganizationDetailPage organizationId="org-1" />);

    await waitFor(() => expect(listUsersMock).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: 'Accounts' }));
    fireEvent.click(screen.getByRole('option', { name: 'Account Eins <eins@example.org>' }));
    fireEvent.click(screen.getByRole('option', { name: 'Account Zwei <zwei@example.org>' }));
    fireEvent.click(screen.getByRole('option', { name: 'Account Drei <drei@example.org>' }));
    fireEvent.click(screen.getByRole('button', { name: 'Mitglieder zuweisen' }));

    await waitFor(() => expect(assignMembership).toHaveBeenCalledTimes(2));
    expect(assignMembership).toHaveBeenNthCalledWith(
      1,
      'org-1',
      {
        accountId: 'user-2',
        isDefaultContext: false,
      },
      { reload: false }
    );
    expect(refetch).toHaveBeenCalledTimes(1);
    expect(loadOrganization).toHaveBeenCalledTimes(2);
    expect(assignMembership).toHaveBeenNthCalledWith(
      2,
      'org-1',
      {
        accountId: 'user-3',
        isDefaultContext: false,
      },
      { reload: false }
    );
    expect(
      screen.queryByRole('button', {
        name: 'Account Eins <eins@example.org> aus Auswahl entfernen',
      })
    ).toBeNull();
    expect(
      screen.getByRole('button', { name: 'Account Zwei <zwei@example.org> aus Auswahl entfernen' })
    ).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Account Drei <drei@example.org> aus Auswahl entfernen' })
    ).toBeTruthy();
  });

  it('allows deleting inactive leaf organizations from the detail page', async () => {
    const deleteOrganization = vi.fn().mockResolvedValue(true);
    useOrganizationsMock.mockReturnValue(
      createState({
        selectedOrganization: {
          ...organizationFixture,
          isActive: false,
          childCount: 0,
        },
        deleteOrganization,
      })
    );

    render(<OrganizationDetailPage organizationId="org-1" />);

    const deleteButton = screen.getByRole('button', { name: 'Löschen' });
    expect((deleteButton as HTMLButtonElement).disabled).toBe(false);

    fireEvent.click(deleteButton);
    fireEvent.click(screen.getByRole('button', { name: 'Löschen' }));

    await waitFor(() => expect(deleteOrganization).toHaveBeenCalledWith('org-1'));
  });

  it('sorts membership users by their rendered label', () => {
    expect(
      sortMembershipUsersByLabel([
        {
          id: 'user-2',
          keycloakSubject: 'kc-user-2',
          displayName: 'Zoe Zebra',
          email: 'zoe@example.org',
          status: 'active',
          isTechnicalAccount: false,
          mainserverUserApplicationSecretSet: false,
          roles: [],
        },
        {
          id: 'user-1',
          keycloakSubject: 'kc-user-1',
          displayName: 'Anna Admin',
          email: 'anna@example.org',
          status: 'active',
          isTechnicalAccount: false,
          mainserverUserApplicationSecretSet: false,
          roles: [],
        },
      ])
    ).toMatchObject([{ id: 'user-1' }, { id: 'user-2' }]);
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
    expect(screen.getByRole('link', { name: 'Zur Organisationsliste' }).getAttribute('href')).toBe(
      '/admin/organizations'
    );
  });

  it('shows the secret-free provisioning state and starts an explicit retry', async () => {
    const provisionMainserver = vi.fn().mockResolvedValue(readyOrganizationFixture);
    useOrganizationsMock.mockReturnValue(createState({ provisionMainserver }));

    render(<OrganizationDetailPage organizationId="org-1" />);

    expect(screen.getByText('Fehlgeschlagen')).toBeTruthy();
    expect(screen.getByText('technical-account-1')).toBeTruthy();
    expect(screen.getByText('Letzter sicherer Fehlercode: missing_credentials')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Mainserver-Zugang provisionieren' }));

    await waitFor(() => {
      expect(provisionMainserver).toHaveBeenCalledWith('org-1');
    });
    expect(
      await screen.findByText('Die Mainserver-Daten wurden geprüft und sind aktuell.')
    ).toBeTruthy();
  });

  it('does not confirm a failed Mainserver provisioning result as current', async () => {
    const provisionMainserver = vi.fn().mockResolvedValue(organizationFixture);
    useOrganizationsMock.mockReturnValue(createState({ provisionMainserver }));

    render(<OrganizationDetailPage organizationId="org-1" />);
    fireEvent.click(screen.getByRole('button', { name: 'Mainserver-Zugang provisionieren' }));

    await waitFor(() => {
      expect(provisionMainserver).toHaveBeenCalledWith('org-1');
    });
    expect(screen.queryByText('Die Mainserver-Daten wurden geprüft und sind aktuell.')).toBeNull();
  });

  it('allows an authorized user to refresh an already ready Mainserver access', async () => {
    const provisionMainserver = vi.fn().mockResolvedValue(readyOrganizationFixture);
    useOrganizationsMock.mockReturnValue(
      createState({ selectedOrganization: readyOrganizationFixture, provisionMainserver })
    );

    render(<OrganizationDetailPage organizationId="org-1" />);
    fireEvent.click(screen.getByRole('button', { name: 'Mainserver-Daten aktualisieren' }));

    await waitFor(() => {
      expect(provisionMainserver).toHaveBeenCalledWith('org-1');
    });
  });

  it('loads parent options across multiple organization pages for reassignment', async () => {
    const loadOrganization = vi.fn().mockResolvedValue(organizationFixture);
    const updateOrganization = vi.fn().mockResolvedValue(true);
    useOrganizationsMock.mockReturnValue(
      createState({
        organizations: [organizationFixture],
        loadOrganization,
        updateOrganization,
      })
    );
    listOrganizationsMock
      .mockResolvedValueOnce({
        data: [{ id: 'org-1', displayName: 'Landkreis Alpha', organizationKey: 'landkreis-alpha' }],
        pagination: { page: 1, pageSize: 100, total: 101 },
      })
      .mockResolvedValueOnce({
        data: [
          { id: 'parent-2', displayName: 'Landkreis Beta', organizationKey: 'landkreis-beta' },
        ],
        pagination: { page: 2, pageSize: 100, total: 101 },
      });

    render(<OrganizationDetailPage organizationId="org-1" />);

    await waitFor(() => {
      expect(listOrganizationsMock).toHaveBeenNthCalledWith(1, {
        page: 1,
        pageSize: 100,
        sortBy: 'displayName',
        sortDirection: 'asc',
      });
      expect(listOrganizationsMock).toHaveBeenNthCalledWith(2, {
        page: 2,
        pageSize: 100,
        sortBy: 'displayName',
        sortDirection: 'asc',
      });
      expect(screen.getByRole('option', { name: 'Landkreis Beta' })).toBeTruthy();
    });

    fireEvent.change(
      screen.getByLabelText('Parent-Organisation', { selector: '#organization-parent' }),
      {
        target: { value: 'parent-2' },
      }
    );
    fireEvent.click(screen.getAllByRole('button', { name: 'Speichern' })[0]!);

    await waitFor(() => {
      expect(updateOrganization).toHaveBeenCalledWith(
        'org-1',
        expect.objectContaining({
          parentOrganizationId: 'parent-2',
        })
      );
    });
  });
});
