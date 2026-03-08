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
});
