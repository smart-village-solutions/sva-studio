import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { IamHttpError } from '../../../lib/iam-api';
import { OrganizationsPage } from './-organizations-page';

const useOrganizationsMock = vi.fn();
const useUsersMock = vi.fn();

vi.mock('../../../hooks/use-organizations', () => ({
  useOrganizations: () => useOrganizationsMock(),
}));

vi.mock('../../../hooks/use-users', () => ({
  useUsers: () => useUsersMock(),
}));

const createOrganizationsApiState = (overrides: Record<string, unknown> = {}) => ({
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
  createOrganization: vi.fn(),
  updateOrganization: vi.fn(),
  deactivateOrganization: vi.fn(),
  assignMembership: vi.fn(),
  removeMembership: vi.fn(),
  ...overrides,
});

const createUsersApiState = (overrides: Record<string, unknown> = {}) => ({
  users: [],
  ...overrides,
});

describe('OrganizationsPage', () => {
  afterEach(() => {
    cleanup();
    useOrganizationsMock.mockReset();
    useUsersMock.mockReset();
  });

  it('renders the organization list with hierarchy and status information', () => {
    useOrganizationsMock.mockReturnValue(
      createOrganizationsApiState({
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
      }),
    );
    useUsersMock.mockReturnValue(createUsersApiState());

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

    useOrganizationsMock.mockReturnValue(
      createOrganizationsApiState({
        createOrganization,
      }),
    );
    useUsersMock.mockReturnValue(createUsersApiState());

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
    fireEvent.submit(createForm as HTMLFormElement);

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

  it.each([
    ['forbidden', 'Unzureichende Berechtigungen für diese Organisationsaktion.'],
    ['csrf_validation_failed', 'Sicherheitsprüfung fehlgeschlagen. Bitte Seite neu laden und erneut versuchen.'],
    ['rate_limited', 'Zu viele Anfragen in kurzer Zeit. Bitte kurz warten und erneut versuchen.'],
    ['conflict', 'Die Organisationsänderung steht in Konflikt mit dem aktuellen Zustand.'],
    ['invalid_organization_id', 'Die angegebene Organisation ist ungültig.'],
    ['organization_inactive', 'Inaktive Organisationen können für diese Aktion nicht verwendet werden.'],
    ['database_unavailable', 'Die IAM-Datenbank ist derzeit nicht erreichbar. Bitte später erneut versuchen.'],
  ])('renders API error feedback for %s and forwards filter actions', (code, message) => {
    const refetch = vi.fn();
    const setSearch = vi.fn();
    const setOrganizationType = vi.fn();
    const setStatus = vi.fn();
    const setPage = vi.fn();

    useOrganizationsMock.mockReturnValue(
      createOrganizationsApiState({
        error: new IamHttpError({
          status: 400,
          code,
          message: code,
        }),
        total: 52,
        page: 2,
        pageSize: 25,
        setSearch,
        setOrganizationType,
        setStatus,
        setPage,
        refetch,
      }),
    );
    useUsersMock.mockReturnValue(createUsersApiState());

    render(<OrganizationsPage />);

    expect(screen.getByRole('alert').textContent).toContain(message);

    fireEvent.change(screen.getByLabelText('Suche'), { target: { value: 'Alpha' } });
    fireEvent.change(screen.getByLabelText('Typ'), { target: { value: 'county' } });
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'active' } });
    fireEvent.click(screen.getByRole('button', { name: 'Erneut versuchen' }));
    fireEvent.click(screen.getByRole('button', { name: 'Zurück' }));
    fireEvent.click(screen.getByRole('button', { name: 'Weiter' }));

    expect(setSearch).toHaveBeenCalledWith('Alpha');
    expect(setOrganizationType).toHaveBeenCalledWith('county');
    expect(setStatus).toHaveBeenCalledWith('active');
    expect(refetch).toHaveBeenCalled();
    expect(setPage).toHaveBeenNthCalledWith(1, 1);
    expect(setPage).toHaveBeenNthCalledWith(2, 3);
  });

  it('loads organization details for editing and submits the update payload', async () => {
    const updateOrganization = vi.fn().mockResolvedValue(true);
    const loadOrganization = vi.fn().mockResolvedValue({
      id: 'org-2',
      organizationKey: 'gemeinde-beta',
      displayName: 'Gemeinde Beta',
      parentOrganizationId: 'org-1',
      contentAuthorPolicy: 'org_or_personal',
      organizationType: 'municipality',
      memberships: [],
    });

    useOrganizationsMock.mockReturnValue(
      createOrganizationsApiState({
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
            childCount: 1,
            membershipCount: 3,
          },
          {
            id: 'org-2',
            organizationKey: 'gemeinde-beta',
            displayName: 'Gemeinde Beta',
            parentOrganizationId: 'org-1',
            parentDisplayName: 'Landkreis Alpha',
            organizationType: 'municipality',
            contentAuthorPolicy: 'org_or_personal',
            isActive: true,
            depth: 1,
            hierarchyPath: ['org-1'],
            childCount: 0,
            membershipCount: 1,
          },
        ],
        total: 2,
        loadOrganization,
        updateOrganization,
      }),
    );
    useUsersMock.mockReturnValue(createUsersApiState());

    render(<OrganizationsPage />);

    fireEvent.click(screen.getAllByRole('button', { name: 'Bearbeiten' })[1]);

    const dialog = await screen.findByRole('dialog', { name: 'Organisation bearbeiten' });
    expect((within(dialog).getByLabelText('Technischer Schlüssel') as HTMLInputElement).value).toBe('gemeinde-beta');
    expect((within(dialog).getByLabelText('Anzeigename') as HTMLInputElement).value).toBe('Gemeinde Beta');
    expect((within(dialog).getByLabelText('Organisationstyp') as HTMLSelectElement).value).toBe('municipality');
    expect((within(dialog).getByLabelText('Parent-Organisation') as HTMLSelectElement).value).toBe('org-1');
    expect((within(dialog).getByLabelText('Autoren-Policy') as HTMLSelectElement).value).toBe('org_or_personal');

    const displayNameInput = within(dialog).getByLabelText('Anzeigename') as HTMLInputElement;
    fireEvent.input(displayNameInput, {
      target: { value: ' Gemeinde Beta Neu ' },
    });
    expect(displayNameInput.value).toBe(' Gemeinde Beta Neu ');
    fireEvent.change(within(dialog).getByLabelText('Parent-Organisation'), {
      target: { value: '' },
    });

    const editForm = within(dialog).getByRole('button', { name: 'Speichern' }).closest('form');
    expect(editForm).not.toBeNull();
    fireEvent.submit(editForm!);

    await waitFor(() => {
      expect(updateOrganization).toHaveBeenCalledWith('org-2', {
        organizationKey: 'gemeinde-beta',
        displayName: 'Gemeinde Beta Neu',
        organizationType: 'municipality',
        parentOrganizationId: undefined,
        contentAuthorPolicy: 'org_or_personal',
      });
    });

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Organisation bearbeiten' })).toBeNull();
    });
  });

  it('keeps the edit dialog closed when organization details cannot be loaded', async () => {
    const loadOrganization = vi.fn().mockResolvedValue(null);

    useOrganizationsMock.mockReturnValue(
      createOrganizationsApiState({
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
            childCount: 0,
            membershipCount: 0,
          },
        ],
        total: 1,
        loadOrganization,
      }),
    );
    useUsersMock.mockReturnValue(createUsersApiState());

    render(<OrganizationsPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Bearbeiten' }));

    await waitFor(() => {
      expect(loadOrganization).toHaveBeenCalledWith('org-1');
    });
    expect(screen.queryByRole('dialog', { name: 'Organisation bearbeiten' })).toBeNull();
  });

  it('manages memberships including default context and removal', async () => {
    const assignMembership = vi.fn().mockResolvedValue(true);
    const removeMembership = vi.fn();
    const clearSelectedOrganization = vi.fn();
    const loadOrganization = vi.fn().mockResolvedValue({
      id: 'org-1',
      organizationKey: 'landkreis-alpha',
      displayName: 'Landkreis Alpha',
      parentOrganizationId: undefined,
      contentAuthorPolicy: 'org_only',
      organizationType: 'county',
      memberships: [
        {
          accountId: 'account-2',
          displayName: 'Bestehender Account',
          email: 'bestehend@example.org',
          keycloakSubject: 'kc-existing',
          visibility: 'external',
          isDefaultContext: true,
        },
      ],
    });

    useOrganizationsMock.mockReturnValue(
      createOrganizationsApiState({
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
            childCount: 0,
            membershipCount: 1,
          },
        ],
        total: 1,
        selectedOrganization: {
          id: 'org-1',
          organizationKey: 'landkreis-alpha',
          displayName: 'Landkreis Alpha',
          parentOrganizationId: undefined,
          contentAuthorPolicy: 'org_only',
          organizationType: 'county',
          memberships: [
            {
              accountId: 'account-2',
              displayName: 'Bestehender Account',
              email: 'bestehend@example.org',
              keycloakSubject: 'kc-existing',
              visibility: 'external',
              isDefaultContext: true,
            },
          ],
        },
        loadOrganization,
        assignMembership,
        removeMembership,
        clearSelectedOrganization,
      }),
    );
    useUsersMock.mockReturnValue(
      createUsersApiState({
        users: [
          {
            id: 'account-1',
            displayName: 'Neuer Account',
          },
        ],
      }),
    );

    render(<OrganizationsPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Mitglieder verwalten' }));

    const dialog = await screen.findByRole('dialog', { name: 'Mitgliedschaften verwalten' });
    expect(dialog.textContent).toContain('Mitglieder von Landkreis Alpha zuordnen oder entfernen.');
    expect(within(dialog).getByText('Bestehender Account')).toBeTruthy();
    expect(within(dialog).getByText('Default')).toBeTruthy();
    expect(within(dialog).getAllByText('Extern').length).toBeGreaterThan(0);

    fireEvent.change(within(dialog).getByLabelText('Account'), {
      target: { value: 'account-1' },
    });
    fireEvent.change(within(dialog).getByLabelText('Sichtbarkeit'), {
      target: { value: 'external' },
    });
    fireEvent.click(within(dialog).getByLabelText('Als Default-Kontext setzen'));

    const membershipForm = within(dialog).getByRole('button', { name: 'Mitglied zuweisen' }).closest('form');
    expect(membershipForm).not.toBeNull();
    fireEvent.submit(membershipForm!);

    await waitFor(() => {
      expect(assignMembership).toHaveBeenCalledWith('org-1', {
        accountId: 'account-1',
        visibility: 'external',
        isDefaultContext: true,
      });
    });

    fireEvent.click(within(dialog).getByRole('button', { name: 'Mitglied entfernen' }));
    expect(removeMembership).toHaveBeenCalledWith('org-1', 'account-2');
  });

  it('deactivates active organizations via the confirmation dialog', async () => {
    const deactivateOrganization = vi.fn().mockResolvedValue(true);

    useOrganizationsMock.mockReturnValue(
      createOrganizationsApiState({
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
            childCount: 0,
            membershipCount: 0,
          },
        ],
        total: 1,
        deactivateOrganization,
      }),
    );
    useUsersMock.mockReturnValue(createUsersApiState());

    render(<OrganizationsPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Deaktivieren' }));

    const dialog = await screen.findByRole('alertdialog', { name: 'Organisation deaktivieren' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Deaktivieren' }));

    await waitFor(() => {
      expect(deactivateOrganization).toHaveBeenCalledWith('org-1');
    });

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Organisation deaktivieren' })).toBeNull();
    });
  });

  it('renders mutation errors inside the create dialog', () => {
    useOrganizationsMock.mockReturnValue(
      createOrganizationsApiState({
        mutationError: new IamHttpError({
          status: 409,
          code: 'invalid_organization_id',
          message: 'invalid_organization_id',
        }),
        selectedOrganization: {
          id: 'org-1',
          organizationKey: 'landkreis-alpha',
          displayName: 'Landkreis Alpha',
          parentOrganizationId: undefined,
          contentAuthorPolicy: 'org_only',
          organizationType: 'county',
          memberships: [],
        },
      }),
    );
    useUsersMock.mockReturnValue(createUsersApiState());

    render(<OrganizationsPage />);

    fireEvent.click(screen.getAllByRole('button', { name: 'Organisation anlegen' })[0]);
    expect(screen.getByRole('alert').textContent).toContain('Die angegebene Organisation ist ungültig.');
  });

  it('renders membership empty states and dialog-level mutation errors', async () => {
    const loadOrganization = vi.fn().mockResolvedValue({
      id: 'org-1',
      organizationKey: 'landkreis-alpha',
      displayName: 'Landkreis Alpha',
      parentOrganizationId: undefined,
      contentAuthorPolicy: 'org_only',
      organizationType: 'county',
      memberships: [],
    });

    useOrganizationsMock.mockReturnValue(
      createOrganizationsApiState({
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
            childCount: 0,
            membershipCount: 0,
          },
        ],
        total: 1,
        mutationError: new IamHttpError({
          status: 409,
          code: 'database_unavailable',
          message: 'database_unavailable',
        }),
        loadOrganization,
        selectedOrganization: {
          id: 'org-1',
          organizationKey: 'landkreis-alpha',
          displayName: 'Landkreis Alpha',
          parentOrganizationId: undefined,
          contentAuthorPolicy: 'org_only',
          organizationType: 'county',
          memberships: [],
        },
      }),
    );
    useUsersMock.mockReturnValue(createUsersApiState());

    render(<OrganizationsPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Mitglieder verwalten' }));

    const dialog = await screen.findByRole('dialog', { name: 'Mitgliedschaften verwalten' });
    expect(dialog.textContent).toContain('Die IAM-Datenbank ist derzeit nicht erreichbar. Bitte später erneut versuchen.');
    expect(dialog.textContent).toContain('Noch keine Mitgliedschaften vorhanden.');
  });
});
