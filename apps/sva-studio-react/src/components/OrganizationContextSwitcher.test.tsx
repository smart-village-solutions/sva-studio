import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { IamHttpError } from '../lib/iam-api';
import { OrganizationContextSwitcher } from './OrganizationContextSwitcher';

const useOrganizationContextMock = vi.fn();

vi.mock('../hooks/use-organization-context', () => ({
  useOrganizationContext: () => useOrganizationContextMock(),
}));

describe('OrganizationContextSwitcher', () => {
  afterEach(() => {
    cleanup();
    useOrganizationContextMock.mockReset();
  });

  it('renders nothing when only one active organization is available', () => {
    useOrganizationContextMock.mockReturnValue({
      context: {
        activeOrganizationId: 'org-1',
        organizations: [
          {
            organizationId: 'org-1',
            organizationKey: 'alpha',
            displayName: 'Alpha',
            organizationType: 'county',
            isActive: true,
            isDefaultContext: true,
          },
        ],
      },
      isLoading: false,
      isUpdating: false,
      error: null,
      refetch: vi.fn(),
      switchOrganization: vi.fn(),
    });

    render(<OrganizationContextSwitcher />);

    expect(screen.queryByLabelText('Aktive Organisation')).toBeNull();
  });

  it('switches the active organization when a different option is selected', () => {
    const switchOrganization = vi.fn().mockResolvedValue(true);

    useOrganizationContextMock.mockReturnValue({
      context: {
        activeOrganizationId: 'org-1',
        organizations: [
          {
            organizationId: 'org-1',
            organizationKey: 'alpha',
            displayName: 'Alpha',
            organizationType: 'county',
            isActive: true,
            isDefaultContext: true,
          },
          {
            organizationId: 'org-2',
            organizationKey: 'beta',
            displayName: 'Beta',
            organizationType: 'municipality',
            isActive: true,
            isDefaultContext: false,
          },
        ],
      },
      isLoading: false,
      isUpdating: false,
      error: null,
      refetch: vi.fn(),
      switchOrganization,
    });

    render(<OrganizationContextSwitcher />);

    fireEvent.change(screen.getByLabelText('Aktive Organisation'), {
      target: { value: 'org-2' },
    });

    expect(switchOrganization).toHaveBeenCalledWith('org-2');
  });

  it('renders the current organization in a live status region', () => {
    useOrganizationContextMock.mockReturnValue({
      context: {
        activeOrganizationId: 'org-2',
        organizations: [
          {
            organizationId: 'org-1',
            organizationKey: 'alpha',
            displayName: 'Alpha',
            organizationType: 'county',
            isActive: true,
            isDefaultContext: false,
          },
          {
            organizationId: 'org-2',
            organizationKey: 'beta',
            displayName: 'Beta',
            organizationType: 'municipality',
            isActive: true,
            isDefaultContext: true,
          },
        ],
      },
      isLoading: false,
      isUpdating: false,
      error: null,
      refetch: vi.fn(),
      switchOrganization: vi.fn(),
    });

    render(<OrganizationContextSwitcher />);

    expect(screen.getByRole('status').textContent).toContain('Aktiver Organisationskontext: Beta');
  });

  it('does not render organization metadata below the selector', () => {
    useOrganizationContextMock.mockReturnValue({
      context: {
        activeOrganizationId: 'org-2',
        organizations: [
          {
            organizationId: 'org-1',
            organizationKey: 'alpha',
            displayName: 'Alpha',
            organizationType: 'county',
            isActive: true,
            isDefaultContext: false,
          },
          {
            organizationId: 'org-2',
            organizationKey: 'beta',
            displayName: 'Beta',
            organizationType: 'municipality',
            isActive: true,
            isDefaultContext: true,
          },
        ],
      },
      isLoading: false,
      isUpdating: false,
      error: null,
      refetch: vi.fn(),
      switchOrganization: vi.fn(),
    });

    render(<OrganizationContextSwitcher variant="menu" />);

    expect(screen.queryByText('beta · municipality · Default-Kontext')).toBeNull();
  });

  it('renders a visible error message when switching the context fails', () => {
    useOrganizationContextMock.mockReturnValue({
      context: {
        activeOrganizationId: 'org-1',
        organizations: [
          {
            organizationId: 'org-1',
            organizationKey: 'alpha',
            displayName: 'Alpha',
            organizationType: 'county',
            isActive: true,
            isDefaultContext: true,
          },
          {
            organizationId: 'org-2',
            organizationKey: 'beta',
            displayName: 'Beta',
            organizationType: 'municipality',
            isActive: true,
            isDefaultContext: false,
          },
        ],
      },
      isLoading: false,
      isUpdating: false,
      error: new IamHttpError({
        status: 409,
        code: 'organization_inactive',
        message: 'inactive',
      }),
      refetch: vi.fn(),
      switchOrganization: vi.fn(),
    });

    render(<OrganizationContextSwitcher />);

    expect(screen.getByRole('alert').textContent).toContain(
      'Inaktive Organisationen können nicht als aktiver Kontext gesetzt werden.'
    );
  });

  it('renders the invalid-organization error variant', () => {
    useOrganizationContextMock.mockReturnValue({
      context: {
        activeOrganizationId: 'org-1',
        organizations: [
          {
            organizationId: 'org-1',
            organizationKey: 'alpha',
            displayName: 'Alpha',
            organizationType: 'county',
            isActive: true,
            isDefaultContext: true,
          },
          {
            organizationId: 'org-2',
            organizationKey: 'beta',
            displayName: 'Beta',
            organizationType: 'municipality',
            isActive: true,
            isDefaultContext: false,
          },
        ],
      },
      isLoading: false,
      isUpdating: false,
      error: new IamHttpError({
        status: 400,
        code: 'invalid_organization_id',
        message: 'invalid',
      }),
      refetch: vi.fn(),
      switchOrganization: vi.fn(),
    });

    render(<OrganizationContextSwitcher />);

    expect(screen.getByRole('alert').textContent).toContain(
      'Diese Organisation steht im aktuellen Kontext nicht zur Auswahl.'
    );
  });

  it('ignores empty organization selections', () => {
    const switchOrganization = vi.fn();

    useOrganizationContextMock.mockReturnValue({
      context: {
        activeOrganizationId: 'org-1',
        organizations: [
          {
            organizationId: 'org-1',
            organizationKey: 'alpha',
            displayName: 'Alpha',
            organizationType: 'county',
            isActive: true,
            isDefaultContext: true,
          },
          {
            organizationId: 'org-2',
            organizationKey: 'beta',
            displayName: 'Beta',
            organizationType: 'municipality',
            isActive: true,
            isDefaultContext: false,
          },
        ],
      },
      isLoading: false,
      isUpdating: false,
      error: null,
      refetch: vi.fn(),
      switchOrganization,
    });

    render(<OrganizationContextSwitcher />);

    fireEvent.change(screen.getByLabelText('Aktive Organisation'), {
      target: { value: '' },
    });

    expect(switchOrganization).not.toHaveBeenCalled();
  });

  it('renders a compact menu layout variant for dropdown usage', () => {
    useOrganizationContextMock.mockReturnValue({
      context: {
        activeOrganizationId: 'org-2',
        organizations: [
          {
            organizationId: 'org-1',
            organizationKey: 'alpha',
            displayName: 'Alpha',
            organizationType: 'county',
            isActive: true,
            isDefaultContext: false,
          },
          {
            organizationId: 'org-2',
            organizationKey: 'beta',
            displayName: 'Beta',
            organizationType: 'municipality',
            isActive: true,
            isDefaultContext: true,
          },
        ],
      },
      isLoading: false,
      isUpdating: false,
      error: null,
      refetch: vi.fn(),
      switchOrganization: vi.fn(),
    });

    render(<OrganizationContextSwitcher variant="menu" />);

    const select = screen.getByLabelText('Aktive Organisation');
    expect(select.className).toContain('w-full');
    expect(select.className).toContain('rounded-lg');
    expect(screen.queryByText('beta · municipality · Default-Kontext')).toBeNull();
  });

  it('renders organization memberships in the menu even when only one active organization exists', () => {
    useOrganizationContextMock.mockReturnValue({
      context: {
        activeOrganizationId: 'org-1',
        organizations: [
          {
            organizationId: 'org-1',
            organizationKey: 'alpha',
            displayName: 'Alpha',
            organizationType: 'county',
            isActive: true,
            isDefaultContext: true,
          },
        ],
      },
      isLoading: false,
      isUpdating: false,
      error: null,
      refetch: vi.fn(),
      switchOrganization: vi.fn(),
    });

    render(<OrganizationContextSwitcher variant="menu" />);

    expect(screen.getByText('Organisationsmitgliedschaften')).toBeTruthy();
    expect(screen.getByText('Alpha')).toBeTruthy();
  });

  it('renders system_admin memberships as read-only without a selector', () => {
    useOrganizationContextMock.mockReturnValue({
      context: {
        activeOrganizationId: undefined,
        organizations: [
          {
            organizationId: 'org-1',
            organizationKey: 'alpha',
            displayName: 'Alpha',
            organizationType: 'county',
            isActive: true,
            isDefaultContext: true,
          },
          {
            organizationId: 'org-2',
            organizationKey: 'beta',
            displayName: 'Beta',
            organizationType: 'municipality',
            isActive: true,
            isDefaultContext: false,
          },
        ],
      },
      isLoading: false,
      isUpdating: false,
      error: null,
      refetch: vi.fn(),
      switchOrganization: vi.fn(),
    });

    render(<OrganizationContextSwitcher variant="menu" readOnly />);

    expect(screen.queryByLabelText('Aktive Organisation')).toBeNull();
    expect(screen.getByText('Organisationsmitgliedschaften')).toBeTruthy();
    expect(screen.getByText('Als Systemadmin arbeiten Sie instanzweit; Organisationsmitgliedschaften schränken Ihre Rechte nicht ein.')).toBeTruthy();
    expect(screen.getByText('Alpha')).toBeTruthy();
    expect(screen.getByText('Beta')).toBeTruthy();
  });

  it('does not announce a stale active organization in read-only mode', () => {
    useOrganizationContextMock.mockReturnValue({
      context: {
        activeOrganizationId: 'org-1',
        organizations: [
          {
            organizationId: 'org-1',
            organizationKey: 'alpha',
            displayName: 'Alpha',
            organizationType: 'county',
            isActive: true,
            isDefaultContext: true,
          },
        ],
      },
      isLoading: false,
      isUpdating: false,
      error: null,
      refetch: vi.fn(),
      switchOrganization: vi.fn(),
    });

    render(<OrganizationContextSwitcher variant="menu" readOnly />);

    expect(screen.getByRole('status').textContent).toBe('');
  });
});
